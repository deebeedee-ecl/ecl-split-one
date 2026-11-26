BEGIN;

CREATE TABLE public.china_stats_ladder_snapshots (
  server TEXT NOT NULL,
  platform_id TEXT NOT NULL,
  queue TEXT NOT NULL DEFAULT 'RANKED_SOLO_5x5',
  captured_at TIMESTAMPTZ(3) NOT NULL,
  coverage JSONB NOT NULL,
  rows JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  collector_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT china_stats_ladder_snapshots_pkey PRIMARY KEY (server),
  CONSTRAINT china_stats_ladder_snapshots_server_check
    CHECK (server IN ('ionia', 'super-server')),
  CONSTRAINT china_stats_ladder_snapshots_platform_check
    CHECK (platform_id IN ('HN1', 'BGP2')),
  CONSTRAINT china_stats_ladder_snapshots_queue_check
    CHECK (queue = 'RANKED_SOLO_5x5'),
  CONSTRAINT china_stats_ladder_snapshots_hash_check
    CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT china_stats_ladder_snapshots_collector_version_check
    CHECK (collector_version = 1)
);

CREATE INDEX china_stats_ladder_snapshots_captured_idx
  ON public.china_stats_ladder_snapshots (captured_at);

REVOKE ALL PRIVILEGES ON TABLE public.china_stats_ladder_snapshots
  FROM PUBLIC, anon, authenticated;

COMMIT;
