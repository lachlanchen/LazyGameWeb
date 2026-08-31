[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyGameWeb

*由私有本地计算驱动的公开只读对局窗口与登录学习入口。*

[![Website](https://img.shields.io/badge/Play-game.lazying.art-176B56?style=for-the-badge)](https://game.lazying.art)
[![Tests](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml/badge.svg)](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F855A?style=for-the-badge)](../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyGameWeb 是 [game.lazying.art](https://game.lazying.art) 的公开门户与部署契约仓库。未登录访客会进入只读围棋复盘，其中只使用经过脱敏并持久保存的证据；已登录的学习者则可以进入完整游戏目录。云端边缘仅把代码中明确列出的少量 API 请求通过专用 LazyEdge 反向隧道发送到私有设备。游戏规则、状态迁移、私密数据和模型推理仍由独立部署的游戏服务负责；本仓库不依赖 LocalLLM，也不耦合到可变的引擎工作树。

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## 设计承诺

- **小型边缘服务：** 门户运行时只使用 Node.js 内置模块。
- **默认拒绝路由：** 仅允许代码持有的精确方法与路径清单；未知方法、路径、查询和编码穿越一律拒绝。
- **权责清晰：** 确定性游戏服务掌管规则与合法动作。门户不会虚构一步棋，也不会直接修改游戏。
- **安全公开复盘：** 访客可以通过严格限定为 GET 的路由观看已保存的围棋对局；这些路由绝不会启动引擎，也不会暴露教练对话。
- **私有计算：** 游戏专用的 LazyEdge 能力令牌和反向 SSH 身份将流量与其他服务隔离。
- **稳健登录：** 内置密码验证、HMAC 记忆会话、CSRF 防护、频率限制、严格 Cookie 与限制性 CSP。
- **不可变发布：** 静态游戏包与门户代码来自审核过的发布目录；密钥和会话状态存放在目录之外。

## 架构

```text
browser
  -> Caddy TLS ingress
  -> LazyGameWeb portal (public replay or authenticated learning; cloud loopback)
  -> private LazyEdge listener
  -> dedicated reverse-SSH tunnel
  -> worker guard + strict game gateway (local loopback)
  -> deterministic game services and bounded engines
```

公网主机只暴露门户。私有 LazyEdge listener、网关、游戏 API、数据库、引擎进程、令牌和模型文件均不公开。信任模型与部署要求详见[安全边界](../docs/security-boundaries.md)。

## 当前内容

| 路径 | 用途 |
| --- | --- |
| [`apps/portal/`](../apps/portal/) | 无外部运行时依赖的登录门户与固定契约 BFF |
| [`deploy/game.lazying.art/`](../deploy/game.lazying.art/) | 不含密钥的 LazyEdge manifest、binding 结构与加固的 systemd 模板 |
| [`docs/security-boundaries.md`](../docs/security-boundaries.md) | 信任边界、凭据所有权与反向代理要求 |
| [`scripts/check-public-repo.sh`](../scripts/check-public-repo.sh) | 测试、语法检查、Shell 检查与公开发布密钥防护 |

围棋、Chess/Xiangqi/Shogi、Mahjong 和纸牌游戏的静态构建是发布输入，不是提交到 Git 的产物。引擎、模型权重、数据库、私有 binding、凭据、运行收据、缓存、浏览器配置文件和用户会话也会被有意排除。

## 快速开始

需要 Node.js 20.19 或更高版本，以及 Bash。

```bash
git clone https://github.com/lachlanchen/LazyGameWeb.git
cd LazyGameWeb
npm test
npm run check
```

要在本地运行门户，请准备四个占位产品目录，并在每个目录中放置一个 `index.html`；把 `apps/portal/config.example.json` 复制到仓库之外，并提供只有所有者可读的凭据文件。切勿在命令行中传递密码或 bearer 能力令牌。

```bash
node apps/portal/bin/game-portal.mjs hash-password \
  --password-file /absolute/private/login.json \
  --out /absolute/private/login-password-verifier \
  --username USERNAME

node apps/portal/bin/game-portal.mjs serve \
  --config /absolute/private/portal.json
```

可以使用当前环境固定版本的 LazyEdge CLI 检查部署 manifest：

```bash
lazyedge validate --config deploy/game.lazying.art/lazyedge.yaml
lazyedge plan --config deploy/game.lazying.art/lazyedge.yaml
```

## 安全与部署说明

配置示例只包含路径和结构。请在仓库之外创建所有权严格受限的凭据，将运行状态保存在不可变发布目录之外，并在安装前针对自己的主机审核所有主机名、端口、用户、模型路径与 GPU 身份。提交到仓库的 unit 是面向生产环境的模板，并非一键安装程序。

在公网反向代理处，请用直接连接方的地址覆盖 `X-Lazying-Client-Address`，保留预期的 `Host` 与 `Cookie` 请求头，并删除传入的 `Authorization` 和 `Proxy-Authorization`。不得公开私有 LazyEdge listener 或任何本地游戏端口。

请按照 [SECURITY.md](../SECURITY.md) 中的说明私下报告安全问题。

## 引用

如果在研究中使用 LazyGameWeb，请引用本仓库。GitHub 会读取 [CITATION.cff](../CITATION.cff)，并在仓库页面显示 **Cite this repository** 面板。

```bibtex
@software{chen_lazygameweb_2026,
  author = {Chen, Lachlan},
  title = {LazyGameWeb: A secure web portal for privately computed teaching games},
  year = {2026},
  url = {https://github.com/lachlanchen/LazyGameWeb}
}
```

## 状态与范围

LazyGameWeb 是 [game.lazying.art](https://game.lazying.art) 独立版本化的 Web 与部署边界。各游戏产品和推理引擎保持为独立项目，分别拥有确定性规则、测试、许可证、发布收据和模型来源说明。
