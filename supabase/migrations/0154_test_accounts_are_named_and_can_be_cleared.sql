/* ═══════════════════════════════════════════════════════════════
   0154 — Test accounts are named, and can be cleared on review

   SEED. profiles.is_test (0150) is set for accounts that are plainly
   test: every @saathban.dev address, and the "admin test" account
   tahirsajeel2002@gmail.com. saathban@gmail.com is NOT flagged.
   This runs once; after it, the flag changes only through
   admin_set_test (audited).

   admin_test_data_overview() — support or super. Every flagged account
   with the counts of what it holds (admin_person_footprint, 0151), the
   totals, and a readable sample of public-ish content (posts, comments,
   group posts, group messages, park-board messages — never DMs, never
   daily logs). Audited: admin_view_test_data.

   admin_remove_test_accounts(p_expected, p_confirm, p_reason) —
   SUPER-ADMIN ONLY. Removes every flagged account entirely, with
   everything that cascades, through admin_erase_account (one audit row
   per account with its snapshot, plus a summary row first).
     · p_expected must equal the number of flagged accounts right now —
       if the list changed since the dry run was reviewed, nothing goes;
     · p_confirm must be exactly 'REMOVE <n> TEST ACCOUNTS';
     · refuses if the caller is flagged, or if any flagged account is an
       admin (unflag or change the role first — staff are never removed
       in bulk).
   Nothing runs automatically. The owner runs it before launch.
   ═══════════════════════════════════════════════════════════════ */

do $seed$
begin
  perform set_config('app.protected_profile_write', 'allow', true);
  update public.profiles p
     set is_test = true
    from auth.users u
   where u.id = p.id
     and not p.is_test
     and (lower(u.email) like '%@saathban.dev' or lower(u.email) = 'tahirsajeel2002@gmail.com')
     and lower(u.email) <> 'saathban@gmail.com';
  perform set_config('app.protected_profile_write', '', true);
end
$seed$;

create or replace function public.admin_test_data_overview()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_accounts jsonb;
  v_totals jsonb;
  v_sample jsonb;
  v_files integer;
begin
  if not public.is_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'full_name', p.full_name, 'email', u.email, 'role', p.role,
           'admin_level', p.admin_level, 'joined', p.created_at,
           'last_active', greatest(p.last_seen_at, u.last_sign_in_at),
           'footprint', public.admin_person_footprint(p.id),
           'files', (select count(*) from public.admin_person_files(p.id)))
           order by p.created_at), '[]'::jsonb)
    into v_accounts
    from public.profiles p join auth.users u on u.id = p.id
   where p.is_test;

  -- Totals per kind across every flagged account (a DM between two test
  -- accounts is counted once per side of 'dm_conversations').
  select coalesce(jsonb_object_agg(k, s), '{}'::jsonb) into v_totals from (
    select e.key as k, sum((e.value)::text::bigint) as s
      from jsonb_array_elements(v_accounts) a,
           jsonb_each(a->'footprint'->'removed') e
     group by e.key) t;

  select coalesce(sum((a->>'files')::int), 0) into v_files from jsonb_array_elements(v_accounts) a;

  select jsonb_build_object(
    'posts', coalesce((select jsonb_agg(x) from (
        select cp.id, pr.full_name as author, left(cp.body, 140) as text, cp.created_at
          from community_posts cp join profiles pr on pr.id = cp.author_id
         where pr.is_test order by cp.created_at desc limit 5) x), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(x) from (
        select c.id, pr.full_name as author, left(c.body, 140) as text, c.created_at
          from post_comments c join profiles pr on pr.id = c.author_id
         where pr.is_test order by c.created_at desc limit 5) x), '[]'::jsonb),
    'group_posts', coalesce((select jsonb_agg(x) from (
        select gp.id, pr.full_name as author, left(gp.body, 140) as text, gp.created_at
          from group_posts gp join profiles pr on pr.id = gp.author_id
         where pr.is_test order by gp.created_at desc limit 5) x), '[]'::jsonb),
    'group_messages', coalesce((select jsonb_agg(x) from (
        select gm.id, pr.full_name as author, left(gm.body, 140) as text, gm.created_at
          from group_messages gm join profiles pr on pr.id = gm.sender_id
         where pr.is_test order by gm.created_at desc limit 5) x), '[]'::jsonb),
    'park_board', coalesce((select jsonb_agg(x) from (
        select m.id, pr.full_name as author, left(m.body, 140) as text, m.created_at
          from park_board_messages m join profiles pr on pr.id = m.author_id
         where pr.is_test order by m.created_at desc limit 5) x), '[]'::jsonb)
  ) into v_sample;

  perform public.write_audit('admin_view_test_data', null, null,
    jsonb_build_object('accounts', jsonb_array_length(v_accounts)));

  return jsonb_build_object(
    'accounts', v_accounts,
    'totals', v_totals,
    'files', v_files,
    'sample', v_sample,
    'confirm_phrase', 'REMOVE ' || jsonb_array_length(v_accounts) || ' TEST ACCOUNTS',
    'caller_is_flagged', exists (select 1 from profiles where id = auth.uid() and is_test),
    'flagged_admins', (select count(*) from profiles where is_test and role = 'admin')
  );
end;
$function$;

create or replace function public.admin_remove_test_accounts(p_expected integer, p_confirm text, p_reason text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_ids uuid[];
  v_n integer;
  v_batch uuid := gen_random_uuid();
  v_id uuid;
  v_files jsonb := '[]'::jsonb;
  v_one jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Only a super-admin can remove test accounts' using errcode = '42501';
  end if;
  if coalesce(length(btrim(p_reason)), 0) < 5 then
    raise exception 'A reason is required';
  end if;

  select coalesce(array_agg(id order by created_at), '{}') into v_ids from profiles where is_test;
  v_n := coalesce(array_length(v_ids, 1), 0);

  if v_n = 0 then
    raise exception 'No accounts are flagged as test';
  end if;
  if p_expected is distinct from v_n then
    raise exception 'The list changed since it was reviewed (% flagged now). Review it again.', v_n;
  end if;
  if btrim(coalesce(p_confirm, '')) <> 'REMOVE ' || v_n || ' TEST ACCOUNTS' then
    raise exception 'The typed confirmation does not match';
  end if;
  if auth.uid() = any(v_ids) then
    raise exception 'Your own account is flagged as test. Unflag it first.';
  end if;
  if exists (select 1 from profiles where is_test and role = 'admin') then
    raise exception 'A flagged account is staff. Unflag it or change its role first.';
  end if;

  perform public.write_audit('remove_test_accounts', null, p_reason,
    jsonb_build_object('accounts', v_n, 'ids', to_jsonb(v_ids), 'file_batch', v_batch));

  foreach v_id in array v_ids loop
    v_one := public.admin_erase_account(v_id, p_reason, v_batch, 'delete_test_account',
               jsonb_build_object('bulk', true));
    v_files := v_files || coalesce(v_one->'files', '[]'::jsonb);
  end loop;

  return jsonb_build_object('accounts', v_n, 'batch', v_batch, 'files', v_files);
end;
$function$;

revoke all on function public.admin_test_data_overview() from public, anon;
revoke all on function public.admin_remove_test_accounts(integer, text, text) from public, anon;
grant execute on function public.admin_test_data_overview() to authenticated;
grant execute on function public.admin_remove_test_accounts(integer, text, text) to authenticated;
