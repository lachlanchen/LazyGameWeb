[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyGameWeb

*Una ventana pública de juegos en modo de solo lectura y una entrada de aprendizaje autenticada, impulsadas por cómputo local privado.*

[![Website](https://img.shields.io/badge/Play-game.lazying.art-176B56?style=for-the-badge)](https://game.lazying.art)
[![Tests](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml/badge.svg)](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F855A?style=for-the-badge)](../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyGameWeb es el repositorio del portal público y de los contratos de despliegue de [game.lazying.art](https://game.lazying.art). Los visitantes que no han iniciado sesión acceden a una repetición de Weiqi de solo lectura, respaldada únicamente por evidencia persistida y redactada; los estudiantes autenticados pueden entrar en el catálogo completo de juegos. El borde reenvía un conjunto deliberadamente reducido de solicitudes API mediante un túnel inverso LazyEdge dedicado. Las reglas, las transiciones de estado, los datos privados y la inferencia de modelos permanecen en servicios de juego desplegados por separado; este repositorio no está acoplado a LocalLLM ni a árboles de trabajo mutables de motores.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## Compromiso de diseño

- **Servicio de borde pequeño:** el portal solo usa módulos integrados de Node.js en tiempo de ejecución.
- **Enrutamiento cerrado por defecto:** las solicitudes del navegador se asignan a una lista de permisos exacta, propiedad del código; se rechazan métodos, rutas y consultas desconocidos, así como el recorrido codificado de directorios.
- **Autoridad clara:** los servicios deterministas poseen las reglas y las acciones legales. El portal nunca inventa una jugada ni muta una partida.
- **Repetición pública segura:** los visitantes pueden ver partidas de Weiqi almacenadas mediante rutas exactas de solo GET que nunca inician un motor ni exponen conversaciones con el entrenador.
- **Cómputo privado:** una capacidad LazyEdge dedicada y una identidad SSH inversa aíslan el tráfico de juego de servicios no relacionados.
- **Inicio de sesión duradero:** incluye verificación de contraseña, sesiones recordadas respaldadas por HMAC, protección CSRF, límites de frecuencia, cookies estrictas y una CSP restrictiva.
- **Versiones inmutables:** los paquetes estáticos de juegos y el código del portal se sirven desde directorios de versión revisados; los secretos y el estado de las sesiones quedan fuera.

## Arquitectura

```text
browser
  -> Caddy TLS ingress
  -> LazyGameWeb portal (public replay or authenticated learning; cloud loopback)
  -> private LazyEdge listener
  -> dedicated reverse-SSH tunnel
  -> worker guard + strict game gateway (local loopback)
  -> deterministic game services and bounded engines
```

El host público solo expone el portal. El listener de LazyEdge, la pasarela, las API de juegos, las bases de datos, los procesos de motores, los tokens y los archivos de modelos siguen siendo privados. Consulta [Límites de seguridad](../docs/security-boundaries.md) para conocer el modelo de confianza y los requisitos de despliegue.

## Contenido actual

| Ruta | Propósito |
| --- | --- |
| [`apps/portal/`](../apps/portal/) | Portal autenticado sin dependencias y BFF para el navegador con contrato fijo |
| [`deploy/game.lazying.art/`](../deploy/game.lazying.art/) | Manifiesto LazyEdge no secreto, formas de binding y plantillas systemd reforzadas |
| [`docs/security-boundaries.md`](../docs/security-boundaries.md) | Límites de confianza, propiedad de credenciales y requisitos del proxy inverso |
| [`scripts/check-public-repo.sh`](../scripts/check-public-repo.sh) | Pruebas, comprobaciones de sintaxis y shell, y barrera contra secretos en versiones públicas |

Las compilaciones estáticas de Weiqi, Chess/Xiangqi/Shogi, Mahjong y juegos de cartas son entradas de versión, no artefactos confirmados en Git. Se excluyen deliberadamente los motores, pesos de modelos, bases de datos, bindings privados, credenciales, recibos de ejecución, cachés, perfiles del navegador y sesiones de usuario.

## Inicio rápido

Requisitos: Node.js 20.19 o posterior y Bash.

```bash
git clone https://github.com/lachlanchen/LazyGameWeb.git
cd LazyGameWeb
npm test
npm run check
```

Para ejecutar el portal localmente, prepara cuatro directorios de producto provisionales con un archivo `index.html` en cada uno, copia `apps/portal/config.example.json` fuera del repositorio y proporciona archivos de credenciales accesibles solo por su propietario. Nunca pases una contraseña ni una capacidad Bearer por la línea de comandos.

```bash
node apps/portal/bin/game-portal.mjs hash-password \
  --password-file /absolute/private/login.json \
  --out /absolute/private/login-password-verifier \
  --username USERNAME

node apps/portal/bin/game-portal.mjs serve \
  --config /absolute/private/portal.json
```

El manifiesto de despliegue puede comprobarse con la versión fijada de la CLI de LazyEdge que utilice tu entorno:

```bash
lazyedge validate --config deploy/game.lazying.art/lazyedge.yaml
lazyedge plan --config deploy/game.lazying.art/lazyedge.yaml
```

## Notas de seguridad y despliegue

Los ejemplos de configuración contienen únicamente rutas y formas. Crea las credenciales fuera del repositorio con permisos restrictivos, mantén el estado de ejecución fuera de las versiones inmutables y revisa todos los nombres de host, puertos, usuarios, rutas de modelos e identidades de GPU para tu propio host antes de la instalación. Las unidades incluidas son plantillas orientadas a producción, no un instalador de un solo comando.

En el proxy inverso público, sobrescribe `X-Lazying-Client-Address` con la dirección del par directo, conserva los encabezados `Host` y `Cookie` esperados y elimina los encabezados entrantes `Authorization` y `Proxy-Authorization`. No publiques el listener privado de LazyEdge ni ningún puerto local de juegos.

Informa de los problemas de seguridad en privado como se describe en [SECURITY.md](../SECURITY.md).

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
