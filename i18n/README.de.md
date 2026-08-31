[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyGameWeb

*Ein öffentliches Nur-Lese-Spielfenster und ein authentifizierter Lernzugang, gestützt auf private lokale Berechnung.*

[![Website](https://img.shields.io/badge/Play-game.lazying.art-176B56?style=for-the-badge)](https://game.lazying.art)
[![Tests](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml/badge.svg)](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F855A?style=for-the-badge)](../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyGameWeb ist das Repository für das öffentliche Portal und die Deployment-Verträge von [game.lazying.art](https://game.lazying.art). Nicht angemeldete Besucher gelangen zu einer schreibgeschützten Weiqi-Wiedergabe, die ausschließlich auf redigierten, dauerhaft gespeicherten Nachweisen beruht; authentifizierte Lernende können den vollständigen Spielekatalog aufrufen. Der Edge-Dienst leitet bewusst nur einen engen Satz von API-Anfragen durch einen eigenen LazyEdge-Reverse-Tunnel. Spielregeln, Zustandsübergänge, private Daten und Modellinferenz verbleiben in separat bereitgestellten Spieldiensten; dieses Repository ist weder an LocalLLM noch an veränderliche Engine-Arbeitsbäume gekoppelt.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## Designversprechen

- **Kleiner Edge-Dienst:** Das Portal verwendet zur Laufzeit ausschließlich eingebaute Node.js-Module.
- **Standardmäßig geschlossen:** Browseranfragen werden auf eine exakte, dem Code gehörende Positivliste abgebildet; unbekannte Methoden, Pfade und Abfragen sowie kodierte Traversalversuche werden abgewiesen.
- **Klare Autorität:** Deterministische Spieldienste besitzen Regeln und legale Aktionen. Das Portal erfindet keinen Zug und verändert kein Spiel.
- **Sichere öffentliche Wiedergabe:** Besucher können gespeicherte Weiqi-Partien über exakt definierte reine GET-Routen ansehen, die niemals eine Engine starten oder Trainerunterhaltungen offenlegen.
- **Private Berechnung:** Eine eigene LazyEdge-Berechtigung und Reverse-SSH-Identität isolieren den Spielverkehr von unabhängigen Diensten.
- **Robuste Anmeldung:** Passwortprüfung, HMAC-gestützte Merk-Sitzungen, CSRF-Schutz, Ratenbegrenzung, strikte Cookies und eine restriktive CSP sind integriert.
- **Unveränderliche Releases:** Statische Spiele-Bundles und Portalcode kommen aus geprüften Release-Verzeichnissen; Geheimnisse und Sitzungszustand liegen außerhalb.

## Architektur

```text
browser
  -> Caddy TLS ingress
  -> LazyGameWeb portal (public replay or authenticated learning; cloud loopback)
  -> private LazyEdge listener
  -> dedicated reverse-SSH tunnel
  -> worker guard + strict game gateway (local loopback)
  -> deterministic game services and bounded engines
```

Der öffentliche Host stellt nur das Portal bereit. LazyEdge-Listener, Gateway, Spiel-APIs, Datenbanken, Engine-Prozesse, Tokens und Modelldateien bleiben privat. Die [Sicherheitsgrenzen](../docs/security-boundaries.md) beschreiben das Vertrauensmodell und die Deployment-Anforderungen.

## Aktueller Inhalt

| Pfad | Zweck |
| --- | --- |
| [`apps/portal/`](../apps/portal/) | Abhängigkeitsfreies Authentifizierungsportal und Browser-BFF mit festem Vertrag |
| [`deploy/game.lazying.art/`](../deploy/game.lazying.art/) | Nicht geheimes LazyEdge-Manifest, Binding-Formen und gehärtete systemd-Vorlagen |
| [`docs/security-boundaries.md`](../docs/security-boundaries.md) | Vertrauensgrenzen, Eigentum von Zugangsdaten und Reverse-Proxy-Anforderungen |
| [`scripts/check-public-repo.sh`](../scripts/check-public-repo.sh) | Tests, Syntax- und Shell-Prüfungen sowie Geheimnisschutz für öffentliche Releases |

Statische Builds von Weiqi, Chess/Xiangqi/Shogi, Mahjong und Kartenspielen sind Release-Eingaben, keine eingecheckten Artefakte. Engines, Modellgewichte, Datenbanken, private Bindings, Zugangsdaten, Laufzeitbelege, Caches, Browserprofile und Benutzersitzungen sind bewusst ausgeschlossen.

## Schnellstart

Voraussetzungen: Node.js 20.19 oder neuer und Bash.

```bash
git clone https://github.com/lachlanchen/LazyGameWeb.git
cd LazyGameWeb
npm test
npm run check
```

Um das Portal lokal auszuführen, bereite vier vorläufige Produktverzeichnisse mit jeweils einer `index.html` vor, kopiere `apps/portal/config.example.json` aus dem Repository heraus und stelle Zugangsdaten-Dateien bereit, auf die nur ihr Eigentümer zugreifen kann. Übergib niemals ein Passwort oder eine Bearer-Berechtigung über die Kommandozeile.

```bash
node apps/portal/bin/game-portal.mjs hash-password \
  --password-file /absolute/private/login.json \
  --out /absolute/private/login-password-verifier \
  --username USERNAME

node apps/portal/bin/game-portal.mjs serve \
  --config /absolute/private/portal.json
```

Das Deployment-Manifest lässt sich mit der in deiner Umgebung festgelegten LazyEdge-CLI prüfen:

```bash
lazyedge validate --config deploy/game.lazying.art/lazyedge.yaml
lazyedge plan --config deploy/game.lazying.art/lazyedge.yaml
```

## Sicherheit und Deployment

Konfigurationsbeispiele enthalten nur Pfade und Formen. Lege Zugangsdaten außerhalb des Repositorys mit restriktiven Eigentumsrechten an, halte den Laufzeitzustand außerhalb unveränderlicher Releases und prüfe vor der Installation alle Hostnamen, Ports, Benutzer, Modellpfade und GPU-Identitäten für deinen eigenen Host. Die eingecheckten Units sind produktionsorientierte Vorlagen, kein Ein-Befehl-Installer.

Überschreibe am öffentlichen Reverse Proxy `X-Lazying-Client-Address` mit der Adresse des direkten Peers, erhalte die erwarteten Header `Host` und `Cookie` und entferne eingehende Header `Authorization` und `Proxy-Authorization`. Veröffentliche weder den privaten LazyEdge-Listener noch einen lokalen Spielport.

Bitte melde Sicherheitsprobleme vertraulich, wie in [SECURITY.md](../SECURITY.md) beschrieben.

## Zitieren

Wenn du LazyGameWeb in Forschungsarbeiten verwendest, zitiere das Repository. GitHub liest [CITATION.cff](../CITATION.cff) und zeigt den Bereich **Cite this repository** an.

```bibtex
@software{chen_lazygameweb_2026,
  author = {Chen, Lachlan},
  title = {LazyGameWeb: A secure web portal for privately computed teaching games},
  year = {2026},
  url = {https://github.com/lachlanchen/LazyGameWeb}
}
```

## Status und Umfang

LazyGameWeb ist die unabhängig versionierte Web- und Deployment-Grenze für [game.lazying.art](https://game.lazying.art). Spiele und Inferenz-Engines bleiben getrennte Projekte mit eigenen deterministischen Regeln, Tests, Lizenzen, Release-Belegen und Modellherkünften.
