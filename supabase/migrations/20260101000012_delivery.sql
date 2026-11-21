-- RF-08: e-mail delivery state and the atomic functions that drive its retries.

-- Reserves the e-mail delivery of an order for one send; creates the row on the first call.
-- Returns jsonb { claimed, attempt?, reason? }.
create function public.claim_delivery(p_order uuid) returns jsonb
language plpgsql as $$
declare
  v_delivery public.deliveries%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('deliver:' || p_order::text));
  if not exists (select 1 from public.results where order_id = p_order) then
    return jsonb_build_object('claimed', false, 'reason', 'no_result');
  end if;
  select * into v_delivery from public.deliveries where order_id = p_order and channel = 'email';
  if not found then
    -- The paid-order trigger runs before any insert, so an existing row is looked up first.
    insert into public.deliveries (order_id, channel) values (p_order, 'email')
      returning * into v_delivery;
  end if;
  if v_delivery.status = 'SENT' then
    return jsonb_build_object('claimed', false, 'reason', 'already_sent');
  end if;
  if v_delivery.status = 'FAILED' then
    return jsonb_build_object('claimed', false, 'reason', 'failed');
  end if;
  if v_delivery.next_attempt_at is not null and v_delivery.next_attempt_at > now() then
    return jsonb_build_object('claimed', false, 'reason', 'not_due');
  end if;
  if v_delivery.attempts >= 4 then
    return jsonb_build_object('claimed', false, 'reason', 'attempts_exhausted');
  end if;
  update public.deliveries
     set attempts = attempts + 1, next_attempt_at = now() + interval '2 minutes'
   where id = v_delivery.id;
  return jsonb_build_object('claimed', true, 'attempt', v_delivery.attempts + 1);
end $$;

-- The provider accepted the e-mail: the delivery is SENT and the order DELIVERED.
create function public.complete_delivery(p_order uuid) returns void
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext('deliver:' || p_order::text));
  update public.deliveries
     set status = 'SENT', sent_at = now(), next_attempt_at = null, last_error = null
   where order_id = p_order and channel = 'email';
  update public.orders set status = 'DELIVERED', delivered_at = now()
   where id = p_order and status = 'PROCESSING';
end $$;

-- A failed send: schedule the next attempt (1, 5, 15 minutes) or end the delivery after the 4th.
-- Returns jsonb { state: 'retry' | 'failed' | 'ignored', next_at? }.
create function public.fail_delivery(p_order uuid, p_error text) returns jsonb
language plpgsql as $$
declare
  v_attempts smallint;
  v_next timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('deliver:' || p_order::text));
  select attempts into v_attempts from public.deliveries
    where order_id = p_order and channel = 'email' and status = 'PENDING';
  if v_attempts is null then
    return jsonb_build_object('state', 'ignored');
  end if;
  if v_attempts < 4 then
    v_next := now() + case v_attempts when 1 then interval '1 minute'
                                      when 2 then interval '5 minutes'
                                      else interval '15 minutes' end;
    update public.deliveries set last_error = left(p_error, 500), next_attempt_at = v_next
     where order_id = p_order and channel = 'email';
    return jsonb_build_object('state', 'retry', 'next_at', v_next);
  end if;
  update public.deliveries set status = 'FAILED', last_error = left(p_error, 500), next_attempt_at = null
   where order_id = p_order and channel = 'email';
  update public.orders set status = 'FAILED', failure_reason = 'DELIVERY_FAILED'
   where id = p_order and status = 'PROCESSING';
  return jsonb_build_object('state', 'failed');
end $$;

-- A failed delivery of a paid order with a result goes back in line (admin "Reprocessar").
create function public.reset_delivery(p_order uuid) returns boolean
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext('deliver:' || p_order::text));
  update public.deliveries d
     set status = 'PENDING', attempts = 0, next_attempt_at = null, last_error = null
   where d.order_id = p_order and d.channel = 'email' and d.status = 'FAILED'
     and exists (select 1 from public.results r where r.order_id = p_order)
     and exists (select 1 from public.orders o where o.id = p_order
                 and o.status = 'FAILED' and o.failure_reason = 'DELIVERY_FAILED');
  if not found then
    return false;
  end if;
  update public.orders set status = 'PROCESSING', failure_reason = null where id = p_order;
  return true;
end $$;

revoke all on function public.claim_delivery(uuid) from public, anon, authenticated;
revoke all on function public.complete_delivery(uuid) from public, anon, authenticated;
revoke all on function public.fail_delivery(uuid, text) from public, anon, authenticated;
revoke all on function public.reset_delivery(uuid) from public, anon, authenticated;
