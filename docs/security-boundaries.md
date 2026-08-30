# Security boundaries

LazyGameWeb separates a public, authenticated web entrance from private game
services and local computation. The examples deliberately use independent
users, capabilities, ports, state directories, and reverse-tunnel identities.

## Authority boundaries

- The portal serves one exact logged-out Weiqi spectator entry and its hashed
  assets, authenticates every play surface, and translates only exact browser
  API contracts.
- LazyEdge authenticates and bounds the private relay. Its game capability is
  not shared with unrelated services.
- The local gateway validates the dispatch envelope and maps it to a fixed
  loopback target.
- Deterministic game services remain authoritative for legality, state,
  scoring, hidden information, and persistence.
- Engines and player models return bounded analysis or candidate selection;
  they do not receive authority to mutate game state directly.

## Credential ownership

Deployed secrets belong outside immutable releases. On the edge host, keep
`/etc/lazying-game/secrets` owned by `root:root` with mode `0700`, and each
credential file owned by `root:root` with mode `0600`. Deliver credentials to
the portal with systemd `LoadCredential`; do not make them readable by the
service account at rest.

Use separate material for:

1. the password verifier (never the plaintext password);
2. the portal session HMAC secret;
3. the edge-to-worker LazyEdge relay secret;
4. the portal's scoped private-listener capability;
5. the worker-to-gateway upstream authorization capability; and
6. the dedicated reverse-SSH identity.

Do not reuse any of these with LocalLLM, another domain, or another project.

## Reverse-proxy contract

The public reverse proxy must:

- route only the intended `game.lazying.art` host to the loopback portal;
- overwrite `X-Lazying-Client-Address` using the direct peer address;
- preserve the expected `Host` and `Cookie` headers;
- strip inbound `Authorization` and `Proxy-Authorization` headers;
- keep the private LazyEdge listener and all local service ports unpublished;
- serve ACME challenges without bypassing portal authentication elsewhere; and
- apply HTTPS and modern response-security headers.

The portal independently enforces strict session cookies, Origin and
`Sec-Fetch-Site` checks, a session-bound CSRF header, bounded bodies and
responses, concurrency limits, login rate limits, CSP, and no-store handling
for authenticated HTML and API responses.

The public exception is deliberately smaller: GET-only Weiqi archive list,
featured, and opaque replay-detail routes are rate-limited by the Caddy-
overwritten client address. They proxy no browser cookie or authorization,
accept no body, expose no mutation, and return only the game service's redacted
persisted replay projection. The public spectator index has no CSRF bootstrap;
entering a learning board performs a full authenticated navigation.

## Release discipline

Deploy from content-addressed or otherwise immutable release directories. Put
SQLite data, model runtime directories, token stores, sessions, logs, and
receipts in separately owned state paths. Record hashes for reviewed portal,
static bundles, manifests, units, and rollback files. Validate each unit's
effective mount namespace; a read-only child path is not protected when an
ancestor is writable in the same sandbox.
