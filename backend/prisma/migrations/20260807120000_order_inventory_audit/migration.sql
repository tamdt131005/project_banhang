-- SPEC-BE-001 v0.3: additive order lifecycle and inventory audit tables.
-- MySQL DDL auto-commits. Follow docs/backend/database.md backup and verification gates.

CREATE TABLE `order_status_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `type` ENUM('CREATED', 'TRANSITION', 'BASELINE') NOT NULL,
    `fromStatus` ENUM('PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED') NULL,
    `toStatus` ENUM('PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED') NOT NULL,
    `actorType` ENUM('CUSTOMER', 'ADMIN', 'SYSTEM') NOT NULL,
    `actorUserId` INTEGER NULL,
    `reason` VARCHAR(500) NULL,
    `occurredAt` DATETIME(3) NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `operationKey` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `order_status_history_operationKey_key`(`operationKey`),
    INDEX `order_status_history_orderId_recordedAt_id_idx`(`orderId`, `recordedAt`, `id`),
    INDEX `order_status_history_actorUserId_idx`(`actorUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_movements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `variantId` INTEGER NULL,
    `productNameSnapshot` VARCHAR(255) NOT NULL,
    `sizeSnapshot` VARCHAR(20) NOT NULL,
    `colorSnapshot` VARCHAR(50) NOT NULL,
    `type` ENUM('BASELINE', 'INITIAL_STOCK', 'ORDER_RESERVED', 'ORDER_RESTORED', 'ADMIN_ADJUSTMENT', 'VARIANT_RETIRED') NOT NULL,
    `beforeStock` INTEGER NULL,
    `afterStock` INTEGER NOT NULL,
    `delta` INTEGER NULL,
    `orderId` INTEGER NULL,
    `actorType` ENUM('CUSTOMER', 'ADMIN', 'SYSTEM') NOT NULL,
    `actorUserId` INTEGER NULL,
    `reason` VARCHAR(500) NULL,
    `operationKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `inventory_movements_operationKey_key`(`operationKey`),
    INDEX `inventory_movements_variantId_createdAt_id_idx`(`variantId`, `createdAt`, `id`),
    INDEX `inventory_movements_orderId_idx`(`orderId`),
    INDEX `inventory_movements_actorUserId_idx`(`actorUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `order_status_history`
    ADD CONSTRAINT `order_status_history_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `order_status_history`
    ADD CONSTRAINT `order_status_history_actorUserId_fkey`
    FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `inventory_movements`
    ADD CONSTRAINT `inventory_movements_variantId_fkey`
    FOREIGN KEY (`variantId`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `inventory_movements`
    ADD CONSTRAINT `inventory_movements_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `inventory_movements`
    ADD CONSTRAINT `inventory_movements_actorUserId_fkey`
    FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- A single recorded time makes the backfill provenance explicit. `occurredAt` remains NULL:
-- existing updatedAt values are not evidence for when a historical transition happened.
SET @be001_migration_time = CURRENT_TIMESTAMP(3);

INSERT INTO `order_status_history` (
    `orderId`, `type`, `fromStatus`, `toStatus`, `actorType`, `actorUserId`,
    `reason`, `occurredAt`, `recordedAt`, `operationKey`
)
SELECT
    o.`id`, 'BASELINE', NULL, o.`status`, 'SYSTEM', NULL,
    'SPEC-BE-001 baseline', NULL, @be001_migration_time, CONCAT('ORDER_BASELINE:', o.`id`)
FROM `orders` o
WHERE NOT EXISTS (
    SELECT 1 FROM `order_status_history` h
    WHERE h.`operationKey` = CONCAT('ORDER_BASELINE:', o.`id`)
);

INSERT INTO `inventory_movements` (
    `variantId`, `productNameSnapshot`, `sizeSnapshot`, `colorSnapshot`, `type`,
    `beforeStock`, `afterStock`, `delta`, `orderId`, `actorType`, `actorUserId`,
    `reason`, `operationKey`, `createdAt`
)
SELECT
    v.`id`, p.`name`, v.`size`, v.`color`, 'BASELINE',
    NULL, v.`stock`, NULL, NULL, 'SYSTEM', NULL,
    'SPEC-BE-001 baseline', CONCAT('INVENTORY_BASELINE:', v.`id`), @be001_migration_time
FROM `product_variants` v
INNER JOIN `products` p ON p.`id` = v.`productId`
WHERE NOT EXISTS (
    SELECT 1 FROM `inventory_movements` m
    WHERE m.`operationKey` = CONCAT('INVENTORY_BASELINE:', v.`id`)
);
