-- CreateTable
CREATE TABLE `Registration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `telegramId` VARCHAR(64) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(32) NOT NULL,
    `courseId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Registration_telegramId_idx`(`telegramId`),
    INDEX `Registration_courseId_idx`(`courseId`),
    INDEX `Registration_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `Registration_telegramId_courseId_key`(`telegramId`, `courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Registration` ADD CONSTRAINT `Registration_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
