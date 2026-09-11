# BUTAI 募集サイト修正版（2026-09-10）

## 状態
修正版は作成・検証済みですが、GitHubへの反映は未完了です。
GitHub連携がブランチ作成を403（Resource not accessible by integration）で拒否しました。
接続から確認できたGitHub Appのインストール先はYushi0118のみです。
BUTAI-Liver-agency側へのアプリのインストール・対象webリポジトリへのアクセス許可を確認する必要があります。

## バックアップ
元のリビジョン: 0779847630b27dc95a38aefc824bb1c8450f3fe5
BUTAI-backup-20260910.zipに元のindex.htmlとimgフォルダをそのまま保存しています。
元のindex.htmlには埋め込み画像も含まれています。
復元するときはバックアップのファイルをリポジトリ直下に戻します。
新規追加のstyles.css・script.jsは旧index.htmlから参照されないため、旧サイトの表示には影響しません。

## 変更点
- 黒・深紅・金のブランドを保ち、所属者の写真を主役に再構成。
- ライバー紹介を前半へ。サポートを具体的な準備・活動・振り返りに整理。
- PCのスクロール連動の写真移動、固定セクション、進捗ライン、段階表示。
- モバイルは長い固定演出を使わず、LINE相談ボタンを常設。
- LINEの主ボタンを「LINEで相談する」に統一し、応募・選考・契約の違いを明示。
- 年齢・配信時間・ノルマ・契約期間・退所・顔出しについてFAQを追加。
- 未確認の月収100万円実績・匿名活動実績を削除。即時換金・還元率100%の断定を整理。
- 5問診断を「相談メモ」に変更し、全回答を結果に反映。前の質問・やり直し・コピーに対応。
- 冒頭の2.6秒待機、センサー権限要求、常時パーティクル、隠しテーマ切替、キー操作阻害を除去。
- 仮のSNSリンクを削除。実在する所属者・代表の既存SNSリンクを保持。
- prefers-reduced-motion、見えるキーボードフォーカス、メニューの開閉・Escapeに対応。
- FAQはJavaScriptがなくても操作可能。相談メモが使えない場合もLINEへの入口を表示。
- 巨大な埋め込み画像をHTMLから分離し、既存imgフォルダを利用。

## 確認済み
- JavaScript構文、ページ内リンク、ローカル画像・CSS・JS、LINEリンクの整合性。
- バックアップZIP内のファイルの存在。
- PC表示、390px幅のフレーム内のモバイル表示（実機テストではありません）。
- モバイルのメニュー開閉・ページ内移動、横はみ出しなし。
- 5問の回答がすべて結果に反映され、やり直し可能。
- FAQ開閉。
- コピーAPIが利用できないHTTP環境での案内表示。

## 実運用で確認する点
- 年齢・ノルマ・契約期間・解約条件・正式な所在地は元サイトに詳細がないため、断定していません。確認後に具体的な条件へ差し替えると、相談前の疑問をさらに減らせます。
- 本人の具体的な体験談・受けた支援のエピソードは未提供のため創作していません。本人確認済みの原稿を追加できます。
- LINE友だち追加後の自動返信・応募フォームは変更していません。相談も受け付けるサイトの案内と整合させてください。
- HTTPS本番でのクリップボード成功、スマホ実機でのLINE起動、登録率の実測は未確認です。
- 参考TikTok動画は取得できていないため、動画の再現ではなく、確認済み素材でのオリジナル再構成です。

## ファイル
index.html・styles.css・script.js・img/ が公開用ファイルです。
package.jsonとdev-server.mjsは、依存ライブラリなしでローカル表示を確認するための開発用です。


## 2026-09-11 — BUTAI special experience

- Added `special/index.html`, `special/special.css`, `special/special.js` and an LP entrance banner and navigation links.
- Four chapters: voice, connection, possibility, and LINE consultation. Uses existing BUTAI portraits and brand colors.
- Scroll-linked typography, portrait movement, and full-screen chapter backgrounds. Native scrolling and chapter anchors remain available. Reduced-motion settings and a manual motion control are supported.
- Original 88 BPM ambient score synthesized with Web Audio (A minor / F / C / G colors, arpeggio, pad and bass). No KOKUYO artwork, code or audio copied. Starts only after an explicit gesture; mute, tab-hide suspension and no-audio fallback included.
- KOKUYO reference loaded its entry/color screen, but a ReferenceError prevented full animation inspection in the available browser. Music was not auditioned; this is an original interpretation, not a reproduction.
- Browser validation: desktop and 390px frame, no horizontal overflow; sound-start reported running, mute, motion toggle, chapter navigation, LP navigation. Audio has not been assessed by listening on physical devices. Existing LINE URL retained; no live registration performed.
- Pre-special backup: `BUTAI-before-special-20260911.zip` from commit 75890a6. Original-site backup from 0779847630b27dc95a38aefc824bb1c8450f3fe5 remains preserved separately.
- Publication remains blocked by the GitHub App integration write permission. This package is a local release, not a confirmed live deployment.
