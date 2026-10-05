# Blockers

## 2026-10-05 — drop the stopgap public-key rules on `scheduled_posts` (needs Jim at the keyboard)

**What is blocked:** step 6 of the `scheduler-key-fix` brief. Server code no longer uses
the public key (`e143c62`, deployed and verified), so these can go.

**Why:** the Supabase connector asks for a confirmation before destructive SQL. Three
attempts (two `apply_migration`, one `execute_sql`) ended in `Invalid or expired
requestState` because nobody answered the prompt. Nothing was partially applied — four
policies and one trigger are still on the table, and `policy_change_log` still ends at
row 9.

**To clear it**, either answer the Supabase confirmation when Claude retries, or paste
this into the Supabase SQL editor:

```sql
begin;
insert into public.policy_change_log (tablename, policyname, reason, restore_sql)
values (
  'scheduled_posts',
  'public_* stopgap policies + scheduled_posts_public_key_guard trigger',
  'server code moved to the service key (commit e143c62); public key no longer needs any access to scheduled_posts',
  $restore$create policy "public_read_scheduled_posts" on public.scheduled_posts for select to public using (true); create policy "public_insert_pending_scheduled_posts" on public.scheduled_posts for insert to public with check ((status = 'pending'::text)); create policy "public_update_scheduled_posts" on public.scheduled_posts for update to public using (true) with check (true); create policy "public_delete_draft_scheduled_posts" on public.scheduled_posts for delete to public using ((status = ANY (ARRAY['pending'::text, 'rejected'::text]))); create trigger scheduled_posts_public_key_guard before update on public.scheduled_posts for each row execute function scheduled_posts_public_key_guard();$restore$
);
drop trigger if exists scheduled_posts_public_key_guard on public.scheduled_posts;
drop policy if exists "public_read_scheduled_posts" on public.scheduled_posts;
drop policy if exists "public_insert_pending_scheduled_posts" on public.scheduled_posts;
drop policy if exists "public_update_scheduled_posts" on public.scheduled_posts;
drop policy if exists "public_delete_draft_scheduled_posts" on public.scheduled_posts;
commit;
```

**Afterwards, repeat the step-5 checks:** fire without credentials → 401; fire Instagram
draft `3155a1b5-43e6-4711-a34a-3f66bd27d892` with `Bearer CRON_SECRET`, open its
`ig_confirm` link, confirm the row reads `posted`, then put it back to `pending` with
`posted_at` and `error` null; and one generator dry run (`POST {dry_run:true}`, about
$0.20 on the app's Anthropic key — approved up to a $1 total, about $0.20 used so far).
