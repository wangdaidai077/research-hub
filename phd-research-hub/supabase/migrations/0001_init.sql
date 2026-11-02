-- =====================================================================
-- PhD Research Hub — initial schema
-- Run once in Supabase → SQL Editor (or `supabase db push`).
-- Every user-owned table carries user_id and is protected by Row Level
-- Security so that a signed-in user can only ever see their own rows.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- helpers ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- user settings / preferences ----------
create table if not exists public.user_settings (
  user_id             uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  theme               text not null default 'system' check (theme in ('light','dark','system')),
  visual_theme        text not null default 'graphite',
  accent              text not null default '#3b5bdb',
  workspace_title     text,
  workspace_subtitle  text,
  avatar_path         text,
  background          jsonb not null default '{"mode":"none"}'::jsonb,
  phases              jsonb,
  project_statuses    jsonb,
  imported_backup_ids text[] not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------- projects ----------
create table if not exists public.projects (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title             text not null check (length(trim(title)) > 0),
  research_question text,
  description       text,
  category          text,
  collaborators     text,
  start_date        date,
  target_date       date,
  priority          text not null default 'medium' check (priority in ('low','medium','high','critical')),
  phase             text not null default 'idea',
  status            text not null default 'backlog',
  notes             text,
  links             jsonb not null default '[]'::jsonb,
  progress_override integer check (progress_override between 0 and 100),
  cover_path        text,
  cover_position    integer not null default 50 check (cover_position between 0 and 100),
  icon_emoji        text,
  icon_path         text,
  idea_id           uuid,
  last_activity_at  timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects(user_id);

-- ---------- milestones ----------
create table if not exists public.milestones (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id   uuid not null references public.projects(id) on delete cascade deferrable initially deferred,
  title        text not null check (length(trim(title)) > 0),
  kind         text not null default 'milestone' check (kind in ('milestone','submission','decision','revision','conference')),
  due_date     date,
  completed_on date,
  venue        text,
  decision     text,
  notes        text,
  sort_order   double precision not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists milestones_user_idx on public.milestones(user_id);
create index if not exists milestones_project_idx on public.milestones(project_id);

-- ---------- tasks (subtasks via parent_id) ----------
create table if not exists public.tasks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id     uuid references public.projects(id) on delete cascade deferrable initially deferred,
  parent_id      uuid references public.tasks(id) on delete cascade deferrable initially deferred,
  milestone_id   uuid references public.milestones(id) on delete set null deferrable initially deferred,
  title          text not null check (length(trim(title)) > 0),
  description    text,
  status         text not null default 'inbox' check (status in ('inbox','next','in_progress','waiting','blocked','done','cancelled')),
  priority       text not null default 'medium' check (priority in ('low','medium','high','critical')),
  due_date       date,
  scheduled_date date,
  effort_hours   numeric(6,2),
  actual_hours   numeric(6,2),
  cognitive_load text not null default 'medium' check (cognitive_load in ('deep','medium','light')),
  recurrence     text not null default 'none' check (recurrence in ('none','daily','weekly','biweekly','monthly')),
  notes          text,
  completed_at   timestamptz,
  sort_order     double precision not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists tasks_user_idx on public.tasks(user_id);
create index if not exists tasks_project_idx on public.tasks(project_id);
create index if not exists tasks_parent_idx on public.tasks(parent_id);
create index if not exists tasks_due_idx on public.tasks(user_id, due_date);
create index if not exists tasks_sched_idx on public.tasks(user_id, scheduled_date);

-- ---------- task → task dependencies ----------
create table if not exists public.task_dependencies (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id       uuid not null references public.tasks(id) on delete cascade deferrable initially deferred,
  depends_on_id uuid not null references public.tasks(id) on delete cascade deferrable initially deferred,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (task_id, depends_on_id),
  check (task_id <> depends_on_id)
);
create index if not exists deps_user_idx on public.task_dependencies(user_id);

-- ---------- waiting items / external dependencies ----------
create table if not exists public.waiting_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id   uuid references public.projects(id) on delete cascade deferrable initially deferred,
  task_id      uuid references public.tasks(id) on delete set null deferrable initially deferred,
  waiting_for  text not null check (length(trim(waiting_for)) > 0),
  title        text,
  initiated_on date not null default current_date,
  expected_on  date,
  follow_up_on date,
  status       text not null default 'waiting' check (status in ('waiting','followed_up','resolved','cancelled')),
  reference    text,
  notes        text,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists waiting_user_idx on public.waiting_items(user_id);

-- ---------- research ideas ----------
create table if not exists public.ideas (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title             text not null check (length(trim(title)) > 0),
  question          text,
  description       text,
  literature        text,
  data_sources      text,
  theory            text,
  feasibility       text not null default 'medium' check (feasibility in ('low','medium','high')),
  tags              text[] not null default '{}',
  status            text not null default 'open' check (status in ('open','archived','promoted')),
  linked_project_id uuid references public.projects(id) on delete set null deferrable initially deferred,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists ideas_user_idx on public.ideas(user_id);

-- ---------- weekly plans & reviews ----------
create table if not exists public.weekly_plans (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start           date not null,
  priority_project_ids uuid[] not null default '{}',
  deliverables         jsonb not null default '[]'::jsonb,
  capacity_hours       numeric(6,2),
  review               jsonb not null default '{}'::jsonb,
  reviewed_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (user_id, week_start)
);
create index if not exists weekly_user_idx on public.weekly_plans(user_id);

-- ---------- activity log (progress history / recent activity) ----------
create table if not exists public.activity_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade deferrable initially deferred,
  kind       text not null,
  message    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists activity_user_idx on public.activity_log(user_id, created_at desc);

-- ---------- updated_at triggers + Row Level Security on every table ----------
do $$
declare t text;
begin
  foreach t in array array['user_settings','projects','milestones','tasks','task_dependencies',
                           'waiting_items','ideas','weekly_plans','activity_log']
  loop
    execute format('drop trigger if exists %1$s_touch on public.%1$s', t);
    execute format('create trigger %1$s_touch before update on public.%1$s
                    for each row execute function public.touch_updated_at()', t);
    execute format('alter table public.%s enable row level security', t);
    execute format('alter table public.%s force row level security', t);
    execute format('drop policy if exists "owner_select" on public.%s', t);
    execute format('drop policy if exists "owner_insert" on public.%s', t);
    execute format('drop policy if exists "owner_update" on public.%s', t);
    execute format('drop policy if exists "owner_delete" on public.%s', t);
    execute format('create policy "owner_select" on public.%s for select to authenticated
                    using (user_id = (select auth.uid()))', t);
    execute format('create policy "owner_insert" on public.%s for insert to authenticated
                    with check (user_id = (select auth.uid()))', t);
    execute format('create policy "owner_update" on public.%s for update to authenticated
                    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "owner_delete" on public.%s for delete to authenticated
                    using (user_id = (select auth.uid()))', t);
    execute format('revoke all on public.%s from anon', t);
    execute format('grant select, insert, update, delete on public.%s to authenticated', t);
  end loop;
end $$;

-- ---------- transactional backup restore ----------
-- p_mode = 'replace' : delete all of the caller's rows, then insert the backup
-- p_mode = 'merge'   : insert only rows whose id does not already exist
-- Runs with the caller's privileges (security invoker) so RLS still applies,
-- and user_id is always overwritten with the caller's id.
create or replace function public.import_snapshot(p_data jsonb, p_mode text default 'merge', p_backup_id text default null)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t text;
  n int;
  counts jsonb := '{}'::jsonb;
  order_tables text[] := array['projects','milestones','tasks','task_dependencies',
                               'waiting_items','ideas','weekly_plans','activity_log'];
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_mode not in ('replace','merge') then raise exception 'invalid mode'; end if;

  set constraints all deferred;

  if p_mode = 'replace' then
    delete from activity_log where user_id = uid;
    delete from weekly_plans where user_id = uid;
    delete from ideas where user_id = uid;
    delete from waiting_items where user_id = uid;
    delete from task_dependencies where user_id = uid;
    delete from tasks where user_id = uid;
    delete from milestones where user_id = uid;
    delete from projects where user_id = uid;
  end if;

  foreach t in array order_tables loop
    execute format(
      'insert into public.%1$I
         select (jsonb_populate_record(null::public.%1$I, x || jsonb_build_object(''user_id'', $1))).*
         from jsonb_array_elements(coalesce($2 -> %1$L, ''[]''::jsonb)) as x
       on conflict do nothing', t)
    using uid, p_data;
    get diagnostics n = row_count;
    counts := counts || jsonb_build_object(t, n);
  end loop;

  insert into user_settings (user_id) values (uid) on conflict (user_id) do nothing;

  if p_data ? 'settings' and jsonb_typeof(p_data -> 'settings') = 'object' then
    update user_settings s set
      theme              = coalesce(p_data->'settings'->>'theme', s.theme),
      visual_theme       = coalesce(p_data->'settings'->>'visual_theme', s.visual_theme),
      accent             = coalesce(p_data->'settings'->>'accent', s.accent),
      workspace_title    = coalesce(p_data->'settings'->>'workspace_title', s.workspace_title),
      workspace_subtitle = coalesce(p_data->'settings'->>'workspace_subtitle', s.workspace_subtitle),
      phases             = coalesce(p_data->'settings'->'phases', s.phases),
      project_statuses   = coalesce(p_data->'settings'->'project_statuses', s.project_statuses)
    where s.user_id = uid;
  end if;

  if p_backup_id is not null then
    update user_settings
       set imported_backup_ids = array_append(array_remove(imported_backup_ids, p_backup_id), p_backup_id)
     where user_id = uid;
  end if;

  return counts;
end $$;

grant execute on function public.import_snapshot(jsonb, text, text) to authenticated;
revoke execute on function public.import_snapshot(jsonb, text, text) from anon, public;

-- ---------- realtime (so other open devices refresh automatically) ----------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['projects','milestones','tasks','task_dependencies','waiting_items',
                             'ideas','weekly_plans','user_settings']
    loop
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception when duplicate_object then null;
      end;
    end loop;
  end if;
end $$;
