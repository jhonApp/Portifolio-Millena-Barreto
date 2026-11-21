-- The two trigger functions were created without an explicit revoke, so they kept
-- the default EXECUTE grant to PUBLIC (and therefore to anon and authenticated).
-- They cannot be called directly through the API, but the lockdown contract is
-- "no EXECUTE for anon/authenticated on any function in public".
-- Trigger firing does not check EXECUTE on the trigger function, so triggers keep working.
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.require_paid_order() from public, anon, authenticated;
