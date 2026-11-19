-- Run once after 01_schema.sql and 02_seed_data.sql.
ALTER TABLE schools
  ADD COLUMN oa_url VARCHAR(255) NULL AFTER display_name,
  ADD CONSTRAINT ck_schools_oa_url
    CHECK (
      oa_url IS NULL
      OR oa_url LIKE 'https://zalo.me/%'
      OR oa_url LIKE 'https://oa.zalo.me/%'
    );
