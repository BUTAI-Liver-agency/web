-- 送信記録を作れるのは、18歳以上と確認済みで、連絡不要にされていない候補者だけ。
--
-- アプリ側の年齢ガードは画面の状態に依存する。担当者が候補者カードを開いている間に
-- 別の担当者が対象外へ移した場合、画面は古いままで承認ボタンが押せてしまう。
-- 設計書5.4が「確認を経ずに送信することが構造的に不可能」と定めている以上、
-- 最後の砦はデータベース側に置く。
create or replace function assert_candidate_sendable() returns trigger as $$
begin
  if exists (
    select 1
      from candidates c
     where c.id = new.candidate_id
       and (c.age_status <> 'adult' or c.opted_out)
  ) then
    raise exception '18歳以上と確認されていない、または連絡不要の候補者には送信記録を作成できません';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger messages_assert_sendable
  before insert on messages
  for each row execute function assert_candidate_sendable();
