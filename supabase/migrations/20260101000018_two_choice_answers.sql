-- Quiz v2 RF-01: two-choice answers and per-version scoring rules.
-- The rules are data: every default reproduces questionnaire version 1 (one choice, 1 point,
-- tie-break by counting chosen alternatives), so existing rows and behavior do not change.

alter table public.questionnaire_versions
  add column first_choice_points smallint not null default 1
    check (first_choice_points between 1 and 5),
  add column second_choice_points smallint not null default 0
    check (second_choice_points between 0 and 5),
  add column late_tiebreak_basis text not null default 'answers'
    check (late_tiebreak_basis in ('answers', 'points')),
  add constraint questionnaire_second_not_above_first
    check (second_choice_points <= first_choice_points);

alter table public.questions
  add column max_choices smallint not null default 1
    check (max_choices in (1, 2));

alter table public.answers
  add column second_alternative_id uuid
    references public.alternatives(id) on delete restrict,
  add constraint answers_second_differs
    check (second_alternative_id is null or second_alternative_id <> alternative_id);

-- save_answer takes an optional second choice. The old 3-parameter function is dropped:
-- a call with 3 arguments still resolves to this one because p_second defaults to null.
drop function public.save_answer(uuid, uuid, uuid);

create function public.save_answer(
  p_attempt uuid,
  p_question uuid,
  p_alternative uuid,
  p_second uuid default null
) returns integer
language plpgsql as $$
declare
  v_expires timestamptz;
  v_version uuid;
  v_max_choices smallint;
  v_pinned uuid;
  v_count integer;
begin
  -- Serialize saves of one attempt so the version check and the upsert cannot interleave.
  perform pg_advisory_xact_lock(hashtext(p_attempt::text));

  select expires_at into v_expires from public.purchase_attempts where id = p_attempt;
  if v_expires is null or v_expires <= now() then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0001';
  end if;

  select q.version_id, q.max_choices into v_version, v_max_choices
    from public.alternatives a
    join public.questions q on q.id = a.question_id
    where a.id = p_alternative and q.id = p_question;
  if v_version is null then
    raise exception 'ALTERNATIVE_MISMATCH' using errcode = 'P0001';
  end if;

  -- The second choice must be allowed, different from the first and an alternative of the question.
  if p_second is not null then
    if v_max_choices < 2 or p_second = p_alternative then
      raise exception 'CHOICE_NOT_ALLOWED' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.alternatives where id = p_second and question_id = p_question
    ) then
      raise exception 'ALTERNATIVE_MISMATCH' using errcode = 'P0001';
    end if;
  end if;

  -- The attempt is pinned to the version of its first saved answer.
  select version_id into v_pinned from public.answers where attempt_id = p_attempt limit 1;
  if v_pinned is null then
    if not exists (
      select 1 from public.questionnaire_versions where id = v_version and status = 'published'
    ) then
      raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
    end if;
  elsif v_pinned <> v_version then
    raise exception 'VERSION_MISMATCH' using errcode = 'P0001';
  end if;

  insert into public.answers (attempt_id, version_id, question_id, alternative_id, second_alternative_id)
    values (p_attempt, v_version, p_question, p_alternative, p_second)
    on conflict (attempt_id, question_id)
    do update set alternative_id = excluded.alternative_id,
                  second_alternative_id = excluded.second_alternative_id,
                  answered_at = now();

  select count(*) into v_count from public.answers where attempt_id = p_attempt;
  return v_count;
end $$;

revoke all on function public.save_answer(uuid, uuid, uuid, uuid) from public, anon, authenticated;
