-- Commerce tables: orders, payments, webhook events, results, deliveries, result tokens.

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.purchase_attempts(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'APPROVED', 'PROCESSING', 'DELIVERED', 'FAILED')),
  failure_reason text check (failure_reason in (
    'PIX_EXPIRED', 'GENERATION_FAILED', 'DELIVERY_FAILED', 'INVALID_ANSWERS', 'MISSING_CONTENT'
  )),
  approved_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'FAILED' or failure_reason is null)
);
create index orders_attempt_idx on public.orders (attempt_id);
create index orders_status_created_idx on public.orders (status, created_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'abacatepay',
  provider_charge_id text not null unique,
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID', 'EXPIRED', 'FAILED')),
  amount_cents integer not null check (amount_cents > 0),
  pix_br_code text,
  pix_qr_image text,
  expires_at timestamptz not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);

-- Idempotency: one row per provider event id.
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'abacatepay',
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);

create table public.results (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  version_id uuid not null references public.questionnaire_versions(id) on delete restrict,
  points jsonb not null,
  predominant_style text not null check (predominant_style in (
    'esportivo_natural', 'tradicional', 'elegante', 'romantico', 'criativo', 'dramatico'
  )),
  secondary_style text not null check (secondary_style in (
    'esportivo_natural', 'tradicional', 'elegante', 'romantico', 'criativo', 'dramatico'
  )),
  content jsonb not null,
  pdf_path text,
  created_at timestamptz not null default now(),
  check (predominant_style <> secondary_style)
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp')),
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
  attempts smallint not null default 0 check (attempts >= 0),
  last_error text,
  next_attempt_at timestamptz,
  sent_at timestamptz,
  marked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, channel)
);

-- A customer may hold several valid result links; only hashes are stored.
create table public.result_tokens (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index result_tokens_order_idx on public.result_tokens (order_id);
