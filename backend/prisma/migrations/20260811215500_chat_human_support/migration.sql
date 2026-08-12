-- SPEC-CHAT-001: additive authenticated chat and human-support foundation.

CREATE TABLE `conversations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `assignedAdminId` INTEGER NULL,
    `status` ENUM('AI', 'WAITING_ADMIN', 'LIVE', 'CLOSED') NOT NULL DEFAULT 'AI',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `closedAt` DATETIME(3) NULL,

    INDEX `conversations_userId_createdAt_id_idx`(`userId`, `createdAt`, `id`),
    INDEX `conversations_status_createdAt_id_idx`(`status`, `createdAt`, `id`),
    INDEX `conversations_assignedAdminId_status_updatedAt_id_idx`(`assignedAdminId`, `status`, `updatedAt`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `chat_messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `conversationId` INTEGER NOT NULL,
    `senderType` ENUM('USER', 'AI', 'ADMIN', 'SYSTEM') NOT NULL,
    `senderUserId` INTEGER NULL,
    `content` TEXT NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chat_messages_conversationId_createdAt_id_idx`(`conversationId`, `createdAt`, `id`),
    INDEX `chat_messages_senderUserId_idx`(`senderUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `conversations`
    ADD CONSTRAINT `conversations_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `conversations`
    ADD CONSTRAINT `conversations_assignedAdminId_fkey`
    FOREIGN KEY (`assignedAdminId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `chat_messages`
    ADD CONSTRAINT `chat_messages_conversationId_fkey`
    FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `chat_messages`
    ADD CONSTRAINT `chat_messages_senderUserId_fkey`
    FOREIGN KEY (`senderUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
