-- Additive banner storage for SPEC-BANNER-001 v0.4. No existing rows are changed.
CREATE TABLE `banners` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL,
  `imageUrl` VARCHAR(500) NOT NULL,
  `altText` VARCHAR(255) NOT NULL,
  `linkUrl` VARCHAR(500) NULL,
  `placement` ENUM('HOME_HERO') NOT NULL DEFAULT 'HOME_HERO',
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `banners_placement_isActive_sortOrder_id_idx`(`placement`, `isActive`, `sortOrder`, `id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
