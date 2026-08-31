[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyGameWeb

*نافذة ألعاب عامة للعرض فقط، ومدخل تعلّم موثّق، تدعمهما حوسبة محلية خاصة.*

[![Website](https://img.shields.io/badge/Play-game.lazying.art-176B56?style=for-the-badge)](https://game.lazying.art)
[![Tests](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml/badge.svg)](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F855A?style=for-the-badge)](../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyGameWeb هو مستودع البوابة العامة وعقود النشر لموقع [game.lazying.art](https://game.lazying.art). يدخل الزوار غير المسجّلين إلى إعادة عرض Weiqi للقراءة فقط، لا تستند إلا إلى أدلة محفوظة ومنقّحة؛ ويمكن للمتعلمين الموثّقين دخول فهرس الألعاب الكامل. لا تمرّر الحافة سوى مجموعة ضيقة ومقصودة من طلبات API عبر نفق LazyEdge عكسي مخصص. تبقى قواعد الألعاب وانتقالات حالاتها وبياناتها الخاصة واستدلال النماذج في خدمات ألعاب منشورة بصورة منفصلة؛ ولا يقترن هذا المستودع بـ LocalLLM أو بأشجار عمل المحركات القابلة للتغيير.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## وعد التصميم

- **خدمة حافة صغيرة:** تستخدم البوابة وحدات Node.js المدمجة فقط أثناء التشغيل.
- **توجيه مغلق افتراضياً:** ترتبط طلبات المتصفح بقائمة سماح دقيقة تملكها الشيفرة؛ وتُرفض الطرق والمسارات والاستعلامات المجهولة ومحاولات الاجتياز المرمّزة.
- **سلطة واضحة:** تملك خدمات الألعاب الحتمية القواعد والحركات القانونية. لا تخترع البوابة حركة ولا تغيّر لعبة.
- **إعادة عرض عامة آمنة:** يستطيع الزوار مشاهدة ألعاب Weiqi المحفوظة عبر مسارات GET فقط ومحددة بدقة، لا تشغّل محركاً ولا تكشف محادثات المدرب.
- **حوسبة خاصة:** تفصل قدرة LazyEdge مخصصة وهوية SSH عكسية مخصصة حركة الألعاب عن الخدمات غير المرتبطة.
- **دخول متين:** يتضمن النظام التحقق من كلمة المرور، وجلسات قابلة للتذكر مدعومة بـ HMAC، وحماية CSRF، وحدود المعدل، وملفات ارتباط صارمة، وCSP مقيّدة.
- **إصدارات ثابتة:** تُخدّم حزم الألعاب الثابتة وشيفرة البوابة من أدلة إصدار مراجعة؛ وتبقى الأسرار وحالة الجلسات خارجها.

## البنية

```text
browser
  -> Caddy TLS ingress
  -> LazyGameWeb portal (public replay or authenticated learning; cloud loopback)
  -> private LazyEdge listener
  -> dedicated reverse-SSH tunnel
  -> worker guard + strict game gateway (local loopback)
  -> deterministic game services and bounded engines
```

لا يعرض المضيف العام سوى البوابة. يظل مستمع LazyEdge والبوابة وواجهات الألعاب وقواعد البيانات وعمليات المحركات والرموز وملفات النماذج خاصة. راجع [حدود الأمان](../docs/security-boundaries.md) لمعرفة نموذج الثقة ومتطلبات النشر.

## المحتويات الحالية

| المسار | الغرض |
| --- | --- |
| [`apps/portal/`](../apps/portal/) | بوابة موثّقة بلا اعتماديات وBFF للمتصفح بعقد ثابت |
| [`deploy/game.lazying.art/`](../deploy/game.lazying.art/) | بيان LazyEdge غير السري وأشكال الربط وقوالب systemd المقوّاة |
| [`docs/security-boundaries.md`](../docs/security-boundaries.md) | حدود الثقة وملكية بيانات الاعتماد ومتطلبات الوكيل العكسي |
| [`scripts/check-public-repo.sh`](../scripts/check-public-repo.sh) | الاختبارات وفحوص الصياغة وفحوص shell وحارس أسرار الإصدار العام |

البُنى الثابتة لـ Weiqi وChess/Xiangqi/Shogi وMahjong وألعاب الورق هي مدخلات للإصدار وليست عناصر محفوظة في Git. تُستبعد عمداً أيضاً المحركات وأوزان النماذج وقواعد البيانات والروابط الخاصة وبيانات الاعتماد وإيصالات التشغيل وذاكرات التخزين المؤقت وملفات المتصفح وجلسات المستخدمين.

## البدء السريع

المتطلبات: Node.js 20.19 أو أحدث وBash.

```bash
git clone https://github.com/lachlanchen/LazyGameWeb.git
cd LazyGameWeb
npm test
npm run check
```

لتشغيل البوابة محلياً، جهّز أربعة أدلة مؤقتة للمنتجات يحتوي كل منها على ملف `index.html`، وانسخ `apps/portal/config.example.json` إلى خارج المستودع، ووفّر ملفات بيانات اعتماد لا يملكها إلا صاحبها. لا تمرّر أبداً كلمة مرور أو قدرة Bearer في سطر الأوامر.

```bash
node apps/portal/bin/game-portal.mjs hash-password \
  --password-file /absolute/private/login.json \
  --out /absolute/private/login-password-verifier \
  --username USERNAME

node apps/portal/bin/game-portal.mjs serve \
  --config /absolute/private/portal.json
```

يمكن فحص بيان النشر باستخدام إصدار LazyEdge CLI المثبّت في بيئتك:

```bash
lazyedge validate --config deploy/game.lazying.art/lazyedge.yaml
lazyedge plan --config deploy/game.lazying.art/lazyedge.yaml
```

## ملاحظات الأمان والنشر

لا تحتوي أمثلة الإعداد إلا على المسارات والأشكال. أنشئ بيانات الاعتماد خارج المستودع بملكية مقيّدة، واحتفظ بحالة التشغيل خارج الإصدارات الثابتة، وراجع جميع أسماء المضيفين والمنافذ والمستخدمين ومسارات النماذج وهويات GPU بما يناسب مضيفك قبل التثبيت. وحدات الخدمة المحفوظة في المستودع قوالب موجّهة للإنتاج وليست مثبّتاً يعمل بأمر واحد.

عند الوكيل العكسي العام، استبدل `X-Lazying-Client-Address` بعنوان النظير المباشر، وحافظ على ترويستي `Host` و`Cookie` المتوقعتين، واحذف ترويستي `Authorization` و`Proxy-Authorization` الواردتين. لا تنشر مستمع LazyEdge الخاص أو أي منفذ لعبة محلي.

يرجى الإبلاغ عن مشكلات الأمان بصورة خاصة كما هو موضح في [SECURITY.md](../SECURITY.md).

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
