[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyGameWeb

*Публичное окно игр только для чтения и аутентифицированный вход для обучения на базе приватных локальных вычислений.*

[![Website](https://img.shields.io/badge/Play-game.lazying.art-176B56?style=for-the-badge)](https://game.lazying.art)
[![Tests](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml/badge.svg)](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F855A?style=for-the-badge)](../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyGameWeb — репозиторий публичного портала и контрактов развёртывания для [game.lazying.art](https://game.lazying.art). Посетители без учётной записи попадают в доступный только для чтения повтор партии Weiqi, основанный исключительно на отредактированных сохранённых свидетельствах; аутентифицированным ученикам доступен полный каталог игр. Пограничный сервис намеренно передаёт лишь узкий набор API-запросов через отдельный обратный туннель LazyEdge. Правила игр, переходы состояния, приватные данные и инференс моделей остаются в отдельно развёрнутых игровых сервисах; этот репозиторий не связан с LocalLLM или изменяемыми рабочими деревьями движков.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## Принципы проекта

- **Малый пограничный сервис:** в работе портал использует только встроенные модули Node.js.
- **Закрытая по умолчанию маршрутизация:** запросы браузера сопоставляются с точным списком разрешений, которым владеет код; неизвестные методы, пути и параметры запросов, а также закодированные попытки обхода отклоняются.
- **Ясные полномочия:** детерминированные сервисы отвечают за правила и допустимые действия. Портал не придумывает ходы и не меняет игру.
- **Безопасный публичный повтор:** посетители могут смотреть сохранённые партии Weiqi через точно заданные маршруты только для GET, которые никогда не запускают движок и не раскрывают беседы с тренером.
- **Приватные вычисления:** отдельные capability LazyEdge и reverse-SSH identity изолируют игровой трафик от несвязанных сервисов.
- **Надёжный вход:** встроены проверка пароля, запоминаемые сессии на базе HMAC, защита CSRF, ограничения частоты, строгие cookie и ограничительная CSP.
- **Неизменяемые релизы:** статические игровые бандлы и код портала подаются из проверенных каталогов релизов; секреты и состояние сессий хранятся отдельно.

## Архитектура

```text
browser
  -> Caddy TLS ingress
  -> LazyGameWeb portal (public replay or authenticated learning; cloud loopback)
  -> private LazyEdge listener
  -> dedicated reverse-SSH tunnel
  -> worker guard + strict game gateway (local loopback)
  -> deterministic game services and bounded engines
```

Публичный узел открывает только портал. Listener LazyEdge, шлюз, игровые API, базы данных, процессы движков, токены и файлы моделей остаются приватными. Модель доверия и требования к развёртыванию описаны в документе [Границы безопасности](../docs/security-boundaries.md).

## Содержимое

| Путь | Назначение |
| --- | --- |
| [`apps/portal/`](../apps/portal/) | Аутентифицированный портал без зависимостей и браузерный BFF с фиксированным контрактом |
| [`deploy/game.lazying.art/`](../deploy/game.lazying.art/) | Несекретный манифест LazyEdge, формы bindings и усиленные шаблоны systemd |
| [`docs/security-boundaries.md`](../docs/security-boundaries.md) | Границы доверия, владение учётными данными и требования к обратному прокси |
| [`scripts/check-public-repo.sh`](../scripts/check-public-repo.sh) | Тесты, проверки синтаксиса и shell, а также защита секретов публичного релиза |

Статические сборки Weiqi, Chess/Xiangqi/Shogi, Mahjong и карточных игр являются входами релиза, а не сохраняемыми в Git артефактами. Движки, веса моделей, базы данных, приватные bindings, учётные данные, runtime receipts, кэши, профили браузеров и пользовательские сессии намеренно исключены.

## Быстрый старт

Требуются Node.js 20.19 или новее и Bash.

```bash
git clone https://github.com/lachlanchen/LazyGameWeb.git
cd LazyGameWeb
npm test
npm run check
```

Чтобы запустить портал локально, подготовьте четыре временных каталога продуктов с файлом `index.html` в каждом, скопируйте `apps/portal/config.example.json` за пределы репозитория и предоставьте файлы учётных данных, доступные только владельцу. Никогда не передавайте пароль или Bearer-capability в командной строке.

```bash
node apps/portal/bin/game-portal.mjs hash-password \
  --password-file /absolute/private/login.json \
  --out /absolute/private/login-password-verifier \
  --username USERNAME

node apps/portal/bin/game-portal.mjs serve \
  --config /absolute/private/portal.json
```

Манифест развёртывания можно проверить закреплённой версией LazyEdge CLI, используемой в вашей среде:

```bash
lazyedge validate --config deploy/game.lazying.art/lazyedge.yaml
lazyedge plan --config deploy/game.lazying.art/lazyedge.yaml
```

## Безопасность и развёртывание

Примеры конфигурации содержат только пути и структуры. Создавайте учётные данные за пределами репозитория с ограничительными правами владельца, храните runtime-состояние вне неизменяемых релизов и перед установкой проверяйте все имена хостов, порты, пользователей, пути моделей и GPU identity для своего узла. Добавленные в репозиторий units — ориентированные на production шаблоны, а не установщик, запускаемый одной командой.

На публичном обратном прокси перезаписывайте `X-Lazying-Client-Address` адресом непосредственного узла, сохраняйте ожидаемые заголовки `Host` и `Cookie` и удаляйте входящие заголовки `Authorization` и `Proxy-Authorization`. Не публикуйте приватный listener LazyEdge или любой локальный игровой порт.

Сообщайте о проблемах безопасности приватно, как описано в [SECURITY.md](../SECURITY.md).

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
