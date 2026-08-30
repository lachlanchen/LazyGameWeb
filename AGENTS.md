# LazyGameWeb repository guidance

LazyGameWeb owns only the authenticated web portal and public deployment
contracts for `game.lazying.art`.

## Boundaries

- Keep game rules, legal actions, persistence, engines, model code, model
  weights, and inference outside this repository.
- Do not add a runtime dependency on LocalLLM or another unrelated project.
- Browser API forwarding remains an exact, code-owned allowlist and fails
  closed for unknown methods, paths, queries, or traversal.
- Never commit credentials, private bindings, SSH identities, databases,
  sessions, browser profiles, runtime receipts, caches, static product builds,
  or host-private configuration.
- Deployment templates may refer only to reviewed immutable release inputs,
  never mutable product worktrees.

## Validation

Run before committing:

```bash
npm run check
git diff --check
```

Changes to authentication, routing, credentials, reverse-proxy behavior, or
systemd hardening require focused fail-closed tests and a security-boundary
review.
