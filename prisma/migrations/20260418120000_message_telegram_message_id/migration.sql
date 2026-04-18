-- Store Telegram Bot API message_id for syncing edit/delete

-- AlterTable
ALTER TABLE `Message`
  ADD COLUMN `telegramMessageId` INTEGER NULL;
