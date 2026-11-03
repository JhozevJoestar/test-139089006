begin;
create type public.app_role as enum ('manager','worker');
create type public.task_status as enum ('new','in_progress','review','accepted','rework');
create table public.profiles (
 id uuid primary key references auth.users(id) on delete restrict,
 full_name text not null check(length(btrim(full_name)) between 1 and 150),
 role public.app_role not null default 'worker', created_at timestamptz not null default now()
);
create table public.objects (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 200),
 address text not null check(length(btrim(address)) between 1 and 500),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(),
 object_id uuid not null references public.objects(id) on delete restrict,
 title text not null check(length(btrim(title)) between 1 and 200),
 description text not null default '' check(length(description)<=10000),
 assignee_id uuid not null references public.profiles(id) on delete restrict,
 author_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
 status public.task_status not null default 'new',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.task_history (
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.tasks(id) on delete cascade,
 changed_by uuid not null references public.profiles(id) on delete restrict,
 old_status public.task_status,
 new_status public.task_status not null,
 comment text check(length(comment)<=4000), created_at timestamptz not null default now()
);
create index tasks_object_idx on public.tasks(object_id);
create index tasks_assignee_idx on public.tasks(assignee_id);
create index tasks_author_idx on public.tasks(author_id);
create index tasks_status_idx on public.tasks(status);
create index history_task_time_idx on public.task_history(task_id,created_at desc);
create index history_actor_idx on public.task_history(changed_by);

create function public.current_app_role() returns public.app_role
language sql stable security definer set search_path = ''
as $$ select role from public.profiles where id = (select auth.uid()) $$;

-- This helper bypasses profile RLS to avoid a profiles -> tasks -> profiles cycle.
create function public.can_read_profile(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select p_id = auth.uid() or public.current_app_role() = 'manager'
 or exists(select 1 from public.tasks t where t.assignee_id = auth.uid()
 and (t.author_id = p_id or exists(select 1 from public.task_history h where h.task_id=t.id and h.changed_by=p_id)))
$$;

alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_history enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(public.can_read_profile(id));
create policy objects_read on public.objects for select to authenticated using(
 public.current_app_role()='manager' or exists(select 1 from public.tasks t where t.object_id=objects.id and t.assignee_id=auth.uid()));
create policy objects_insert on public.objects for insert to authenticated with check(public.current_app_role()='manager');
create policy objects_update on public.objects for update to authenticated using(public.current_app_role()='manager') with check(public.current_app_role()='manager');
create policy objects_delete on public.objects for delete to authenticated using(public.current_app_role()='manager');
create policy tasks_read on public.tasks for select to authenticated using(public.current_app_role()='manager' or assignee_id=auth.uid());
create policy tasks_insert on public.tasks for insert to authenticated with check(public.current_app_role()='manager' and author_id=auth.uid() and status='new');
create policy tasks_update on public.tasks for update to authenticated using(public.current_app_role()='manager') with check(public.current_app_role()='manager');
create policy tasks_delete on public.tasks for delete to authenticated using(public.current_app_role()='manager');
create policy history_read on public.task_history for select to authenticated using(exists(select 1 from public.tasks t where t.id=task_history.task_id));

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at=clock_timestamp(); return new; end $$;
create trigger objects_touch before update on public.objects for each row execute function public.touch_updated_at();

create function public.validate_task() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.profiles where id=new.assignee_id and role='worker') then
  raise exception 'Исполнителем может быть только worker';
 end if;
 if tg_op='INSERT' then
  if new.status <> 'new' then raise exception 'Начальный статус должен быть new'; end if;
  if not exists(select 1 from public.profiles where id=new.author_id and role='manager') then raise exception 'Автор должен быть manager'; end if;
 else
  if new.author_id<>old.author_id or new.created_at<>old.created_at then raise exception 'Автор и дата создания неизменяемы'; end if;
 end if;
 new.updated_at=clock_timestamp(); return new;
end $$;
create trigger tasks_validate before insert or update on public.tasks for each row execute function public.validate_task();

create function public.log_task_creation() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.task_history(task_id,changed_by,old_status,new_status) values(new.id,new.author_id,null,'new');
 return new;
end $$;
create trigger tasks_created after insert on public.tasks for each row execute function public.log_task_creation();

create function public.change_task_status(p_task_id uuid,p_new_status public.task_status,p_comment text default null)
returns public.tasks language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); actor_role public.app_role; task public.tasks; allowed boolean := false;
begin
 if actor is null then raise exception 'Требуется авторизация' using errcode='42501'; end if;
 select role into actor_role from public.profiles where id=actor;
 if actor_role is null then raise exception 'Профиль не найден' using errcode='42501'; end if;
 select * into task from public.tasks where id=p_task_id for update;
 if not found or (actor_role='worker' and task.assignee_id<>actor) then
  raise exception 'Задача недоступна' using errcode='42501';
 end if;
 if actor_role='manager' then
  allowed := task.status='review' and p_new_status in ('accepted','rework');
 elsif actor_role='worker' and task.assignee_id=actor then
  allowed := (task.status in ('new','rework') and p_new_status='in_progress') or (task.status='in_progress' and p_new_status='review');
 end if;
 if allowed is not true then raise exception 'Недопустимый переход статуса'; end if;
 if p_new_status='rework' and (p_comment is null or p_comment !~ '[^[:space:]]') then raise exception 'Укажите причину возврата'; end if;
 if length(p_comment)>4000 then raise exception 'Комментарий слишком длинный'; end if;
 update public.tasks set status=p_new_status where id=task.id;
 insert into public.task_history(task_id,changed_by,old_status,new_status,comment)
 values(task.id,actor,task.status,p_new_status,nullif(btrim(p_comment),''));
 select * into task from public.tasks where id=task.id;
 return task;
end $$;

-- Supabase may give broad default privileges: explicitly remove them first.
revoke all on public.profiles,public.objects,public.tasks,public.task_history from public,anon,authenticated;
grant usage on schema public to authenticated;
grant select on public.profiles,public.objects,public.tasks,public.task_history to authenticated;
grant insert(name,address),update(name,address) on public.objects to authenticated;
grant delete on public.objects to authenticated;
grant insert(object_id,title,description,assignee_id),update(object_id,title,description,assignee_id) on public.tasks to authenticated;
grant delete on public.tasks to authenticated;
revoke all on function public.current_app_role(),public.can_read_profile(uuid),public.touch_updated_at(),public.validate_task(),public.log_task_creation(),public.change_task_status(uuid,public.task_status,text) from public,anon,authenticated;
grant execute on function public.current_app_role(),public.can_read_profile(uuid),public.change_task_status(uuid,public.task_status,text) to authenticated;
commit;
