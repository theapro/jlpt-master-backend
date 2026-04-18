-- DropForeignKey
ALTER TABLE `Message` DROP FOREIGN KEY `message_telegramId_fkey`;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `telegramNickname` VARCHAR(191) NULL,
    ADD COLUMN `telegramUsername` VARCHAR(64) NULL;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_telegramId_fkey` FOREIGN KEY (`telegramId`) REFERENCES `User`(`telegramId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `Message` RENAME INDEX `message_createdAt_idx` TO `Message_createdAt_idx`;

-- RenameIndex
ALTER TABLE `Message` RENAME INDEX `message_telegramId_createdAt_idx` TO `Message_telegramId_createdAt_idx`;

-- RenameIndex
ALTER TABLE `Message` RENAME INDEX `message_telegramId_idx` TO `Message_telegramId_idx`;

-- RenameIndex
ALTER TABLE `Message` RENAME INDEX `message_telegramId_isRead_idx` TO `Message_telegramId_isRead_idx`;
