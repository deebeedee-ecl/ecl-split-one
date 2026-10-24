-- Apply in the same transaction as add-match-workflow.sql.
ALTER TABLE public.tournament_members ADD CONSTRAINT tournament_member_pot CHECK (pot IS NULL OR pot BETWEEN 1 AND 5);
ALTER TABLE public.tournament_fixtures ADD CONSTRAINT tournament_fixture_shape CHECK
  (home_team_id <> away_team_id AND best_of IN (1,3,5) AND week > 0 AND revision >= 0 AND stage IN ('ROUND_ROBIN','SEMIFINAL','FINAL','TIEBREAKER'));
ALTER TABLE public.tournament_reports ADD CONSTRAINT tournament_report_shape CHECK
  (game_number BETWEEN 1 AND 5 AND status IN ('PENDING','APPROVED','REJECTED','REPLACED')
   AND source IN ('MANUAL','JSON','HUB') AND platform ~ '^[A-Z0-9]{2,12}$'
   AND (league_game_id IS NULL OR league_game_id ~ '^[0-9]{5,20}$') AND jsonb_typeof(payload)='object');
CREATE UNIQUE INDEX tournament_one_approved_game ON public.tournament_reports(fixture_id,game_number) WHERE status='APPROVED';
CREATE UNIQUE INDEX tournament_unique_league_game ON public.tournament_reports(platform,league_game_id) WHERE status='APPROVED' AND league_game_id IS NOT NULL;
ALTER TABLE public.tournament_notifications ADD CONSTRAINT tournament_notification_shape CHECK
  (status IN ('PENDING','SENDING','SENT','UNKNOWN','FAILED') AND attempts BETWEEN 0 AND 8 AND length(content) BETWEEN 1 AND 3500 AND channel_id ~ '^[0-9]{1,30}$');

CREATE FUNCTION public.tournament_member_scope_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tournament_registrations r WHERE r.id=NEW.registration_id
    AND r.tournament_id=NEW.tournament_id AND r.profile_id=NEW.profile_id AND r.pool='MAIN') THEN
    RAISE EXCEPTION 'Tournament membership requires the matching main registration';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tournament_member_scope_guard BEFORE INSERT OR UPDATE ON public.tournament_members FOR EACH ROW EXECUTE FUNCTION public.tournament_member_scope_guard();

CREATE FUNCTION public.tournament_floater_scope_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tournament_registrations r WHERE r.tournament_id=NEW.tournament_id
    AND r.profile_id=NEW.profile_id AND r.pool='FLOATER') THEN RAISE EXCEPTION 'Not a tournament floater'; END IF;
  IF NOT EXISTS (SELECT 1 FROM tournament_reports r JOIN tournament_fixtures f ON f.id=r.fixture_id
    WHERE r.id=NEW.report_id AND r.tournament_id=NEW.tournament_id AND r.status='APPROVED'
    AND NEW.team_id IN (f.home_team_id,f.away_team_id)) THEN RAISE EXCEPTION 'Invalid floater match assignment'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tournament_floater_scope_guard BEFORE INSERT OR UPDATE ON public.tournament_floater_appearances FOR EACH ROW EXECUTE FUNCTION public.tournament_floater_scope_guard();

ALTER TABLE public.tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_floater_appearances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tournament_teams,public.tournament_members,public.tournament_fixtures,public.tournament_reports,public.tournament_floater_appearances,public.tournament_notifications FROM PUBLIC,anon,authenticated;

ALTER TABLE public.tournament_collection_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tournament_collection_jobs FROM PUBLIC,anon,authenticated;
ALTER TABLE public.tournament_collection_jobs ADD CONSTRAINT tournament_collection_shape CHECK
 (status IN ('PENDING','UPLOADED','CANCELLED') AND league_game_id ~ '^[0-9]{5,20}$' AND game_number BETWEEN 1 AND 5 AND expires_at>created_at);
ALTER TABLE public.tournament_collection_jobs ADD CONSTRAINT tournament_collection_fixture FOREIGN KEY(fixture_id,tournament_id) REFERENCES public.tournament_fixtures(id,tournament_id);
ALTER TABLE public.tournament_collection_jobs ADD CONSTRAINT tournament_collection_profile FOREIGN KEY(profile_id) REFERENCES public."AccountProfile"(id);
ALTER TABLE public.tournament_collection_jobs ADD CONSTRAINT tournament_collection_report FOREIGN KEY(report_id,tournament_id) REFERENCES public.tournament_reports(id,tournament_id);

-- Serializes both ingestion paths for a known Ionia League Game ID. No legacy
-- rows or scores are rewritten. Ambiguous reports remain pending for review.
CREATE FUNCTION public.reject_tournament_game_in_legacy() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_catalog AS $$
DECLARE source jsonb; game_id text;
BEGIN
  IF TG_TABLE_NAME='InhouseSession' THEN game_id:=NEW."lzyumiGameId";
  ELSIF TG_TABLE_NAME='InhouseReportJob' THEN source:=NEW."rawMatchData";
  ELSE source:=NEW."ocrRawJson"; END IF;
  game_id:=COALESCE(game_id,source->>'gameId',source#>>'{raw,gameId}');
  IF game_id ~ '^[0-9]{5,20}$' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('HN1:'||game_id,0));
    IF EXISTS(SELECT 1 FROM tournament_reports WHERE platform='HN1' AND league_game_id=game_id AND status='APPROVED') THEN
      RAISE EXCEPTION 'League game already approved in separate tournament workflow';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tournament_legacy_game_guard BEFORE INSERT OR UPDATE OF "ocrRawJson" ON public."MatchGame" FOR EACH ROW EXECUTE FUNCTION public.reject_tournament_game_in_legacy();
CREATE TRIGGER tournament_legacy_report_guard BEFORE INSERT OR UPDATE OF "rawMatchData" ON public."InhouseReportJob" FOR EACH ROW EXECUTE FUNCTION public.reject_tournament_game_in_legacy();
CREATE TRIGGER tournament_legacy_session_guard BEFORE INSERT OR UPDATE OF "lzyumiGameId" ON public."InhouseSession" FOR EACH ROW EXECUTE FUNCTION public.reject_tournament_game_in_legacy();
REVOKE ALL ON FUNCTION public.reject_tournament_game_in_legacy(),public.tournament_member_scope_guard(),public.tournament_floater_scope_guard() FROM PUBLIC,anon,authenticated;
