# LazyingArt Game Portal

This package is the small cloud entrance for the teaching-game products. It
offers one read-only public Weiqi replay and authenticates every learning/play
surface. It uses only Node.js built-ins at runtime. The browser reaches this
service through the reviewed `game.lazying.art` Caddy site; computation remains
on the private workstation behind one fixed LazyEdge private listener.

## Boundaries

- The listener is fixed to IPv4 loopback and defaults to `127.0.0.1:18620`.
- The BFF can call only the configured loopback `POST /v1/game/dispatch` URL.
- Its bearer capability is read once from a protected regular file. Browser
  Authorization and Cookie headers are never forwarded.
- The browser API map is code-owned: exact private Weiqi routes, GET-only
  public Weiqi archive routes, Chess
  `POST /api/engine-analysis`, and DouZero `GET /api/douzero/health` plus
  `POST /api/douzero/analyze`. Unknown paths, methods, queries, encoded
  separators, and traversal fail closed.
- Rules and game state stay with the deterministic product services. The portal
  does not manufacture moves or interpret hidden game state.

The configured immutable release directory has this shape:

```text
public/
  weiqi/index.html
  chess/index.html
  mahjong/index.html
  poker/index.html
```

Each authenticated SPA index receives an external same-origin bootstrap before
its module scripts. The public spectator index deliberately omits that
bootstrap and can request only the exact archive GETs. The bootstrap wraps the
browser's existing `fetch` and adds the session-bound `X-Game-CSRF` value only
to same-origin, state-changing `/api/` requests. It never adds the value to
cross-origin or read-only calls. Index HTML, the bootstrap, service workers,
manifests, portal pages, and APIs are `no-store`; versioned Weiqi assets needed
by the spectator are public immutable responses, while other assets remain
private immutable responses.

## Credential preparation

Do not pass a password in argv. Prepare an owner-only input file as either a
single line or strict JSON:

```json
{"username":"lachlanchen","password":"value-is-private"}
```

Then create the verifier without printing the password or verifier:

```bash
node ./bin/game-portal.mjs hash-password \
  --password-file /absolute/private/login.json \
  --out /absolute/private/login-password-verifier \
  --username lachlanchen
```

The output is a non-overwriting mode-`0600` JSON record containing the username
and scrypt verifier. The plaintext input remains under its owner's retention
policy; it is never copied into a release, configuration, log, or unit.

The session secret and LazyEdge client token are separate high-entropy
capabilities in owner-only files. The session store directory must already be a
mode-`0700` directory owned by the service account. Remembered sessions are
stored as HMAC identities, written atomically as mode `0600`, and never contain
the raw cookie or secret.

## Run and verify

Copy `config.example.json` outside the immutable release, replace reviewed
paths and the release ID, and run:

```bash
node ./bin/game-portal.mjs serve --config /absolute/path/service.json
npm test
```

The public Caddy route must preserve Cookie, set Host to `game.lazying.art`,
and overwrite (never merely pass through) `X-Lazying-Client-Address` with
Caddy's direct client address. That overwritten value is the only forwarded
identity trusted by the per-client login failure limiter; a separate global
failure limiter still bounds brute-force work across all clients. Both windows
reserve capacity before scrypt, so concurrent verifiers cannot share the last
failure slot. Only completed invalid-credential attempts commit those
reservations; valid logins release them, while stale one-time forms and requests
rejected as verifier-busy reserve nothing. Stale forms receive a fresh challenge
and a human-readable explanation. The bounded login form accepts the complete
documented UTF-8 password range, and its refreshed challenge remains valid
through the 15-minute failure window. Caddy must not expose the
LazyEdge private listener. Use a systemd `StateDirectory` for session state and
`LoadCredential` for the three credential files.
