[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyGameWeb

*プライベートなローカル計算で本格的な学習ゲームを提供する、小さく堅牢な認証付きウェブ入口です。*

[![Website](https://img.shields.io/badge/Play-game.lazying.art-176B56?style=for-the-badge)](https://game.lazying.art)
[![Tests](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml/badge.svg)](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F855A?style=for-the-badge)](../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyGameWeb は [game.lazying.art](https://game.lazying.art) の公開ポータルとデプロイ契約を管理するリポジトリです。認証済みのゲーム一覧をクラウドエッジから配信し、コードで明示された最小限の API リクエストだけを専用の LazyEdge リバーストンネルへ転送します。ルール、状態遷移、非公開データ、モデル推論は独立したゲームサービス側に残ります。本リポジトリは LocalLLM や変更可能なエンジンの作業ツリーに依存しません。

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## 設計上の約束

- **小さなエッジサービス:** 実行時に使うのは Node.js の組み込みモジュールだけです。
- **フェイルクローズな経路:** コード所有の厳密な許可リストだけを受け付け、未知のメソッド、パス、クエリ、トラバーサルを拒否します。
- **明確な権限:** 決定論的なゲームサービスがルールと合法手を管理します。ポータルは着手を作らず、ゲーム状態を変更しません。
- **非公開の計算:** ゲーム専用の LazyEdge capability とリバース SSH ID により、他サービスから通信を分離します。
- **堅牢なログイン:** scrypt、HMAC で保護した記憶セッション、CSRF 対策、レート制限、厳格な Cookie と CSP を備えます。
- **不変リリース:** ポータルと静的バンドルはレビュー済みのリリースディレクトリから配信し、秘密情報と状態はその外に置きます。

## アーキテクチャ

```text
browser
  -> Caddy TLS ingress
  -> authenticated LazyGameWeb portal (cloud loopback)
  -> private LazyEdge listener
  -> dedicated reverse-SSH tunnel
  -> worker guard + strict game gateway (local loopback)
  -> deterministic game services and bounded engines
```

公開ホストが外部へ見せるのはポータルだけです。非公開 LazyEdge listener、ローカルゲートウェイ、ゲーム API、データベース、エンジン、トークン、モデルは公開しません。信頼モデルは[セキュリティ境界](../docs/security-boundaries.md)を参照してください。

## 現在の内容

| パス | 用途 |
| --- | --- |
| [`apps/portal/`](../apps/portal/) | 外部ランタイム依存のない認証ポータルと固定契約 BFF |
| [`deploy/game.lazying.art/`](../deploy/game.lazying.art/) | 秘密を含まない LazyEdge manifest、binding の形、強化済み systemd テンプレート |
| [`docs/security-boundaries.md`](../docs/security-boundaries.md) | 信頼境界、認証情報の所有権、リバースプロキシ要件 |
| [`scripts/check-public-repo.sh`](../scripts/check-public-repo.sh) | テスト、構文検査、公開前の秘密情報検査 |

囲碁、Chess/Xiangqi/Shogi、Mahjong、カードゲームの生成済みビルドはリリース入力であり、Git には含めません。エンジン、モデル重み、データベース、非公開 binding、認証情報、実行記録、キャッシュ、セッションも除外します。

## クイックスタート

Node.js 20.19 以降と Bash が必要です。

```bash
git clone https://github.com/lachlanchen/LazyGameWeb.git
cd LazyGameWeb
npm test
npm run check
```

`apps/portal/config.example.json` をリポジトリ外の非公開場所へコピーし、所有者だけが読める認証情報ファイルを用意します。パスワードや Bearer capability をコマンドラインへ渡してはいけません。デプロイ契約は次で検証できます。

```bash
lazyedge validate --config deploy/game.lazying.art/lazyedge.yaml
lazyedge plan --config deploy/game.lazying.art/lazyedge.yaml
```

## セキュリティとデプロイ

同梱例はレビュー済みテンプレートであり、自動インストーラーではありません。ホストごとにユーザー、パス、ポート、GPU ID を確認してください。公開プロキシは `X-Lazying-Client-Address` を直接接続元のアドレスで上書きし、想定する `Host` と `Cookie` を保持し、受信した `Authorization` と `Proxy-Authorization` を削除する必要があります。非公開 listener やローカルゲームポートを公開しないでください。脆弱性は [SECURITY.md](../SECURITY.md) に従い非公開で報告してください。

## 引用

研究で LazyGameWeb を利用する場合は、本リポジトリを引用してください。GitHub は [CITATION.cff](../CITATION.cff) を読み、リポジトリページに **Cite this repository** パネルを表示します。

```bibtex
@software{chen_lazygameweb_2026,
  author = {Chen, Lachlan},
  title = {LazyGameWeb: A secure web portal for privately computed teaching games},
  year = {2026},
  url = {https://github.com/lachlanchen/LazyGameWeb}
}
```

## 状況と対象範囲

LazyGameWeb は [game.lazying.art](https://game.lazying.art) のために独立してバージョン管理されるウェブ／デプロイ境界です。ゲーム製品と推論エンジンは、独自の決定論的ルール、テスト、ライセンス、リリース記録、モデル由来情報を持つ別プロジェクトです。
