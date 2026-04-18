-- Add onboarding/state fields
ALTER TABLE `User`
  ADD COLUMN `currentStep` VARCHAR(32) NOT NULL DEFAULT 'START',
  ADD COLUMN `region` VARCHAR(64) NULL,
  ADD COLUMN `learningFormat` ENUM('online', 'offline') NULL;

-- Preserve legacy onboarding progress if present
UPDATE `User` SET `currentStep` = 'ASK_GOAL' WHERE `onboardingStep` = 'ASK_GOAL';
UPDATE `User`
SET `currentStep` = 'SELECT_EXPERIENCE'
WHERE `onboardingStep` = 'ASK_EXPERIENCE';

-- Convert legacy goal enum to string
ALTER TABLE `User` MODIFY COLUMN `goal` VARCHAR(191) NULL;

-- Convert legacy experience yes/no -> beginner/intermediate
ALTER TABLE `User` MODIFY COLUMN `experience` VARCHAR(32) NULL;
UPDATE `User` SET `experience` = 'beginner' WHERE `experience` = 'no';
UPDATE `User` SET `experience` = 'intermediate' WHERE `experience` = 'yes';
ALTER TABLE `User`
  MODIFY COLUMN `experience` ENUM('beginner', 'intermediate') NULL;

-- Drop legacy onboardingStep
ALTER TABLE `User` DROP COLUMN `onboardingStep`;
