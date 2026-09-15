-- どのテーブルにも DELETE ポリシーを与えない。
-- 送信記録は改変不能な証跡であり（設計書 8）、候補者や動画を消せると外部キー経由でそれを失う。
-- 行の削除が必要な場合はデータベース側で対応する。
-- これはオプトアウトを「UIからは解除できない」とした設計書 5.2 と同じ方針である。

alter table videos enable row level security;
alter table app_users enable row level security;
alter table candidates enable row level security;
alter table messages enable row level security;
alter table app_settings enable row level security;

create policy "認証済みユーザーは動画を読める"
  on videos for select to authenticated using (true);

create policy "認証済みユーザーは動画を追加できる"
  on videos for insert to authenticated with check (true);

create policy "認証済みユーザーは動画を更新できる"
  on videos for update to authenticated using (true) with check (true);

create policy "認証済みユーザーは担当者を読める"
  on app_users for select to authenticated using (true);

create policy "本人のみ自分の担当者情報を更新できる"
  on app_users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "認証済みユーザーは候補者を読める"
  on candidates for select to authenticated using (true);

create policy "認証済みユーザーは候補者を追加できる"
  on candidates for insert to authenticated with check (true);

create policy "認証済みユーザーは候補者を更新できる"
  on candidates for update to authenticated using (true) with check (true);

-- 送信記録は証跡のため、更新・削除を許可しない（挿入と参照のみ）。
create policy "認証済みユーザーは送信記録を読める"
  on messages for select to authenticated using (true);

create policy "認証済みユーザーは送信記録を追加できる"
  on messages for insert to authenticated with check (sent_by = auth.uid());

create policy "認証済みユーザーは設定を読める"
  on app_settings for select to authenticated using (true);

create policy "認証済みユーザーは設定を更新できる"
  on app_settings for update to authenticated using (true) with check (true);
