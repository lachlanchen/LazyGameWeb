[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyGameWeb

*一個小巧、可靠、需要登入的教學遊戲網站入口，運算留在本機私有設備。*

[![Website](https://img.shields.io/badge/Play-game.lazying.art-176B56?style=for-the-badge)](https://game.lazying.art)
[![Tests](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml/badge.svg)](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F855A?style=for-the-badge)](../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyGameWeb 是 [game.lazying.art](https://game.lazying.art) 的公開入口與部署契約儲存庫。它在雲端邊緣提供登入後的遊戲目錄，只把程式碼中明確列出的少量 API 請求透過專用 LazyEdge 反向通道送到私有設備。規則、狀態轉移、私密資料與模型推論仍由獨立部署的遊戲服務負責；本儲存庫不依賴 LocalLLM，也不與可變動的引擎工作樹耦合。

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## 設計承諾

- **小型邊緣服務：** 入口執行時只使用 Node.js 內建模組。
- **預設拒絕路由：** 僅允許程式碼持有的精確方法與路徑清單；未知方法、路徑、查詢與編碼穿越一律拒絕。
- **權責清楚：** 確定性遊戲服務掌管規則與合法動作。入口不會虛構一步棋，也不會直接修改遊戲。
- **私有運算：** 遊戲專用的 LazyEdge capability 與反向 SSH 身分將流量與其他服務隔離。
- **穩健登入：** 內建 scrypt、HMAC 記憶工作階段、CSRF 防護、頻率限制、嚴格 Cookie 與 CSP。
- **不可變發布：** 入口與靜態遊戲套件來自審核過的發布目錄；密鑰和執行狀態存放在目錄之外。

## 架構

```text
browser
  -> Caddy TLS ingress
  -> authenticated LazyGameWeb portal (cloud loopback)
  -> private LazyEdge listener
  -> dedicated reverse-SSH tunnel
  -> worker guard + strict game gateway (local loopback)
  -> deterministic game services and bounded engines
```

公開主機只對外提供入口。私有 LazyEdge listener、本機閘道、遊戲 API、資料庫、引擎、權杖和模型均不公開。信任模型與部署要求詳見[安全邊界](../docs/security-boundaries.md)。

## 目前內容

| 路徑 | 用途 |
| --- | --- |
| [`apps/portal/`](../apps/portal/) | 無外部執行期相依性的登入入口與固定契約 BFF |
| [`deploy/game.lazying.art/`](../deploy/game.lazying.art/) | 不含密鑰的 LazyEdge manifest、binding 結構與強化的 systemd 範本 |
| [`docs/security-boundaries.md`](../docs/security-boundaries.md) | 信任邊界、憑證所有權與反向代理要求 |
| [`scripts/check-public-repo.sh`](../scripts/check-public-repo.sh) | 測試、語法檢查與發布前密鑰掃描 |

圍棋、Chess/Xiangqi/Shogi、Mahjong 和紙牌遊戲的建置成品是發布輸入，不提交至 Git。引擎、模型權重、資料庫、私有 binding、憑證、執行收據、快取、瀏覽器資料與使用者工作階段也明確排除。

## 快速開始

需要 Node.js 20.19 或更高版本，以及 Bash。

```bash
git clone https://github.com/lachlanchen/LazyGameWeb.git
cd LazyGameWeb
npm test
npm run check
```

請把 `apps/portal/config.example.json` 複製到儲存庫之外的私密位置，並提供只有擁有者可讀的憑證檔案。切勿在命令列中傳遞密碼或 Bearer capability。使用以下命令驗證部署契約：

```bash
lazyedge validate --config deploy/game.lazying.art/lazyedge.yaml
lazyedge plan --config deploy/game.lazying.art/lazyedge.yaml
```

## 安全與部署說明

儲存庫中的範例是經過審核的範本，並非一鍵安裝程式。請依實際主機審核使用者、路徑、連接埠與 GPU 身分。公開反向代理必須使用直接連線方的位址覆寫 `X-Lazying-Client-Address`，保留預期的 `Host` 與 `Cookie`，並刪除傳入的 `Authorization` 和 `Proxy-Authorization`。不得公開私有 listener 或本機遊戲連接埠。請依 [SECURITY.md](../SECURITY.md) 私下回報安全問題。

## 引用

若在研究中使用 LazyGameWeb，請引用本儲存庫。GitHub 會讀取 [CITATION.cff](../CITATION.cff)，並在儲存庫頁面顯示 **Cite this repository** 面板。

```bibtex
@software{chen_lazygameweb_2026,
  author = {Chen, Lachlan},
  title = {LazyGameWeb: A secure web portal for privately computed teaching games},
  year = {2026},
  url = {https://github.com/lachlanchen/LazyGameWeb}
}
```

## 狀態與範圍

LazyGameWeb 是 [game.lazying.art](https://game.lazying.art) 獨立版本化的 Web 與部署邊界。各遊戲產品與推論引擎維持為獨立專案，分別擁有確定性規則、測試、授權條款、發布收據與模型來源說明。
