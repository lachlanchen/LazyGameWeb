# Contributing

Contributions that make the portal smaller, safer, easier to audit, or more
portable are welcome.

1. Keep rules, game state, and model inference outside the portal.
2. Extend browser API routing only with an explicit method/path contract and
   fail-closed tests.
3. Never add credentials, runtime state, model weights, generated game bundles,
   or host-private configuration.
4. Run `npm run check` and `git diff --check` before opening a pull request.
5. Explain changes to trust boundaries, authentication, routing, or service
   hardening in the pull request description.

Security reports should follow [SECURITY.md](SECURITY.md), not public issues.
