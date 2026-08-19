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

-- ── 2026-08-04: 表示名の重複を禁止する ──
-- 的中率ランキングは表示名でしか人を見分けられないので、同名が並ぶと誰が誰か分からない。
-- 大文字小文字と前後の空白だけが違う名前は「同じ名前」とみなす（"Taro" と "taro " は衝突）。
create unique index if not exists profiles_display_name_key
  on public.profiles (lower(btrim(display_name)));

-- 空白だけの名前と、未設定ユーザーの自動表示名「ゲストxxxxxx」を名乗ることを禁じる。
-- 後者を許すと匿名の人になりすませてしまう。
alter table public.profiles drop constraint if exists profiles_display_name_shape;
alter table public.profiles
  add constraint profiles_display_name_shape
  check (btrim(display_name) <> '' and btrim(display_name) !~ '^ゲスト');

notify pgrst, 'reload schema';

-- 表示名を消せるように（card_votes と揃える）。delete ポリシーが無いとRLSが黙って拒否し、
-- 「消したはずなのに名前が残り続ける」状態になる。
drop policy if exists "delete own profile" on public.profiles;
create policy "delete own profile"
  on public.profiles for delete
  using (auth.uid() = user_id);

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────
-- コレクション総額の分布（2026-08-15 追加・マイコレクションの「上位◯%」用）
-- ─────────────────────────────────────────────────────────────
-- マイコレクション本体は今までどおり localStorage 完結（所持カードの中身はサーバーに送らない）。
-- ここに置くのは **評価額の合計という数値ひとつ** だけで、何を持っているかは一切送らない。
create table if not exists public.collection_totals (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  -- 上限は釣り上げ対策。所持枚数はクライアントが自己申告するので、桁を間違えた入力や
  -- 悪意ある水増しがそのまま分布の上端を壊さないよう10億円で頭を止める。
  total_yen  bigint not null check (total_yen >= 0 and total_yen <= 1000000000),
  kinds      int not null check (kinds between 0 and 100000),  -- 種類数（1枚豪華型と数量型を分けて見るため）
  qty        int not null check (qty between 0 and 1000000),   -- 総枚数
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists collection_totals_touch_updated_at on public.collection_totals;
create trigger collection_totals_touch_updated_at
  before update on public.collection_totals
  for each row execute function public.touch_updated_at();

alter table public.collection_totals enable row level security;

drop policy if exists "read own total"   on public.collection_totals;
drop policy if exists "insert own total" on public.collection_totals;
drop policy if exists "update own total" on public.collection_totals;
drop policy if exists "delete own total" on public.collection_totals;

-- ⚠️ card_votes と違い select は `using (true)` にしない。
-- 票は公開前提の意見だが、こちらは個人の資産額。全開放すると
-- 「誰でも全ユーザーの総額一覧を引ける」＝資産額リストになってしまう。
-- 他人の数字はこの下の集計関数（分布の要約）ごしにしか出さない。
create policy "read own total"
  on public.collection_totals for select
  using (auth.uid() = user_id);

create policy "insert own total"
  on public.collection_totals for insert
  with check (auth.uid() = user_id);

create policy "update own total"
  on public.collection_totals for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own total"
  on public.collection_totals for delete
  using (auth.uid() = user_id);

-- 自分の位置と分布の要約だけを返す。RLS（自分の行しか読めない）を意図的に迂回するので
-- security definer にするが、**返すのは順位と代表値だけで、個々の行は決して返さない**。
-- search_path を固定しないと、呼び出し側の search_path 経由で別スキーマの同名テーブルを
-- 掴まされる余地が残る（security definer の定石）。
create or replace function public.collection_percentile(mine bigint)
returns table (my_rank int, sample_count int, median_yen bigint, p90_yen bigint)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    -- 自分より上の人数＋1＝順位。同額は同順位になる
    (count(*) filter (where total_yen > mine) + 1)::int,
    count(*)::int,
    coalesce(percentile_cont(0.5) within group (order by total_yen), 0)::bigint,
    coalesce(percentile_cont(0.9) within group (order by total_yen), 0)::bigint
  from public.collection_totals;
$$;

-- 引数を変えて何度も呼べば分布の形は推測できるが、それは分位点を出す機能の性質上どうしても残る。
-- 個人と金額の結びつきは漏れない（誰の額かは決して返らない）ので許容する。
revoke all on function public.collection_percentile(bigint) from public;
grant execute on function public.collection_percentile(bigint) to anon, authenticated;

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────
-- みんなの注目ランキング（2026-08-19 追加・カード詳細の閲覧数）
-- ─────────────────────────────────────────────────────────────
-- 「いま何が見られているか」は価格やAI予想からは絶対に出てこない、閲覧者だけが作る指標。
-- 相場が動く前に注目が動くことがあるので、値上がりランキングとは別の情報になる。
--
-- 数えるのは **1カード・1日・1訪問者につき1** で、リロード連打では増えない。
-- 訪問者の識別は「日付を混ぜたIPのmd5」＝日が変われば別人になる使い捨ての値で、
-- IPそのものも端末IDも保存しない（追跡には使えない）。
create table if not exists public.card_view_visits (
  -- pokeca_data.json のカードスラッグ。想定外の文字列で行を作らせないよう形も縛る
  card_id    text not null check (card_id ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  day        date not null,
  visitor    text not null,
  created_at timestamptz not null default now(),
  primary key (card_id, day, visitor)
);

-- ランキングは常に「直近N日ぶんを日付で切ってカード別に数える」
create index if not exists card_view_visits_day_idx
  on public.card_view_visits (day, card_id);

-- ⚠ ポリシーを1本も置かない＝anon/authenticated からは読み書きとも一切できない。
-- 生の行には訪問者ハッシュが入っているので、出入りは下の security definer 関数だけに絞る。
-- （card_votes の「読みは全開放」をコピペしてこないこと。collection_totals と同じ方針）
alter table public.card_view_visits enable row level security;

-- 閲覧を1件記録し、そのカードの現状（直近7日の閲覧者数・順位）を返す。
-- 記録と表示を1本にまとめてあるのは、カードを開くたびに往復を2回させないため。
-- p_count=false で「数えずに現状だけ読む」（同じ端末が同じ日に開き直したとき用）。
create or replace function public.record_card_view(p_card_id text, p_count boolean default true)
-- rank は plpgsql の OUT 名としては窓関数 rank() と紛らわしいので view_rank にする
returns table (viewers_7d int, viewers_today int, view_rank int, ranked_cards int)
language plpgsql
security definer
set search_path = public, pg_temp
volatile
as $$
declare
  v_day     date := (now() at time zone 'Asia/Tokyo')::date;
  v_ip      text;
  v_visitor text;
begin
  if p_card_id is null or p_card_id !~ '^[a-z0-9][a-z0-9_-]{0,79}$' then
    return;
  end if;

  if p_count then
    -- nullif を挟むのは、GUC が空文字だった場合に ''::json が構文エラーで落ちるため
    v_ip := split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1);
    -- 日付を混ぜるので、同じ人でも日が変われば別のハッシュになる（横断的な追跡ができない）。
    -- ヘッダが取れない環境ではランダム値にする＝重複排除は効かないが、数え落とすよりはよい
    v_visitor := md5(v_day::text || '|' || coalesce(nullif(btrim(v_ip), ''), gen_random_uuid()::text));

    -- 同じ人が同じ日に同じカードを何度開いても、ここで弾かれて1のまま
    insert into public.card_view_visits (card_id, day, visitor)
    values (p_card_id, v_day, v_visitor)
    on conflict do nothing;

    -- 保持は31日ぶん。cron を持たないので、書き込みのついでに1%の確率で掃除する
    if random() < 0.01 then
      delete from public.card_view_visits where day < v_day - 31;
    end if;
  end if;

  return query
  with tally as (
    select v.card_id as cid, count(*)::int as viewers,
           count(*) filter (where v.day = v_day)::int as today
    from public.card_view_visits v
    where v.day > v_day - 7
    group by v.card_id
  ), ranked as (
    select t.cid, t.viewers, t.today, rank() over (order by t.viewers desc)::int as rnk
    from tally t
  )
  select coalesce(r.viewers, 0), coalesce(r.today, 0), r.rnk, (select count(*)::int from tally)
  from (select 1) as one
  left join ranked r on r.cid = p_card_id;
end;
$$;

revoke all on function public.record_card_view(text, boolean) from public;
grant execute on function public.record_card_view(text, boolean) to anon, authenticated;

-- トップの「みんなの注目ランキング」。返すのは **カード別の人数だけ**（行そのものは返さない）。
-- prev_viewers＝ひとつ前の同じ長さの期間。これがあると「先週より急に見られ出した」が出せる。
create or replace function public.card_view_ranking(p_days int default 7, p_limit int default 10)
returns table (card_id text, viewers int, viewers_today int, prev_viewers int)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  with d as (
    select (now() at time zone 'Asia/Tokyo')::date as today,
           greatest(1, least(coalesce(p_days, 7), 31))   as span
  )
  select v.card_id,
         count(*) filter (where v.day >  d.today - d.span)::int,
         count(*) filter (where v.day =  d.today)::int,
         count(*) filter (where v.day <= d.today - d.span)::int
  from public.card_view_visits v cross join d
  where v.day > d.today - d.span * 2
  group by v.card_id
  having count(*) filter (where v.day > d.today - d.span) > 0
  order by count(*) filter (where v.day > d.today - d.span) desc, v.card_id
  limit greatest(1, least(coalesce(p_limit, 10), 100));
$$;

revoke all on function public.card_view_ranking(int, int) from public;
grant execute on function public.card_view_ranking(int, int) to anon, authenticated;

notify pgrst, 'reload schema';
