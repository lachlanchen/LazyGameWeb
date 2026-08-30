# game.lazying.art deployment

This directory contains only the non-secret contract for the game site. The
runtime is deliberately independent from LocalLLM:

- a dedicated cloud portal terminates the `lachlanchen` login and serves the
  immutable static game bundle;
- the portal calls one fixed private LazyEdge route on `127.0.0.1:18120`;
- a separate SSH identity and restricted tunnel account carry that route to the
  game worker guard on `127.0.0.1:17820`;
- the worker injects a game-only upstream capability before calling the strict
  local gateway on `127.0.0.1:18030`;
- Weiqi is a one-worker FastAPI process with persistent SQLite data outside the
  release. KataGo is local, lazy, bounded, and pinned to physical GPU 1 by PCI
  ordering. Chess engines are bounded CPU children. Browser-only game sessions
  remain in local storage on the stable HTTPS origin.

The site adds one host to the existing Caddy ingress. It does not modify the
existing 80/443 nftables redirect, LocalLLM manifest, LocalLLM tunnel, LocalLLM
credentials, or any LocalLLM service.

The reviewed host fragment is
[`caddy/game.caddy.example`](caddy/game.caddy.example). Install it as a separate
root-owned include after validating the combined Caddyfile. It overwrites the
public authority and client-address boundary at the proxy, strips caller-supplied
forwarding/authentication headers, and suppresses only the game host's misleading
`Alt-Svc: h3=":10443"` when `10443` is an internal redirect target rather than a
public QUIC port.

## Independent release inputs

This repository owns the public portal and non-secret deployment contract. It
does not copy or import game engines, model code, model weights, databases, or
mutable product worktrees. The Weiqi, Chess, Poker/DouZero, Mahjong, local
gateway, and static web bundles referenced by these templates must arrive as
separately reviewed immutable release inputs with their own provenance and
tests. In particular, the DouZero service template calls lifecycle scripts from
the pinned Poker release; those scripts are deliberately not duplicated here.

## Credential and proxy requirements

On the edge host, create `/etc/lazying-game/secrets` as `root:root` mode `0700`
and each credential inside it as `root:root` mode `0600`. Deliver portal
credentials with systemd `LoadCredential`; never place plaintext passwords,
tokens, SSH identities, deployed bindings, or session state in a release.

Caddy must overwrite `X-Lazying-Client-Address` with the direct peer address,
preserve the intended `Host` and `Cookie` headers, and strip inbound
`Authorization` and `Proxy-Authorization`. The private LazyEdge listener and
all local game ports must remain unpublished.

## Public paths

| Category | Paths |
| --- | --- |
| Weiqi | `/weiqi/`, `/weiqi/full`, board query `board=5|7|9|19` |
| Chess family | `/chess/?game=chess|xiangqi|shogi` |
| Mahjong | `/mahjong/?profile=riichi|mcr|hong-kong` |
| Cards | `/poker/?game=holdem|bridge|guandan|doudizhu` |

Only the explicitly translated browser APIs reach private compute. Static
assets are served at the cloud edge with immutable cache headers. API and HTML
responses are `no-store`/`no-cache` as appropriate.

## Required validation

Before any rollout, validate and plan with the pinned LazyEdge release:

```bash
lazyedge validate --config deploy/game.lazying.art/lazyedge.yaml
lazyedge plan --config deploy/game.lazying.art/lazyedge.yaml
```

The accepted release receipt must record hashes for the manifest, LazyEdge
package, four static bundles, portal, gateway, service units, and Caddy rollback
file. Secrets and runtime receipts belong only in owner-protected private state.
