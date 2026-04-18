-- AlterTable
ALTER TABLE `User` ADD COLUMN `experience` ENUM('yes', 'no') NULL,
    ADD COLUMN `goal` ENUM('jlpt_exam', 'work', 'study', 'travel', 'anime_manga', 'conversation', 'culture', 'other') NULL,
    ADD COLUMN `onboardingStep` ENUM('ASK_GOAL', 'ASK_EXPERIENCE') NULL;
