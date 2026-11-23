USE tuyensinh_zalo;

CREATE TABLE IF NOT EXISTS puzzle_images (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  mime_type  VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  image_data MEDIUMBLOB NOT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_puzzle_images_active_sort (is_active, sort_order, id)
) ENGINE=InnoDB;

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('puzzle_replay_cooldown_seconds', '600')
ON DUPLICATE KEY UPDATE setting_value = setting_value;
