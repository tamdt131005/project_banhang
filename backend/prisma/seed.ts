import { hashPassword } from '../src/lib/password.js';
import { prisma } from '../src/lib/prisma.js';

/**
 * Dữ liệu mẫu cho tiệm quần áo CHUẨN — đủ để bấm thử ngay sau khi cài đặt.
 *
 * Taxonomy theo kiểu các shop thời trang Việt (giới → loại đồ): sản phẩm luôn
 * gắn vào danh mục con. Tồn kho nằm trên từng biến thể size × màu; sản phẩm
 * một cỡ (mũ, túi, tất) dùng size "Freesize".
 *
 * Seed dùng upsert theo slug/email nên chạy lại nhiều lần vẫn an toàn.
 */

const ADMIN_EMAIL = 'admin@shop.test';
const ADMIN_PASSWORD = 'Admin@12345';
const CUSTOMER_EMAIL = 'khach@shop.test';
const CUSTOMER_PASSWORD = 'Khach@12345';

export const FREESIZE = 'Freesize';

interface SeedCategory {
  name: string;
  slug: string;
  children: { name: string; slug: string }[];
}

const CATEGORIES: SeedCategory[] = [
  {
    name: 'Đồ nam',
    slug: 'do-nam',
    children: [
      { name: 'Áo thun nam', slug: 'ao-thun-nam' },
      { name: 'Sơ mi nam', slug: 'so-mi-nam' },
      { name: 'Quần jeans nam', slug: 'quan-jeans-nam' },
      { name: 'Quần short nam', slug: 'quan-short-nam' },
      { name: 'Áo khoác nam', slug: 'ao-khoac-nam' },
    ],
  },
  {
    name: 'Đồ nữ',
    slug: 'do-nu',
    children: [
      { name: 'Áo thun nữ', slug: 'ao-thun-nu' },
      { name: 'Sơ mi & blouse', slug: 'so-mi-blouse-nu' },
      { name: 'Váy đầm', slug: 'vay-dam' },
      { name: 'Quần nữ', slug: 'quan-nu' },
      { name: 'Áo khoác nữ', slug: 'ao-khoac-nu' },
    ],
  },
  {
    name: 'Phụ kiện',
    slug: 'phu-kien',
    children: [
      { name: 'Mũ nón', slug: 'mu-non' },
      { name: 'Túi vải', slug: 'tui-vai' },
      { name: 'Tất vớ', slug: 'tat-vo' },
    ],
  },
];

interface SeedProduct {
  name: string;
  slug: string;
  price: number;
  categorySlug: string;
  description: string;
  /** Biến thể = sizes × colors, mỗi biến thể có stockEach sản phẩm. */
  sizes: string[];
  colors: string[];
  stockEach: number;
}

const SHIRT_SIZES = ['S', 'M', 'L', 'XL'];

const PRODUCTS: SeedProduct[] = [
  // ---- Áo thun nam
  {
    name: 'Áo thun nam cotton 100% form regular',
    slug: 'ao-thun-nam-cotton-form-regular',
    price: 149_000,
    categorySlug: 'ao-thun-nam',
    sizes: SHIRT_SIZES,
    colors: ['Trắng', 'Đen', 'Xám'],
    stockEach: 10,
    description:
      'Cotton 2 chiều 220gsm dày dặn, cổ bo dệt chắc không nhão sau giặt. Form regular dễ mặc, size S–XL cho người 48–80kg. Giặt máy được, hạn chế sấy nóng.',
  },
  {
    name: 'Áo thun nam dài tay cổ tròn co giãn',
    slug: 'ao-thun-nam-dai-tay-co-tron',
    price: 189_000,
    categorySlug: 'ao-thun-nam',
    sizes: SHIRT_SIZES,
    colors: ['Đen', 'Xanh navy'],
    stockEach: 10,
    description:
      'Thun cotton pha 5% spandex co giãn nhẹ, mặc trong áo khoác hay mặc riêng đều gọn. Size S–XL, dáng ôm vừa không bó.',
  },
  // ---- Sơ mi nam
  {
    name: 'Sơ mi nam Oxford dài tay form slim',
    slug: 'so-mi-nam-oxford-dai-tay',
    price: 329_000,
    categorySlug: 'so-mi-nam',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: ['Trắng', 'Xanh nhạt'],
    stockEach: 6,
    description:
      'Vải Oxford đứng phom, cúc ngọc trai nhựa dày. Form slim ôm nhẹ thân, size S–XXL. Ủi nhiệt thấp, càng mặc càng mềm.',
  },
  {
    name: 'Sơ mi nam cộc tay vải đũi thoáng mát',
    slug: 'so-mi-nam-coc-tay-dui',
    price: 259_000,
    categorySlug: 'so-mi-nam',
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: ['Be', 'Trắng'],
    stockEach: 6,
    description:
      'Đũi tự nhiên nhẹ và thoáng, hợp thời tiết nóng ẩm. Dáng suông cộc tay, size M–XXL. Nhăn nhẹ tự nhiên là đặc tính của vải.',
  },
  // ---- Quần jeans nam
  {
    name: 'Quần jeans nam slim fit wash xanh nhạt',
    slug: 'quan-jeans-nam-slim-fit',
    price: 399_000,
    categorySlug: 'quan-jeans-nam',
    sizes: ['29', '30', '31', '32', '33'],
    colors: ['Xanh nhạt'],
    stockEach: 10,
    description:
      'Denim 12oz co giãn nhẹ, wash xanh nhạt bụi bặm. Ống côn nhỏ dần từ gối, size 29–33. Giặt lộn trái để giữ màu.',
  },
  {
    name: 'Quần jeans nam straight màu đen trơn',
    slug: 'quan-jeans-nam-straight-den',
    price: 429_000,
    categorySlug: 'quan-jeans-nam',
    sizes: ['29', '30', '31', '32', '33', '34'],
    colors: ['Đen'],
    stockEach: 6,
    description:
      'Denim đen ít phai, ống đứng cổ điển hợp cả giày da lẫn sneaker. Size 29–34, đủ dài để lên gấu theo ý.',
  },
  // ---- Quần short nam
  {
    name: 'Quần short nam kaki 9 inch',
    slug: 'quan-short-nam-kaki',
    price: 199_000,
    categorySlug: 'quan-short-nam',
    sizes: SHIRT_SIZES,
    colors: ['Be', 'Đen', 'Xám'],
    stockEach: 8,
    description:
      'Kaki cotton mềm, dài 9 inch chớm gối. Lưng có dây rút giấu trong, size S–XL. Hai túi hông một túi sau có khoá.',
  },
  {
    name: 'Quần short nam gió 2 lớp chạy bộ',
    slug: 'quan-short-nam-gio-chay-bo',
    price: 179_000,
    categorySlug: 'quan-short-nam',
    sizes: SHIRT_SIZES,
    colors: ['Đen', 'Xám'],
    stockEach: 9,
    description:
      'Lớp ngoài gió nhẹ khô nhanh, lớp trong lưới thoáng. Có túi khoá nhỏ đựng chìa khoá, size S–XL.',
  },
  // ---- Áo khoác nam
  {
    name: 'Áo khoác nam bomber dù 2 lớp',
    slug: 'ao-khoac-nam-bomber-du',
    price: 449_000,
    categorySlug: 'ao-khoac-nam',
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: ['Đen', 'Xanh rêu'],
    stockEach: 5,
    description:
      'Vải dù chống gió lót lưới, bo tay bo gấu dệt chắc. Hai túi khoá kéo, size M–XXL. Khoá kéo YKK trơn tay.',
  },
  {
    name: 'Áo hoodie nam nỉ bông form rộng',
    slug: 'ao-hoodie-nam-ni-bong',
    price: 349_000,
    categorySlug: 'ao-khoac-nam',
    sizes: ['M', 'L', 'XL', 'XXL'],
    colors: ['Đen', 'Xám', 'Be'],
    stockEach: 5,
    description:
      'Nỉ bông dày 350gsm ấm mà không nặng, mũ hai lớp đứng dáng. Form rộng vừa, size M–XXL. Túi kangaroo phía trước.',
  },
  // ---- Áo thun nữ
  {
    name: 'Áo thun nữ baby tee cotton co giãn',
    slug: 'ao-thun-nu-baby-tee',
    price: 129_000,
    categorySlug: 'ao-thun-nu',
    sizes: ['S', 'M', 'L'],
    colors: ['Trắng', 'Đen', 'Hồng phấn'],
    stockEach: 12,
    description:
      'Cotton co giãn 4 chiều ôm dáng, cổ tròn viền bo nhỏ. Size S–L, hợp mặc cùng quần lưng cao.',
  },
  {
    name: 'Áo thun nữ form rộng tay lỡ',
    slug: 'ao-thun-nu-form-rong-tay-lo',
    price: 139_000,
    categorySlug: 'ao-thun-nu',
    sizes: [FREESIZE],
    colors: ['Trắng', 'Đen', 'Be', 'Nâu'],
    stockEach: 24,
    description:
      'Cotton 100% mềm rũ, form rộng tay lỡ che bắp tay. Freesize dưới 60kg. Nhiều màu trung tính dễ phối.',
  },
  // ---- Sơ mi & blouse nữ
  {
    name: 'Sơ mi nữ lụa tay dài',
    slug: 'so-mi-nu-lua-tay-dai',
    price: 289_000,
    categorySlug: 'so-mi-blouse-nu',
    sizes: SHIRT_SIZES,
    colors: ['Trắng', 'Be'],
    stockEach: 5,
    description:
      'Lụa mềm rũ không nhăn, đi làm hay đi chơi đều hợp. Size S–XL. Giặt tay hoặc chế độ nhẹ, phơi tránh nắng gắt.',
  },
  {
    name: 'Blouse nữ tay bồng cổ vuông',
    slug: 'ao-blouse-nu-tay-bong',
    price: 249_000,
    categorySlug: 'so-mi-blouse-nu',
    sizes: ['S', 'M', 'L'],
    colors: ['Trắng', 'Đen'],
    stockEach: 6,
    description:
      'Vải voan lót trong, tay bồng nhẹ cổ vuông tôn xương quai xanh. Size S–L, khoá kéo giấu bên hông.',
  },
  // ---- Váy đầm
  {
    name: 'Đầm midi hai dây vải linen',
    slug: 'vay-dam-midi-hai-day-linen',
    price: 359_000,
    categorySlug: 'vay-dam',
    sizes: ['S', 'M', 'L'],
    colors: ['Be', 'Đen'],
    stockEach: 5,
    description:
      'Linen pha mát và đứng dáng, dài midi qua bắp chân. Dây điều chỉnh được, size S–L. Có lót trong, không lo mỏng.',
  },
  {
    name: 'Chân váy chữ A lưng cao',
    slug: 'chan-vay-chu-a-lung-cao',
    price: 219_000,
    categorySlug: 'vay-dam',
    sizes: SHIRT_SIZES,
    colors: ['Đen', 'Xám'],
    stockEach: 6,
    description:
      'Dáng chữ A xoè nhẹ, lưng cao tôn eo, dài trên gối. Size S–XL, có quần lót trong liền váy.',
  },
  {
    name: 'Đầm sơ mi dáng suông thắt eo',
    slug: 'vay-dam-so-mi-dang-suong',
    price: 329_000,
    categorySlug: 'vay-dam',
    sizes: SHIRT_SIZES,
    colors: ['Trắng', 'Xanh nhạt'],
    stockEach: 3,
    description:
      'Phom sơ mi dài qua gối kèm đai thắt eo rời, mặc buông hay thắt đều đẹp. Vải cotton pha ít nhăn, size S–XL.',
  },
  // ---- Quần nữ
  {
    name: 'Quần jeans nữ ống rộng lưng cao',
    slug: 'quan-jeans-nu-ong-rong',
    price: 379_000,
    categorySlug: 'quan-nu',
    sizes: ['26', '27', '28', '29', '30', '31'],
    colors: ['Xanh đậm'],
    stockEach: 7,
    description:
      'Denim cứng vừa giữ dáng ống rộng, lưng cao che bụng. Size 26–31, dài 100cm dễ cắt gấu theo chiều cao.',
  },
  {
    name: 'Quần culottes nữ vải tuyết mưa',
    slug: 'quan-culottes-nu-tuyet-mua',
    price: 269_000,
    categorySlug: 'quan-nu',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: ['Đen', 'Xám'],
    stockEach: 4,
    description:
      'Tuyết mưa co giãn đứng phom, ống lửng qua bắp chân. Lưng thun sau thoải mái, size S–XXL. Hợp môi trường công sở.',
  },
  // ---- Áo khoác nữ
  {
    name: 'Cardigan nữ len mỏng cúc gỗ',
    slug: 'ao-khoac-nu-cardigan-len',
    price: 279_000,
    categorySlug: 'ao-khoac-nu',
    sizes: [FREESIZE],
    colors: ['Be', 'Nâu', 'Đen'],
    stockEach: 11,
    description:
      'Len dệt mỏng mặc được trong phòng điều hoà lẫn thu se lạnh. Freesize dưới 62kg, cúc gỗ tự nhiên mỗi chiếc một vân.',
  },
  {
    name: 'Áo khoác nữ gió chống nắng có mũ',
    slug: 'ao-khoac-nu-gio-chong-nang',
    price: 319_000,
    categorySlug: 'ao-khoac-nu',
    sizes: SHIRT_SIZES,
    colors: ['Tím nhạt', 'Xám'],
    stockEach: 6,
    description:
      'Vải gió mỏng nhẹ xếp gọn bằng lòng bàn tay, khoá kéo full zip, mũ có dây rút. Size S–XL.',
  },
  // ---- Mũ nón
  {
    name: 'Mũ bucket vải trơn',
    slug: 'mu-bucket-vai-tron',
    price: 99_000,
    categorySlug: 'mu-non',
    sizes: [FREESIZE],
    colors: ['Đen', 'Be', 'Trắng'],
    stockEach: 50,
    description:
      'Vải canvas mềm hai mặt khâu chắc, vành 6cm che nắng tốt. Vòng đầu 56–58cm. Giặt tay giữ phom.',
  },
  {
    name: 'Mũ lưỡi trai thêu chữ',
    slug: 'mu-luoi-trai-theu',
    price: 119_000,
    categorySlug: 'mu-non',
    sizes: [FREESIZE],
    colors: ['Đen', 'Trắng', 'Xanh navy'],
    stockEach: 43,
    description:
      'Kaki dày đứng vành, thêu chữ nổi phía trước. Khoá gài kim loại chỉnh cỡ 55–60cm.',
  },
  // ---- Túi vải
  {
    name: 'Túi tote canvas 12L',
    slug: 'tui-tote-canvas-12l',
    price: 159_000,
    categorySlug: 'tui-vai',
    sizes: [FREESIZE],
    colors: ['Be', 'Đen'],
    stockEach: 42,
    description:
      'Canvas 16oz đựng nặng không xệ, đáy rộng đứng được laptop 14 inch. Có túi phụ trong và khuy bấm miệng túi.',
  },
  {
    name: 'Túi đeo chéo vải dù mini',
    slug: 'tui-deo-cheo-vai-du',
    price: 189_000,
    categorySlug: 'tui-vai',
    sizes: [FREESIZE],
    colors: ['Đen', 'Xám'],
    stockEach: 33,
    description:
      'Vải dù chống nước nhẹ, vừa điện thoại + ví + chai nước nhỏ. Dây chỉnh dài đeo chéo hoặc đeo hông.',
  },
  // ---- Tất vớ
  {
    name: 'Tất cổ trung cotton pack 3 đôi',
    slug: 'tat-co-trung-pack-3',
    price: 79_000,
    categorySlug: 'tat-vo',
    sizes: [FREESIZE],
    colors: ['Trắng', 'Đen', 'Trộn màu'],
    stockEach: 66,
    description:
      'Cotton dệt dày gót và mũi, bo cổ vừa không hằn chân. Pack 3 đôi màu trung tính, cỡ 39–44.',
  },
  {
    name: 'Tất cổ ngắn lười pack 5 đôi',
    slug: 'tat-co-ngan-luoi-pack-5',
    price: 89_000,
    categorySlug: 'tat-vo',
    sizes: [FREESIZE],
    colors: ['Trắng', 'Đen'],
    stockEach: 90,
    description:
      'Tất lười có đệm silicon gót chống tuột, mặt lưới thoáng. Pack 5 đôi, cỡ 38–43, hợp đi sneaker cổ thấp.',
  },
];

/**
 * Ảnh minh hoạ ổn định theo slug — cùng slug luôn ra cùng một ảnh.
 * Khung DỌC 4:5 theo DESIGN.md: thẻ sản phẩm quần áo dùng ảnh đứng.
 */
function imageFor(slug: string) {
  return {
    url: `https://picsum.photos/seed/${slug}/800/1000`,
    thumbUrl: `https://picsum.photos/seed/${slug}/400/500`,
  };
}

function variantsFor(item: SeedProduct) {
  return item.sizes.flatMap((size) =>
    item.colors.map((color) => ({ size, color, stock: item.stockEach })),
  );
}

async function seedUsers() {
  const [adminHash, customerHash] = await Promise.all([
    hashPassword(ADMIN_PASSWORD),
    hashPassword(CUSTOMER_PASSWORD),
  ]);

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: 'ADMIN' },
    create: {
      email: ADMIN_EMAIL,
      passwordHash: adminHash,
      fullName: 'Quản trị viên',
      phone: '0900000001',
      role: 'ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: CUSTOMER_EMAIL },
    update: {},
    create: {
      email: CUSTOMER_EMAIL,
      passwordHash: customerHash,
      fullName: 'Khách hàng thử nghiệm',
      phone: '0900000002',
      role: 'USER',
    },
  });
}

async function seedCategories() {
  const idBySlug = new Map<string, number>();

  for (const [index, parent] of CATEGORIES.entries()) {
    const row = await prisma.category.upsert({
      where: { slug: parent.slug },
      update: { name: parent.name, sortOrder: index },
      create: { name: parent.name, slug: parent.slug, sortOrder: index },
    });
    idBySlug.set(parent.slug, row.id);

    for (const [childIndex, child] of parent.children.entries()) {
      const childRow = await prisma.category.upsert({
        where: { slug: child.slug },
        update: { name: child.name, parentId: row.id, sortOrder: childIndex },
        create: {
          name: child.name,
          slug: child.slug,
          parentId: row.id,
          sortOrder: childIndex,
        },
      });
      idBySlug.set(child.slug, childRow.id);
    }
  }

  return idBySlug;
}

async function seedProducts(categoryIdBySlug: Map<string, number>) {
  for (const item of PRODUCTS) {
    const categoryId = categoryIdBySlug.get(item.categorySlug);
    if (categoryId === undefined) {
      throw new Error(
        `Sản phẩm "${item.slug}" trỏ tới danh mục không tồn tại: ${item.categorySlug}`,
      );
    }

    const image = imageFor(item.slug);
    const variants = variantsFor(item);

    await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        description: item.description,
        price: item.price,
        categoryId,
        isActive: true,
        // Xoá rồi tạo lại để chạy seed nhiều lần không sinh bản ghi trùng.
        // Lưu ý: xoá biến thể sẽ kéo dòng giỏ hàng tương ứng đi theo (Cascade)
        // — chấp nhận được với dữ liệu mẫu.
        images: { deleteMany: {}, create: [{ ...image, sortOrder: 0 }] },
        variants: { deleteMany: {}, create: variants },
      },
      create: {
        name: item.name,
        slug: item.slug,
        description: item.description,
        price: item.price,
        categoryId,
        images: { create: [{ ...image, sortOrder: 0 }] },
        variants: { create: variants },
      },
    });
  }
}

async function main() {
  console.log('Đang tạo dữ liệu mẫu cho tiệm quần áo...');

  await seedUsers();
  const categoryIdBySlug = await seedCategories();
  await seedProducts(categoryIdBySlug);

  const [users, categories, products, variants] = await Promise.all([
    prisma.user.count(),
    prisma.category.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
  ]);

  console.log(
    `\nXong. Hiện có ${users} người dùng, ${categories} danh mục, ${products} sản phẩm, ${variants} biến thể size/màu.`,
  );
  console.log('\nTài khoản đăng nhập thử:');
  console.log(`  Admin:  ${ADMIN_EMAIL}  /  ${ADMIN_PASSWORD}`);
  console.log(`  Khách:  ${CUSTOMER_EMAIL}  /  ${CUSTOMER_PASSWORD}\n`);
}

main()
  .catch((error: unknown) => {
    console.error('\nSeed thất bại:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
