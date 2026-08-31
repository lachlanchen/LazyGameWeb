[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyGameWeb

*Cửa sổ trò chơi công khai chỉ đọc và cổng học tập có xác thực, vận hành bằng tính toán cục bộ riêng tư.*

[![Website](https://img.shields.io/badge/Play-game.lazying.art-176B56?style=for-the-badge)](https://game.lazying.art)
[![Tests](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml/badge.svg)](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F855A?style=for-the-badge)](../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyGameWeb là kho mã công khai chứa cổng truy cập và hợp đồng triển khai cho [game.lazying.art](https://game.lazying.art). Khách chưa đăng nhập được xem bản phát lại Weiqi chỉ đọc, chỉ dựa trên bằng chứng đã lưu bền vững và đã lược bỏ dữ liệu nhạy cảm; người học đã xác thực có thể vào toàn bộ danh mục trò chơi. Biên đám mây chỉ chuyển tiếp một tập yêu cầu API hẹp, được khai báo rõ trong mã, qua đường hầm ngược LazyEdge riêng. Luật chơi, chuyển trạng thái, dữ liệu riêng tư và suy luận mô hình vẫn nằm trong các dịch vụ trò chơi được triển khai riêng; kho mã này không phụ thuộc LocalLLM hay cây làm việc engine có thể thay đổi.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## Cam kết thiết kế

- **Dịch vụ biên nhỏ:** cổng chỉ dùng các mô-đun tích hợp sẵn của Node.js khi chạy.
- **Định tuyến đóng mặc định:** yêu cầu trình duyệt được ánh xạ vào danh sách cho phép chính xác do mã sở hữu; phương thức, đường dẫn, truy vấn và hành vi traversal đã mã hóa không biết đều bị từ chối.
- **Quyền hạn rõ ràng:** dịch vụ trò chơi tất định sở hữu luật và nước đi hợp lệ. Cổng không tạo nước đi hay sửa trạng thái trò chơi.
- **Phát lại công khai an toàn:** khách có thể xem các ván Weiqi đã lưu qua những route chính xác chỉ cho phép GET; các route này không bao giờ khởi động engine hoặc để lộ hội thoại với huấn luyện viên.
- **Tính toán riêng tư:** capability LazyEdge và danh tính reverse-SSH chuyên dụng cô lập lưu lượng trò chơi.
- **Đăng nhập vững chắc:** có sẵn xác minh mật khẩu, phiên ghi nhớ dựa trên HMAC, bảo vệ CSRF, giới hạn tần suất, cookie nghiêm ngặt và CSP hạn chế chặt chẽ.
- **Bản phát hành bất biến:** bundle trò chơi tĩnh và mã cổng được phục vụ từ các thư mục phát hành đã duyệt; bí mật và trạng thái phiên nằm bên ngoài.

## Kiến trúc

```text
browser
  -> Caddy TLS ingress
  -> LazyGameWeb portal (public replay or authenticated learning; cloud loopback)
  -> private LazyEdge listener
  -> dedicated reverse-SSH tunnel
  -> worker guard + strict game gateway (local loopback)
  -> deterministic game services and bounded engines
```

Máy chủ công khai chỉ phơi bày cổng. Listener LazyEdge riêng, gateway, API trò chơi, cơ sở dữ liệu, tiến trình engine, token và tệp mô hình đều không công khai. Xem [Ranh giới bảo mật](../docs/security-boundaries.md) để hiểu mô hình tin cậy và các yêu cầu triển khai.

## Nội dung hiện tại

| Đường dẫn | Mục đích |
| --- | --- |
| [`apps/portal/`](../apps/portal/) | Cổng xác thực không có phụ thuộc runtime ngoài và BFF với hợp đồng cố định |
| [`deploy/game.lazying.art/`](../deploy/game.lazying.art/) | Manifest LazyEdge không chứa bí mật, hình dạng binding và mẫu systemd gia cố |
| [`docs/security-boundaries.md`](../docs/security-boundaries.md) | Ranh giới tin cậy, quyền sở hữu thông tin xác thực và yêu cầu proxy |
| [`scripts/check-public-repo.sh`](../scripts/check-public-repo.sh) | Kiểm thử, kiểm tra cú pháp, kiểm tra shell và lớp chặn bí mật cho bản phát hành công khai |

Các bản build tĩnh của Weiqi, Chess/Xiangqi/Shogi, Mahjong và trò chơi bài là đầu vào của bản phát hành, không phải hiện vật được commit. Engine, trọng số mô hình, cơ sở dữ liệu, binding riêng, thông tin xác thực, biên nhận runtime, cache, hồ sơ trình duyệt và phiên người dùng đều được chủ ý loại trừ.

## Bắt đầu nhanh

Cần Node.js 20.19 trở lên và Bash.

```bash
git clone https://github.com/lachlanchen/LazyGameWeb.git
cd LazyGameWeb
npm test
npm run check
```

Để chạy cổng cục bộ, hãy chuẩn bị bốn thư mục sản phẩm giữ chỗ, mỗi thư mục có một tệp `index.html`; sao chép `apps/portal/config.example.json` ra ngoài kho mã và cung cấp các tệp thông tin xác thực chỉ chủ sở hữu được đọc. Tuyệt đối không truyền mật khẩu hay bearer capability qua dòng lệnh.

```bash
node apps/portal/bin/game-portal.mjs hash-password \
  --password-file /absolute/private/login.json \
  --out /absolute/private/login-password-verifier \
  --username USERNAME

node apps/portal/bin/game-portal.mjs serve \
  --config /absolute/private/portal.json
```

Có thể kiểm tra manifest triển khai bằng phiên bản LazyEdge CLI đã ghim của môi trường:

```bash
lazyedge validate --config deploy/game.lazying.art/lazyedge.yaml
lazyedge plan --config deploy/game.lazying.art/lazyedge.yaml
```

## Lưu ý bảo mật và triển khai

Các ví dụ cấu hình chỉ chứa đường dẫn và cấu trúc. Hãy tạo thông tin xác thực bên ngoài kho mã với quyền sở hữu được giới hạn chặt chẽ, giữ trạng thái runtime bên ngoài các bản phát hành bất biến, đồng thời rà soát mọi tên máy chủ, cổng, người dùng, đường dẫn mô hình và danh tính GPU cho máy của bạn trước khi cài đặt. Các unit đã commit là mẫu hướng đến môi trường production, không phải trình cài đặt một lệnh.

Tại reverse proxy công khai, hãy ghi đè `X-Lazying-Client-Address` bằng địa chỉ của peer kết nối trực tiếp, giữ nguyên các header `Host` và `Cookie` mong đợi, đồng thời loại bỏ `Authorization` và `Proxy-Authorization` đầu vào. Không công khai listener LazyEdge riêng hay bất kỳ cổng trò chơi cục bộ nào.

Vui lòng báo cáo riêng các vấn đề bảo mật theo hướng dẫn trong [SECURITY.md](../SECURITY.md).

## Trích dẫn

Nếu dùng LazyGameWeb trong nghiên cứu, hãy trích dẫn kho mã. GitHub đọc [CITATION.cff](../CITATION.cff) và hiển thị bảng **Cite this repository**.

```bibtex
@software{chen_lazygameweb_2026,
  author = {Chen, Lachlan},
  title = {LazyGameWeb: A secure web portal for privately computed teaching games},
  year = {2026},
  url = {https://github.com/lachlanchen/LazyGameWeb}
}
```

## Trạng thái và phạm vi

LazyGameWeb là ranh giới web và triển khai được đánh phiên bản độc lập cho [game.lazying.art](https://game.lazying.art). Các sản phẩm trò chơi và engine suy luận vẫn là dự án riêng, có luật tất định, kiểm thử, giấy phép, biên nhận phát hành và nguồn gốc mô hình riêng.
