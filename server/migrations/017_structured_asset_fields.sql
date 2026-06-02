-- +goose Up
ALTER TABLE assets ADD COLUMN margin REAL;
ALTER TABLE assets ADD COLUMN direction TEXT NOT NULL DEFAULT 'long'
  CHECK(direction IN ('long', 'short'));
ALTER TABLE assets ADD COLUMN lot_qty REAL;

UPDATE assets SET direction = 'short' WHERE note LIKE '%sell-to-open%';

UPDATE assets SET margin = CAST(
  SUBSTR(note, INSTR(note, 'margin=') + 7,
    INSTR(SUBSTR(note, INSTR(note, 'margin=') + 7), ' ') - 1
  ) AS REAL)
WHERE note LIKE '%margin=%';

UPDATE assets SET lot_qty = CAST(
  SUBSTR(note, INSTR(note, 'orig_qty:') + 9)
  AS REAL)
WHERE note LIKE '%orig_qty:%';

-- +goose Down
ALTER TABLE assets DROP COLUMN lot_qty;
ALTER TABLE assets DROP COLUMN direction;
ALTER TABLE assets DROP COLUMN margin;
