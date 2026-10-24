-- One row per player and day: the fewest points that beat that day's horde.
CREATE TABLE daily_scores (
  day TEXT NOT NULL CHECK (length(day) = 10),
  player_hash TEXT NOT NULL CHECK (length(player_hash) = 64),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 20),
  points INTEGER NOT NULL CHECK (points BETWEEN 1 AND 1000),
  size INTEGER NOT NULL CHECK (size BETWEEN 1 AND 100),
  team TEXT NOT NULL CHECK (length(team) <= 1000),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (day, player_hash)
);

CREATE INDEX daily_scores_ranking ON daily_scores (day, points, updated_at);
