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

-- ── 2026-08-04: 強気/弱気の2択 → AIと同じ 上昇/横ばい/下落 の3択へ ──
-- AI予想は up_pct / flat_pct / down_pct の3シナリオで出しているのに、投票だけ2択だと
-- 「AIとみんなの予想を並べて見比べる」というこの機能の主眼が成立しない（横ばい派の行き場が
-- 無く、その票が上昇か下落のどちらかに押し込まれて分布が歪む）。
-- 既存票は bull→up / bear→down に移送する。check制約を先に外さないと update が弾かれる。
alter table public.card_votes drop constraint if exists card_votes_stance_check;
update public.card_votes set stance = 'up'   where stance = 'bull';
update public.card_votes set stance = 'down' where stance = 'bear';
alter table public.card_votes
  add constraint card_votes_stance_check check (stance in ('up', 'flat', 'down'));

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

-- ─────────────────────────────────────────────────────────────
-- 表示名（2026-08-04 追加・的中率ランキング用）
-- ─────────────────────────────────────────────────────────────
-- 匿名サインインのユーザーはUUIDしか持たないので、ランキングに出す名前をここに置く。
-- 未設定なら画面側で「ゲスト+UUID先頭4桁」を出すため、登録は任意のままでよい。
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 16),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles are readable by everyone" on public.profiles;
drop policy if exists "insert own profile"                on public.profiles;
drop policy if exists "update own profile"                on public.profiles;

create policy "profiles are readable by everyone"
  on public.profiles for select
  using (true);

create policy "insert own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "update own profile"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- カード別の集計ビュー（2026-08-04 追加・トップの「みんなの予想 注目カード」用）
-- ─────────────────────────────────────────────────────────────
-- トップページで294枚ぶんの票を1枚ずつ引くと往復が多すぎるので、集計はDB側で1回にまとめる。
-- security_invoker=true にして card_votes のRLS（読みは全開放）をそのまま効かせる。
-- これを付けないとビューは所有者権限で動き、RLSを迂回する隠れた抜け道になる。
drop view if exists public.card_vote_tallies;
create view public.card_vote_tallies with (security_invoker = true) as
  select
    card_id,
    count(*)                                        as total,
    count(*) filter (where stance = 'up')           as up_votes,
    count(*) filter (where stance = 'flat')         as flat_votes,
    count(*) filter (where stance = 'down')         as down_votes,
    max(updated_at)                                 as last_voted_at
  from public.card_votes
  group by card_id;

grant select on public.card_vote_tallies to anon, authenticated;

-- PostgRESTのスキーマキャッシュを更新（新しいテーブル/ビューが即座に見えるようにする）
notify pgrst, 'reload schema';
