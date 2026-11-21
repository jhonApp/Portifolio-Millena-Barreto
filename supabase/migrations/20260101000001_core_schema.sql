-- Core schema: customers, purchase attempts, consents, questionnaire, answers.
-- Conventions: snake_case, uuid keys, timestamptz dates, text + CHECK for fixed values.

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 120),
  email text not null check (char_length(email) <= 254 and email = lower(email)),
  whatsapp text not null check (whatsapp ~ '^\+55[1-9][0-9]9[0-9]{8}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_email_idx on public.customers (email);

create table public.purchase_attempts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  delivery_preference text not null check (delivery_preference in ('email', 'whatsapp', 'both')),
  ip_hash text,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index purchase_attempts_customer_idx on public.purchase_attempts (customer_id);
create index purchase_attempts_expires_idx on public.purchase_attempts (expires_at);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null unique references public.purchase_attempts(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  consent_text_version text not null,
  consent_text text not null,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.questionnaire_versions (
  id uuid primary key default gen_random_uuid(),
  version integer not null unique check (version >= 1),
  status text not null check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- At most one published questionnaire version at a time.
create unique index questionnaire_one_published_idx
  on public.questionnaire_versions ((true)) where status = 'published';

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.questionnaire_versions(id) on delete cascade,
  position smallint not null check (position >= 1),
  text text not null,
  unique (version_id, position)
);

create table public.alternatives (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  position smallint not null check (position between 1 and 4),
  text text not null,
  style text not null check (style in (
    'esportivo_natural', 'tradicional', 'elegante', 'romantico', 'criativo', 'dramatico'
  )),
  weight smallint not null default 1 check (weight between 1 and 3),
  unique (question_id, position)
);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.purchase_attempts(id) on delete cascade,
  version_id uuid not null references public.questionnaire_versions(id) on delete restrict,
  question_id uuid not null references public.questions(id) on delete restrict,
  alternative_id uuid not null references public.alternatives(id) on delete restrict,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);
create index answers_attempt_idx on public.answers (attempt_id);
