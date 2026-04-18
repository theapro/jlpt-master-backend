-- Create BotButton table for configurable reply keyboard buttons per state

CREATE TABLE `BotButton` (
    `id` VARCHAR(191) NOT NULL,
    `state` VARCHAR(32) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `action` VARCHAR(64) NULL,
    `row` INTEGER NOT NULL,
    `col` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BotButton_state_row_col_key`(`state`, `row`, `col`),
    INDEX `BotButton_state_isActive_row_col_idx`(`state`, `isActive`, `row`, `col`),
    INDEX `BotButton_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
