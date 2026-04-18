-- Add message edit/delete metadata and per-admin hide (delete-for-me)

-- AlterTable
ALTER TABLE `Message`
  ADD COLUMN `editedAt` DATETIME(3) NULL,
  ADD COLUMN `deletedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Message_telegramId_deletedAt_idx` ON `Message`(`telegramId`, `deletedAt`);

-- CreateTable
CREATE TABLE `MessageHidden` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `messageId` INTEGER NOT NULL,
    `adminId` INTEGER NOT NULL,
    `hiddenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MessageHidden_messageId_adminId_key`(`messageId`, `adminId`),
    INDEX `MessageHidden_adminId_idx`(`adminId`),
    INDEX `MessageHidden_messageId_idx`(`messageId`),
    INDEX `MessageHidden_hiddenAt_idx`(`hiddenAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MessageHidden` ADD CONSTRAINT `MessageHidden_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `Message`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MessageHidden` ADD CONSTRAINT `MessageHidden_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `Admin`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
