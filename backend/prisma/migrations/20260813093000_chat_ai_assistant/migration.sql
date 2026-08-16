-- SPEC-CHAT-002: AI response lease for Gemini shopping assistant.
-- Additive only. Applying this migration is intentionally separate from creating it.

ALTER TABLE `conversations`
    ADD COLUMN `activeAiRunId` VARCHAR(64) NULL,
    ADD COLUMN `activeAiRunStartedAt` DATETIME(3) NULL;

CREATE INDEX `conversations_status_activeAiRunStartedAt_idx`
    ON `conversations`(`status`, `activeAiRunStartedAt`);
