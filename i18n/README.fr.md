[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyGameWeb

*Une fenêtre de jeu publique en lecture seule et une entrée d’apprentissage authentifiée, alimentées par des calculs locaux privés.*

[![Website](https://img.shields.io/badge/Play-game.lazying.art-176B56?style=for-the-badge)](https://game.lazying.art)
[![Tests](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml/badge.svg)](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F855A?style=for-the-badge)](../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyGameWeb est le dépôt du portail public et des contrats de déploiement de [game.lazying.art](https://game.lazying.art). Les visiteurs non connectés accèdent à une rediffusion de Weiqi en lecture seule, fondée uniquement sur des preuves persistées et expurgées ; les apprenants authentifiés peuvent accéder au catalogue complet des jeux. La périphérie ne transmet délibérément qu’un ensemble restreint de requêtes API via un tunnel inverse LazyEdge dédié. Les règles des jeux, les transitions d’état, les données privées et l’inférence des modèles restent dans des services de jeu déployés séparément ; ce dépôt n’est couplé ni à LocalLLM ni à des arbres de travail de moteurs modifiables.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## Engagement de conception

- **Service de périphérie minimal :** le portail n’utilise que les modules intégrés de Node.js à l’exécution.
- **Routage fermé par défaut :** les requêtes du navigateur correspondent à une liste d’autorisation exacte détenue par le code ; les méthodes, chemins et requêtes inconnus ainsi que les traversées encodées sont rejetés.
- **Autorité claire :** les services déterministes possèdent les règles et les coups légaux. Le portail n’invente jamais un coup et ne modifie pas une partie.
- **Rediffusion publique sûre :** les visiteurs peuvent regarder des parties de Weiqi enregistrées par des routes GET uniquement et strictement définies, qui ne démarrent jamais de moteur et n’exposent aucune conversation avec le coach.
- **Calcul privé :** une capacité LazyEdge et une identité SSH inverse dédiées isolent le trafic des jeux des services sans rapport.
- **Connexion robuste :** la vérification du mot de passe, les sessions mémorisées adossées à HMAC, la protection CSRF, la limitation de débit, les cookies stricts et une CSP restrictive sont intégrés.
- **Versions immuables :** les bundles statiques des jeux et le code du portail sont servis depuis des répertoires de version vérifiés ; les secrets et l’état des sessions restent à l’extérieur.

## Architecture

```text
browser
  -> Caddy TLS ingress
  -> LazyGameWeb portal (public replay or authenticated learning; cloud loopback)
  -> private LazyEdge listener
  -> dedicated reverse-SSH tunnel
  -> worker guard + strict game gateway (local loopback)
  -> deterministic game services and bounded engines
```

L’hôte public n’expose que le portail. Le listener LazyEdge, la passerelle, les API des jeux, les bases de données, les processus des moteurs, les jetons et les fichiers de modèles restent privés. Consultez les [limites de sécurité](../docs/security-boundaries.md) pour connaître le modèle de confiance et les exigences de déploiement.

## Contenu actuel

| Chemin | Rôle |
| --- | --- |
| [`apps/portal/`](../apps/portal/) | Portail authentifié sans dépendance et BFF du navigateur à contrat fixe |
| [`deploy/game.lazying.art/`](../deploy/game.lazying.art/) | Manifeste LazyEdge non secret, formes de binding et modèles systemd renforcés |
| [`docs/security-boundaries.md`](../docs/security-boundaries.md) | Frontières de confiance, propriété des identifiants et exigences du proxy inverse |
| [`scripts/check-public-repo.sh`](../scripts/check-public-repo.sh) | Tests, contrôles de syntaxe et du shell, et garde des secrets avant publication |

Les builds statiques de Weiqi, Chess/Xiangqi/Shogi, Mahjong et des jeux de cartes sont des entrées de version, et non des artefacts suivis dans Git. Les moteurs, les poids des modèles, les bases de données, les bindings privés, les identifiants, les reçus d’exécution, les caches, les profils de navigateur et les sessions utilisateur sont délibérément exclus.

## Démarrage rapide

Prérequis : Node.js 20.19 ou plus récent et Bash.

```bash
git clone https://github.com/lachlanchen/LazyGameWeb.git
cd LazyGameWeb
npm test
npm run check
```

Pour exécuter le portail localement, préparez quatre répertoires de produits temporaires contenant chacun un fichier `index.html`, copiez `apps/portal/config.example.json` hors du dépôt et fournissez des fichiers d’identifiants accessibles uniquement par leur propriétaire. Ne passez jamais de mot de passe ou de capacité Bearer en ligne de commande.

```bash
node apps/portal/bin/game-portal.mjs hash-password \
  --password-file /absolute/private/login.json \
  --out /absolute/private/login-password-verifier \
  --username USERNAME

node apps/portal/bin/game-portal.mjs serve \
  --config /absolute/private/portal.json
```

Le manifeste de déploiement peut être vérifié avec la version épinglée de la CLI LazyEdge utilisée dans votre environnement :

```bash
lazyedge validate --config deploy/game.lazying.art/lazyedge.yaml
lazyedge plan --config deploy/game.lazying.art/lazyedge.yaml
```

## Sécurité et déploiement

Les exemples de configuration ne contiennent que des chemins et des formes. Créez les identifiants hors du dépôt avec des droits restrictifs, conservez l’état d’exécution hors des versions immuables et vérifiez tous les noms d’hôte, ports, utilisateurs, chemins de modèles et identités GPU pour votre propre hôte avant l’installation. Les unités présentes dans le dépôt sont des modèles destinés à la production, pas un installateur en une commande.

Sur le proxy inverse public, écrasez `X-Lazying-Client-Address` avec l’adresse du pair direct, conservez les en-têtes `Host` et `Cookie` attendus, puis supprimez les en-têtes entrants `Authorization` et `Proxy-Authorization`. Ne publiez pas le listener LazyEdge privé ni aucun port local de jeu.

Veuillez signaler les problèmes de sécurité en privé comme indiqué dans [SECURITY.md](../SECURITY.md).

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
