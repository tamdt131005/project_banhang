-- DropForeignKey
ALTER TABLE `cart_items` DROP FOREIGN KEY `cart_items_cartId_fkey`;

-- DropForeignKey
ALTER TABLE `cart_items` DROP FOREIGN KEY `cart_items_productId_fkey`;

-- DropIndex
DROP INDEX `cart_items_cartId_productId_key` ON `cart_items`;

-- DropIndex
DROP INDEX `cart_items_productId_idx` ON `cart_items`;

-- AlterTable
ALTER TABLE `cart_items` DROP COLUMN `productId`,
    ADD COLUMN `variantId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `order_items` ADD COLUMN `color` VARCHAR(50) NULL,
    ADD COLUMN `size` VARCHAR(20) NULL,
    ADD COLUMN `variantId` INTEGER NULL;

-- AlterTable
ALTER TABLE `products` DROP COLUMN `stock`;

-- CreateTable
CREATE TABLE `product_variants` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `productId` INTEGER NOT NULL,
    `size` VARCHAR(20) NOT NULL,
    `color` VARCHAR(50) NOT NULL,
    `stock` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `product_variants_productId_idx`(`productId`),
    UNIQUE INDEX `product_variants_productId_size_color_key`(`productId`, `size`, `color`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `cart_items_variantId_idx` ON `cart_items`(`variantId`);

-- CreateIndex
CREATE UNIQUE INDEX `cart_items_cartId_variantId_key` ON `cart_items`(`cartId`, `variantId`);

-- CreateIndex
CREATE INDEX `order_items_variantId_idx` ON `order_items`(`variantId`);

-- AddForeignKey
-- Sửa tay so với bản diff sinh tự động:
--   1. BỎ câu "ADD CONSTRAINT addresses_userId_fkey" — FK này đã tồn tại từ
--      migration init, thêm lại sẽ lỗi trùng tên.
--   2. THÊM lại cart_items_cartId_fkey ở cuối — nó bị drop ở đầu file để gỡ
--      unique index cũ (cartId, productId), và index mới (cartId, variantId)
--      giờ đã có nên FK gắn lại được. Diff quên bước này.
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_cartId_fkey` FOREIGN KEY (`cartId`) REFERENCES `carts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

