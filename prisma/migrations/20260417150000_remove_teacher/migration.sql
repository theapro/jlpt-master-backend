-- Remove teacher concept (AdminRole.teacher + Course.teacherId)

-- 1) Admin.role: migrate existing teacher roles to admin
UPDATE `Admin` SET `role` = 'admin' WHERE `role` = 'teacher';

-- 2) Admin.role: drop 'teacher' enum value and default to 'admin'
ALTER TABLE `Admin`
  MODIFY COLUMN `role` ENUM('admin', 'super_admin') NOT NULL DEFAULT 'admin';

-- 3) Course.teacherId: drop FK + index + column
ALTER TABLE `Course` DROP FOREIGN KEY `Course_teacherId_fkey`;
DROP INDEX `Course_teacherId_idx` ON `Course`;
ALTER TABLE `Course` DROP COLUMN `teacherId`;
