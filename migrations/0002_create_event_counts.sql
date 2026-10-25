-- How many times each tracked event happened each day: totals only, no visitor is identified.
CREATE TABLE event_counts (
  day TEXT NOT NULL CHECK (length(day) = 10),
  name TEXT NOT NULL CHECK (length(name) <= 40),
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name)
);
