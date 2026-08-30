[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyGameWeb

*비공개 로컬 연산으로 진지한 교육용 게임을 제공하는 작고 견고한 인증 웹 관문입니다.*

[![Website](https://img.shields.io/badge/Play-game.lazying.art-176B56?style=for-the-badge)](https://game.lazying.art)
[![Tests](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml/badge.svg)](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F855A?style=for-the-badge)](../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyGameWeb은 [game.lazying.art](https://game.lazying.art)의 공개 포털과 배포 계약을 담는 저장소입니다. 클라우드 엣지에서 인증된 게임 목록을 제공하고, 코드에 명시된 좁은 범위의 API 요청만 전용 LazyEdge 역방향 터널로 전달합니다. 규칙, 상태 전이, 비공개 데이터, 모델 추론은 별도로 배포된 게임 서비스에 남습니다. 이 저장소는 LocalLLM이나 변경 가능한 엔진 작업 트리에 결합되지 않습니다.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## 설계 약속

- **작은 엣지 서비스:** 런타임에는 Node.js 내장 모듈만 사용합니다.
- **기본 거부 라우팅:** 코드가 소유한 정확한 허용 목록만 통과시키며 알 수 없는 메서드, 경로, 쿼리, 경로 우회를 거부합니다.
- **명확한 권한:** 결정론적 게임 서비스가 규칙과 합법 수를 소유합니다. 포털은 수를 만들거나 게임을 변경하지 않습니다.
- **비공개 연산:** 게임 전용 LazyEdge capability와 역방향 SSH ID가 다른 서비스와 트래픽을 분리합니다.
- **견고한 로그인:** scrypt, HMAC 기억 세션, CSRF 방어, 속도 제한, 엄격한 쿠키와 CSP를 적용합니다.
- **불변 릴리스:** 포털과 정적 번들은 검토된 릴리스 디렉터리에서 제공하고 비밀과 상태는 밖에 둡니다.

## 아키텍처

```text
browser
  -> Caddy TLS ingress
  -> authenticated LazyGameWeb portal (cloud loopback)
  -> private LazyEdge listener
  -> dedicated reverse-SSH tunnel
  -> worker guard + strict game gateway (local loopback)
  -> deterministic game services and bounded engines
```

공개 호스트는 포털만 노출합니다. 비공개 LazyEdge listener, 로컬 게이트웨이, 게임 API, 데이터베이스, 엔진, 토큰, 모델은 외부에 공개하지 않습니다. 신뢰 모델과 배포 요구사항은 [보안 경계](../docs/security-boundaries.md)를 참고하세요.

## 현재 구성

| 경로 | 목적 |
| --- | --- |
| [`apps/portal/`](../apps/portal/) | 외부 런타임 의존성이 없는 인증 포털과 고정 계약 BFF |
| [`deploy/game.lazying.art/`](../deploy/game.lazying.art/) | 비밀이 없는 LazyEdge manifest, binding 형태, 강화된 systemd 템플릿 |
| [`docs/security-boundaries.md`](../docs/security-boundaries.md) | 신뢰 경계, 자격 증명 소유권, 프록시 요구사항 |
| [`scripts/check-public-repo.sh`](../scripts/check-public-repo.sh) | 테스트, 구문 검사, 공개 전 비밀 자료 검사 |

Weiqi, Chess/Xiangqi/Shogi, Mahjong, 카드 게임의 생성된 빌드는 릴리스 입력이며 Git에 포함하지 않습니다. 엔진, 모델 가중치, 데이터베이스, 비공개 binding, 자격 증명, 런타임 기록, 캐시, 세션도 제외합니다.

## 빠른 시작

Node.js 20.19 이상과 Bash가 필요합니다.

```bash
git clone https://github.com/lachlanchen/LazyGameWeb.git
cd LazyGameWeb
npm test
npm run check
```

`apps/portal/config.example.json`을 저장소 밖의 비공개 위치로 복사하고 소유자만 읽을 수 있는 자격 증명 파일을 준비하세요. 비밀번호나 Bearer capability를 명령줄에 전달하지 마세요. 배포 계약은 다음과 같이 검증합니다.

```bash
lazyedge validate --config deploy/game.lazying.art/lazyedge.yaml
lazyedge plan --config deploy/game.lazying.art/lazyedge.yaml
```

## 보안 및 배포 안내

예제는 검토된 템플릿이며 자동 설치기가 아닙니다. 각 호스트의 사용자, 경로, 포트, GPU ID를 검토해야 합니다. 공개 프록시는 `X-Lazying-Client-Address`를 직접 연결 주소로 덮어쓰고, 예상된 `Host`와 `Cookie`를 보존하며, 들어오는 `Authorization`과 `Proxy-Authorization`을 제거해야 합니다. 비공개 listener나 로컬 게임 포트를 공개하지 마세요. 취약점은 [SECURITY.md](../SECURITY.md)에 따라 비공개로 신고해 주세요.

## 인용

연구에 LazyGameWeb을 사용한다면 이 저장소를 인용해 주세요. GitHub는 [CITATION.cff](../CITATION.cff)를 읽어 저장소 페이지에 **Cite this repository** 패널을 표시합니다.

```bibtex
@software{chen_lazygameweb_2026,
  author = {Chen, Lachlan},
  title = {LazyGameWeb: A secure web portal for privately computed teaching games},
  year = {2026},
  url = {https://github.com/lachlanchen/LazyGameWeb}
}
```

## 상태와 범위

LazyGameWeb은 [game.lazying.art](https://game.lazying.art)을 위한 독립 버전의 웹 및 배포 경계입니다. 게임 제품과 추론 엔진은 각각 결정론적 규칙, 테스트, 라이선스, 릴리스 기록, 모델 출처를 갖는 별도 프로젝트로 유지됩니다.
