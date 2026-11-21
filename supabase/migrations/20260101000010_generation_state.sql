-- RF-07: generation state on orders and the atomic functions that drive retries.

alter table public.orders
  add column generation_attempts smallint not null default 0 check (generation_attempts between 0 and 4),
  add column generation_next_at timestamptz;
create index orders_generation_due_idx on public.orders (generation_next_at)
  where status = 'PROCESSING' and generation_next_at is not null;

-- Reserves an order for one generation run. Returns jsonb { claimed, attempt?, reason? }.
-- Claimable: APPROVED, or PROCESSING whose generation_next_at is due (a retry or an expired lease).
create function public.claim_generation(p_order uuid) returns jsonb
language plpgsql as $$
declare
  v_order public.orders%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('generate:' || p_order::text));
  select * into v_order from public.orders where id = p_order;
  if not found then
    return jsonb_build_object('claimed', false, 'reason', 'not_found');
  end if;
  if v_order.status = 'APPROVED'
     or (v_order.status = 'PROCESSING' and v_order.generation_next_at is not null
         and v_order.generation_next_at <= now()) then
    if v_order.generation_attempts >= 4 then
      return jsonb_build_object('claimed', false, 'reason', 'attempts_exhausted');
    end if;
    update public.orders
       set status = 'PROCESSING',
           generation_attempts = generation_attempts + 1,
           generation_next_at = now() + interval '2 minutes'
     where id = p_order;
    return jsonb_build_object('claimed', true, 'attempt', v_order.generation_attempts + 1);
  end if;
  return jsonb_build_object('claimed', false, 'reason', 'not_claimable');
end $$;

-- Records a failed run. p_retry = false fails the order at once with p_reason; with p_retry = true
-- the next attempt is scheduled (30 s, 2 min, 10 min) or, after the 4th attempt, the order fails
-- with GENERATION_FAILED. Returns jsonb { state: 'retry' | 'failed' | 'ignored', next_at?, reason? }.
create function public.fail_generation(p_order uuid, p_reason text, p_retry boolean) returns jsonb
language plpgsql as $$
declare
  v_attempts smallint;
  v_next timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('generate:' || p_order::text));
  select generation_attempts into v_attempts
    from public.orders where id = p_order and status = 'PROCESSING';
  if v_attempts is null then
    return jsonb_build_object('state', 'ignored');
  end if;
  if p_retry and v_attempts < 4 then
    v_next := now() + case v_attempts when 1 then interval '30 seconds'
                                      when 2 then interval '2 minutes'
                                      else interval '10 minutes' end;
    update public.orders set generation_next_at = v_next where id = p_order;
    return jsonb_build_object('state', 'retry', 'next_at', v_next);
  end if;
  update public.orders
     set status = 'FAILED',
         failure_reason = case when p_retry then 'GENERATION_FAILED' else p_reason end,
         generation_next_at = null
   where id = p_order;
  return jsonb_build_object('state', 'failed',
    'reason', case when p_retry then 'GENERATION_FAILED' else p_reason end);
end $$;

-- Puts a paid order that failed in generation back to APPROVED with a clean schedule.
create function public.reset_generation(p_order uuid) returns boolean
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext('generate:' || p_order::text));
  update public.orders o
     set status = 'APPROVED', failure_reason = null, generation_attempts = 0, generation_next_at = null
   where o.id = p_order and o.status = 'FAILED'
     and o.failure_reason in ('GENERATION_FAILED', 'INVALID_ANSWERS', 'MISSING_CONTENT')
     and exists (select 1 from public.payments p where p.order_id = o.id and p.status = 'PAID');
  return found;
end $$;

revoke all on function public.claim_generation(uuid) from public, anon, authenticated;
revoke all on function public.fail_generation(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.reset_generation(uuid) from public, anon, authenticated;
