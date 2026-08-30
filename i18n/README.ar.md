[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyGameWeb

*مدخل ويب صغير وآمن لألعاب تعليمية جادّة تعتمد على حوسبة محلية خاصة.*

[![Website](https://img.shields.io/badge/Play-game.lazying.art-176B56?style=for-the-badge)](https://game.lazying.art)
[![Tests](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml/badge.svg)](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F855A?style=for-the-badge)](../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyGameWeb هو مستودع البوابة العامة وعقود النشر لموقع [game.lazying.art](https://game.lazying.art). يقدّم فهرس الألعاب بعد تسجيل الدخول عند حافة السحابة، ولا يمرّر إلى الحاسوب الخاص إلا مجموعة ضيقة ومحددة من طلبات API عبر نفق LazyEdge مستقل. تبقى قواعد الألعاب وحالاتها وبياناتها الخاصة واستدلال النماذج في خدمات ألعاب منفصلة؛ ولا يعتمد هذا المستودع على LocalLLM أو على أشجار عمل لمحركات قابلة للتغيير.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## وعد التصميم

- **خدمة حافة صغيرة:** تستخدم البوابة وحدات Node.js المدمجة فقط أثناء التشغيل.
- **توجيه مغلق افتراضياً:** تُقبل فقط الطرق والمسارات المحددة صراحة في الشيفرة، وتُرفض الطلبات المجهولة ومحاولات الاجتياز.
- **سلطة واضحة:** خدمات الألعاب الحتمية هي صاحبة القواعد والحركات القانونية؛ ولا تنشئ البوابة حركة ولا تغيّر لعبة.
- **حوسبة خاصة:** قدرة LazyEdge وهوية SSH عكسية مخصصتان تفصلان حركة الألعاب عن بقية الخدمات.
- **دخول متين:** تحقق scrypt، وجلسات HMAC قابلة للتذكر، وحماية CSRF، وحدود للمحاولات، وملفات ارتباط صارمة، وCSP مقيّدة.
- **إصدارات ثابتة:** تُخدّم البوابة وحزم الألعاب من أدلة إصدار مراجعة غير قابلة للتبديل، بينما تبقى الأسرار والحالة خارجها.

## البنية

```text
browser
  -> Caddy TLS ingress
  -> authenticated LazyGameWeb portal (cloud loopback)
  -> private LazyEdge listener
  -> dedicated reverse-SSH tunnel
  -> worker guard + strict game gateway (local loopback)
  -> deterministic game services and bounded engines
```

لا يعرض المضيف العام سوى البوابة. تظل مستمعات LazyEdge الخاصة والبوابة المحلية وواجهات الألعاب وقواعد البيانات والمحركات والرموز والنماذج غير عامة. يشرح مستند [حدود الأمان](../docs/security-boundaries.md) نموذج الثقة ومتطلبات النشر.

## المحتويات الحالية

| المسار | الغرض |
| --- | --- |
| [`apps/portal/`](../apps/portal/) | بوابة موثقة وBFF ثابت العقد بلا اعتماديات تشغيل خارجية |
| [`deploy/game.lazying.art/`](../deploy/game.lazying.art/) | بيان LazyEdge غير السري وأشكال الربط وقوالب systemd المقوّاة |
| [`docs/security-boundaries.md`](../docs/security-boundaries.md) | حدود الثقة وملكية بيانات الاعتماد ومتطلبات الوكيل العكسي |
| [`scripts/check-public-repo.sh`](../scripts/check-public-repo.sh) | الاختبارات وفحوص الصياغة ومنع نشر الأسرار |

لا تُحفظ حزم Weiqi وChess/Xiangqi/Shogi وMahjong وألعاب الورق المولدة في Git. كما تُستبعد المحركات وأوزان النماذج وقواعد البيانات والروابط الخاصة وبيانات الاعتماد وحالة التشغيل والجلسات.

## البدء السريع

المتطلبات: Node.js 20.19 أو أحدث وBash.

```bash
git clone https://github.com/lachlanchen/LazyGameWeb.git
cd LazyGameWeb
npm test
npm run check
```

انسخ `apps/portal/config.example.json` إلى موقع خاص خارج المستودع، وأنشئ بيانات اعتماد بملكية مقيدة. لا تمرّر كلمة مرور أو قدرة Bearer في سطر الأوامر. لفحص عقد النشر:

```bash
lazyedge validate --config deploy/game.lazying.art/lazyedge.yaml
lazyedge plan --config deploy/game.lazying.art/lazyedge.yaml
```

## ملاحظات الأمان والنشر

الأمثلة قوالب مراجعة وليست مثبّتاً آلياً. يجب مراجعة المستخدمين والمسارات والمنافذ وهويات GPU لكل مضيف. على الوكيل العام أن يستبدل `X-Lazying-Client-Address` بعنوان النظير المباشر، ويحافظ على `Host` و`Cookie` المتوقعين، ويحذف `Authorization` و`Proxy-Authorization` الواردين. لا تنشر مستمع LazyEdge الخاص أو منافذ الألعاب المحلية. أبلغ عن الثغرات سراً وفق [SECURITY.md](../SECURITY.md).

## الاستشهاد

إذا استخدمت LazyGameWeb في بحث، فاستشهد بالمستودع. يقرأ GitHub ملف [CITATION.cff](../CITATION.cff) ويعرض لوحة **Cite this repository** في صفحة المستودع.

```bibtex
@software{chen_lazygameweb_2026,
  author = {Chen, Lachlan},
  title = {LazyGameWeb: A secure web portal for privately computed teaching games},
  year = {2026},
  url = {https://github.com/lachlanchen/LazyGameWeb}
}
```

## الحالة والنطاق

LazyGameWeb هو حد الويب والنشر المستقل لموقع [game.lazying.art](https://game.lazying.art). تبقى منتجات الألعاب ومحركات الاستدلال مشاريع منفصلة لها قواعد حتمية واختبارات وتراخيص وإيصالات إصدار ومصادر نماذج خاصة بها.
