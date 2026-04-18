-- ============================================
-- JLPT Master Database - Seed Data (No Prisma)
-- MySQL / utf8mb4
-- Updated: 2026-04-13
--
-- This file is OPTIONAL. Run after FULL_SCHEMA.sql.
-- IMPORTANT: Change the admin credentials before production use.
-- ============================================

START TRANSACTION;

-- Super admin (default password: ChangeMe123!)
-- Password is bcrypt hash (cost 12). You can replace it with your own.
INSERT INTO `admin` (`id`, `name`, `email`, `password`, `role`)
VALUES (
  1,
  'JLPT Master',
  'admin@example.com',
  '$2b$12$uBIs35BNmS8QKPnvZ.Vd1OTk8jDu7ac7M4ZhCkKVGKeHtaVWvhwiS',
  'super_admin'
);

-- Courses (teacherId = 1)
INSERT INTO `course` (`id`, `title`, `level`, `description`, `duration`, `teacherId`)
VALUES
  (1, 'JLPT N5 kursi', 'N5', 'Boshlang‘ich daraja\nDavomiyligi: 3 oy', 3, 1),
  (2, 'JLPT N4 kursi', 'N4', 'Boshlang‘ich-o‘rta daraja\nDavomiyligi: 4 oy', 4, 1),
  (3, 'JLPT N3 kursi', 'N3', 'O‘rta daraja\nDavomiyligi: 5 oy', 5, 1),
  (4, 'JLPT N2 kursi', 'N2', 'Yuqori daraja\nDavomiyligi: 6 oy', 6, 1),
  (5, 'JLPT N1 kursi', 'N1', 'Eng yuqori daraja\nDavomiyligi: 6 oy', 6, 1);

COMMIT;
