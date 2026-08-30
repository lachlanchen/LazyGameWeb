# Security policy

## Supported version

Security fixes are applied to the latest release on the `main` branch. The
deployment examples are reviewed templates; operators remain responsible for
pinning releases and validating host-specific paths, identities, and ports.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability or disclose
credentials, tokens, private host details, session material, or user data.
Use GitHub's private vulnerability reporting for this repository. Include the
affected version, impact, minimal reproduction, and any suggested mitigation.

If private reporting is unavailable, contact the repository owner through the
contact route on [lazying.art](https://lazying.art) without including live
secrets in the first message.

## Operational reminder

Never commit deployed bindings, password inputs or verifiers, session secrets,
LazyEdge capabilities, SSH identities, model files, databases, session stores,
runtime receipts, or browser profiles. Rotate a capability immediately if it
may have entered a log, shell history, issue, pull request, or artifact.
