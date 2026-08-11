import crypto from 'node:crypto';
import { type AuditActorType, Prisma } from '@prisma/client';
import { AppError } from '../../middleware/error.js';

type Actor = {
  type: AuditActorType;
  userId?: number;
};

function actorData(actor: Actor) {
  return {
    actorType: actor.type,
    actorUserId: actor.userId ?? null,
  };
}

/**
 * Creates a sellable variant and its INITIAL_STOCK ledger row in the caller's transaction.
 * Product create/update callers never write ProductVariant.stock themselves.
 */
export async function createVariantWithInitialStock(
  tx: Prisma.TransactionClient,
  input: {
    productId: number;
    productName: string;
    size: string;
    color: string;
    initialStock: number;
    actor: Actor;
  },
) {
  const variant = await tx.productVariant.create({
    data: {
      productId: input.productId,
      size: input.size,
      color: input.color,
      stock: input.initialStock,
    },
    select: { id: true, productId: true, size: true, color: true, stock: true },
  });

  await tx.inventoryMovement.create({
    data: {
      variantId: variant.id,
      productNameSnapshot: input.productName,
      sizeSnapshot: variant.size,
      colorSnapshot: variant.color,
      type: 'INITIAL_STOCK',
      beforeStock: 0,
      afterStock: variant.stock,
      delta: variant.stock,
      ...actorData(input.actor),
      operationKey: `INITIAL_STOCK:${variant.id}`,
    },
  });

  return variant;
}

/**
 * Atomically claims stock for one persisted order item. The conditional decrement prevents two
 * checkouts from both buying the final unit; the movement shares the enclosing order transaction.
 */
export async function reserveOrderItem(
  tx: Prisma.TransactionClient,
  input: {
    orderId: number;
    orderItemId: number;
    variantId: number;
    productName: string;
    size: string;
    color: string;
    quantity: number;
    actor: Actor;
  },
) {
  const claimed = await tx.productVariant.updateMany({
    where: { id: input.variantId, stock: { gte: input.quantity } },
    data: { stock: { decrement: input.quantity } },
  });

  if (claimed.count === 0) {
    throw AppError.conflict(
      'OUT_OF_STOCK',
      `"${input.productName} (${input.size}, ${input.color})" vừa hết hàng hoặc không còn đủ số lượng bạn chọn. Vui lòng kiểm tra lại giỏ hàng.`,
    );
  }

  const variant = await tx.productVariant.findUniqueOrThrow({
    where: { id: input.variantId },
    select: { stock: true },
  });

  await tx.inventoryMovement.create({
    data: {
      variantId: input.variantId,
      productNameSnapshot: input.productName,
      sizeSnapshot: input.size,
      colorSnapshot: input.color,
      type: 'ORDER_RESERVED',
      beforeStock: variant.stock + input.quantity,
      afterStock: variant.stock,
      delta: -input.quantity,
      orderId: input.orderId,
      ...actorData(input.actor),
      operationKey: `ORDER_RESERVED:${input.orderItemId}`,
    },
  });
}

/** Restores every still-addressable variant for a cancelled order and appends one row per item. */
export async function restoreOrderInventory(
  tx: Prisma.TransactionClient,
  input: { orderId: number; actor: Actor },
) {
  const items = await tx.orderItem.findMany({
    where: { orderId: input.orderId, variantId: { not: null } },
    select: {
      id: true,
      variantId: true,
      quantity: true,
      productName: true,
      size: true,
      color: true,
    },
  });

  for (const item of items) {
    const variant = await tx.productVariant.update({
      where: { id: item.variantId! },
      data: { stock: { increment: item.quantity } },
      select: { stock: true, size: true, color: true },
    });

    await tx.inventoryMovement.create({
      data: {
        variantId: item.variantId,
        productNameSnapshot: item.productName,
        sizeSnapshot: item.size ?? variant.size,
        colorSnapshot: item.color ?? variant.color,
        type: 'ORDER_RESTORED',
        beforeStock: variant.stock - item.quantity,
        afterStock: variant.stock,
        delta: item.quantity,
        orderId: input.orderId,
        ...actorData(input.actor),
        operationKey: `ORDER_RESTORED:${item.id}`,
      },
    });
  }
}

/** Compare-and-set stock adjustment used by the admin inventory endpoint. */
export async function adjustVariantStock(
  tx: Prisma.TransactionClient,
  input: {
    variantId: number;
    stock: number;
    expectedStock: number;
    reason: string;
    actor: Actor;
  },
) {
  const changed = await tx.productVariant.updateMany({
    where: { id: input.variantId, stock: input.expectedStock },
    data: { stock: input.stock },
  });

  if (changed.count === 0) {
    const current = await tx.productVariant.findUnique({
      where: { id: input.variantId },
      select: { stock: true },
    });
    if (!current) {
      throw AppError.notFound('Không tìm thấy biến thể cần cập nhật.');
    }
    throw AppError.conflict(
      'STOCK_CHANGED',
      'Tồn kho đã thay đổi từ lúc bạn mở trang. Vui lòng kiểm tra lại trước khi ghi đè.',
      { currentStock: current.stock },
    );
  }

  const variant = await tx.productVariant.findUniqueOrThrow({
    where: { id: input.variantId },
    select: {
      id: true,
      productId: true,
      size: true,
      color: true,
      stock: true,
      product: { select: { name: true } },
    },
  });

  const movement = await tx.inventoryMovement.create({
    data: {
      variantId: variant.id,
      productNameSnapshot: variant.product.name,
      sizeSnapshot: variant.size,
      colorSnapshot: variant.color,
      type: 'ADMIN_ADJUSTMENT',
      beforeStock: input.expectedStock,
      afterStock: input.stock,
      delta: input.stock - input.expectedStock,
      ...actorData(input.actor),
      reason: input.reason,
      operationKey: `ADMIN_ADJUSTMENT:${variant.id}:${crypto.randomUUID()}`,
    },
  });

  const { product: _product, ...publicVariant } = variant;
  return { variant: publicVariant, movement };
}

/** Hard-deletes a zero-stock variant only after preserving a retirement ledger row. */
export async function retireVariant(
  tx: Prisma.TransactionClient,
  input: { variantId: number; actor: Actor },
) {
  // Prisma has no typed FOR UPDATE option. This parameterized tagged query acquires the
  // InnoDB row lock before the stock read, so a concurrent CAS cannot change 0 to a positive
  // value between validation and delete.
  const rows = await tx.$queryRaw<
    Array<{ id: number; stock: number; size: string; color: string; productName: string }>
  >`
    SELECT v.id, v.stock, v.size, v.color, p.name AS productName
    FROM product_variants v
    INNER JOIN products p ON p.id = v.productId
    WHERE v.id = ${input.variantId}
    FOR UPDATE
  `;
  // Use the locking read result itself. A normal Prisma SELECT here could return an older
  // REPEATABLE READ snapshot if this transaction listed product variants before waiting.
  const variant = rows[0];
  if (!variant) throw AppError.notFound('Không tìm thấy biến thể cần xoá.');

  if (variant.stock > 0) {
    throw AppError.conflict(
      'STOCK_REMAINS',
      'Không thể xoá biến thể vẫn còn tồn kho. Hãy điều chỉnh tồn kho về 0 trước.',
      { variantId: variant.id, stock: variant.stock },
    );
  }

  await tx.inventoryMovement.create({
    data: {
      variantId: variant.id,
      productNameSnapshot: variant.productName,
      sizeSnapshot: variant.size,
      colorSnapshot: variant.color,
      type: 'VARIANT_RETIRED',
      beforeStock: 0,
      afterStock: 0,
      delta: 0,
      ...actorData(input.actor),
      operationKey: `VARIANT_RETIRED:${variant.id}`,
    },
  });

  await tx.productVariant.delete({ where: { id: variant.id } });
}
