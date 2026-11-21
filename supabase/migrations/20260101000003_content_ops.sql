-- Editable content, automation errors, deletion requests and rate limits.

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version >= 1),
  status text not null check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index content_one_published_idx
  on public.content_versions ((true)) where status = 'published';

create table public.content_templates (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.content_versions(id) on delete cascade,
  kind text not null check (kind in ('style_block', 'pair_paragraph', 'piece', 'accessory')),
  style text check (style in (
    'esportivo_natural', 'tradicional', 'elegante', 'romantico', 'criativo', 'dramatico'
  )),
  secondary_style text check (secondary_style in (
    'esportivo_natural', 'tradicional', 'elegante', 'romantico', 'criativo', 'dramatico'
  )),
  block text check (block in ('result', 'pieces', 'accessories', 'guidance')),
  position smallint not null default 1 check (position >= 1),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index content_templates_key_idx on public.content_templates (
  version_id, kind, coalesce(style, ''), coalesce(secondary_style, ''), coalesce(block, ''), position
);

create table public.automation_errors (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  step text not null,
  message text not null,
  context jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index automation_errors_open_idx on public.automation_errors (created_at)
  where resolved_at is null;

create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  email text,
  token_hash text not null unique,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count integer not null default 1 check (count >= 0),
  primary key (key, window_start)
);
