-- Cleanup migration: remove JLPT level/region, update support statuses, and add missing fields

-- 1) SupportStatus enum changes (waiting -> pending, add none)
ALTER TABLE `User`
  MODIFY COLUMN `supportStatus` ENUM('waiting', 'pending', 'active', 'closed', 'none') NOT NULL DEFAULT 'closed';

ALTER TABLE `SupportRequest`
  MODIFY COLUMN `status` ENUM('waiting', 'pending', 'active', 'closed', 'none') NOT NULL DEFAULT 'waiting';

UPDATE `User` SET `supportStatus` = 'pending' WHERE `supportStatus` = 'waiting';
UPDATE `SupportRequest` SET `status` = 'pending' WHERE `status` = 'waiting';

UPDATE `User` SET `isInSupport` = true WHERE `supportStatus` IN ('pending', 'active');
UPDATE `User` SET `isInSupport` = false WHERE `supportStatus` IN ('none', 'closed');

ALTER TABLE `User`
  MODIFY COLUMN `supportStatus` ENUM('none', 'pending', 'active', 'closed') NOT NULL DEFAULT 'none';

ALTER TABLE `SupportRequest`
  MODIFY COLUMN `status` ENUM('none', 'pending', 'active', 'closed') NOT NULL DEFAULT 'pending';

-- 2) Remove legacy user fields (level/region)
ALTER TABLE `User` DROP COLUMN `region`;
ALTER TABLE `User` DROP COLUMN `jlptLevel`;

-- 3) Course: remove level + add isActive/updatedAt
ALTER TABLE `Course` DROP COLUMN `level`;

ALTER TABLE `Course`
  ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `Course` ADD COLUMN `updatedAt` DATETIME(3) NULL;
UPDATE `Course` SET `updatedAt` = `createdAt` WHERE `updatedAt` IS NULL;
ALTER TABLE `Course` MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL;

CREATE INDEX `Course_isActive_idx` ON `Course`(`isActive`);

-- 4) Enrollment: add registration metadata fields
ALTER TABLE `Enrollment`
  ADD COLUMN `name` VARCHAR(100) NULL,
  ADD COLUMN `phone` VARCHAR(32) NULL,
  ADD COLUMN `format` ENUM('online', 'offline') NULL;

ALTER TABLE `Enrollment` ADD COLUMN `updatedAt` DATETIME(3) NULL;
UPDATE `Enrollment` SET `updatedAt` = `createdAt` WHERE `updatedAt` IS NULL;
ALTER TABLE `Enrollment` MODIFY COLUMN `updatedAt` DATETIME(3) NOT NULL;
