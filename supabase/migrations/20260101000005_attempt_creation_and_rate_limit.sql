-- RF-02: atomic attempt creation, idempotency key and fixed-window rate limit.

alter table public.purchase_attempts add column idempotency_key text unique;

-- Creates customer, purchase attempt and consent record in one transaction.
create function public.create_purchase_attempt(
  p_name text,
  p_email text,
  p_whatsapp text,
  p_preference text,
  p_ip_hash text,
  p_idempotency_key text,
  p_consent_version text,
  p_consent_text text
) returns uuid
language plpgsql as $$
declare
  v_customer uuid;
  v_attempt uuid;
begin
  insert into public.customers (name, email, whatsapp)
    values (p_name, p_email, p_whatsapp)
    returning id into v_customer;

  insert into public.purchase_attempts (customer_id, delivery_preference, ip_hash, idempotency_key)
    values (v_customer, p_preference, p_ip_hash, p_idempotency_key)
    returning id into v_attempt;

  insert into public.consent_records (attempt_id, customer_id, consent_text_version, consent_text)
    values (v_attempt, v_customer, p_consent_version, p_consent_text);

  return v_attempt;
end $$;

-- Fixed-window counter: returns false when the limit for the window is exceeded.
create function public.hit_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_max integer
) returns boolean
language plpgsql as $$
declare
  v_window timestamptz :=
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into public.rate_limits (key, window_start, count)
    values (p_key, v_window, 1)
    on conflict (key, window_start)
    do update set count = public.rate_limits.count + 1
    returning count into v_count;
  return v_count <= p_max;
end $$;

-- Only the service role may call these functions.
revoke all on function public.create_purchase_attempt(text, text, text, text, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.hit_rate_limit(text, integer, integer)
  from public, anon, authenticated;
