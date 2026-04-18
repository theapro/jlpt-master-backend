-- CreateTable
CREATE TABLE `AdminPasswordResetToken` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `adminId` INTEGER NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AdminPasswordResetToken_tokenHash_key`(`tokenHash`),
    INDEX `AdminPasswordResetToken_adminId_idx`(`adminId`),
    INDEX `AdminPasswordResetToken_expiresAt_idx`(`expiresAt`),
    INDEX `AdminPasswordResetToken_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AdminPasswordResetToken` ADD CONSTRAINT `AdminPasswordResetToken_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `Admin`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
