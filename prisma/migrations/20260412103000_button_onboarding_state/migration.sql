-- Add onboarding/state fields
ALTER TABLE `user`
  ADD COLUMN `currentStep` VARCHAR(32) NOT NULL DEFAULT 'START',
  ADD COLUMN `region` VARCHAR(64) NULL,
  ADD COLUMN `learningFormat` ENUM('online', 'offline') NULL;

-- Preserve legacy onboarding progress if present
UPDATE `user` SET `currentStep` = 'ASK_GOAL' WHERE `onboardingStep` = 'ASK_GOAL';
UPDATE `user`
SET `currentStep` = 'SELECT_EXPERIENCE'
WHERE `onboardingStep` = 'ASK_EXPERIENCE';

-- Convert legacy goal enum to string
ALTER TABLE `user` MODIFY COLUMN `goal` VARCHAR(191) NULL;

-- Convert legacy experience yes/no -> beginner/intermediate
ALTER TABLE `user` MODIFY COLUMN `experience` VARCHAR(32) NULL;
UPDATE `user` SET `experience` = 'beginner' WHERE `experience` = 'no';
UPDATE `user` SET `experience` = 'intermediate' WHERE `experience` = 'yes';
ALTER TABLE `user`
  MODIFY COLUMN `experience` ENUM('beginner', 'intermediate') NULL;

-- Drop legacy onboardingStep
ALTER TABLE `user` DROP COLUMN `onboardingStep`;
