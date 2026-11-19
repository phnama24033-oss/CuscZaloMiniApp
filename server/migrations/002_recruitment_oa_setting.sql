CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  setting_value VARCHAR(255) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB;

INSERT IGNORE INTO app_settings (setting_key, setting_value)
VALUES ('recruitment_oa_url', 'https://zalo.me/149986668034000433');
