-- The access model is "RLS on, no policies, anon/authenticated revoked; the server
-- uses the service role". Earlier migrations only revoked from anon/authenticated and
-- relied on the local Supabase stack granting service_role by default. A hosted
-- project does not (service_role only had Dxtm on tables and nothing on functions),
-- so every server query failed with "permission denied for table ...".
-- Grant service_role explicitly. anon and authenticated stay without any access.
grant select, insert, update, delete on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Objects created by later migrations get the same grants.
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant execute on functions to service_role;
