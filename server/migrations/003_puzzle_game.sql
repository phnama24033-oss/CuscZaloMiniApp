USE tuyensinh_zalo;

CREATE TABLE IF NOT EXISTS puzzle_plays (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id   INT UNSIGNED NOT NULL,
  `level`      TINYINT UNSIGNED NOT NULL,
  status       VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  started_at   DATETIME(3) NOT NULL,
  completed_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_puzzle_plays_student_level (student_id, `level`),
  KEY ix_puzzle_plays_student_status (student_id, status),
  CONSTRAINT chk_puzzle_plays_level CHECK (`level` IN (1, 2)),
  CONSTRAINT chk_puzzle_plays_status CHECK (status IN ('started', 'completed', 'failed')),
  CONSTRAINT chk_puzzle_plays_done CHECK (
    (status = 'started' AND completed_at IS NULL)
    OR (status <> 'started' AND completed_at IS NOT NULL AND completed_at >= started_at)),
  CONSTRAINT fk_puzzle_plays_student
    FOREIGN KEY (student_id) REFERENCES students (id) ON DELETE CASCADE
) ENGINE=InnoDB;
