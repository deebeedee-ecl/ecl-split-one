BEGIN;

CREATE TYPE public."LzyumiRefreshPermitStatus" AS ENUM (
  'ISSUED',
  'COMPLETED',
  'REJECTED',
  'EXPIRED'
);

CREATE TABLE public.lzyumi_refresh_permits (
  id UUID NOT NULL,
  token_hash TEXT NOT NULL,
  requester_profile_id TEXT NOT NULL,
  target_profile_id TEXT NOT NULL,
  status public."LzyumiRefreshPermitStatus" NOT NULL DEFAULT 'ISSUED',
  terminal_code TEXT,
  issued_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ(3) NOT NULL,
  completed_at TIMESTAMPTZ(3),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT lzyumi_refresh_permits_pkey PRIMARY KEY (id),
  CONSTRAINT lzyumi_refresh_permits_token_hash_key UNIQUE (token_hash),
  CONSTRAINT lzyumi_refresh_permits_requester_profile_id_fkey
    FOREIGN KEY (requester_profile_id) REFERENCES public."AccountProfile"(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT lzyumi_refresh_permits_target_profile_id_fkey
    FOREIGN KEY (target_profile_id) REFERENCES public."AccountProfile"(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX lzyumi_refresh_permits_target_issued_idx
  ON public.lzyumi_refresh_permits (target_profile_id, issued_at);
CREATE INDEX lzyumi_refresh_permits_requester_issued_idx
  ON public.lzyumi_refresh_permits (requester_profile_id, issued_at);
CREATE INDEX lzyumi_refresh_permits_status_expiry_idx
  ON public.lzyumi_refresh_permits (status, expires_at);

REVOKE ALL PRIVILEGES ON TABLE public.lzyumi_refresh_permits
  FROM PUBLIC, anon, authenticated;

COMMIT;
