import { z } from 'zod';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import * as orderService from '../orders/order.service.js';
import { ORDER_STATUSES } from '../orders/order.schema.js';
import * as productService from '../products/product.service.js';
import { PRODUCT_SORTS } from '../products/product.schema.js';
import { SUPPORT_REQUESTED_CONTENT } from './chat.constants.js';
import { conversationPublicSelect } from './chat.dto.js';
import { chatEvents } from './chat.events.js';
import type {
  AIMatchingVariant,
  AIChatTool,
  AIProductCard,
  AIToolCall,
  AIToolContext,
  AIToolDeclaration,
  AIToolExecutionResult,
  AIToolRegistry,
} from './chat.ai.js';

const jsonObject = { type: 'object', additionalProperties: false } as const;

const searchProductsSchema = z
  .object({
    query: z.string().trim().min(1).max(191).optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    minPrice: z.coerce.number().int().nonnegative().optional(),
    maxPrice: z.coerce.number().int().nonnegative().optional(),
    size: z.string().trim().min(1).max(20).optional(),
    color: z.string().trim().min(1).max(50).optional(),
    sort: z.enum(PRODUCT_SORTS).default('newest'),
    limit: z.coerce.number().int().min(1).max(6).default(4),
  })
  .strict()
  .refine(
    (value) =>
      value.minPrice === undefined ||
      value.maxPrice === undefined ||
      value.minPrice <= value.maxPrice,
    { path: ['minPrice'], message: 'minPrice must be <= maxPrice' },
  );

const productIdentityFields = {
  productId: z.coerce.number().int().positive().optional(),
  slug: z.string().trim().min(1).max(191).optional(),
};

const productIdentitySchema = z
  .object(productIdentityFields)
  .strict()
  .refine((value) => value.productId !== undefined || value.slug !== undefined, {
    message: 'productId or slug is required',
  });

const availabilitySchema = z
  .object({
    ...productIdentityFields,
    size: z.string().trim().min(1).max(20).optional(),
    color: z.string().trim().min(1).max(50).optional(),
    quantity: z.coerce.number().int().min(1).max(100).default(1),
  })
  .strict()
  .refine((value) => value.productId !== undefined || value.slug !== undefined, {
    message: 'productId or slug is required',
  });

const myOrdersSchema = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    limit: z.coerce.number().int().min(1).max(5).default(3),
  })
  .strict();

const orderCodeSchema = z.object({ code: z.string().trim().min(3).max(32) }).strict();

const returnPolicySchema = z
  .object({ code: z.string().trim().min(3).max(32).optional() })
  .strict();

const handoffSchema = z
  .object({ reason: z.string().trim().min(1).max(300).optional() })
  .strict();

function imageFrom(images: { url?: string; thumbUrl?: string }[]) {
  const image = images[0];
  return image?.url && image.thumbUrl ? { url: image.url, thumbUrl: image.thumbUrl } : null;
}

function toMatchingVariant(variant: {
  id: number;
  size: string;
  color: string;
  stock: number;
}): AIMatchingVariant {
  return {
    id: variant.id,
    size: variant.size,
    color: variant.color,
    available: variant.stock > 0,
  };
}

function toProductCard(product: {
  id: number;
  name: string;
  slug: string;
  price: number;
  stock: number;
  category: { id: number; name: string; slug: string };
  images: { url?: string; thumbUrl?: string }[];
}, matchingVariants: Array<{ id: number; size: string; color: string; stock: number }> = []): AIProductCard {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    stock: product.stock,
    category: product.category,
    image: imageFrom(product.images),
    matchingVariants: matchingVariants.map(toMatchingVariant),
  };
}

function compactProduct(product: AIProductCard) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: product.price,
    stock: product.stock,
    category: product.category.name,
    matchingVariants: product.matchingVariants,
  };
}

async function matchingVariantsForProducts(
  productIds: number[],
  input: { size?: string; color?: string },
) {
  if (productIds.length === 0) return new Map<number, Array<{ id: number; size: string; color: string; stock: number }>>();

  const variants = await prisma.productVariant.findMany({
    where: {
      productId: { in: productIds },
      stock: { gt: 0 },
      ...(input.size === undefined ? {} : { size: input.size }),
      ...(input.color === undefined ? {} : { color: input.color }),
    },
    select: { id: true, productId: true, size: true, color: true, stock: true },
    orderBy: [{ productId: 'asc' }, { id: 'asc' }],
  });

  const byProduct = new Map<number, Array<{ id: number; size: string; color: string; stock: number }>>();
  for (const variant of variants) {
    const existing = byProduct.get(variant.productId) ?? [];
    if (existing.length < 4) existing.push(variant);
    byProduct.set(variant.productId, existing);
  }
  return byProduct;
}

async function getActiveProduct(input: z.infer<typeof productIdentitySchema>) {
  if (input.slug !== undefined) return productService.getProductBySlug(input.slug);

  const product = await prisma.product.findFirst({
    where: { id: input.productId, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      price: true,
      isActive: true,
      createdAt: true,
      category: { select: { id: true, name: true, slug: true } },
      images: {
        select: { id: true, url: true, thumbUrl: true, sortOrder: true },
        orderBy: { sortOrder: 'asc' },
      },
      variants: {
        select: { id: true, size: true, color: true, stock: true },
        orderBy: { id: 'asc' },
      },
    },
  });
  if (!product) throw AppError.notFound('Không tìm thấy sản phẩm này.');
  const stock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
  return { ...product, stock };
}

function toOrderSummary(order: {
  code: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  total: number;
  shippingFee: number;
  createdAt: Date;
  items: Array<{
    productName: string;
    size: string | null;
    color: string | null;
    quantity: number;
    lineTotal: number;
  }>;
}) {
  return {
    code: order.code,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    total: order.total,
    shippingFee: order.shippingFee,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      productName: item.productName,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
  };
}

async function requestHumanSupport(context: AIToolContext, reason?: string) {
  const claimed = await prisma.$transaction(async (tx) => {
    const updated = await tx.conversation.updateMany({
      where: {
        id: context.conversationId,
        userId: context.userId,
        status: 'AI',
        activeAiRunId: context.runId,
      },
      data: { status: 'WAITING_ADMIN', activeAiRunId: null, activeAiRunStartedAt: null },
    });
    if (updated.count === 0) return null;

    const message = await tx.chatMessage.create({
      data: {
        conversationId: context.conversationId,
        senderType: 'SYSTEM',
        content: SUPPORT_REQUESTED_CONTENT,
        metadata: {
          kind: 'SUPPORT_REQUESTED',
          requestedBy: 'AI',
          ...(reason === undefined ? {} : { reason }),
        },
      },
    });
    const conversation = await tx.conversation.findUniqueOrThrow({
      where: { id: context.conversationId },
      select: conversationPublicSelect,
    });
    return { conversation, message };
  });

  if (!claimed) {
    return {
      response: {
        handoffRequested: false,
        reason: 'Conversation state changed before handoff.',
      },
      handoffRequested: false,
    };
  }

  chatEvents.publish('message.created', { message: claimed.message });
  chatEvents.publish('support.requested', claimed);
  return { response: { handoffRequested: true }, handoffRequested: true };
}

function tool(
  declaration: AIToolDeclaration,
  execute: (context: AIToolContext, args: unknown) => Promise<AIToolExecutionResult>,
): AIChatTool {
  return { declaration, execute };
}

export class DefaultAIToolRegistry implements AIToolRegistry {
  private readonly tools: Map<string, AIChatTool>;

  constructor(tools = defaultTools) {
    this.tools = new Map(tools.map((entry) => [entry.declaration.name, entry]));
  }

  declarations() {
    return [...this.tools.values()].map((entry) => entry.declaration);
  }

  async execute(context: AIToolContext, call: AIToolCall) {
    const entry = this.tools.get(call.name);
    if (!entry) {
      return {
        id: call.id,
        name: call.name,
        response: { error: `Tool ${call.name} is not allowed.` },
      };
    }
    try {
      const result = await entry.execute(context, call.args);
      return { id: call.id, name: call.name, ...result };
    } catch (error) {
      if (error instanceof AppError) {
        return {
          id: call.id,
          name: call.name,
          response: { error: error.code, message: error.message },
        };
      }
      return {
        id: call.id,
        name: call.name,
        response: { error: 'TOOL_FAILED', message: 'Không lấy được dữ liệu từ hệ thống.' },
      };
    }
  }
}

const defaultTools: AIChatTool[] = [
  tool(
    {
      name: 'searchProducts',
      description: 'Search active store products. Use this before recommending products.',
      parametersJsonSchema: {
        ...jsonObject,
        properties: {
          query: { type: 'string' },
          categoryId: { type: 'integer' },
          minPrice: { type: 'integer' },
          maxPrice: { type: 'integer' },
          size: { type: 'string' },
          color: { type: 'string' },
          sort: { type: 'string', enum: PRODUCT_SORTS },
          limit: { type: 'integer', minimum: 1, maximum: 6 },
        },
      },
    },
    async (_context, args) => {
      const input = searchProductsSchema.parse(args);
      const result = await productService.listProducts({
        search: input.query,
        categoryId: input.categoryId,
        minPrice: input.minPrice,
        maxPrice: input.maxPrice,
        size: input.size,
        color: input.color,
        sort: input.sort,
        page: 1,
        limit: input.limit,
      });
      const availableItems = result.items.filter((product) => product.stock > 0);
      const variantsByProduct = await matchingVariantsForProducts(
        availableItems.map((product) => product.id),
        input,
      );
      const products = availableItems.map((product) =>
        toProductCard(product, variantsByProduct.get(product.id) ?? []),
      );
      return {
        response: {
          products: products.map(compactProduct),
          total: products.length,
        },
        products,
      };
    },
  ),
  tool(
    {
      name: 'getProductDetails',
      description: 'Get active product details by productId or slug.',
      parametersJsonSchema: {
        ...jsonObject,
        properties: { productId: { type: 'integer' }, slug: { type: 'string' } },
      },
    },
    async (_context, args) => {
      const input = productIdentitySchema.parse(args);
      const product = await getActiveProduct(input);
      const availableVariants = product.variants.filter((variant) => variant.stock > 0).slice(0, 4);
      const card = toProductCard(product, availableVariants);
      return {
        response: {
          product: {
            ...compactProduct(card),
            description: product.description,
            variants: product.variants.map((variant) => ({
              size: variant.size,
              color: variant.color,
              stock: variant.stock,
            })),
          },
        },
        products: [card],
      };
    },
  ),
  tool(
    {
      name: 'checkProductAvailability',
      description: 'Check stock for an active product, optionally by size and color.',
      parametersJsonSchema: {
        ...jsonObject,
        properties: {
          productId: { type: 'integer' },
          slug: { type: 'string' },
          size: { type: 'string' },
          color: { type: 'string' },
          quantity: { type: 'integer', minimum: 1, maximum: 100 },
        },
      },
    },
    async (_context, args) => {
      const input = availabilitySchema.parse(args);
      const product = await getActiveProduct(input);
      const variants = product.variants.filter(
        (variant) =>
          (input.size === undefined || variant.size === input.size) &&
          (input.color === undefined || variant.color === input.color),
      );
      const availableStock = variants.reduce((sum, variant) => sum + variant.stock, 0);
      const card = toProductCard(product, variants.slice(0, 4));
      return {
        response: {
          product: compactProduct(card),
          requestedQuantity: input.quantity,
          availableStock,
          available: availableStock >= input.quantity,
          variants: variants.map((variant) => ({
            size: variant.size,
            color: variant.color,
            stock: variant.stock,
          })),
        },
        products: [card],
      };
    },
  ),
  tool(
    {
      name: 'getMyOrders',
      description: 'List recent orders for the authenticated customer only.',
      parametersJsonSchema: {
        ...jsonObject,
        properties: {
          status: { type: 'string', enum: ORDER_STATUSES },
          limit: { type: 'integer', minimum: 1, maximum: 5 },
        },
      },
    },
    async (context, args) => {
      const input = myOrdersSchema.parse(args);
      const result = await orderService.listMyOrders(context.userId, {
        status: input.status,
        page: 1,
        limit: input.limit,
      });
      return {
        response: {
          orders: result.items.map(toOrderSummary),
          total: result.pagination.total,
        },
      };
    },
  ),
  tool(
    {
      name: 'getOrderDetails',
      description: 'Get one order owned by the authenticated customer by code.',
      parametersJsonSchema: {
        ...jsonObject,
        properties: { code: { type: 'string' } },
        required: ['code'],
      },
    },
    async (context, args) => {
      const input = orderCodeSchema.parse(args);
      const order = await orderService.getMyOrder(context.userId, input.code);
      return { response: { order: toOrderSummary(order) } };
    },
  ),
  tool(
    {
      name: 'getOrderStatus',
      description: 'Get status for one order owned by the authenticated customer by code.',
      parametersJsonSchema: {
        ...jsonObject,
        properties: { code: { type: 'string' } },
        required: ['code'],
      },
    },
    async (context, args) => {
      const input = orderCodeSchema.parse(args);
      const order = await orderService.getMyOrder(context.userId, input.code);
      return {
        response: {
          code: order.code,
          status: order.status,
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          createdAt: order.createdAt.toISOString(),
        },
      };
    },
  ),
  tool(
    {
      name: 'getShippingInfo',
      description: 'Get store shipping fee and current shipping guidance.',
      parametersJsonSchema: { ...jsonObject, properties: {} },
    },
    async () => ({
      response: {
        shippingFee: env.SHIPPING_FEE,
        currency: 'VND',
        policy:
          'Phí vận chuyển hiện là phí cố định theo cấu hình cửa hàng. Thời gian giao phụ thuộc khu vực và đơn vị vận chuyển; nếu khách cần cam kết cụ thể hãy chuyển nhân viên.',
      },
    }),
  ),
  tool(
    {
      name: 'getReturnPolicyStatus',
      description: 'Get conservative return-policy guidance, optionally for a customer-owned order.',
      parametersJsonSchema: {
        ...jsonObject,
        properties: { code: { type: 'string' } },
      },
    },
    async (context, args) => {
      const input = returnPolicySchema.parse(args);
      const order =
        input.code === undefined ? null : await orderService.getMyOrder(context.userId, input.code);
      return {
        response: {
          configured: false,
          order: order
            ? {
                code: order.code,
                status: order.status,
                createdAt: order.createdAt.toISOString(),
              }
            : null,
        },
      };
    },
  ),
  tool(
    {
      name: 'requestHumanSupport',
      description:
        'Immediately hand this conversation to a human support agent when the user asks for staff, complains, or the assistant is uncertain.',
      parametersJsonSchema: {
        ...jsonObject,
        properties: { reason: { type: 'string' } },
      },
    },
    async (context, args) => {
      const input = handoffSchema.parse(args);
      return requestHumanSupport(context, input.reason);
    },
  ),
];
