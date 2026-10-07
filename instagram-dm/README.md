# BUTAI Instagram コメント→公式LINE案内DM

投稿・リール単位でキーワード、完全一致/部分一致、DM文章、LINE URL、ON/OFFを管理。公式LINEの初期値はBUTAIホームページ掲載の https://lin.ee/pgwER6s です。ホームページのファイルは変更しません。コードの保存先は `BUTAI-Liver-agency/web`、実装ブランチは `codex/butai-instagram-comment-dm` です。

## 現在の状態

実装・ローカルの自動テストまで完了。サーバー公開とMeta/Instagram認証、実アカウントでの配送テストは未実施です。GitHub Pagesは静的ホスティングのため、このサーバーを実行できません。管理画面とWebhookはCloudflare Workersで動かします。GitHub Actionsを常時サーバーの代用にしません。

## ローカルで確認

Node.js 24系。サーバー実行時の外部npm依存はありません。Cloudflare公開用の開発依存にWranglerを固定しています。

```sh
cd instagram-dm
cp .env.example .env
# .env の ADMIN_TOKEN を十分長いランダムな値に変更
npm test
npm start
```

http://localhost:3000/ を開き、ADMIN_TOKENでログイン。投稿ID（数字）を指定し、投稿別のキーワードとDMを保存。「送信前に確認」で文章と判定を試せます。確認操作は外部送信しません。APIトークン等をGitHubにコミットしないでください。

## 推奨公開先：Cloudflare Free

Cloudflare Workers + D1版を追加しました。無料版の公開手順と停止機能は [cloudflare/README.md](cloudflare/README.md) を参照してください。サーバー公開と実Instagram配送はまだ未実施です。

管理画面はWorkersの公開URL `/`、Webhookは `/webhook` です。Renderの契約は不要です。`server.mjs` はローカル確認用のNode版として残しています。`render.yaml` は以前の有料構成で、無料版の公開には使いません。

## Instagram接続：Instagram Login方式

1. 対象はBUTAIが管理するInstagramプロアカウント（BusinessまたはCreator）。個人アカウントは対象外。Meta for DevelopersでアプリとInstagram APIのInstagram Loginを設定。
2. `instagram_business_basic` と `instagram_business_manage_comments` を含む適切な権限でアカウントを認証し、Instagram User Access TokenとアカウントIDを取得。Metaの設定・審査が追加権限やAdvanced Accessを求める場合は案内に従う。アプリ役割/テスト利用と本番利用で条件が異なるため、本番権限を確認する。
3. 管理画面の「Instagramの接続設定」でアカウントID・アクセストークン・アプリシークレット・Webhook検証用トークンを入力して保存。この実装にはOAuth認可画面は含まれないため、Metaのセットアップ画面でトークンを取得する。期限・更新・失効を管理してください。管理画面の「認証設定あり」は配送成功や権限審査の完了を意味しません。
4. MetaでWebhookのCallback URLを `https://公開ドメイン/webhook`、Verify TokenをMETA_VERIFY_TOKENに設定し、Instagramの `comments` を購読する。対象プロアカウントにも `POST https://graph.instagram.com/v24.0/{IG_ACCOUNT_ID}/subscribed_apps` に `subscribed_fields=comments` を設定し、アプリ購読を有効化する。リクエストにはBearerトークンを使用する。
5. 管理画面で投稿を読み込み、動画ごとにキーワードとDM文章を設定、投稿ONと全体ONを設定。管理画面の確認モードをONのまま新しいテストコメントをして「確認のみ」の履歴が出ることを確認。
6. 正しいアカウントとLINE URLを確認後、管理画面の確認モードをOFFにして保存。別の新しいテストコメントで本人同意のもとDMを確認。確認モードの既存コメントは再送しません。
7. 未登録投稿、非該当キーワード、投稿OFF、全体OFFでは送信されないことも確認。

## 送信と重複防止

- Instagram公式Private Repliesを使用：`POST /{IG_ACCOUNT_ID}/messages`、`recipient.comment_id` とプレーンテキストDM。ユーザーIDを宛先にした無差別DMは行いません。
- 通常投稿/リールのコメントのみ。ライブ、ストーリー、広告、返信コメント、自己コメントは対象外（自己コメント判定に必要な情報がある場合）。
- 無料版はD1、ローカルNode版はSQLiteでコメントIDを一意キーにして永続保存。署名を生データのHMAC-SHA256で確認し、対象アカウントと登録投稿も照合。WebhookはDB保存後に応答。無料版は毎分1件、ローカルNode版は5秒間隔で1件ずつ処理。
- 明示的なレート制限/一時エラーは最大5試行。通信タイムアウトや送信途中の再起動は「要確認」にし、自動再送しない。Instagram側で確認してください。HTTP成功でもmessage_idが無い応答は成功扱いしません。
- Metaの期限は通常コメントから7日。コメント時刻がWebhookにある場合は7日超を除外。時刻が無いときは受付時刻を使用し、サーバー内の待機は6日で打ち切ります。Metaが実際のコメント時刻で最終判定します。
- 本機能からの私的返信はコメントに対して1通。追加の追客メッセージは実装していません。DMがメッセージリクエストに入る場合があります。
- 全体/投稿をOFFにすると未送信の処理は停止（投稿OFFの待機ジョブはキャンセル）。既に送信中の1件は取り消せません。保存済み待機ジョブは受付時の文章を使用します。
- 管理APIはBearer管理キーで保護。ブラウザではメモリだけに保持。ページ更新で再ログイン。インターネット公開にはHTTPS必須。一般向け多ユーザー認証ではなく、少人数の社内運用向けです。
- コメント本文・ユーザー名は保存せず、コメントID、投稿ID、送信DM、状態を保存。直近100件を画面表示。DBの保存容量と保持期間を定期管理し、バックアップ/削除は運用側で行ってください。古いコメントIDの削除は遅延Webhookでの再処理リスクを伴います。

## 公式資料

- Meta Private Replies: https://developers.facebook.com/docs/instagram-platform/private-replies/
- Meta公式サンプル（API、Private Replies、Webhook例）: https://github.com/fbsamples/messenger-platform-samples/blob/main/postman/instagram-platform-api.postman_collection.json
- Meta Webhooks: https://developers.facebook.com/docs/instagram-platform/webhooks/
- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- Render Blueprint: https://render.com/docs/blueprint-spec
- Render永続ディスク: https://render.com/docs/disks

実装はMeta公式サンプルのInstagram Login方式を基準にしています。APIバージョンは環境変数で変更可能。本番接続時にMetaの対応バージョン・権限・アカウント設定を確認してください。

## 管理画面から接続先を設定・変更

- Instagramアカウント名、数字のアカウントID、APIバージョン、アクセストークン、Metaアプリシークレット、Webhook検証用トークン、確認モード/実送信モードを設定可能です。サーバー再起動は不要。アカウント名だけで認証はできません。
- 1台のサーバーで一度に1アカウントを接続します。同時に複数アカウントを運用する機能ではありません。
- 認証情報はAES-256-GCMで暗号化し永続DBに保存。設定APIは秘密値を返さず、設定済みかどうかだけを返します。空欄の秘密項目は既存値を維持します。アカウント変更時はすべて再入力します。
- `SETTINGS_KEY` を暗号化鍵として使用します。CloudflareではSecretとして設定します。ローカルで未指定ならADMIN_TOKENを使用。保存後に鍵を変更すると復号できなくなるので、鍵を安全に保管・バックアップしてください。ADMIN_TOKENを変更する場合もSETTINGS_KEYは維持します。
- 接続設定の保存は全体OFF・待機ジョブ取消を伴います。アカウントID変更時は登録投稿設定も解除します。送信中は保存を拒否するため、数秒後に再度保存してください。
- 「接続を確認」はアカウント情報取得の疎通確認だけです。Meta側の権限・Webhook購読・実DM配送は個別に確認が必要です。認証情報取得用のOAuthログイン画面は含みません。
- Cloudflareの初回登録とサーバー公開は管理画面からは行えません。GitHubはコード保存先で、無料版の実行先はCloudflare Workersです。
