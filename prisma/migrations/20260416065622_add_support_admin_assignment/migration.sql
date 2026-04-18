-- AlterTable
ALTER TABLE `user` ADD COLUMN `supportAdminId` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_supportAdminId_fkey` FOREIGN KEY (`supportAdminId`) REFERENCES `Admin`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
