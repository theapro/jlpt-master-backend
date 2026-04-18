-- ============================================
-- JLPT Master Database - Full Schema (No Prisma)
-- MySQL / utf8mb4
-- Updated: 2026-04-13
--
-- Purpose:
-- - Create the entire database schema from zero in ONE SQL file
-- - Does NOT create Prisma-specific tables (e.g. _prisma_migrations)
--
-- Usage:
-- 1) Create a database (example):
--    CREATE DATABASE jlpt_master CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--    USE jlpt_master;
-- 2) Run this file
-- 3) Optionally run SEED_DATA.sql
-- ============================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Drop in FK-safe order
DROP TABLE IF EXISTS `enrollment`;
DROP TABLE IF EXISTS `registration`;
DROP TABLE IF EXISTS `message`;
DROP TABLE IF EXISTS `supportrequest`;
DROP TABLE IF EXISTS `course`;
DROP TABLE IF EXISTS `admin`;
DROP TABLE IF EXISTS `user`;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- TABLE: user
-- ============================================
CREATE TABLE `user` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `telegramId` VARCHAR(64) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(32) NULL,
  `jlptLevel` ENUM('N5','N4','N3','N2','N1') NULL,

  `currentStep` VARCHAR(32) NOT NULL DEFAULT 'START',
  `goal` VARCHAR(191) NULL,
  `experience` ENUM('beginner','intermediate') NULL,
  `region` VARCHAR(64) NULL,
  `learningFormat` ENUM('online','offline') NULL,

  `isInSupport` BOOLEAN NOT NULL DEFAULT false,
  `supportStatus` ENUM('waiting','active','closed') NOT NULL DEFAULT 'closed',

  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `user_telegramId_key` (`telegramId`),
  INDEX `user_createdAt_idx` (`createdAt`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- TABLE: admin
-- ============================================
CREATE TABLE `admin` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `role` ENUM('teacher','admin','super_admin') NOT NULL DEFAULT 'teacher',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `admin_email_key` (`email`),
  INDEX `admin_role_idx` (`role`),
  INDEX `admin_createdAt_idx` (`createdAt`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- TABLE: course
-- ============================================
CREATE TABLE `course` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(200) NOT NULL,
  `level` ENUM('N5','N4','N3','N2','N1') NOT NULL,
  `description` TEXT NOT NULL,
  `duration` INTEGER NULL,
  `teacherId` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `course_teacherId_idx` (`teacherId`),
  INDEX `course_level_idx` (`level`),
  INDEX `course_createdAt_idx` (`createdAt`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- TABLE: message
-- ============================================
CREATE TABLE `message` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `telegramId` VARCHAR(64) NOT NULL,
  `sender` ENUM('user','admin') NOT NULL,
  `text` TEXT NOT NULL,
  `isRead` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `message_telegramId_idx` (`telegramId`),
  INDEX `message_createdAt_idx` (`createdAt`),
  INDEX `message_telegramId_createdAt_idx` (`telegramId`, `createdAt`),
  INDEX `message_telegramId_isRead_idx` (`telegramId`, `isRead`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- TABLE: enrollment
-- ============================================
CREATE TABLE `enrollment` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `courseId` INTEGER NOT NULL,
  `status` ENUM('pending','active','completed') NOT NULL DEFAULT 'pending',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `enrollment_courseId_idx` (`courseId`),
  INDEX `enrollment_userId_idx` (`userId`),
  INDEX `enrollment_status_idx` (`status`),
  INDEX `enrollment_createdAt_idx` (`createdAt`),
  UNIQUE INDEX `enrollment_userId_courseId_key` (`userId`, `courseId`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- TABLE: registration
-- ============================================
CREATE TABLE `registration` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `telegramId` VARCHAR(64) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `phone` VARCHAR(32) NOT NULL,
  `courseId` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `registration_telegramId_idx` (`telegramId`),
  INDEX `registration_courseId_idx` (`courseId`),
  INDEX `registration_createdAt_idx` (`createdAt`),
  UNIQUE INDEX `registration_telegramId_courseId_key` (`telegramId`, `courseId`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- TABLE: supportrequest
-- ============================================
CREATE TABLE `supportrequest` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `telegramId` VARCHAR(64) NOT NULL,
  `status` ENUM('waiting','active','closed') NOT NULL DEFAULT 'waiting',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  INDEX `supportrequest_telegramId_idx` (`telegramId`),
  INDEX `supportrequest_status_idx` (`status`),
  INDEX `supportrequest_createdAt_idx` (`createdAt`),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- FOREIGN KEYS
-- ============================================
ALTER TABLE `course`
  ADD CONSTRAINT `course_teacherId_fkey`
  FOREIGN KEY (`teacherId`) REFERENCES `admin`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `enrollment`
  ADD CONSTRAINT `enrollment_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `enrollment`
  ADD CONSTRAINT `enrollment_courseId_fkey`
  FOREIGN KEY (`courseId`) REFERENCES `course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `registration`
  ADD CONSTRAINT `registration_courseId_fkey`
  FOREIGN KEY (`courseId`) REFERENCES `course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `supportrequest`
  ADD CONSTRAINT `supportrequest_telegramId_fkey`
  FOREIGN KEY (`telegramId`) REFERENCES `user`(`telegramId`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `message`
  ADD CONSTRAINT `message_telegramId_fkey`
  FOREIGN KEY (`telegramId`) REFERENCES `user`(`telegramId`) ON DELETE CASCADE ON UPDATE CASCADE;
