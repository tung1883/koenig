-- Chess Web backend schema
-- MySQL 8+

CREATE DATABASE IF NOT EXISTS chess_web
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE chess_web;

CREATE TABLE IF NOT EXISTS user (
  userID INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user VARCHAR(50) NOT NULL,
  pwd VARCHAR(255) NOT NULL,
  displayName VARCHAR(80) NULL,
  bio VARCHAR(280) NULL,
  avatarUrl VARCHAR(500) NULL,
  PRIMARY KEY (userID),
  UNIQUE KEY uq_user_user (user)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS game (
  gameID INT UNSIGNED NOT NULL AUTO_INCREMENT,
  wp INT UNSIGNED NOT NULL,
  bp INT UNSIGNED NOT NULL,
  date DATE NULL,
  result VARCHAR(16) NULL,   -- e.g. "1,0", "0,4"
  record LONGTEXT NULL,      -- move record "i1,i2 i1,i2 ..."
  timer LONGTEXT NULL,       -- timer format + move times
  PRIMARY KEY (gameID),
  KEY idx_game_wp (wp),
  KEY idx_game_bp (bp),
  CONSTRAINT fk_game_wp_user FOREIGN KEY (wp) REFERENCES user(userID),
  CONSTRAINT fk_game_bp_user FOREIGN KEY (bp) REFERENCES user(userID)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS active_game (
  gameID INT UNSIGNED NOT NULL,
  wp INT UNSIGNED NOT NULL,
  bp INT UNSIGNED NOT NULL,
  turn INT UNSIGNED NOT NULL,
  timer LONGTEXT NOT NULL,         -- "base+inc t1 t2 ..."
  started_time BIGINT UNSIGNED NOT NULL,
  record LONGTEXT NULL,
  move_number INT UNSIGNED NULL,
  time_spent BIGINT UNSIGNED NULL,
  i1 TINYINT UNSIGNED NULL,
  i2 TINYINT UNSIGNED NULL,
  result VARCHAR(16) NULL,
  PRIMARY KEY (gameID),
  KEY idx_active_wp (wp),
  KEY idx_active_bp (bp),
  KEY idx_active_turn (turn),
  CONSTRAINT fk_active_game_game FOREIGN KEY (gameID) REFERENCES game(gameID) ON DELETE CASCADE,
  CONSTRAINT fk_active_game_wp_user FOREIGN KEY (wp) REFERENCES user(userID),
  CONSTRAINT fk_active_game_bp_user FOREIGN KEY (bp) REFERENCES user(userID),
  CONSTRAINT fk_active_game_turn_user FOREIGN KEY (turn) REFERENCES user(userID)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS drawOffers (
  gameID INT UNSIGNED NOT NULL,
  state BIT(2) NOT NULL DEFAULT b'00',
  PRIMARY KEY (gameID),
  CONSTRAINT fk_drawoffers_game FOREIGN KEY (gameID) REFERENCES game(gameID) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS request (
  reqID INT UNSIGNED NOT NULL AUTO_INCREMENT,
  receiver INT UNSIGNED NOT NULL,
  wp INT UNSIGNED NOT NULL,
  wu VARCHAR(50) NOT NULL,
  bp INT UNSIGNED NOT NULL,
  bu VARCHAR(50) NOT NULL,
  timer VARCHAR(32) NOT NULL,      -- e.g. "600+5"
  gameID INT UNSIGNED NULL,
  PRIMARY KEY (reqID),
  KEY idx_request_receiver (receiver),
  KEY idx_request_wp (wp),
  KEY idx_request_bp (bp),
  KEY idx_request_gameID (gameID),
  CONSTRAINT fk_request_receiver_user FOREIGN KEY (receiver) REFERENCES user(userID),
  CONSTRAINT fk_request_wp_user FOREIGN KEY (wp) REFERENCES user(userID),
  CONSTRAINT fk_request_bp_user FOREIGN KEY (bp) REFERENCES user(userID),
  CONSTRAINT fk_request_game FOREIGN KEY (gameID) REFERENCES game(gameID) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Keep exactly these 3 columns because backend uses:
-- insert into message values(?, ?, ?)
CREATE TABLE IF NOT EXISTS message (
  gameID INT UNSIGNED NOT NULL,
  userID INT UNSIGNED NOT NULL,
  message TEXT NOT NULL,
  KEY idx_message_gameID (gameID),
  KEY idx_message_userID (userID),
  CONSTRAINT fk_message_game FOREIGN KEY (gameID) REFERENCES game(gameID) ON DELETE CASCADE,
  CONSTRAINT fk_message_user FOREIGN KEY (userID) REFERENCES user(userID)
) ENGINE=InnoDB;
