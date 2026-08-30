[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyGameWeb

*Una entrada web pequeña y autenticada para juegos didácticos serios con cómputo local privado.*

[![Website](https://img.shields.io/badge/Play-game.lazying.art-176B56?style=for-the-badge)](https://game.lazying.art)
[![Tests](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml/badge.svg)](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F855A?style=for-the-badge)](../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyGameWeb es el repositorio público del portal y del contrato de despliegue de [game.lazying.art](https://game.lazying.art). Sirve el catálogo autenticado en el borde de la nube y reenvía únicamente un conjunto estrecho y explícito de solicitudes API por un túnel inverso LazyEdge dedicado. Las reglas, las transiciones de estado, los datos privados y la inferencia permanecen en servicios de juego independientes; este repositorio no depende de LocalLLM ni de árboles de trabajo mutables de motores.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## Compromiso de diseño

- **Servicio de borde pequeño:** el portal solo usa módulos integrados de Node.js en tiempo de ejecución.
- **Enrutamiento cerrado por defecto:** una lista exacta controlada por código acepta rutas y métodos; todo lo desconocido se rechaza.
- **Autoridad clara:** los servicios deterministas poseen las reglas y las acciones legales. El portal nunca inventa una jugada ni muta una partida.
- **Cómputo privado:** una capacidad LazyEdge y una identidad SSH inversa dedicadas aíslan el tráfico de juego.
- **Inicio de sesión duradero:** scrypt, sesiones recordadas con HMAC, CSRF, límites de intentos, cookies estrictas y CSP restrictiva.
- **Versiones inmutables:** el código y los recursos estáticos se sirven desde directorios revisados; los secretos y el estado quedan fuera.

## Arquitectura

```text
browser
  -> Caddy TLS ingress
  -> authenticated LazyGameWeb portal (cloud loopback)
  -> private LazyEdge listener
  -> dedicated reverse-SSH tunnel
  -> worker guard + strict game gateway (local loopback)
  -> deterministic game services and bounded engines
```

El host público solo expone el portal. El listener privado de LazyEdge, la pasarela local, las API, las bases de datos, los motores, los tokens y los modelos siguen siendo privados. Consulta [Límites de seguridad](../docs/security-boundaries.md) para conocer el modelo de confianza.

## Contenido actual

| Ruta | Propósito |
| --- | --- |
| [`apps/portal/`](../apps/portal/) | Portal autenticado sin dependencias y BFF con contrato fijo |
| [`deploy/game.lazying.art/`](../deploy/game.lazying.art/) | Manifiesto LazyEdge no secreto, formas de binding y plantillas systemd reforzadas |
| [`docs/security-boundaries.md`](../docs/security-boundaries.md) | Límites de confianza, propiedad de credenciales y requisitos del proxy |
| [`scripts/check-public-repo.sh`](../scripts/check-public-repo.sh) | Pruebas, sintaxis y control de secretos antes de publicar |

Las compilaciones de Weiqi, Chess/Xiangqi/Shogi, Mahjong y cartas son entradas de versión, no artefactos en Git. También se excluyen motores, pesos, bases de datos, bindings privados, credenciales, recibos, cachés y sesiones.

## Inicio rápido

Requisitos: Node.js 20.19 o posterior y Bash.

```bash
git clone https://github.com/lachlanchen/LazyGameWeb.git
cd LazyGameWeb
npm test
npm run check
```

Copia `apps/portal/config.example.json` fuera del repositorio y proporciona archivos de credenciales privados. Nunca pases contraseñas ni capacidades Bearer por la línea de comandos. Valida el contrato de despliegue con:

```bash
lazyedge validate --config deploy/game.lazying.art/lazyedge.yaml
lazyedge plan --config deploy/game.lazying.art/lazyedge.yaml
```

## Notas de seguridad y despliegue

Los ejemplos son plantillas revisadas, no un instalador automático. Revisa usuarios, rutas, puertos e identidades de GPU para tu host. El proxy público debe sobrescribir `X-Lazying-Client-Address` con la dirección directa del cliente, conservar `Host` y `Cookie`, y eliminar `Authorization` y `Proxy-Authorization` entrantes. Nunca publiques el listener privado ni los puertos locales de juegos. Informa vulnerabilidades en privado según [SECURITY.md](../SECURITY.md).

## Cita

Si utilizas LazyGameWeb en investigación, cita el repositorio. GitHub lee [CITATION.cff](../CITATION.cff) y muestra el panel **Cite this repository**.

```bibtex
@software{chen_lazygameweb_2026,
  author = {Chen, Lachlan},
  title = {LazyGameWeb: A secure web portal for privately computed teaching games},
  year = {2026},
  url = {https://github.com/lachlanchen/LazyGameWeb}
}
```

## Estado y alcance

LazyGameWeb es el límite web y de despliegue versionado de forma independiente para [game.lazying.art](https://game.lazying.art). Los juegos y motores permanecen como proyectos separados con sus propias reglas, pruebas, licencias, recibos de versión y procedencia de modelos.
