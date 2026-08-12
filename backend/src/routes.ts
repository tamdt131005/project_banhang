import { Router } from 'express';
import { prisma } from './lib/prisma.js';
import { addressRouter } from './modules/addresses/address.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { cartRouter } from './modules/cart/cart.routes.js';
import { chatRouter } from './modules/chat/chat.routes.js';
import { adminChatRouter } from './modules/chat/admin-chat.routes.js';
import { adminCategoryRouter, categoryRouter } from './modules/categories/category.routes.js';
import { adminOrderRouter, orderRouter } from './modules/orders/order.routes.js';
import {
  adminProductImageRouter,
  adminProductRouter,
  productRouter,
} from './modules/products/product.routes.js';
import { adminUserRouter } from './modules/users/user.routes.js';

export const apiRouter = Router();

/**
 * Kiểm tra sức khoẻ. Có ping cả database vì lỗi hay gặp nhất khi chạy dự án
 * này là quên bật MySQL trong Laragon — endpoint chỉ ra ngay điều đó.
 */
apiRouter.get('/health', async (_req, res) => {
  let database: 'up' | 'down' = 'up';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'down';
  }

  res.status(database === 'up' ? 200 : 503).json({
    status: database === 'up' ? 'ok' : 'degraded',
    database,
    time: new Date().toISOString(),
  });
});

// ------------------------------------------------------------------ công khai
apiRouter.use('/auth', authRouter);
apiRouter.use('/categories', categoryRouter);
apiRouter.use('/products', productRouter);

// -------------------------------------------------------------- cần đăng nhập
apiRouter.use('/addresses', addressRouter);
apiRouter.use('/cart', cartRouter);
apiRouter.use('/orders', orderRouter);
apiRouter.use('/chat', chatRouter);

// ---------------------------------------------------------------------- admin
// Đặt TRƯỚC các router con: /admin/stats và /admin/inventory là route riêng,
// không được để router nào khác nuốt mất.
apiRouter.use('/admin', adminRouter);
apiRouter.use('/admin/chat', adminChatRouter);
apiRouter.use('/admin/categories', adminCategoryRouter);
apiRouter.use('/admin/products', adminProductRouter);
apiRouter.use('/admin/product-images', adminProductImageRouter);
apiRouter.use('/admin/orders', adminOrderRouter);
apiRouter.use('/admin/users', adminUserRouter);
