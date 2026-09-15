# データベース初期設定手順

**注記:** このマイグレーションファイルはまだ実装環境のプロジェクトに適用されていません。本PoCの環境構築時に適用予定です。

## セットアップ手順

1. Supabase で新規プロジェクトを作成する
2. SQL Editor で `supabase/migrations/0001_initial_schema.sql` を実行する
3. 続けて `supabase/migrations/0002_rls_policies.sql` を実行する
4. 続けて `supabase/migrations/0003_send_guard.sql` を実行する（18歳以上と確認済みで、
   連絡不要にされていない候補者にしか送信記録を作れないようにするDBトリガー。アプリ側の
   年齢ガードが画面の古い状態のせいで抜けても、ここで止まる）
5. Authentication > Providers で Email を有効にする
6. 担当者分のユーザーを作成し、各ユーザーについて以下を実行する

```sql
insert into app_users (id, name, email)
values ('<auth.users の id>', '<担当者名>', '<メールアドレス>');
```

7. Project Settings > API から URL と anon key を控え、`.env` に設定する

**6 を忘れると何が起きるか:** 担当者が `app_users` に登録されていないと、送信記録の追加（`messages.sent_by`）と候補者の担当者割り当て（`candidates.assignee_id`）が外部キー違反で失敗する。ログインはできるのに送信だけが失敗するため、最初のセットアップでは特に見落としやすい。

## 制約の意図

- `candidates.tiktok_handle` の一意制約は、同一人物への重複スカウトを防ぐためのもの。アプリ側のフィルタと二重で担保している
- `messages_one_b_per_candidate` は再アプローチを1回までに制限する部分一意インデックス
- `messages` に UPDATE / DELETE のポリシーを作っていないのは、送信記録を改変不可の証跡として扱うため
- **どのテーブルにも DELETE ポリシーを与えていない。** `messages` だけを守っても、候補者を削除できれば外部キー経由で送信記録が失われる。`messages.candidate_id` を `on delete restrict` にしているのはそのため
