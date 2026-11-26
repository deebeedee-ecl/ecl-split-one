WITH snapshot_metadata AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'server', server,
        'platformId', platform_id,
        'collectorVersion', collector_version,
        'capturedAt', captured_at,
        'rowCount', jsonb_array_length(rows)
      )
      ORDER BY server
    ),
    '[]'::jsonb
  ) AS snapshots
  FROM public.china_stats_ladder_snapshots
)
SELECT
  current_database() = 'postgres' AS correct_database,
  to_regclass('public.china_stats_ladder_snapshots') IS NOT NULL AS ladder_table_present,
  COALESCE((
    SELECT role.rolname
    FROM pg_class relation
    JOIN pg_roles role ON role.oid = relation.relowner
    WHERE relation.oid = to_regclass('public.china_stats_ladder_snapshots')
  ), 'missing') AS table_owner,
  EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = to_regclass('public.china_stats_ladder_snapshots')
      AND conname = 'china_stats_ladder_snapshots_collector_version_check'
      AND pg_get_constraintdef(oid) LIKE '%ARRAY[1, 2]%'
  ) AS v2_constraint_present,
  (
    SELECT count(*)
    FROM public._prisma_migrations
    WHERE migration_name IN (
      '20261126030000_add_china_stats_ladder_snapshots',
      '20261126180000_add_china_stats_ladder_v2'
    )
      AND finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  ) AS completed_ladder_migration_count,
  (
    SELECT count(*)
    FROM information_schema.table_privileges
    WHERE table_schema = 'public'
      AND table_name = 'china_stats_ladder_snapshots'
      AND grantee IN ('PUBLIC', 'anon', 'authenticated')
  ) AS browser_role_grant_count,
  EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'ecl_china_stats_migrator'
  ) AS temporary_migrator_present,
  (SELECT snapshots FROM snapshot_metadata) AS snapshot_metadata;
