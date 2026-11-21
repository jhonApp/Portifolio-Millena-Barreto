-- Integrity rules and access lockdown.

-- updated_at triggers on every table that has the column.
create trigger set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.purchase_attempts
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.questionnaire_versions
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.deliveries
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.content_versions
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.content_templates
  for each row execute function public.set_updated_at();

-- Results and deliveries can only be created for a paid order.
create function public.require_paid_order() returns trigger
language plpgsql as $$
declare
  current_status text;
begin
  select status into current_status from public.orders where id = new.order_id;
  if current_status is null or current_status not in ('APPROVED', 'PROCESSING', 'DELIVERED') then
    raise exception 'order must be APPROVED, PROCESSING or DELIVERED' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger results_require_paid before insert on public.results
  for each row execute function public.require_paid_order();
create trigger deliveries_require_paid before insert on public.deliveries
  for each row execute function public.require_paid_order();

-- Lockdown: row-level security on every table, no policies, no privileges for browser roles.
alter table public.customers enable row level security;
alter table public.purchase_attempts enable row level security;
alter table public.consent_records enable row level security;
alter table public.questionnaire_versions enable row level security;
alter table public.questions enable row level security;
alter table public.alternatives enable row level security;
alter table public.answers enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.results enable row level security;
alter table public.deliveries enable row level security;
alter table public.result_tokens enable row level security;
alter table public.content_versions enable row level security;
alter table public.content_templates enable row level security;
alter table public.automation_errors enable row level security;
alter table public.deletion_requests enable row level security;
alter table public.rate_limits enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- Private bucket for PDFs: PDF only, at most 2 MB, no policies for browser roles.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('diagnostics', 'diagnostics', false, 2097152, array['application/pdf'])
on conflict (id) do nothing;
