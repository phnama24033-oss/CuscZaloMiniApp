USE tuyensinh_zalo;

ALTER TABLE puzzle_plays
  DROP INDEX uq_puzzle_plays_student_level,
  ADD KEY ix_puzzle_plays_student_level_id (student_id, `level`, id);
