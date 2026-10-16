import crypto from 'node:crypto';
import { type OrderStatus, type PaymentStatus, Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import {
  getPaymentProvider,
  type PaymentInitResult,
  type PaymentOrderInfo,
} from '../../payments/index.js';
import {
  type MomoOutcome,
  type MomoTransaction,
  momoOutcome,
  orderCodeFromMomoOrderId,
  queryMomoTransaction,
} from '../../payments/momo.js';
import { reserveOrderItem, restoreOrderInventory } from '../inventory/inventory.service.js';
import type { AdminOrderListQuery, OrderCreateInput, OrderListQuery } from './order.schema.js';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'chờ xác nhận',
  CONFIRMED: 'đã xác nhận',
  SHIPPING: 'đang giao',
  DELIVERED: 'đã giao',
  CANCELLED: 'đã huỷ',
};

/**
 * Đơn chỉ đi tới, không lùi. Cho phép nhảy tuỳ ý sẽ dẫn tới cảnh đơn đã giao
 * bị kéo về "chờ xác nhận" rồi huỷ, làm tồn kho được hoàn hai lần.
 */
const ADMIN_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

const CUSTOMER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CANCELLED'],
  CONFIRMED: [],
  SHIPPING: [],
  DELIVERED: [],
  CANCELLED: [],
};

const orderInclude = {
  items: { orderBy: { id: 'asc' } },
} satisfies Prisma.OrderInclude;

const statusHistorySelect = {
  id: true,
  type: true,
  fromStatus: true,
  toStatus: true,
  actorType: true,
  actorUserId: true,
  reason: true,
  occurredAt: true,
  recordedAt: true,
} satisfies Prisma.OrderStatusHistorySelect;

const orderDetailInclude = {
  ...orderInclude,
  statusHistory: {
    select: statusHistorySelect,
    orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.OrderInclude;

/** Mã đơn dạng DH20260726-00042 — có ngày để tra tay, có id để không trùng. */
function buildOrderCode(id: number, createdAt: Date): string {
  const yyyymmdd = [
    createdAt.getFullYear(),
    String(createdAt.getMonth() + 1).padStart(2, '0'),
    String(createdAt.getDate()).padStart(2, '0'),
  ].join('');
  return `DH${yyyymmdd}-${String(id).padStart(5, '0')}`;
}

export async function createOrder(userId: number, input: OrderCreateInput) {
  const provider = getPaymentProvider(input.paymentMethod);

  // Kiểm tra trước khi chạm database. Nếu để tới giữa transaction mới phát
  // hiện thì tồn kho đã bị trừ cho một đơn không thể thanh toán.
  if (!provider.implemented) {
    throw new AppError(
      501,
      'PAYMENT_NOT_IMPLEMENTED',
      `Phương thức thanh toán ${input.paymentMethod} chưa được đấu nối. Vui lòng chọn thanh toán khi nhận hàng (COD).`,
    );
  }

  const order = await prisma.$transaction(async (tx) => {
    const address = await tx.address.findUnique({ where: { id: input.addressId } });
    if (!address || address.userId !== userId) {
      throw AppError.badRequest('ADDRESS_NOT_FOUND', 'Không tìm thấy địa chỉ giao hàng này.');
    }

    const variantInclude = {
      product: {
        include: {
          images: { select: { thumbUrl: true }, orderBy: { sortOrder: 'asc' as const }, take: 1 },
        },
      },
    } satisfies Prisma.ProductVariantInclude;

    // Mua ngay chỉ đặt đúng biến thể khách vừa chọn. Giỏ hàng giữ nguyên.
    const buyNowVariant = input.buyNow
      ? await tx.productVariant.findUnique({
          where: { id: input.buyNow.variantId },
          include: variantInclude,
        })
      : null;

    if (input.buyNow && (!buyNowVariant || !buyNowVariant.product.isActive)) {
      throw AppError.notFound('Sản phẩm không tồn tại hoặc đã ngừng bán.');
    }

    const cart = input.buyNow
      ? null
      : await tx.cart.findUnique({
          where: { userId },
          include: {
            items: {
              orderBy: { createdAt: 'asc' },
              include: { variant: { include: variantInclude } },
            },
          },
        });

    const sources = input.buyNow
      ? [{ quantity: input.buyNow.quantity, variant: buyNowVariant! }]
      : (cart?.items ?? []).map((item) => ({ quantity: item.quantity, variant: item.variant }));

    if (sources.length === 0) {
      throw AppError.badRequest('CART_EMPTY', 'Giỏ hàng đang trống.');
    }

    let subtotal = 0;
    const itemsToCreate: Prisma.OrderItemCreateWithoutOrderInput[] = [];

    for (const item of sources) {
      const variant = item.variant;
      const product = variant.product;

      if (!product.isActive) {
        throw AppError.conflict(
          'PRODUCT_UNAVAILABLE',
          `"${product.name}" đã ngừng bán. Vui lòng bỏ khỏi giỏ hàng rồi đặt lại.`,
        );
      }

      // Chụp lại tên, ảnh, giá và size/màu tại thời điểm mua để lịch sử đơn
      // không đổi khi admin sửa hoặc xoá sản phẩm/biến thể về sau.
      const lineTotal = product.price * item.quantity;
      subtotal += lineTotal;
      itemsToCreate.push({
        product: { connect: { id: product.id } },
        variant: { connect: { id: variant.id } },
        productName: product.name,
        productImage: product.images[0]?.thumbUrl ?? null,
        size: variant.size,
        color: variant.color,
        unitPrice: product.price,
        quantity: item.quantity,
        lineTotal,
      });
    }

    const shippingFee = env.SHIPPING_FEE;

    const created = await tx.order.create({
      data: {
        // Mã thật cần id nên tạm dùng chuỗi ngẫu nhiên rồi cập nhật ngay bên
        // dưới. Cột code là UNIQUE nên không thể để trống.
        code: `tmp-${crypto.randomBytes(8).toString('hex')}`,
        userId,
        paymentMethod: input.paymentMethod,
        subtotal,
        shippingFee,
        total: subtotal + shippingFee,
        receiverName: address.fullName,
        receiverPhone: address.phone,
        shippingLine1: address.line1,
        shippingWard: address.ward,
        shippingDistrict: address.district,
        shippingProvince: address.province,
        note: input.note ?? null,
        items: { create: itemsToCreate },
      },
      include: orderInclude,
    });

    // OrderItem phải có id trước khi ghi ledger để operationKey của mỗi lần giữ hàng ổn định.
    // Khoá các biến thể theo id tăng dần để giảm nguy cơ deadlock giữa hai giỏ có cùng mặt hàng.
    for (const source of [...sources].sort((a, b) => a.variant.id - b.variant.id)) {
      const orderItem = created.items.find((item) => item.variantId === source.variant.id);
      if (!orderItem) {
        throw new Error(`Không ghép được OrderItem với variant ${source.variant.id}.`);
      }
      await reserveOrderItem(tx, {
        orderId: created.id,
        orderItemId: orderItem.id,
        variantId: source.variant.id,
        productName: orderItem.productName,
        size: orderItem.size ?? source.variant.size,
        color: orderItem.color ?? source.variant.color,
        quantity: orderItem.quantity,
        actor: { type: 'CUSTOMER', userId },
      });
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: created.id,
        type: 'CREATED',
        fromStatus: null,
        toStatus: 'PENDING',
        actorType: 'CUSTOMER',
        actorUserId: userId,
        occurredAt: created.createdAt,
        operationKey: `ORDER_CREATED:${created.id}`,
      },
    });

    if (cart) {
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

    return tx.order.update({
      where: { id: created.id },
      data: { code: buildOrderCode(created.id, created.createdAt) },
      include: orderDetailInclude,
    });
  });

  // Gọi ra ngoài đặt sau transaction: chờ mạng trong transaction sẽ giữ khoá
  // hàng loạt dòng sản phẩm suốt thời gian đó.
  let payment: PaymentInitResult;
  try {
    payment = await provider.initiate(paymentInfoOf(order));
  } catch (error) {
    // Đơn và phần giữ hàng đã ghi xong nên không được báo lỗi như thể chưa đặt:
    // trả đơn về để khách thanh toán lại hoặc tự huỷ ở trang chi tiết đơn.
    if (error instanceof AppError) return { order, paymentError: error.message };
    throw error;
  }

  const result =
    payment.paymentStatus === order.paymentStatus
      ? order
      : await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: payment.paymentStatus },
          include: orderDetailInclude,
        });

  return { order: result, paymentUrl: payment.redirectUrl };
}

function paymentInfoOf(order: { code: string; total: number }): PaymentOrderInfo {
  return {
    code: order.code,
    total: order.total,
    description: `Thanh toan don hang ${order.code}`,
  };
}

/** Đơn MoMo còn chờ xử lý hoặc đã xác nhận thì khách vẫn thanh toán (lại) được. */
const MOMO_PAYABLE_STATUSES: OrderStatus[] = ['PENDING', 'CONFIRMED'];

export async function startMomoPayment(userId: number, code: string) {
  const order = await getMyOrder(userId, code);

  if (order.paymentMethod !== 'MOMO') {
    throw AppError.conflict('PAYMENT_METHOD_MISMATCH', 'Đơn hàng này không thanh toán qua MoMo.');
  }
  if (order.paymentStatus === 'PAID') {
    throw AppError.conflict('ORDER_ALREADY_PAID', 'Đơn hàng đã được thanh toán.');
  }
  if (!MOMO_PAYABLE_STATUSES.includes(order.status)) {
    throw AppError.conflict(
      'ORDER_NOT_PAYABLE',
      `Đơn hàng ${STATUS_LABEL[order.status]} nên không thể thanh toán.`,
    );
  }

  const payment = await getPaymentProvider('MOMO').initiate(paymentInfoOf(order));
  return { paymentUrl: payment.redirectUrl };
}

/**
 * Ghi nhận kết quả giao dịch MoMo đã được xác thực (IPN đúng chữ ký hoặc tự tra
 * cứu). Cả hai đường có thể tới cùng lúc nên mọi cập nhật đều có điều kiện:
 * không bao giờ hạ PAID xuống, không đánh dấu PAID cho đơn đã huỷ.
 */
export async function applyMomoResult(transaction: MomoTransaction): Promise<MomoOutcome> {
  const outcome = momoOutcome(transaction.resultCode);
  const order = await prisma.order.findUnique({
    where: { code: orderCodeFromMomoOrderId(transaction.orderId) },
  });
  if (!order || order.paymentMethod !== 'MOMO') return 'UNKNOWN';

  if (outcome === 'PAID') {
    if (
      transaction.partnerCode !== env.MOMO_PARTNER_CODE ||
      Number(transaction.amount) !== order.total
    ) {
      console.error(`[momo] giao dịch ${transaction.orderId} không khớp đơn ${order.code}; bỏ qua.`);
      return 'UNKNOWN';
    }

    const claimed = await prisma.order.updateMany({
      where: { id: order.id, paymentStatus: { not: 'PAID' }, status: { not: 'CANCELLED' } },
      data: { paymentStatus: 'PAID' },
    });
    if (claimed.count === 0 && order.status === 'CANCELLED') {
      console.error(
        `[momo] đơn ${order.code} đã huỷ nhưng giao dịch ${transaction.orderId} thanh toán thành công; cần hoàn tiền thủ công.`,
      );
    }
  } else if (outcome === 'FAILED') {
    await prisma.order.updateMany({
      where: { id: order.id, paymentStatus: 'UNPAID' },
      data: { paymentStatus: 'FAILED' },
    });
  }

  return outcome;
}

/** Trang kết quả gọi sau khi MoMo chuyển khách về; tự tra cứu thay vì tin URL. */
export async function verifyMomoPayment(userId: number, code: string, momoOrderId: string) {
  if (orderCodeFromMomoOrderId(momoOrderId) !== code) {
    throw AppError.badRequest('MOMO_ORDER_MISMATCH', 'Giao dịch MoMo không thuộc đơn hàng này.');
  }

  const order = await getMyOrder(userId, code);
  if (order.paymentMethod !== 'MOMO') {
    throw AppError.conflict('PAYMENT_METHOD_MISMATCH', 'Đơn hàng này không thanh toán qua MoMo.');
  }
  if (order.paymentStatus === 'PAID') {
    return { order, outcome: 'PAID' as MomoOutcome, message: 'Đơn hàng đã được thanh toán.' };
  }
  if (!getPaymentProvider('MOMO').implemented) {
    throw new AppError(
      501,
      'PAYMENT_NOT_IMPLEMENTED',
      'Thanh toán MoMo chưa được cấu hình nên chưa tra cứu được giao dịch.',
    );
  }

  const transaction = await queryMomoTransaction(momoOrderId);
  const outcome = await applyMomoResult(transaction);
  return {
    order: await getMyOrder(userId, code),
    outcome,
    message: transaction.message ?? '',
  };
}

export async function listMyOrders(userId: number, query: OrderListQuery) {
  const where: Prisma.OrderWhereInput = {
    userId,
    ...(query.status === undefined ? {} : { status: query.status }),
  };

  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: orderInclude,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function getMyOrder(userId: number, code: string) {
  const order = await prisma.order.findUnique({ where: { code }, include: orderDetailInclude });
  if (!order || order.userId !== userId) {
    throw AppError.notFound('Không tìm thấy đơn hàng này.');
  }
  return order;
}

type TransitionRequest =
  | {
      actorType: 'CUSTOMER';
      actorUserId: number;
      code: string;
      next: 'CANCELLED';
      reason: string;
    }
  | {
      actorType: 'ADMIN';
      actorUserId: number;
      orderId: number;
      next: OrderStatus;
      reason?: string;
    };

/**
 * The single order-state mutation seam. A conditional update claims the expected state before
 * any history/stock side effect; a lost race therefore performs no partial business work.
 */
async function transitionOrderStatus(request: TransitionRequest) {
  const current =
    request.actorType === 'CUSTOMER'
      ? await prisma.order.findUnique({ where: { code: request.code } })
      : await prisma.order.findUnique({ where: { id: request.orderId } });

  if (
    !current ||
    (request.actorType === 'CUSTOMER' && current.userId !== request.actorUserId)
  ) {
    throw AppError.notFound('Không tìm thấy đơn hàng này.');
  }

  const next = request.next;
  if (current.status === next) {
    if (next === 'CANCELLED') {
      const order = await prisma.order.findUniqueOrThrow({
        where: { id: current.id },
        include: orderDetailInclude,
      });
      return { order, replayed: true };
    }
    throw AppError.conflict(
      'ORDER_STATUS_UNCHANGED',
      `Đơn hàng đang ở trạng thái "${STATUS_LABEL[next]}".`,
    );
  }

  // Chưa có luồng hoàn tiền tự động: tiền đã trừ trên MoMo thì cửa hàng phải xử lý.
  if (
    request.actorType === 'CUSTOMER' &&
    current.paymentMethod === 'MOMO' &&
    current.paymentStatus === 'PAID'
  ) {
    throw AppError.conflict(
      'ORDER_ALREADY_PAID',
      'Đơn đã thanh toán qua MoMo nên không thể tự huỷ. Vui lòng liên hệ cửa hàng để được hỗ trợ hoàn tiền.',
    );
  }

  const allowed =
    request.actorType === 'CUSTOMER'
      ? CUSTOMER_TRANSITIONS[current.status]
      : ADMIN_TRANSITIONS[current.status];

  if (!allowed.includes(next)) {
    if (request.actorType === 'CUSTOMER') {
      throw AppError.conflict(
        'ORDER_NOT_CANCELLABLE',
        `Đơn hàng ${STATUS_LABEL[current.status]} nên không thể tự huỷ. Vui lòng liên hệ cửa hàng.`,
      );
    }
    throw AppError.conflict(
      'INVALID_STATUS_TRANSITION',
      `Không thể chuyển đơn từ "${STATUS_LABEL[current.status]}" sang "${STATUS_LABEL[next]}".`,
    );
  }

  const cancelReason = next === 'CANCELLED' ? request.reason?.trim() : undefined;
  if (next === 'CANCELLED' && !cancelReason) {
    throw AppError.badRequest(
      'CANCEL_REASON_REQUIRED',
      'Vui lòng chọn lý do có sẵn hoặc tự điền lý do huỷ đơn.',
    );
  }

  const transitioned = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: {
        id: current.id,
        status: current.status,
        // Khách huỷ đua với IPN MoMo: chỉ huỷ khi tình trạng thanh toán chưa đổi.
        ...(request.actorType === 'CUSTOMER' ? { paymentStatus: current.paymentStatus } : {}),
      },
      data: {
        status: next,
        ...(next === 'DELIVERED' && current.paymentMethod === 'COD'
          ? { paymentStatus: 'PAID' as const }
          : {}),
      },
    });

    if (claimed.count === 0) return null;

    if (next === 'CANCELLED') {
      await restoreOrderInventory(tx, {
        orderId: current.id,
        actor: { type: request.actorType, userId: request.actorUserId },
      });
    }

    await tx.orderStatusHistory.create({
      data: {
        orderId: current.id,
        type: 'TRANSITION',
        fromStatus: current.status,
        toStatus: next,
        actorType: request.actorType,
        actorUserId: request.actorUserId,
        ...(cancelReason === undefined ? {} : { reason: cancelReason }),
        occurredAt: new Date(),
        operationKey: `ORDER_TRANSITION:${current.id}:${current.status}:${next}`,
      },
    });

    return tx.order.findUniqueOrThrow({
      where: { id: current.id },
      include: orderDetailInclude,
    });
  });

  if (transitioned) return { order: transitioned, replayed: false };

  // Re-read outside the failed claim transaction so MySQL REPEATABLE READ cannot return the
  // snapshot captured before a concurrent writer committed.
  const latest = await prisma.order.findUnique({
    where: { id: current.id },
    include: orderDetailInclude,
  });
  if (!latest) throw AppError.notFound('Không tìm thấy đơn hàng này.');
  if (next === 'CANCELLED' && latest.status === 'CANCELLED') {
    return { order: latest, replayed: true };
  }

  throw AppError.conflict(
    'ORDER_STATUS_CHANGED',
    'Trạng thái đơn đã thay đổi bởi thao tác khác. Vui lòng tải lại trước khi tiếp tục.',
    { currentStatus: latest.status },
  );
}

export function cancelMyOrder(userId: number, code: string, reason: string) {
  return transitionOrderStatus({
    actorType: 'CUSTOMER',
    actorUserId: userId,
    code,
    next: 'CANCELLED',
    reason,
  });
}

// ------------------------------------------------------------------- admin

export async function listAllOrders(query: AdminOrderListQuery) {
  const where: Prisma.OrderWhereInput = {};

  if (query.status !== undefined) where.status = query.status;
  if (query.paymentStatus !== undefined) where.paymentStatus = query.paymentStatus;
  if (query.paymentMethod !== undefined) where.paymentMethod = query.paymentMethod;

  if (query.search) {
    // Người trực đơn hay có sẵn một trong ba thứ: mã đơn khách đọc qua điện
    // thoại, tên người nhận, hoặc email tài khoản.
    where.OR = [
      { code: { contains: query.search } },
      { receiverName: { contains: query.search } },
      { user: { fullName: { contains: query.search } } },
      { user: { email: { contains: query.search } } },
    ];
  }

  if (query.from !== undefined || query.to !== undefined) {
    where.createdAt = {
      ...(query.from === undefined ? {} : { gte: new Date(`${query.from}T00:00:00`) }),
      // "Đến ngày" phải bao trọn ngày đó, nếu không đơn buổi chiều bị rớt.
      ...(query.to === undefined ? {} : { lte: new Date(`${query.to}T23:59:59.999`) }),
    };
  }

  const [items, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: {
        ...orderInclude,
        user: { select: { id: true, email: true, fullName: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function getOrderByCode(code: string) {
  const order = await prisma.order.findUnique({
    where: { code },
    include: {
      ...orderDetailInclude,
      user: { select: { id: true, email: true, fullName: true } },
    },
  });
  if (!order) throw AppError.notFound('Không tìm thấy đơn hàng này.');
  return order;
}

export function updateOrderStatus(
  orderId: number,
  next: OrderStatus,
  adminUserId: number,
  reason?: string,
) {
  return transitionOrderStatus({
    actorType: 'ADMIN',
    actorUserId: adminUserId,
    orderId,
    next,
    ...(reason === undefined ? {} : { reason }),
  });
}

/**
 * Đánh dấu tình trạng thanh toán bằng tay. Máy trạng thái đơn chỉ suy ra được
 * trường hợp COD giao xong; chuyển khoản trước hay thu hộ thất bại thì phải
 * có người ghi nhận.
 */
export async function updatePaymentStatus(orderId: number, next: PaymentStatus) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw AppError.notFound('Không tìm thấy đơn hàng này.');

  if (order.status === 'CANCELLED' && next === 'PAID') {
    throw AppError.conflict(
      'ORDER_CANCELLED',
      'Đơn đã huỷ nên không đánh dấu đã thanh toán được.',
    );
  }

  if (order.paymentStatus === next) {
    throw AppError.conflict('PAYMENT_STATUS_UNCHANGED', 'Tình trạng thanh toán không đổi.');
  }

  return prisma.order.update({
    where: { id: order.id },
    data: { paymentStatus: next },
    include: { ...orderInclude, user: { select: { id: true, email: true, fullName: true } } },
  });
}
