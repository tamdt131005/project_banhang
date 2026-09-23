-- RBAC-001: add per-user admin-section permissions. No existing rows are changed.

ALTER TABLE `users`
    MODIFY `role` ENUM('USER', 'STAFF', 'ADMIN') NOT NULL DEFAULT 'USER';

CREATE TABLE `user_staff_permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `permission` ENUM('DASHBOARD', 'ORDERS', 'INVENTORY', 'CATALOG', 'BANNERS', 'CUSTOMERS', 'SUPPORT') NOT NULL,
    `grantedById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `user_staff_permissions_userId_permission_key`(`userId`, `permission`),
    INDEX `user_staff_permissions_grantedById_idx`(`grantedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `user_staff_permissions`
    ADD CONSTRAINT `user_staff_permissions_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `user_staff_permissions`
    ADD CONSTRAINT `user_staff_permissions_grantedById_fkey`
    FOREIGN KEY (`grantedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
