-- RF-06: webhook event idempotency and exactly-once order approval.

-- Stores a provider event once. Returns 'new', 'duplicate_processed' or 'duplicate_unprocessed'.
create function public.record_webhook_event(p_event_id text, p_event_type text, p_payload jsonb)
returns text
language plpgsql as $$
declare
  v_processed timestamptz;
begin
  insert into public.webhook_events (event_id, event_type, payload)
    values (p_event_id, p_event_type, p_payload)
    on conflict (provider, event_id) do nothing;
  if found then
    return 'new';
  end if;
  select processed_at into v_processed from public.webhook_events
    where provider = 'abacatepay' and event_id = p_event_id;
  return case when v_processed is null then 'duplicate_unprocessed' else 'duplicate_processed' end;
end $$;

-- Approves the order of a paid charge exactly once. The caller already verified the
-- provider status and the amount. Returns jsonb { result, order_id?, late?, order_status? }.
create function public.approve_order(p_charge_id text, p_token_hash text)
returns jsonb
language plpgsql as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_late boolean;
begin
  select * into v_payment from public.payments where provider_charge_id = p_charge_id;
  if not found then
    return jsonb_build_object('result', 'unknown_charge');
  end if;

  perform pg_advisory_xact_lock(hashtext('approve:' || v_payment.order_id::text));
  select * into v_order from public.orders where id = v_payment.order_id;

  if v_order.status in ('APPROVED', 'PROCESSING', 'DELIVERED') then
    return jsonb_build_object('result', 'already_approved', 'order_id', v_order.id, 'order_status', v_order.status);
  end if;

  -- Another order of the same attempt is already paid: do not approve a second one.
  if exists (
    select 1 from public.orders o
     where o.attempt_id = v_order.attempt_id and o.id <> v_order.id
       and o.status in ('APPROVED', 'PROCESSING', 'DELIVERED')
  ) then
    update public.payments set status = 'PAID', paid_at = coalesce(paid_at, now()) where id = v_payment.id;
    return jsonb_build_object('result', 'duplicate_payment', 'order_id', v_order.id);
  end if;

  v_late := v_order.status = 'FAILED' and v_order.failure_reason = 'PIX_EXPIRED';
  if v_order.status <> 'PENDING' and not v_late then
    return jsonb_build_object('result', 'not_approvable', 'order_id', v_order.id);
  end if;

  update public.orders
     set status = 'APPROVED', failure_reason = null, approved_at = now()
   where id = v_order.id and (status = 'PENDING' or (status = 'FAILED' and failure_reason = 'PIX_EXPIRED'));
  update public.payments set status = 'PAID', paid_at = now() where id = v_payment.id;
  insert into public.result_tokens (order_id, token_hash, expires_at)
    values (v_order.id, p_token_hash, now() + interval '30 days');

  return jsonb_build_object('result', 'approved', 'order_id', v_order.id, 'late', v_late);
end $$;

revoke all on function public.record_webhook_event(text, text, jsonb) from public, anon, authenticated;
revoke all on function public.approve_order(text, text) from public, anon, authenticated;
