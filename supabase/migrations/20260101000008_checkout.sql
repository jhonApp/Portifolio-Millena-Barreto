-- RF-05: atomic checkout. One PENDING order per attempt, lazy Pix expiry, charge attachment.

-- At most one order waiting for payment per attempt.
create unique index orders_one_pending_per_attempt
  on public.orders (attempt_id) where status = 'PENDING';

-- Decides what the checkout of an attempt must do. Never calls the gateway.
-- Returns jsonb: { state, order_id?, order_status?, payment? }
--   'existing'    a PENDING order with a valid payment (payment holds the Pix data)
--   'created'     a new PENDING order without payment; the caller must create the charge
--   'expired'     the previous Pix expired and renewal was not requested
--   'paid'        the attempt already has a paid order
--   'in_progress' a PENDING order without payment younger than 60 seconds exists
create function public.begin_checkout(p_attempt uuid, p_amount integer, p_renew boolean)
returns jsonb
language plpgsql as $$
declare
  v_expires timestamptz;
  v_version uuid;
  v_questions integer;
  v_answers integer;
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('checkout:' || p_attempt::text));

  select expires_at into v_expires from public.purchase_attempts where id = p_attempt;
  if v_expires is null or v_expires <= now() then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0001';
  end if;

  select version_id into v_version from public.answers where attempt_id = p_attempt limit 1;
  select count(*) into v_answers from public.answers where attempt_id = p_attempt;
  select count(*) into v_questions from public.questions where version_id = v_version;
  if v_version is null or v_questions = 0 or v_answers <> v_questions then
    raise exception 'ANSWERS_INCOMPLETE' using errcode = 'P0001';
  end if;

  -- Already paid: never open a second charge.
  select o.* into v_order from public.orders o
    where o.attempt_id = p_attempt
      and (o.status in ('APPROVED', 'PROCESSING', 'DELIVERED')
           or exists (select 1 from public.payments p where p.order_id = o.id and p.status = 'PAID'))
    order by o.created_at desc limit 1;
  if found then
    return jsonb_build_object('state', 'paid', 'order_id', v_order.id, 'order_status', v_order.status);
  end if;

  select o.* into v_order from public.orders o
    where o.attempt_id = p_attempt and o.status = 'PENDING';
  if found then
    select * into v_payment from public.payments where order_id = v_order.id;
    if not found then
      if v_order.created_at > now() - interval '60 seconds' then
        return jsonb_build_object('state', 'in_progress');
      end if;
      delete from public.orders where id = v_order.id;  -- leftover of a crashed request
    elsif v_payment.expires_at > now() then
      return jsonb_build_object(
        'state', 'existing',
        'order_id', v_order.id,
        'payment', jsonb_build_object(
          'amount_cents', v_payment.amount_cents,
          'pix_br_code', v_payment.pix_br_code,
          'pix_qr_image', v_payment.pix_qr_image,
          'expires_at', v_payment.expires_at
        )
      );
    else
      update public.orders
        set status = 'FAILED', failure_reason = 'PIX_EXPIRED', updated_at = now()
        where id = v_order.id;
      update public.payments set status = 'EXPIRED', updated_at = now() where id = v_payment.id;
    end if;
  end if;

  -- An expired Pix is only replaced when the customer asks for it.
  if not p_renew and exists (
    select 1 from public.orders where attempt_id = p_attempt and failure_reason = 'PIX_EXPIRED'
  ) then
    return jsonb_build_object('state', 'expired');
  end if;

  insert into public.orders (attempt_id, amount_cents) values (p_attempt, p_amount)
    returning * into v_order;
  return jsonb_build_object('state', 'created', 'order_id', v_order.id);
end $$;

-- Stores the charge of a PENDING order that has none yet.
create function public.attach_charge(
  p_order uuid,
  p_charge_id text,
  p_br_code text,
  p_qr_image text,
  p_expires_at timestamptz
) returns void
language plpgsql as $$
declare
  v_amount integer;
begin
  select amount_cents into v_amount from public.orders where id = p_order and status = 'PENDING';
  if v_amount is null then
    raise exception 'ORDER_NOT_PENDING' using errcode = 'P0001';
  end if;
  insert into public.payments (order_id, provider_charge_id, amount_cents, pix_br_code, pix_qr_image, expires_at)
    values (p_order, p_charge_id, v_amount, p_br_code, p_qr_image, p_expires_at);
end $$;

-- Removes an order that never got a charge. Never touches an order with a payment.
create function public.abort_checkout(p_order uuid) returns void
language sql as $$
  delete from public.orders o
   where o.id = p_order and o.status = 'PENDING'
     and not exists (select 1 from public.payments p where p.order_id = o.id);
$$;

revoke all on function public.begin_checkout(uuid, integer, boolean) from public, anon, authenticated;
revoke all on function public.attach_charge(uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.abort_checkout(uuid) from public, anon, authenticated;
