import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { descendantCategoryIds } from '../categories/category.service.js';
import { adjustVariantStock } from '../inventory/inventory.service.js';
import type {
  InventoryQuery,
  MovementListQuery,
  StockUpdateInput,
} from './admin.schema.js';

/**
 * Ngưỡng cảnh báo tồn kho thấp. Dùng chung cho thẻ "Sắp hết" ngoài cửa hàng
 * và bộ lọc trong trang kho, để hai nơi không nói hai con số khác nhau.
 */
export const LOW_STOCK_THRESHOLD = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Khoá ngày theo giờ máy chủ (YYYY-MM-DD) — không dùng UTC để khỏi lệch ngày. */
function dateKey(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * Số liệu tổng quan cho trang quản trị. Mọi con số đều đếm từ database —
 * không có chỉ số nào được ước lượng hay dựng sẵn.
 */
export async function getDashboardStats() {
  const today = startOfToday();
  // Mốc 14 ngày: 7 ngày gần nhất để vẽ biểu đồ, 7 ngày trước đó để so sánh.
  const since14 = new Date(today.getTime() - 13 * DAY_MS);
  const since7 = new Date(today.getTime() - 6 * DAY_MS);

  const [
    ordersByStatus,
    deliveredSum,
    inProgressSum,
    recentOrderRows,
    productCount,
    activeProductCount,
    categoryCount,
    stockAggregate,
    lowStockCount,
    outOfStockCount,
    customerCount,
    newCustomerCount,
    lowStockRows,
  ] = await prisma.$transaction([
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),

    prisma.order.aggregate({ where: { status: 'DELIVERED' }, _sum: { total: true } }),

    prisma.order.aggregate({
      where: { status: { in: ['PENDING', 'CONFIRMED', 'SHIPPING'] } },
      _sum: { total: true },
    }),

    // Kéo 14 ngày gần nhất một lần rồi gộp trong bộ nhớ: dữ liệu nhỏ, mà làm
    // vậy thì không phải viết SQL thô riêng cho MySQL.
    prisma.order.findMany({
      where: { createdAt: { gte: since14 } },
      select: { createdAt: true, total: true, status: true },
    }),

    prisma.product.count(),
    prisma.product.count({ where: { isActive: true } }),
    prisma.category.count(),

    prisma.productVariant.aggregate({ _sum: { stock: true }, _count: { _all: true } }),
    prisma.productVariant.count({ where: { stock: { gt: 0, lte: LOW_STOCK_THRESHOLD } } }),
    prisma.productVariant.count({ where: { stock: 0 } }),

    prisma.user.count({ where: { role: 'USER' } }),
    prisma.user.count({ where: { role: 'USER', createdAt: { gte: since7 } } }),

    // Danh sách việc cần làm: biến thể sắp hết, ít nhất lên đầu.
    prisma.productVariant.findMany({
      where: { stock: { lte: LOW_STOCK_THRESHOLD }, product: { isActive: true } },
      orderBy: [{ stock: 'asc' }, { id: 'asc' }],
      take: 6,
      select: {
        id: true,
        size: true,
        color: true,
        stock: true,
        product: {
          select: {
            id: true,
            name: true,
            images: { select: { thumbUrl: true }, orderBy: { sortOrder: 'asc' }, take: 1 },
          },
        },
      },
    }),
  ]);

  const statusCounts = Object.fromEntries(
    ordersByStatus.map((row) => [row.status, row._count._all]),
  ) as Record<string, number>;

  const countFor = (status: string) => statusCounts[status] ?? 0;

  // Biểu đồ 7 ngày: khởi tạo đủ 7 khoá để ngày không có đơn vẫn là cột 0
  // thay vì biến mất khỏi trục hoành.
  const series = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(since7.getTime() + index * DAY_MS);
    return { date: dateKey(day), orders: 0, revenue: 0 };
  });
  const seriesIndex = new Map(series.map((point, index) => [point.date, index]));

  let last7Days = 0;
  let previous7Days = 0;

  for (const order of recentOrderRows) {
    // Đơn huỷ không phải doanh thu — bỏ khỏi mọi phép cộng.
    if (order.status === 'CANCELLED') continue;

    const index = seriesIndex.get(dateKey(order.createdAt));
    if (index === undefined) {
      previous7Days += order.total;
      continue;
    }

    last7Days += order.total;
    series[index]!.orders += 1;
    series[index]!.revenue += order.total;
  }

  const recentOrders = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      code: true,
      status: true,
      total: true,
      createdAt: true,
      user: { select: { fullName: true, email: true } },
    },
  });

  // Bán chạy tính trên dòng đơn, KHÔNG tính đơn đã huỷ. Tên lấy từ snapshot
  // trong OrderItem nên sản phẩm bị xoá vẫn hiện đúng tên lúc bán.
  const topRows = await prisma.orderItem.groupBy({
    by: ['productId', 'productName'],
    where: { order: { status: { not: 'CANCELLED' } } },
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 5,
  });

  const topProducts = topRows.map((row) => ({
    productId: row.productId,
    name: row.productName,
    quantity: row._sum.quantity ?? 0,
    revenue: row._sum.lineTotal ?? 0,
  }));

  return {
    revenue: {
      delivered: deliveredSum._sum.total ?? 0,
      inProgress: inProgressSum._sum.total ?? 0,
      last7Days,
      previous7Days,
    },
    orders: {
      total: ordersByStatus.reduce((sum, row) => sum + row._count._all, 0),
      pending: countFor('PENDING'),
      confirmed: countFor('CONFIRMED'),
      shipping: countFor('SHIPPING'),
      delivered: countFor('DELIVERED'),
      cancelled: countFor('CANCELLED'),
    },
    catalog: {
      products: productCount,
      activeProducts: activeProductCount,
      categories: categoryCount,
      variants: stockAggregate._count._all,
    },
    stock: {
      units: stockAggregate._sum.stock ?? 0,
      low: lowStockCount,
      out: outOfStockCount,
      threshold: LOW_STOCK_THRESHOLD,
    },
    customers: { total: customerCount, newLast7Days: newCustomerCount },
    series,
    topProducts,
    recentOrders,
    lowStockVariants: lowStockRows.map((variant) => ({
      id: variant.id,
      size: variant.size,
      color: variant.color,
      stock: variant.stock,
      productId: variant.product.id,
      productName: variant.product.name,
      thumbUrl: variant.product.images[0]?.thumbUrl ?? null,
    })),
  };
}

const INVENTORY_ORDER_BY: Record<
  InventoryQuery['sort'],
  Prisma.ProductVariantOrderByWithRelationInput[]
> = {
  'stock-asc': [{ stock: 'asc' }, { id: 'asc' }],
  'stock-desc': [{ stock: 'desc' }, { id: 'asc' }],
  name: [{ product: { name: 'asc' } }, { id: 'asc' }],
};

/** Danh sách tồn kho theo biến thể, kèm thông tin sản phẩm để nhận ra món hàng. */
export async function listInventory(query: InventoryQuery) {
  const where: Prisma.ProductVariantWhereInput = {};

  // Gom điều kiện của sản phẩm vào một object rồi mới gán: gán từng mảnh vào
  // where.product khiến TypeScript mất kiểu vì nhánh đó có thể là undefined.
  const productWhere: Prisma.ProductWhereInput = {};

  if (query.search) {
    productWhere.name = { contains: query.search };
  }

  if (query.categoryId !== undefined) {
    productWhere.categoryId = { in: await descendantCategoryIds(query.categoryId) };
  }

  if (Object.keys(productWhere).length > 0) {
    where.product = productWhere;
  }

  if (query.lowOnly === true) {
    where.stock = { lte: LOW_STOCK_THRESHOLD };
  }

  const [rows, total] = await prisma.$transaction([
    prisma.productVariant.findMany({
      where,
      orderBy: INVENTORY_ORDER_BY[query.sort],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        size: true,
        color: true,
        stock: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            isActive: true,
            category: { select: { id: true, name: true } },
            images: { select: { thumbUrl: true }, orderBy: { sortOrder: 'asc' }, take: 1 },
          },
        },
      },
    }),
    prisma.productVariant.count({ where }),
  ]);

  return {
    items: rows.map((variant) => ({
      id: variant.id,
      size: variant.size,
      color: variant.color,
      stock: variant.stock,
      updatedAt: variant.updatedAt,
      product: {
        id: variant.product.id,
        name: variant.product.name,
        slug: variant.product.slug,
        price: variant.product.price,
        isActive: variant.product.isActive,
        category: variant.product.category,
        thumbUrl: variant.product.images[0]?.thumbUrl ?? null,
      },
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
    threshold: LOW_STOCK_THRESHOLD,
  };
}

/** Đặt lại tồn kho một biến thể — nhập hàng về hoặc kiểm kê lại. */
export function updateVariantStock(
  variantId: number,
  input: StockUpdateInput,
  adminUserId: number,
) {
  return prisma.$transaction((tx) =>
    adjustVariantStock(tx, {
      variantId,
      stock: input.stock,
      expectedStock: input.expectedStock,
      reason: input.reason,
      actor: { type: 'ADMIN', userId: adminUserId },
    }),
  );
}

export async function listInventoryMovements(
  variantId: number,
  query: MovementListQuery,
) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true },
  });
  if (!variant) throw AppError.notFound('Không tìm thấy biến thể cần xem lịch sử.');

  const where: Prisma.InventoryMovementWhereInput = { variantId };
  const [items, total] = await prisma.$transaction([
    prisma.inventoryMovement.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.inventoryMovement.count({ where }),
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
