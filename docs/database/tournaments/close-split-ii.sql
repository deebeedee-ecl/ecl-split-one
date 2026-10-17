-- Operational close: retains all registrations, roles and consent evidence.
BEGIN;
UPDATE public.tournaments SET status = 'REGISTRATION_CLOSED', updated_at = CURRENT_TIMESTAMP
WHERE slug = 'ecl-split-ii-2026' AND status = 'REGISTRATION_OPEN';
COMMIT;
