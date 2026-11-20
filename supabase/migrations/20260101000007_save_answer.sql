-- RF-04: atomic save of one questionnaire answer.
-- Checks the attempt, the alternative/question pair and the questionnaire version, then upserts
-- the answer and returns how many questions the attempt has answered.

create function public.save_answer(
  p_attempt uuid,
  p_question uuid,
  p_alternative uuid
) returns integer
language plpgsql as $$
declare
  v_expires timestamptz;
  v_version uuid;
  v_pinned uuid;
  v_count integer;
begin
  -- Serialize saves of one attempt so the version check and the upsert cannot interleave.
  perform pg_advisory_xact_lock(hashtext(p_attempt::text));

  select expires_at into v_expires from public.purchase_attempts where id = p_attempt;
  if v_expires is null or v_expires <= now() then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0001';
  end if;

  select q.version_id into v_version
    from public.alternatives a
    join public.questions q on q.id = a.question_id
    where a.id = p_alternative and q.id = p_question;
  if v_version is null then
    raise exception 'ALTERNATIVE_MISMATCH' using errcode = 'P0001';
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

  insert into public.answers (attempt_id, version_id, question_id, alternative_id)
    values (p_attempt, v_version, p_question, p_alternative)
    on conflict (attempt_id, question_id)
    do update set alternative_id = excluded.alternative_id, answered_at = now();

  select count(*) into v_count from public.answers where attempt_id = p_attempt;
  return v_count;
end $$;

revoke all on function public.save_answer(uuid, uuid, uuid) from public, anon, authenticated;
