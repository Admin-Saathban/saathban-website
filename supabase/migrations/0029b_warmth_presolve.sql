-- 0029b — warmth respects the pre-solve veil (games/community lane;
-- patch on 0029, same hour, caught while handing the RPC to the My
-- People lane).
--
-- riddle_people() hides WHO solved until the caller has solved (no
-- answer-fishing by ringing a solved friend) — but person_warmth()
-- leaked the same fact through a profile page. Now solved_today is
-- NULL until the caller has solved today's riddle themselves; clients
-- hide the chip on null. Badges are unaffected.

create or replace function public.person_warmth(p_profile uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_badges jsonb;
  v_solved boolean;
  v_caller_solved boolean;
begin
  if not public.can_use_community()
     or not public.game_connected(auth.uid(), p_profile)
     or exists (
       select 1 from public.user_blocks
       where kind = 'block'
         and ((blocker_id = auth.uid() and blocked_id = p_profile)
           or (blocker_id = p_profile and blocked_id = auth.uid()))
     ) then
    raise exception 'Not available';
  end if;

  select exists (
    select 1 from public.puzzle_attempts
    where profile_id = auth.uid() and puzzle_date = current_date and solved_at is not null
  ) into v_caller_solved;

  if v_caller_solved then
    select exists (
      select 1 from public.puzzle_attempts
      where profile_id = p_profile and puzzle_date = current_date and solved_at is not null
    ) into v_solved;
  else
    v_solved := null; -- veiled until the caller solves
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'emoji', b.emoji, 'name_en', b.name_en, 'name_ur', b.name_ur,
    'earned_at', e.earned_at
  ) order by e.earned_at desc), '[]'::jsonb) into v_badges
  from public.earned_badges e
  join public.badges b on b.key = e.badge_key
  where e.profile_id = p_profile and e.earned_at > now() - interval '7 days';

  return jsonb_build_object('solved_today', v_solved, 'badges', v_badges);
end;
$$;

revoke execute on function public.person_warmth(uuid) from public, anon;
grant execute on function public.person_warmth(uuid) to authenticated;
