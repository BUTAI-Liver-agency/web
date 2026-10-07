# BUTAI無料版：Cloudflare Workers + D1

GitHubは `BUTAI-Liver-agency/web`、ブランチは `codex/butai-instagram-comment-dm`。Render契約・常時起動のPC・独自ドメインは不要。Cloudflare **Workers Free**プランと無料の `workers.dev` URLを使用します。有料プランへ切り替えないでください。

## 無料枠と停止動作

- Cloudflare Workers Freeの上限はアカウント全体で1日100,000リクエストです。アプリは安全余裕を確保し **1日90,000回**で新規処理を停止します。Webhook、管理API、ヘルスチェック、毎分の定期実行を同じD1カウンターで数えます。カウント更新はSQLの条件付き更新で不可分なので、複数拠点・同時アクセス・再公開で上限をすり抜けません。90,000はDM件数ではありません。
- 90,000回に達すると動的リクエストにHTTP429とRetry-Afterを返します。新しいコメントの受け付け・DM送信・管理APIの更新を停止します。送信中の1件は取り消せません。定期実行も上限を確認し、次の日まで配送しません。
- 日付はUTC基準、日本時間の毎日9時にリセットします。既存の送信待ちは翌日から順次処理します。上限中のコメントは保存・成功応答しません。Meta側の再配信があれば受け付けますが、再配信期間外のコメントは取り逃す可能性があります。
- **拒否するアクセスもWorkersを起動するため、アプリがインターネットから届くリクエスト自体を止めることはできません。** 拒否分、異常終了、別Workerの利用などはアプリの成功カウンターと一致しません。10万回という無料枠の最後の停止はCloudflare Freeのサービス側上限が担います。別Workerがあると、このアプリは9万回より早く停止する場合があります。専用Cloudflareアカウントを推奨します。
- 静的な管理画面HTML/JSはWorkers Static Assetsから配信し、Workerスクリプトを呼びません。読み込めてもAPIは上限中は停止します。
- D1も独立した無料枠（1日500万行読取・10万行書込、1DB500MB）があります。リクエストカウンターも書込に含まれるため、D1上限が先に来る可能性があります。D1障害や枠超過の場合もWebhookは503、定期処理は失敗として停止し、記録できないまま送信しません。
- D1とInstagramへの負荷を抑えるため、毎分1件ずつ処理し、**DM試行も1日1,000回**までです。成功件数ではなく、失敗・再試行を含むAPI呼出試行数を数えます。送信済みデータは残します。保存容量はCloudflareで定期確認し、古いデータの削除はバックアップと重複防止の影響を検討してから行ってください。
- 無料枠超過で自動的に有料契約へ変更する処理はありません。Freeでのリクエスト制限・CPU制限・D1制限のため、無制限運用や全件配送は保証できません。

## 初回公開

1. Cloudflareアカウントを作り、Workersは **Free** のまま使います。
2. D1データベース `butai-instagram-dm` を作成します。
3. 表示されたdatabase_idを `cloudflare/wrangler.jsonc` の `REPLACE_WITH_D1_DATABASE_ID` に指定します。このIDは秘密ではありません。GitHubに保存できます。
4. Cloudflare WorkersのGitHub連携からリポジトリと実装ブランチを選び、Root directoryを `instagram-dm` にします。ビルドコマンドは空欄、Deploy commandは `npm run deploy:cloudflare`。Wrangler設定は `cloudflare/wrangler.jsonc` です。初期DBマイグレーションを適用して公開します。DBが作成済みでIDが正しいことが必要です。
5. WorkerのSettings > Variables and Secretsで以下を **Secret** として設定し、再公開します。ランダムな値は手元で安全に生成・保管してください。秘密値はチャットやGitHubに貼らないでください。

| Secret | 値 |
| --- | --- |
| ADMIN_TOKEN | 32文字以上のランダム値。管理画面ログインキー |
| SETTINGS_KEY | 別の32文字以上のランダム値。保存後は変更しない暗号化鍵 |
| META_VERIFY_TOKEN | ランダム値。MetaのWebhook検証にも同じ値を指定 |

6. 公開URLを開きADMIN_TOKENでログイン。Instagram接続情報と動画ごとの設定を保存します。初期は全体OFF、確認モードONです。Metaの権限・Webhook購読を設定し、確認モードで新しいコメントが記録されることを確認します。その後、同意したテスト用アカウントで実DM配送を確認します。
7. `/healthz` は200、管理APIは未認証401を確認。画面の「本日処理」「DM試行」が増えることを確認します。通常運用で上限まで実アクセスを発生させる必要はありません。

GitHub連携時にUIが異なる場合は次のCLIでも公開できます。

```sh
cd instagram-dm
npm ci
npx wrangler login
npx wrangler d1 create butai-instagram-dm
# 作成結果のdatabase_idをcloudflare/wrangler.jsoncへ指定
npx wrangler secret put ADMIN_TOKEN --config cloudflare/wrangler.jsonc
npx wrangler secret put SETTINGS_KEY --config cloudflare/wrangler.jsonc
npx wrangler secret put META_VERIFY_TOKEN --config cloudflare/wrangler.jsonc
npm run deploy:cloudflare
```

## ローカル検証

`npm test` はNode版とCloudflare版のテストを実行します。Cloudflare版ではD1インターフェースをSQLiteで再現し、実SQLとトランザクション、上限前の同時アクセス、日次リセット、上限後の送信停止、署名と重複防止、暗号化、送信ロック、アカウント切替を検証します。WranglerでビルドとローカルD1マイグレーションも確認しています。この実行環境ではネットワークインターフェースの制約でWrangler開発サーバーを起動できず、HTTPでの実Workersランタイム確認は未実施です。実Cloudflareの課金計測や実Instagram配送をテストしたものではありません。

`npm run check:cloudflare` でWranglerのビルド・設定を確認できます。`npm run dev:cloudflare` でローカルWorkersランタイムを利用できます。ローカルD1もマイグレーションが必要です。

```sh
npx wrangler d1 migrations apply butai-instagram-dm --local --config cloudflare/wrangler.jsonc
# cloudflare/.dev.varsにADMIN_TOKENとSETTINGS_KEYを安全に設定（gitignore対象）
npm run dev:cloudflare
```

## 公式資料

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/

## 配送と接続の保護

接続情報はWeb Crypto AES-GCMでD1に暗号化保存し、管理APIは秘密値を返しません。Webhookは生データのHMAC-SHA256で署名確認します。D1の1回の実行当たりクエリ制限に合わせ、1つのWebhookで対象アカウントのコメント変更は20件までです。超えるペイロードは保存前に503で拒否します。送信ワーカーと設定保存はD1の期限付きロックで同時実行を防ぎ、送信中の設定保存は409になります。送信が中断されたジョブは要確認になり自動再送しません。別アカウントへ変更した際は全体OFF・待機取消・投稿設定解除を行い、変更前のWebhookが新しい待機ジョブを追加できないよう設定のrevisionも検査します。
