-- Database initialisation script
--
-- Runs automatically on FIRST start (when db_data volume is empty).
-- To reset: docker compose down -v && docker compose up

CREATE TABLE IF NOT EXISTS notes (
    id         SERIAL       PRIMARY KEY,
    title      TEXT         NOT NULL,
    content    TEXT         NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO notes (title, content) VALUES
    ('the database is a bottleneck',
     'always has been. you can spin up 10 api replicas and it won''t matter — they''ll all be waiting on the same postgres connection pool. horizontal scaling only moves the problem downstream.'),
    ('agents don''t need to be smart',
     'the openai/huggingface thing wasn''t about intelligence. 1200 programs accidentally shared a filesystem and started leaving files for each other. no llm required. emergent coordination from dumb if-statements.'),
    ('p95 lies to you less than averages',
     'average response time of 40ms sounds fine. p95 of 1200ms means 1 in 20 requests is timing out. your users notice p95. your dashboards usually show the average.');
