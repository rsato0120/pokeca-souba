-- Aggregate daily visitors separately from card views. No raw IP addresses are stored.
begin;
create table if not exists public.site_visit_days (
  day date primary key,
  visitors bigint not null default 0 check (visitors >= 0)
);
create table if not exists public.site_visit_dedup (
  day date not null,
  visitor text not null,
  primary key (day, visitor)
);
create table if not exists public.site_visit_total (
  singleton boolean primary key default true check (singleton),
  visitors bigint not null default 0 check (visitors >= 0),
  started_on date not null default (now() at time zone 'Asia/Tokyo')::date
);
insert into public.site_visit_total (singleton) values (true) on conflict do nothing;
alter table public.site_visit_days enable row level security;
alter table public.site_visit_dedup enable row level security;
alter table public.site_visit_total enable row level security;
revoke all on public.site_visit_days, public.site_visit_dedup, public.site_visit_total from public, anon, authenticated;

create or replace function public.record_site_visit(p_count boolean default true)
returns table (today bigint, total bigint, started_on date, day date)
language plpgsql
security definer
set search_path = public, pg_temp
volatile
as $$
declare
  v_day date := (now() at time zone 'Asia/Tokyo')::date;
  v_ip text;
  v_added integer;
begin
  if p_count then
    v_ip := btrim(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1));
    -- Without a client address we can read totals, but must not invent a new visitor.
    if v_ip <> '' then
      insert into public.site_visit_dedup (day, visitor)
      values (v_day, md5(v_day::text || '|' || v_ip)) on conflict do nothing;
      get diagnostics v_added = row_count;
      if v_added = 1 then
        insert into public.site_visit_days as d (day, visitors) values (v_day, 1)
        on conflict on constraint site_visit_days_pkey do update set visitors = d.visitors + 1;
        update public.site_visit_total t set visitors = t.visitors + 1 where singleton;
        -- Preserve aggregate counts forever; identifiers only cover today and yesterday.
        delete from public.site_visit_dedup v where v.day < v_day - 1;
      end if;
    end if;
  end if;
  return query select coalesce(d.visitors, 0::bigint), t.visitors, t.started_on, v_day
  from public.site_visit_total t
  left join public.site_visit_days d on d.day = v_day
  where t.singleton;
end;
$$;
revoke all on function public.record_site_visit(boolean) from public;
grant execute on function public.record_site_visit(boolean) to anon, authenticated;
commit;
