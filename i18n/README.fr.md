[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyGameWeb

*Une petite porte d’entrée web authentifiée pour des jeux pédagogiques sérieux, calculés localement et en privé.*

[![Website](https://img.shields.io/badge/Play-game.lazying.art-176B56?style=for-the-badge)](https://game.lazying.art)
[![Tests](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml/badge.svg)](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F855A?style=for-the-badge)](../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyGameWeb est le dépôt public du portail et du contrat de déploiement de [game.lazying.art](https://game.lazying.art). Il sert le catalogue authentifié à la périphérie du cloud et ne transmet qu’un ensemble étroit et explicite de requêtes API via un tunnel inverse LazyEdge dédié. Les règles, les transitions d’état, les données privées et l’inférence restent dans des services de jeu indépendants ; ce dépôt ne dépend ni de LocalLLM ni d’arbres de travail de moteurs modifiables.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## Engagement de conception

- **Service de périphérie minimal :** le portail n’utilise que les modules intégrés de Node.js à l’exécution.
- **Routage fermé par défaut :** une liste d’autorisation exacte, définie dans le code, rejette toute méthode ou route inconnue.
- **Autorité claire :** les services déterministes possèdent les règles et les coups légaux. Le portail n’invente jamais un coup et ne modifie pas une partie.
- **Calcul privé :** une capacité LazyEdge et une identité SSH inverse dédiées isolent le trafic des jeux.
- **Connexion robuste :** scrypt, sessions HMAC mémorisées, CSRF, limitation des tentatives, cookies stricts et CSP restrictive.
- **Versions immuables :** le portail et les ressources sont servis depuis des répertoires vérifiés ; les secrets et l’état restent à l’extérieur.

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

L’hôte public n’expose que le portail. Le listener LazyEdge privé, la passerelle locale, les API, bases de données, moteurs, jetons et modèles restent privés. Consultez les [limites de sécurité](../docs/security-boundaries.md) pour le modèle de confiance.

## Contenu actuel

| Chemin | Rôle |
| --- | --- |
| [`apps/portal/`](../apps/portal/) | Portail authentifié sans dépendance et BFF à contrat fixe |
| [`deploy/game.lazying.art/`](../deploy/game.lazying.art/) | Manifeste LazyEdge non secret, formes de binding et modèles systemd renforcés |
| [`docs/security-boundaries.md`](../docs/security-boundaries.md) | Frontières de confiance, propriété des identifiants et exigences du proxy |
| [`scripts/check-public-repo.sh`](../scripts/check-public-repo.sh) | Tests, contrôles de syntaxe et garde anti-secrets |

Les builds de Weiqi, Chess/Xiangqi/Shogi, Mahjong et jeux de cartes sont des entrées de version et ne sont pas suivis. Les moteurs, poids, bases de données, bindings privés, identifiants, reçus, caches et sessions sont également exclus.

## Démarrage rapide

Prérequis : Node.js 20.19 ou plus récent et Bash.

```bash
git clone https://github.com/lachlanchen/LazyGameWeb.git
cd LazyGameWeb
npm test
npm run check
```

Copiez `apps/portal/config.example.json` hors du dépôt et fournissez des fichiers d’identifiants privés. Ne passez jamais de mot de passe ou de capacité Bearer en ligne de commande. Validez le contrat avec :

```bash
lazyedge validate --config deploy/game.lazying.art/lazyedge.yaml
lazyedge plan --config deploy/game.lazying.art/lazyedge.yaml
```

## Sécurité et déploiement

Les exemples sont des modèles vérifiés, pas un installateur automatique. Vérifiez les utilisateurs, chemins, ports et identités GPU pour votre hôte. Le proxy public doit écraser `X-Lazying-Client-Address` avec l’adresse directe du pair, conserver `Host` et `Cookie`, puis supprimer les en-têtes entrants `Authorization` et `Proxy-Authorization`. N’exposez jamais le listener privé ou les ports locaux. Signalez les failles en privé selon [SECURITY.md](../SECURITY.md).

## Citation

Si vous utilisez LazyGameWeb dans une recherche, citez ce dépôt. GitHub lit [CITATION.cff](../CITATION.cff) et affiche le panneau **Cite this repository**.

```bibtex
@software{chen_lazygameweb_2026,
  author = {Chen, Lachlan},
  title = {LazyGameWeb: A secure web portal for privately computed teaching games},
  year = {2026},
  url = {https://github.com/lachlanchen/LazyGameWeb}
}
```

## État et périmètre

LazyGameWeb est la frontière web et de déploiement versionnée indépendamment pour [game.lazying.art](https://game.lazying.art). Les jeux et moteurs restent des projets séparés avec leurs propres règles, tests, licences, reçus de version et provenance de modèles.
