[English](README.md) · [العربية](i18n/README.ar.md) · [Español](i18n/README.es.md) · [Français](i18n/README.fr.md) · [日本語](i18n/README.ja.md) · [한국어](i18n/README.ko.md) · [Tiếng Việt](i18n/README.vi.md) · [中文 (简体)](i18n/README.zh-Hans.md) · [中文（繁體）](i18n/README.zh-Hant.md) · [Deutsch](i18n/README.de.md) · [Русский](i18n/README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyGameWeb

*A small, authenticated web entrance for serious teaching games powered by private local computation.*

[![Website](https://img.shields.io/badge/Play-game.lazying.art-176B56?style=for-the-badge)](https://game.lazying.art)
[![Tests](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml/badge.svg)](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F855A?style=for-the-badge)](LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyGameWeb is the public portal and deployment-contract repository for [game.lazying.art](https://game.lazying.art). It serves the authenticated game catalogue at the cloud edge and forwards a deliberately narrow set of API requests through a dedicated LazyEdge reverse tunnel. Game rules, state transitions, private data, and model inference stay in separately deployed game services; this repository is not coupled to LocalLLM or mutable engine worktrees.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## Design promise

- **Small edge service:** the portal uses only Node.js built-ins at runtime.
- **Fail-closed routing:** browser requests map to an exact code-owned allowlist; unknown methods, paths, queries, and encoded traversal are rejected.
- **Clear authority:** deterministic game services own rules and legal actions. The portal never invents a move or mutates a game.
- **Private compute:** a dedicated LazyEdge capability and reverse SSH identity isolate game traffic from unrelated services.
- **Durable login:** password verification, HMAC-backed remembered sessions, CSRF protection, rate limits, strict cookies, and a restrictive CSP are built in.
- **Immutable releases:** static game bundles and portal code are served from reviewed release directories; secrets and session state live outside them.

## Architecture

```text
browser
  -> Caddy TLS ingress
  -> authenticated LazyGameWeb portal (cloud loopback)
  -> private LazyEdge listener
  -> dedicated reverse-SSH tunnel
  -> worker guard + strict game gateway (local loopback)
  -> deterministic game services and bounded engines
```

The public host exposes only the portal. The LazyEdge listener, gateway, game APIs, databases, engine processes, tokens, and model files remain private. See [Security boundaries](docs/security-boundaries.md) for the trust model and deployment requirements.

## Current contents

| Path | Purpose |
| --- | --- |
| [`apps/portal/`](apps/portal/) | Dependency-free authenticated portal and fixed-contract browser BFF |
| [`deploy/game.lazying.art/`](deploy/game.lazying.art/) | Non-secret LazyEdge manifest, binding shapes, and hardened systemd templates |
| [`docs/security-boundaries.md`](docs/security-boundaries.md) | Trust boundaries, credential ownership, and reverse-proxy requirements |
| [`scripts/check-public-repo.sh`](scripts/check-public-repo.sh) | Tests, syntax checks, shell checks, and public-release secret guard |

Static builds of Weiqi, Chess/Xiangqi/Shogi, Mahjong, and card games are release inputs, not committed artifacts. Engines, model weights, databases, private bindings, credentials, runtime receipts, caches, browser profiles, and user sessions are intentionally excluded.

## Quick start

Requirements: Node.js 20.19 or newer and Bash.

```bash
git clone https://github.com/lachlanchen/LazyGameWeb.git
cd LazyGameWeb
npm test
npm run check
```

To run the portal locally, prepare four placeholder product directories with an `index.html` in each, copy `apps/portal/config.example.json` outside the repository, and provide owner-only credential files. Never pass a password or bearer capability on the command line.

```bash
node apps/portal/bin/game-portal.mjs hash-password \
  --password-file /absolute/private/login.json \
  --out /absolute/private/login-password-verifier \
  --username USERNAME

node apps/portal/bin/game-portal.mjs serve \
  --config /absolute/private/portal.json
```

The deployment manifest can be checked with the pinned LazyEdge CLI used by your environment:

```bash
lazyedge validate --config deploy/game.lazying.art/lazyedge.yaml
lazyedge plan --config deploy/game.lazying.art/lazyedge.yaml
```

## Security and deployment notes

Configuration examples contain paths and shapes only. Create credentials outside the repository with restrictive ownership, keep runtime state outside immutable releases, and review all hostnames, ports, users, model paths, and GPU identities for your own host before installation. The checked-in units are production-oriented templates, not a one-command installer.

At the public reverse proxy, overwrite `X-Lazying-Client-Address` from the direct peer address, preserve the expected `Host` and `Cookie` headers, and remove inbound `Authorization` and `Proxy-Authorization`. Do not publish the private LazyEdge listener or any local game port.

Please report security issues privately as described in [SECURITY.md](SECURITY.md).

## Citation

If you use LazyGameWeb in research, cite the repository. GitHub reads [CITATION.cff](CITATION.cff) and shows a **Cite this repository** panel on the repo page.

```bibtex
@software{chen_lazygameweb_2026,
  author = {Chen, Lachlan},
  title = {LazyGameWeb: A secure web portal for privately computed teaching games},
  year = {2026},
  url = {https://github.com/lachlanchen/LazyGameWeb}
}
```

## Status and scope

LazyGameWeb is the independently versioned web and deployment boundary for [game.lazying.art](https://game.lazying.art). The game products and inference engines remain separate projects with their own deterministic rules, tests, licenses, release receipts, and model provenance.
