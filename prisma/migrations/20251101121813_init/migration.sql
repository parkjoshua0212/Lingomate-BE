-- CreateTable
CREATE TABLE `User` (
    `user_id` INTEGER NOT NULL AUTO_INCREMENT,
    `password_hash` VARCHAR(255) NOT NULL,
    `username` VARCHAR(100) NOT NULL,
    `language_pref` VARCHAR(10) NULL DEFAULT 'ko',
    `voice_setting` VARCHAR(50) NULL DEFAULT 'Kore',
    `role` ENUM('USER', 'PREMIUM') NOT NULL DEFAULT 'USER',
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Topic` (
    `topic_id` INTEGER NOT NULL AUTO_INCREMENT,
    `title_jp` VARCHAR(255) NOT NULL,
    `title_en` VARCHAR(255) NOT NULL,
    `start_prompt` TEXT NOT NULL,
    `category` VARCHAR(50) NULL,

    PRIMARY KEY (`topic_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Conversation` (
    `conversation_id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `topic_id` INTEGER NOT NULL,
    `language_used` VARCHAR(5) NOT NULL,
    `started_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `ended_at` TIMESTAMP(0) NULL,

    PRIMARY KEY (`conversation_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `message_id` INTEGER NOT NULL AUTO_INCREMENT,
    `conversation_id` INTEGER NOT NULL,
    `sender` ENUM('USER', 'AI') NOT NULL DEFAULT 'USER',
    `content` TEXT NOT NULL,
    `timestamp` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`message_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_topic_id_fkey` FOREIGN KEY (`topic_id`) REFERENCES `Topic`(`topic_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `Conversation`(`conversation_id`) ON DELETE CASCADE ON UPDATE CASCADE;
