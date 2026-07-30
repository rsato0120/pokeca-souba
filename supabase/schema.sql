-- ─────────────────────────────────────────────────────────────
-- Souba「みんなの予想」投稿機能スキーマ
-- Supabase ダッシュボード → SQL Editor に貼って実行する。
-- 何度流しても壊れないように書いてある（idempotent）。
-- ─────────────────────────────────────────────────────────────

create table if not exists public.card_votes (
  id         uuid primary key default gen_random_uuid(),
  card_id    text not null,                       -- pokeca_data.json の card.id
  user_id    uuid not null references auth.users(id) on delete cascade,
  stance     text not null check (stance in ('bull', 'bear')),
  comment    text check (comment is null or char_length(comment) <= 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 1カード1ユーザー1票。投票し直しは upsert で更新される
  unique (card_id, user_id)
);

-- カード詳細ページは常に card_id で引く
create index if not exists card_votes_card_id_idx
  on public.card_votes (card_id, created_at desc);

-- 更新時刻の自動更新（投票し直しの並び順に使う）
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists card_votes_touch_updated_at on public.card_votes;
create trigger card_votes_touch_updated_at
  before update on public.card_votes
  for each row execute function public.touch_updated_at();

-- ── Row Level Security ──────────────────────────────────────
-- 匿名サインインで発行された auth.uid() を持ち主とみなす。
-- 読みは全開放、書きは自分の行だけ。これを外すと誰でも他人の票を書き換えられる。
alter table public.card_votes enable row level security;

drop policy if exists "votes are readable by everyone"  on public.card_votes;
drop policy if exists "insert own vote"                 on public.card_votes;
drop policy if exists "update own vote"                 on public.card_votes;
drop policy if exists "delete own vote"                 on public.card_votes;

create policy "votes are readable by everyone"
  on public.card_votes for select
  using (true);

create policy "insert own vote"
  on public.card_votes for insert
  with check (auth.uid() = user_id);

create policy "update own vote"
  on public.card_votes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own vote"
  on public.card_votes for delete
  using (auth.uid() = user_id);
