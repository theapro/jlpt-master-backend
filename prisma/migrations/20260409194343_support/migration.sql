-- AlterTable
ALTER TABLE `user` ADD COLUMN `isInSupport` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `supportStatus` ENUM('waiting', 'active', 'closed') NOT NULL DEFAULT 'closed';

-- CreateTable
CREATE TABLE `SupportRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `telegramId` VARCHAR(64) NOT NULL,
    `status` ENUM('waiting', 'active', 'closed') NOT NULL DEFAULT 'waiting',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SupportRequest_telegramId_idx`(`telegramId`),
    INDEX `SupportRequest_status_idx`(`status`),
    INDEX `SupportRequest_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SupportRequest` ADD CONSTRAINT `SupportRequest_telegramId_fkey` FOREIGN KEY (`telegramId`) REFERENCES `User`(`telegramId`) ON DELETE CASCADE ON UPDATE CASCADE;
