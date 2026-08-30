[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyGameWeb

*Ein kleines, authentifiziertes Webportal für anspruchsvolle Lernspiele mit privater lokaler Berechnung.*

[![Website](https://img.shields.io/badge/Play-game.lazying.art-176B56?style=for-the-badge)](https://game.lazying.art)
[![Tests](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml/badge.svg)](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F855A?style=for-the-badge)](../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyGameWeb ist das öffentliche Portal- und Deployment-Vertragsrepository für [game.lazying.art](https://game.lazying.art). Es liefert den authentifizierten Spielekatalog am Cloud-Rand aus und leitet nur einen engen, ausdrücklich definierten Satz von API-Anfragen durch einen eigenen LazyEdge-Reverse-Tunnel. Regeln, Zustandsübergänge, private Daten und Modellinferenz verbleiben in getrennten Spieldiensten; dieses Repository ist weder an LocalLLM noch an veränderliche Engine-Arbeitsbäume gekoppelt.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## Designversprechen

- **Kleiner Edge-Dienst:** Das Portal verwendet zur Laufzeit ausschließlich eingebaute Node.js-Module.
- **Standardmäßig geschlossen:** Eine exakte, im Code definierte Positivliste weist unbekannte Methoden, Pfade und Traversalversuche ab.
- **Klare Autorität:** Deterministische Spieldienste besitzen Regeln und legale Aktionen. Das Portal erfindet keinen Zug und verändert kein Spiel.
- **Private Berechnung:** Eine eigene LazyEdge-Berechtigung und Reverse-SSH-Identität isolieren den Spielverkehr.
- **Robuste Anmeldung:** scrypt, HMAC-gesicherte Merk-Sitzungen, CSRF-Schutz, Ratenbegrenzung, strikte Cookies und restriktive CSP.
- **Unveränderliche Releases:** Portal und statische Bundles kommen aus geprüften Release-Verzeichnissen; Geheimnisse und Zustand liegen außerhalb.

## Architektur

```text
browser
  -> Caddy TLS ingress
  -> authenticated LazyGameWeb portal (cloud loopback)
  -> private LazyEdge listener
  -> dedicated reverse-SSH tunnel
  -> worker guard + strict game gateway (local loopback)
  -> deterministic game services and bounded engines
```

Der öffentliche Host stellt nur das Portal bereit. Privater LazyEdge-Listener, lokales Gateway, APIs, Datenbanken, Engines, Tokens und Modelle bleiben intern. Die [Sicherheitsgrenzen](../docs/security-boundaries.md) beschreiben Vertrauensmodell und Deployment-Anforderungen.

## Aktueller Inhalt

| Pfad | Zweck |
| --- | --- |
| [`apps/portal/`](../apps/portal/) | Abhängigkeitsfreies Authentifizierungsportal und BFF mit festem Vertrag |
| [`deploy/game.lazying.art/`](../deploy/game.lazying.art/) | Nicht geheimes LazyEdge-Manifest, Binding-Formen und gehärtete systemd-Vorlagen |
| [`docs/security-boundaries.md`](../docs/security-boundaries.md) | Vertrauensgrenzen, Eigentum von Zugangsdaten und Proxy-Anforderungen |
| [`scripts/check-public-repo.sh`](../scripts/check-public-repo.sh) | Tests, Syntaxprüfungen und Schutz vor versehentlicher Geheimnisveröffentlichung |

Generierte Builds für Weiqi, Chess/Xiangqi/Shogi, Mahjong und Kartenspiele sind Release-Eingaben und werden nicht eingecheckt. Engines, Gewichte, Datenbanken, private Bindings, Zugangsdaten, Laufzeitbelege, Caches und Sitzungen bleiben ebenfalls draußen.

## Schnellstart

Voraussetzungen: Node.js 20.19 oder neuer und Bash.

```bash
git clone https://github.com/lachlanchen/LazyGameWeb.git
cd LazyGameWeb
npm test
npm run check
```

Kopiere `apps/portal/config.example.json` an einen privaten Ort außerhalb des Repositorys und stelle geschützte Zugangsdaten-Dateien bereit. Passwörter oder Bearer-Berechtigungen gehören niemals in die Kommandozeile. Deployment-Vertrag prüfen:

```bash
lazyedge validate --config deploy/game.lazying.art/lazyedge.yaml
lazyedge plan --config deploy/game.lazying.art/lazyedge.yaml
```

## Sicherheit und Deployment

Die Beispiele sind geprüfte Vorlagen, kein automatischer Installer. Prüfe Benutzer, Pfade, Ports und GPU-Identitäten für den jeweiligen Host. Der öffentliche Proxy muss `X-Lazying-Client-Address` mit der direkten Peer-Adresse überschreiben, `Host` und `Cookie` erhalten sowie eingehende `Authorization`- und `Proxy-Authorization`-Header entfernen. Veröffentliche niemals den privaten Listener oder lokale Spielports. Sicherheitslücken bitte privat gemäß [SECURITY.md](../SECURITY.md) melden.

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
