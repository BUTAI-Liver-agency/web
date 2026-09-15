-- 候補者の年齢確認状態。既定は unverified で、adult 以外は送信不可。
create type age_status as enum ('unverified', 'under18', 'adult');

-- パイプラインのステージ（設計書 4.2）。
create type stage as enum (
  'prospect', 'dm_sent', 'responded', 'line_reached', 'meeting_set', 'contracted',
  'undeliverable', 'excluded', 'no_response', 'declined', 'opted_out'
);

create type template_id as enum ('A', 'B');

-- 募集動画。取り込んだコメント数はPoCの最重要指標（母数が足りるか）。
create table videos (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  title text not null,
  posted_at date,
  comment_count_collected integer not null default 0,
  created_at timestamptz not null default now()
);

-- スカウト担当者。Supabase Auth の auth.users と 1:1 で紐づける。
create table app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  role text not null default 'scout',
  created_at timestamptz not null default now()
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  -- 同一人物への重複スカウトを構造的に防ぐ。アプリ側ロジックではなくDB制約で担保する。
  tiktok_handle text not null unique,
  -- 候補者がLINEで名乗る合言葉。LINE到達の紐付けキー。
  ref_code text not null unique,
  display_name text not null,
  comment_text text not null,
  source_video_id uuid references videos (id) on delete set null,
  age_status age_status not null default 'unverified',
  age_verified_by uuid references app_users (id) on delete set null,
  age_verified_at timestamptz,
  stage stage not null default 'prospect',
  assignee_id uuid references app_users (id) on delete set null,
  opted_out boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index candidates_stage_idx on candidates (stage);
create index candidates_assignee_idx on candidates (assignee_id);

-- 送信記録。誰がいつ誰に何を送ったかの全件ログ（設計書 8）。
create table messages (
  id uuid primary key default gen_random_uuid(),
  -- restrict にして、候補者を消しても送信記録が道連れにならないようにする。
  -- 送信記録は事務所を守る唯一の証跡であり、アプリ経由で失われてはならない。
  candidate_id uuid not null references candidates (id) on delete restrict,
  template_id template_id not null,
  body text not null,
  sent_at timestamptz not null default now(),
  sent_by uuid not null references app_users (id)
);

create index messages_candidate_idx on messages (candidate_id);
create index messages_sent_at_idx on messages (sent_at);

-- テンプレBは1候補者につき1回まで（設計書 7.6）。アプリ側ロジックに加えDBでも担保する。
create unique index messages_one_b_per_candidate
  on messages (candidate_id)
  where template_id = 'B';

-- 1日の送信上限などの運用設定。単一行で運用する。
create table app_settings (
  id integer primary key default 1,
  daily_send_limit integer not null default 20,
  updated_at timestamptz not null default now(),
  constraint app_settings_single_row check (id = 1)
);

insert into app_settings (id, daily_send_limit) values (1, 20);

-- updated_at の自動更新
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 取り込み件数を不可分に加算する。
-- 読み取ってから書き戻す方式だと、2人が同時に取り込んだとき片方の件数が失われる。
-- この数値はPoCの最重要指標（募集動画1本あたりのコメント数）なので、静かに欠けてはならない。
create or replace function add_collected_count(p_video_id uuid, p_delta integer)
returns void as $$
  update videos
     set comment_count_collected = comment_count_collected + p_delta
   where id = p_video_id;
$$ language sql security invoker;

create trigger candidates_touch_updated_at
  before update on candidates
  for each row execute function touch_updated_at();
