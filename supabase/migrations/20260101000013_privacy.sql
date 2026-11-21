-- RF-09: privacy. Paid orders outlive the customer in anonymized form, and the functions that
-- erase a customer, purge unpaid attempts and confirm deletion requests run atomically.

-- A paid order keeps its id, amount, status and dates after the customer is erased: the attempt link
-- is cut (SET NULL) instead of cascading the delete to the payment record.
alter table public.orders alter column attempt_id drop not null;
alter table public.orders drop constraint orders_attempt_id_fkey;
alter table public.orders add constraint orders_attempt_id_fkey
  foreign key (attempt_id) references public.purchase_attempts(id) on delete set null;

alter table public.deletion_requests add column last_error text;
create index deletion_requests_pending_idx on public.deletion_requests (confirmed_at)
  where confirmed_at is not null and completed_at is null;
create index deletion_requests_notice_idx on public.deletion_requests (completed_at)
  where completed_at is not null and email is not null;

-- Confirms a deletion request by the hash of its token. Idempotent for a request already confirmed.
-- Returns jsonb { result: 'unknown' | 'expired' | 'confirmed', request_id?, completed? }.
create function public.confirm_deletion_request(p_token_hash text) returns jsonb
language plpgsql as $$
declare
  v_request public.deletion_requests%rowtype;
begin
  select * into v_request from public.deletion_requests where token_hash = p_token_hash for update;
  if not found then
    return jsonb_build_object('result', 'unknown');
  end if;
  if v_request.confirmed_at is null and v_request.expires_at <= now() then
    return jsonb_build_object('result', 'expired');
  end if;
  update public.deletion_requests set confirmed_at = coalesce(confirmed_at, now()) where id = v_request.id;
  return jsonb_build_object('result', 'confirmed', 'request_id', v_request.id,
                            'completed', v_request.completed_at is not null);
end $$;

-- Marks a request completed. Only the first caller gets true, so only one caller sends the notice.
create function public.complete_deletion_request(p_request uuid) returns boolean
language plpgsql as $$
begin
  update public.deletion_requests set completed_at = now(), last_error = null
   where id = p_request and completed_at is null;
  return found;
end $$;

-- What an erasure of one customer needs to know before it starts.
-- Returns jsonb { in_flight: boolean, pdf_orders: [order id, ...] }.
create function public.erasure_plan(p_customer uuid) returns jsonb
language plpgsql as $$
declare
  v_in_flight boolean;
  v_pdf uuid[];
begin
  select exists (
    select 1 from public.orders o join public.purchase_attempts a on a.id = o.attempt_id
     where a.customer_id = p_customer and o.status in ('APPROVED', 'PROCESSING')
  ) into v_in_flight;
  select coalesce(array_agg(r.order_id), '{}') into v_pdf
    from public.results r
    join public.orders o on o.id = r.order_id
    join public.purchase_attempts a on a.id = o.attempt_id
   where a.customer_id = p_customer and r.pdf_path is not null;
  return jsonb_build_object('in_flight', v_in_flight, 'pdf_orders', to_jsonb(v_pdf));
end $$;

-- Erases one customer in one transaction. Paid orders stay, detached and cleared of anything that
-- identifies the person; orders without a PAID payment are deleted. Waits (deferred) while an
-- order is in flight. Returns jsonb { result: 'erased' | 'deferred' | 'not_found' }.
create function public.erase_customer(p_customer uuid) returns jsonb
language plpgsql as $$
declare
  v_order uuid;
  v_paid uuid[];
  v_unpaid uuid[];
  v_charges text[];
begin
  perform pg_advisory_xact_lock(hashtext('erase:' || p_customer::text));
  if not exists (select 1 from public.customers where id = p_customer) then
    return jsonb_build_object('result', 'not_found');
  end if;

  -- The same lock approve_order takes: a payment cannot slip in between the check and the delete.
  for v_order in
    select o.id from public.orders o join public.purchase_attempts a on a.id = o.attempt_id
     where a.customer_id = p_customer order by o.id
  loop
    perform pg_advisory_xact_lock(hashtext('approve:' || v_order::text));
  end loop;

  if exists (
    select 1 from public.orders o join public.purchase_attempts a on a.id = o.attempt_id
     where a.customer_id = p_customer and o.status in ('APPROVED', 'PROCESSING')
  ) then
    return jsonb_build_object('result', 'deferred');
  end if;

  select coalesce(array_agg(o.id), '{}') into v_paid
    from public.orders o join public.purchase_attempts a on a.id = o.attempt_id
   where a.customer_id = p_customer
     and exists (select 1 from public.payments p where p.order_id = o.id and p.status = 'PAID');
  select coalesce(array_agg(o.id), '{}') into v_unpaid
    from public.orders o join public.purchase_attempts a on a.id = o.attempt_id
   where a.customer_id = p_customer and not (o.id = any(v_paid));

  delete from public.orders where id = any(v_unpaid);

  select coalesce(array_agg(provider_charge_id), '{}') into v_charges
    from public.payments where order_id = any(v_paid);
  delete from public.results where order_id = any(v_paid);
  delete from public.deliveries where order_id = any(v_paid);
  delete from public.result_tokens where order_id = any(v_paid);
  update public.payments set pix_br_code = null, pix_qr_image = null where order_id = any(v_paid);
  update public.webhook_events set payload = jsonb_build_object('anonymized', true)
   where provider = 'abacatepay' and payload #>> '{data,transparent,id}' = any(v_charges);

  -- Cascades attempts, answers and consent; the foreign key detaches the paid orders.
  delete from public.customers where id = p_customer;
  return jsonb_build_object('result', 'erased');
end $$;

-- Deletes up to p_limit unpaid attempts older than their 7 days (expires_at), with their orders,
-- answers and consent, and the customers left without attempts. Returns how many attempts went.
create function public.purge_unpaid_attempts(p_limit integer) returns integer
language plpgsql as $$
declare
  v_attempts uuid[];
  v_customers uuid[];
begin
  select coalesce(array_agg(s.id), '{}') into v_attempts from (
    select a.id from public.purchase_attempts a
     where a.expires_at < now()
       and not exists (
         select 1 from public.orders o
          where o.attempt_id = a.id
            and (o.status in ('APPROVED', 'PROCESSING', 'DELIVERED')
                 or exists (select 1 from public.payments p where p.order_id = o.id and p.status = 'PAID'))
       )
     order by a.expires_at
     limit p_limit
     for update of a skip locked
  ) s;
  if cardinality(v_attempts) = 0 then
    return 0;
  end if;
  select coalesce(array_agg(distinct customer_id), '{}') into v_customers
    from public.purchase_attempts where id = any(v_attempts);
  delete from public.orders where attempt_id = any(v_attempts);
  delete from public.purchase_attempts where id = any(v_attempts);
  delete from public.customers c
   where c.id = any(v_customers)
     and not exists (select 1 from public.purchase_attempts a where a.customer_id = c.id);
  return cardinality(v_attempts);
end $$;

-- Customers whose paid orders are all older than 12 months (oldest first), with no order in flight
-- and no attempt that is still active.
create function public.paid_customers_due(p_limit integer) returns setof uuid
language sql stable as $$
  select c.id
    from public.customers c
    join public.purchase_attempts a on a.customer_id = c.id
    join public.orders o on o.attempt_id = a.id
   where exists (select 1 from public.payments p where p.order_id = o.id and p.status = 'PAID')
   group by c.id
  having max(o.approved_at) < now() - interval '12 months'
     and not bool_or(o.status in ('APPROVED', 'PROCESSING'))
     and not exists (select 1 from public.purchase_attempts live
                      where live.customer_id = c.id and live.expires_at > now())
   order by max(o.approved_at)
   limit p_limit
$$;

revoke all on function public.confirm_deletion_request(text) from public, anon, authenticated;
revoke all on function public.complete_deletion_request(uuid) from public, anon, authenticated;
revoke all on function public.erasure_plan(uuid) from public, anon, authenticated;
revoke all on function public.erase_customer(uuid) from public, anon, authenticated;
revoke all on function public.purge_unpaid_attempts(integer) from public, anon, authenticated;
revoke all on function public.paid_customers_due(integer) from public, anon, authenticated;
