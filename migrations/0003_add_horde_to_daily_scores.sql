-- The horde each score was won against, as the server drew it then: hordes follow the prices, which may change
-- later, so checking a score needs the very horde it beat. Empty for scores sent before this column.
ALTER TABLE daily_scores ADD COLUMN horde TEXT CHECK (horde IS NULL OR length(horde) <= 1000);
