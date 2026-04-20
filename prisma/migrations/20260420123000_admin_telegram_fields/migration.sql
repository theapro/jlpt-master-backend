-- AlterTable
ALTER TABLE `Admin`
    ADD COLUMN `tgUsername` VARCHAR(64) NULL,
    ADD COLUMN `tgChatId` VARCHAR(64) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Admin_tgUsername_key` ON `Admin`(`tgUsername`);

-- CreateIndex
CREATE INDEX `Admin_tgChatId_idx` ON `Admin`(`tgChatId`);
