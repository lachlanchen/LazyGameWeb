[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyGameWeb

*Небольшой аутентифицированный веб-вход для серьёзных обучающих игр с приватными локальными вычислениями.*

[![Website](https://img.shields.io/badge/Play-game.lazying.art-176B56?style=for-the-badge)](https://game.lazying.art)
[![Tests](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml/badge.svg)](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F855A?style=for-the-badge)](../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyGameWeb — публичный репозиторий портала и контракта развёртывания для [game.lazying.art](https://game.lazying.art). Он отдаёт каталог игр после входа на облачном узле и передаёт только узкий, явно заданный набор API-запросов через отдельный обратный туннель LazyEdge. Правила, переходы состояния, приватные данные и инференс остаются в независимых игровых сервисах; репозиторий не связан с LocalLLM или изменяемыми рабочими деревьями движков.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## Принципы проекта

- **Малый пограничный сервис:** в работе портал использует только встроенные модули Node.js.
- **Закрытая по умолчанию маршрутизация:** точный список в коде отклоняет неизвестные методы, пути и попытки обхода.
- **Ясные полномочия:** детерминированные сервисы отвечают за правила и допустимые действия. Портал не придумывает ходы и не меняет игру.
- **Приватные вычисления:** отдельные capability LazyEdge и reverse-SSH identity изолируют игровой трафик.
- **Надёжный вход:** scrypt, HMAC-сессии, CSRF, ограничения частоты, строгие cookie и CSP.
- **Неизменяемые релизы:** код и статика подаются из проверенных каталогов; секреты и состояние хранятся отдельно.

## Архитектура

```text
browser
  -> Caddy TLS ingress
  -> authenticated LazyGameWeb portal (cloud loopback)
  -> private LazyEdge listener
  -> dedicated reverse-SSH tunnel
  -> worker guard + strict game gateway (local loopback)
  -> deterministic game services and bounded engines
```

Публичный узел открывает только портал. Приватный listener LazyEdge, локальный шлюз, API, базы, движки, токены и модели остаются закрытыми. Подробности — в документе [Границы безопасности](../docs/security-boundaries.md).

## Содержимое

| Путь | Назначение |
| --- | --- |
| [`apps/portal/`](../apps/portal/) | Аутентифицированный портал без внешних runtime-зависимостей и BFF с фиксированным контрактом |
| [`deploy/game.lazying.art/`](../deploy/game.lazying.art/) | Несекретный манифест LazyEdge, формы bindings и усиленные шаблоны systemd |
| [`docs/security-boundaries.md`](../docs/security-boundaries.md) | Границы доверия, владение учётными данными и требования к прокси |
| [`scripts/check-public-repo.sh`](../scripts/check-public-repo.sh) | Тесты, проверка синтаксиса и защита от публикации секретов |

Сборки Weiqi, Chess/Xiangqi/Shogi, Mahjong и карточных игр являются входами релиза и не хранятся в Git. Движки, веса, базы, приватные bindings, учётные данные, runtime receipts, кэши и сессии также исключены.

## Быстрый старт

Требуются Node.js 20.19 или новее и Bash.

```bash
git clone https://github.com/lachlanchen/LazyGameWeb.git
cd LazyGameWeb
npm test
npm run check
```

Скопируйте `apps/portal/config.example.json` в приватное место вне репозитория и подготовьте защищённые файлы учётных данных. Не передавайте пароли или Bearer-capability в командной строке. Проверка контракта развёртывания:

```bash
lazyedge validate --config deploy/game.lazying.art/lazyedge.yaml
lazyedge plan --config deploy/game.lazying.art/lazyedge.yaml
```

## Безопасность и развёртывание

Примеры — проверенные шаблоны, а не автоматический установщик. Проверьте пользователей, пути, порты и GPU identity для своего хоста. Публичный прокси обязан перезаписывать `X-Lazying-Client-Address` прямым адресом клиента, сохранять `Host` и `Cookie` и удалять входящие `Authorization` и `Proxy-Authorization`. Никогда не публикуйте приватный listener или локальные игровые порты. Сообщайте об уязвимостях приватно по [SECURITY.md](../SECURITY.md).

## Цитирование

Если вы используете LazyGameWeb в исследовании, процитируйте репозиторий. GitHub читает [CITATION.cff](../CITATION.cff) и показывает панель **Cite this repository**.

```bibtex
@software{chen_lazygameweb_2026,
  author = {Chen, Lachlan},
  title = {LazyGameWeb: A secure web portal for privately computed teaching games},
  year = {2026},
  url = {https://github.com/lachlanchen/LazyGameWeb}
}
```

## Статус и границы

LazyGameWeb — независимо версионируемая веб-граница и слой развёртывания для [game.lazying.art](https://game.lazying.art). Игры и движки остаются отдельными проектами со своими детерминированными правилами, тестами, лицензиями, квитанциями релизов и происхождением моделей.
