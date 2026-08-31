[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyGameWeb

*비공개 로컬 연산으로 구동되는 공개 읽기 전용 게임 창이자 인증된 학습 관문입니다.*

[![Website](https://img.shields.io/badge/Play-game.lazying.art-176B56?style=for-the-badge)](https://game.lazying.art)
[![Tests](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml/badge.svg)](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F855A?style=for-the-badge)](../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyGameWeb은 [game.lazying.art](https://game.lazying.art)의 공개 포털과 배포 계약을 담는 저장소입니다. 로그아웃한 방문자는 영속적으로 저장되고 민감 정보가 제거된 증거만을 바탕으로 하는 읽기 전용 Weiqi 리플레이를 볼 수 있으며, 인증된 학습자는 전체 게임 카탈로그에 들어갈 수 있습니다. 엣지는 코드에 명시된 좁은 범위의 API 요청만 전용 LazyEdge 역방향 터널로 전달합니다. 게임 규칙, 상태 전이, 비공개 데이터, 모델 추론은 별도로 배포된 게임 서비스에 남습니다. 이 저장소는 LocalLLM이나 변경 가능한 엔진 작업 트리에 결합되지 않습니다.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## 설계 약속

- **작은 엣지 서비스:** 런타임에는 Node.js 내장 모듈만 사용합니다.
- **기본 거부 라우팅:** 브라우저 요청은 코드가 소유한 정확한 허용 목록에 대응되며, 알 수 없는 메서드, 경로, 쿼리, 인코딩된 경로 우회는 거부됩니다.
- **명확한 권한:** 결정론적 게임 서비스가 규칙과 합법 수를 소유합니다. 포털은 수를 만들거나 게임을 변경하지 않습니다.
- **안전한 공개 리플레이:** 방문자는 정확한 GET 전용 경로를 통해 저장된 Weiqi 대국을 볼 수 있습니다. 이 경로는 엔진을 시작하거나 코치 대화를 노출하지 않습니다.
- **비공개 연산:** 게임 전용 LazyEdge capability와 역방향 SSH ID가 다른 서비스와 트래픽을 분리합니다.
- **견고한 로그인:** 비밀번호 검증, HMAC 기반 기억 세션, CSRF 보호, 속도 제한, 엄격한 쿠키와 제한적인 CSP가 내장되어 있습니다.
- **불변 릴리스:** 정적 게임 번들과 포털 코드는 검토된 릴리스 디렉터리에서 제공하고 비밀 정보와 세션 상태는 그 밖에 둡니다.

## 아키텍처

```text
browser
  -> Caddy TLS ingress
  -> LazyGameWeb portal (public replay or authenticated learning; cloud loopback)
  -> private LazyEdge listener
  -> dedicated reverse-SSH tunnel
  -> worker guard + strict game gateway (local loopback)
  -> deterministic game services and bounded engines
```

공개 호스트는 포털만 노출합니다. 비공개 LazyEdge listener, 게이트웨이, 게임 API, 데이터베이스, 엔진 프로세스, 토큰, 모델 파일은 외부에 공개하지 않습니다. 신뢰 모델과 배포 요구사항은 [보안 경계](../docs/security-boundaries.md)를 참고하세요.

## 현재 구성

| 경로 | 목적 |
| --- | --- |
| [`apps/portal/`](../apps/portal/) | 외부 런타임 의존성이 없는 인증 포털과 고정 계약 BFF |
| [`deploy/game.lazying.art/`](../deploy/game.lazying.art/) | 비밀이 없는 LazyEdge manifest, binding 형태, 강화된 systemd 템플릿 |
| [`docs/security-boundaries.md`](../docs/security-boundaries.md) | 신뢰 경계, 자격 증명 소유권, 프록시 요구사항 |
| [`scripts/check-public-repo.sh`](../scripts/check-public-repo.sh) | 테스트, 구문 검사, 셸 검사, 공개 릴리스 비밀 정보 가드 |

Weiqi, Chess/Xiangqi/Shogi, Mahjong, 카드 게임의 정적 빌드는 릴리스 입력이며 커밋하는 산출물이 아닙니다. 엔진, 모델 가중치, 데이터베이스, 비공개 binding, 자격 증명, 런타임 검증 기록, 캐시, 브라우저 프로필, 사용자 세션도 의도적으로 제외합니다.

## 빠른 시작

Node.js 20.19 이상과 Bash가 필요합니다.

```bash
git clone https://github.com/lachlanchen/LazyGameWeb.git
cd LazyGameWeb
npm test
npm run check
```

포털을 로컬에서 실행하려면 각각 `index.html`이 있는 네 개의 제품용 자리표시자 디렉터리를 준비하고, `apps/portal/config.example.json`을 저장소 밖으로 복사한 뒤 소유자만 읽을 수 있는 자격 증명 파일을 제공하세요. 비밀번호나 bearer capability를 명령줄에 전달하지 마세요.

```bash
node apps/portal/bin/game-portal.mjs hash-password \
  --password-file /absolute/private/login.json \
  --out /absolute/private/login-password-verifier \
  --username USERNAME

node apps/portal/bin/game-portal.mjs serve \
  --config /absolute/private/portal.json
```

배포 manifest는 환경에서 사용하는 고정 버전의 LazyEdge CLI로 확인할 수 있습니다.

```bash
lazyedge validate --config deploy/game.lazying.art/lazyedge.yaml
lazyedge plan --config deploy/game.lazying.art/lazyedge.yaml
```

## 보안 및 배포 안내

구성 예제에는 경로와 구조만 들어 있습니다. 저장소 밖에 소유권을 엄격히 제한한 자격 증명을 만들고, 런타임 상태는 불변 릴리스 밖에 두세요. 설치하기 전에 자신의 호스트에 맞게 모든 호스트 이름, 포트, 사용자, 모델 경로, GPU ID를 검토하세요. 커밋된 unit은 프로덕션 지향 템플릿이며 원클릭 설치기가 아닙니다.

공개 역방향 프록시에서는 직접 연결한 피어의 주소로 `X-Lazying-Client-Address`를 덮어쓰고, 예상된 `Host`와 `Cookie` 헤더를 보존하며, 들어오는 `Authorization`과 `Proxy-Authorization`을 제거하세요. 비공개 LazyEdge listener나 로컬 게임 포트를 공개하지 마세요.

보안 문제는 [SECURITY.md](../SECURITY.md)의 안내에 따라 비공개로 신고해 주세요.

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
