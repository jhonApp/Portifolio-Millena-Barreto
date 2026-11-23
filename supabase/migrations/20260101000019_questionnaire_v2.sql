-- Quiz v2 RF-02: question set version 2, atomic publication and version routing.
-- Version 1 and every existing row stay as they are. Version 2 is created as a DRAFT: it goes live
-- only through publish_questionnaire_version (npm run quiz:publish -- 2), after Millena reviews the texts.

alter table public.questions
  add column kind text not null default 'choice' check (kind in ('choice', 'duel')),
  add column chapter smallint check (chapter between 1 and 3),
  add constraint questions_duel_single_choice check (kind <> 'duel' or max_choices = 1);

-- ---------------------------------------------------------------------------------------------
-- Seed of version 2 (does nothing when version 2 exists; fails loudly when version 1 is missing).
-- The 12 regular questions are copies of version 1 questions 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13
-- and 15 (same text, alternatives, styles and weights) at steps 1-4, 6-9 and 11-14; steps 5, 10 and
-- 15 are look duels.
-- ---------------------------------------------------------------------------------------------
do $seed$
declare
  v_v1 uuid;
  v_v2 uuid;
  v_old_positions int[] := array[2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 15];
  v_new_positions int[] := array[1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14];
  v_old_question uuid;
  v_new_question uuid;
  v_new_position int;
  v_duel_positions int[] := array[5, 10, 15];
  v_duel_styles text[][] := array[
    array['esportivo_natural', 'elegante'],
    array['tradicional', 'criativo'],
    array['romantico', 'dramatico']
  ];
  i int;
begin
  if exists (select 1 from public.questionnaire_versions where version = 2) then
    return;
  end if;

  select id into v_v1 from public.questionnaire_versions where version = 1;
  if v_v1 is null then
    raise exception 'questionnaire version 1 is missing: cannot seed version 2';
  end if;

  insert into public.questionnaire_versions
    (version, status, first_choice_points, second_choice_points, late_tiebreak_basis)
    values (2, 'draft', 2, 1, 'points')
    returning id into v_v2;

  for i in 1..array_length(v_old_positions, 1) loop
    v_new_position := v_new_positions[i];
    select id into v_old_question from public.questions
      where version_id = v_v1 and position = v_old_positions[i];
    if v_old_question is null then
      raise exception 'questionnaire version 1 has no question at position %', v_old_positions[i];
    end if;

    insert into public.questions (version_id, position, text, max_choices, kind, chapter)
      select v_v2, v_new_position, q.text, 2, 'choice', ceil(v_new_position / 5.0)::smallint
      from public.questions q where q.id = v_old_question
      returning id into v_new_question;

    insert into public.alternatives (question_id, position, text, style, weight)
      select v_new_question, a.position, a.text, a.style, a.weight
      from public.alternatives a where a.question_id = v_old_question;
  end loop;

  for i in 1..3 loop
    -- Draft copy for Millena's review: the question text of every duel.
    insert into public.questions (version_id, position, text, max_choices, kind, chapter)
      values (v_v2, v_duel_positions[i], 'Qual look combina mais com você?', 1, 'duel', i)
      returning id into v_new_question;
    insert into public.alternatives (question_id, position, text, style, weight) values
      (v_new_question, 1, 'Look A', v_duel_styles[i][1], 1),
      (v_new_question, 2, 'Look B', v_duel_styles[i][2], 1);
  end loop;
end $seed$;

-- ---------------------------------------------------------------------------------------------
-- Structural validation of a question set. Returns null when the set is valid, otherwise
-- '<RULE>: <detail>' for the first broken rule. A set with any duel uses the version 2 profile
-- (12 regular questions, 3 duels, every style in exactly 9 steps and in exactly one duel, 5 steps
-- per chapter, duels at steps 5, 10 and 15); any other set uses the version 1 profile
-- (15 questions, 4 alternatives, imbalance of at most 2). The TypeScript rules in
-- lib/diagnostico/question-set-rules.ts must agree with this function.
-- ---------------------------------------------------------------------------------------------
create function public.questionnaire_set_issue(p_version uuid) returns text
language plpgsql stable as $$
declare
  v_styles text[] := array['esportivo_natural', 'tradicional', 'elegante', 'romantico', 'criativo', 'dramatico'];
  v_total integer;
  v_duels integer;
  v_style text;
  v_count integer;
  v_min integer;
  v_max integer;
  v_chapter integer;
  v_position integer;
  v_found integer;
begin
  select count(*), count(*) filter (where kind = 'duel') into v_total, v_duels
    from public.questions where version_id = p_version;

  if v_total <> 15 then
    return format('QUESTION_COUNT: expected 15 steps, found %s', v_total);
  end if;

  -- Alternatives per question: 4 for a regular question, 2 for a duel.
  select q.position, count(a.id) into v_position, v_found
    from public.questions q left join public.alternatives a on a.question_id = q.id
    where q.version_id = p_version
    group by q.id, q.position, q.kind
    having count(a.id) <> case when q.kind = 'duel' then 2 else 4 end
    order by q.position limit 1;
  if v_position is not null then
    return format('ALTERNATIVE_COUNT: step %s has %s alternatives', v_position, v_found);
  end if;

  -- Every alternative of a question has a different style.
  select q.position into v_position
    from public.questions q join public.alternatives a on a.question_id = q.id
    where q.version_id = p_version
    group by q.id, q.position
    having count(distinct a.style) <> count(a.id)
    order by q.position limit 1;
  if v_position is not null then
    return format('REPEATED_STYLE: step %s repeats a style', v_position);
  end if;

  if v_duels > 0 then
    if v_duels <> 3 then
      return format('KIND_COUNT: expected 12 regular questions and 3 duels, found %s duels', v_duels);
    end if;

    select q.position into v_position from public.questions q
      where q.version_id = p_version and q.kind = 'duel' and q.position not in (5, 10, 15)
      order by q.position limit 1;
    if v_position is not null then
      return format('DUEL_POSITION: step %s is a duel, duels must be at steps 5, 10 and 15', v_position);
    end if;

    for v_chapter in 1..3 loop
      select count(*) into v_count from public.questions
        where version_id = p_version and chapter = v_chapter;
      if v_count <> 5 then
        return format('CHAPTER_SIZE: chapter %s has %s steps, expected 5', v_chapter, v_count);
      end if;
    end loop;

    foreach v_style in array v_styles loop
      select count(distinct q.id) into v_count
        from public.questions q join public.alternatives a on a.question_id = q.id
        where q.version_id = p_version and q.kind = 'duel' and a.style = v_style;
      if v_count <> 1 then
        return format('DUEL_STYLES: %s appears in %s duels, expected 1', v_style, v_count);
      end if;
    end loop;

    foreach v_style in array v_styles loop
      select count(distinct q.id) into v_count
        from public.questions q join public.alternatives a on a.question_id = q.id
        where q.version_id = p_version and a.style = v_style;
      if v_count <> 9 then
        return format('STYLE_BALANCE: %s appears in %s steps, expected 9', v_style, v_count);
      end if;
    end loop;
  else
    select min(counts.c), max(counts.c) into v_min, v_max from (
      select (
        select count(distinct q.id)
        from public.questions q join public.alternatives a on a.question_id = q.id
        where q.version_id = p_version and a.style = s.style
      ) as c
      from unnest(v_styles) as s(style)
    ) counts;
    if v_max - v_min > 2 then
      return format('STYLE_IMBALANCE: styles appear between %s and %s times, at most 2 apart', v_min, v_max);
    end if;
  end if;

  return null;
end $$;

-- ---------------------------------------------------------------------------------------------
-- Atomic publication: validates the target, archives the published version and publishes the
-- target in one transaction, so there are never zero or two published versions. Locking every
-- version row makes a concurrent first answer wait for the swap (see save_answer below).
-- ---------------------------------------------------------------------------------------------
create function public.publish_questionnaire_version(p_version uuid) returns void
language plpgsql as $$
declare
  v_status text;
  v_issue text;
begin
  perform 1 from public.questionnaire_versions order by id for update;

  select status into v_status from public.questionnaire_versions where id = p_version;
  if v_status is null then
    raise exception 'VERSION_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_status = 'published' then
    raise exception 'VERSION_ALREADY_PUBLISHED' using errcode = 'P0001';
  end if;

  v_issue := public.questionnaire_set_issue(p_version);
  if v_issue is not null then
    raise exception 'INVALID_SET: %', v_issue using errcode = 'P0001';
  end if;

  update public.questionnaire_versions set status = 'archived' where status = 'published';
  update public.questionnaire_versions
    set status = 'published', published_at = now()
    where id = p_version;
end $$;

-- ---------------------------------------------------------------------------------------------
-- save_answer: same signature as RF-01. The first answer of an attempt must target the published
-- version: UNAVAILABLE when nothing is published, VERSION_CHANGED when the question belongs to
-- another version (the customer's page is older than the publication). An attempt already pinned
-- keeps saving on its own version, even archived; VERSION_MISMATCH stays for another version.
-- ---------------------------------------------------------------------------------------------
create or replace function public.save_answer(
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
    -- Wait for a publication in progress, then read the committed state.
    perform 1 from public.questionnaire_versions order by id for share;
    if not exists (select 1 from public.questionnaire_versions where status = 'published') then
      raise exception 'UNAVAILABLE' using errcode = 'P0001';
    end if;
    if not exists (
      select 1 from public.questionnaire_versions where id = v_version and status = 'published'
    ) then
      raise exception 'VERSION_CHANGED' using errcode = 'P0001';
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

-- ---------------------------------------------------------------------------------------------
-- One row per attempt with at least one answer: the version of its first answer, when it started
-- and whether an order exists for it (read by RF-05).
-- ---------------------------------------------------------------------------------------------
create view public.attempt_version_outcomes with (security_invoker = true) as
select pa.id as attempt_id,
       qv.id as version_id,
       qv.version,
       f.started_at,
       exists (select 1 from public.orders o where o.attempt_id = pa.id) as reached_checkout
from public.purchase_attempts pa
join lateral (
  select a.version_id, min(a.answered_at) as started_at
  from public.answers a
  where a.attempt_id = pa.id
  group by a.version_id
  order by min(a.answered_at)
  limit 1
) f on true
join public.questionnaire_versions qv on qv.id = f.version_id;

revoke all on public.attempt_version_outcomes from public, anon, authenticated;
revoke all on function public.questionnaire_set_issue(uuid) from public, anon, authenticated;
revoke all on function public.publish_questionnaire_version(uuid) from public, anon, authenticated;
revoke all on function public.save_answer(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant select on public.attempt_version_outcomes to service_role;
