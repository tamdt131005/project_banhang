CREATE TABLE `email_otp_challenges` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `purpose` ENUM('REGISTER', 'PASSWORD_RESET') NOT NULL,
    `otpDigest` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `failedAttemptCount` INTEGER NOT NULL DEFAULT 0,
    `resendAvailableAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `email_otp_challenges_email_purpose_key`(`email`, `purpose`),
    INDEX `email_otp_challenges_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
