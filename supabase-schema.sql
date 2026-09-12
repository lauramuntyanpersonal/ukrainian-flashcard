create table if not exists public.flashcards_users (
  username text primary key,
  data jsonb not null default '{"words":[],"sets":[]}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.flashcards_users enable row level security;

create policy "Open public access for demo app"
on public.flashcards_users
for all
using (true)
with check (true);

create or replace function public.touch_flashcards_user()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger flashcards_users_updated
before update on public.flashcards_users
for each row
execute function public.touch_flashcards_user();
