import { prisma } from '../src/lib/prisma.js';

const rows = await prisma.productImage.findMany({
  select: { url: true, thumbUrl: true, product: { select: { slug: true } } },
  orderBy: { productId: 'asc' },
  take: 2,
});
const local = await prisma.productImage.count({
  where: { url: { startsWith: '/uploads/seed/' } },
});
const total = await prisma.productImage.count();
console.log(JSON.stringify({ local, total, sample: rows }));
await prisma.$disconnect();
