BEGIN;

ALTER TABLE public.china_stats_ladder_snapshots
  DROP CONSTRAINT china_stats_ladder_snapshots_collector_version_check;

ALTER TABLE public.china_stats_ladder_snapshots
  ADD CONSTRAINT china_stats_ladder_snapshots_collector_version_check
    CHECK (collector_version IN (1, 2));

COMMIT;
