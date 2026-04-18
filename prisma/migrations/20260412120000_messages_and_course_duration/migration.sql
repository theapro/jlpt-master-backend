-- AlterTable
ALTER TABLE `Course` ADD COLUMN `duration` INTEGER NULL;

-- CreateTable
CREATE TABLE `Message` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `telegramId` VARCHAR(64) NOT NULL,
    `sender` ENUM('user', 'admin') NOT NULL,
    `text` TEXT NOT NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `message_telegramId_idx` (`telegramId`),
    INDEX `message_createdAt_idx` (`createdAt`),
    INDEX `message_telegramId_createdAt_idx` (`telegramId`, `createdAt`),
    INDEX `message_telegramId_isRead_idx` (`telegramId`, `isRead`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `message_telegramId_fkey` FOREIGN KEY (`telegramId`) REFERENCES `User`(`telegramId`) ON DELETE CASCADE ON UPDATE CASCADE;
