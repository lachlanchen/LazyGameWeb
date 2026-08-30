[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyGameWeb

*Cổng web nhỏ gọn có xác thực dành cho các trò chơi giảng dạy nghiêm túc, với tính toán cục bộ riêng tư.*

[![Website](https://img.shields.io/badge/Play-game.lazying.art-176B56?style=for-the-badge)](https://game.lazying.art)
[![Tests](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml/badge.svg)](https://github.com/lachlanchen/LazyGameWeb/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2F855A?style=for-the-badge)](../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=for-the-badge&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyGameWeb là kho mã công khai chứa cổng truy cập và hợp đồng triển khai cho [game.lazying.art](https://game.lazying.art). Cổng phục vụ danh mục trò chơi đã xác thực tại biên đám mây và chỉ chuyển tiếp một tập yêu cầu API hẹp, được khai báo rõ trong mã, qua đường hầm ngược LazyEdge riêng. Luật chơi, chuyển trạng thái, dữ liệu riêng tư và suy luận mô hình vẫn nằm trong các dịch vụ trò chơi độc lập; kho mã này không phụ thuộc LocalLLM hay cây làm việc engine có thể thay đổi.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## Cam kết thiết kế

- **Dịch vụ biên nhỏ:** cổng chỉ dùng các mô-đun tích hợp sẵn của Node.js khi chạy.
- **Định tuyến đóng mặc định:** danh sách cho phép chính xác do mã sở hữu sẽ từ chối phương thức, đường dẫn, truy vấn và hành vi traversal không biết.
- **Quyền hạn rõ ràng:** dịch vụ trò chơi tất định sở hữu luật và nước đi hợp lệ. Cổng không tạo nước đi hay sửa trạng thái trò chơi.
- **Tính toán riêng tư:** capability LazyEdge và danh tính reverse-SSH chuyên dụng cô lập lưu lượng trò chơi.
- **Đăng nhập vững chắc:** scrypt, phiên ghi nhớ dựa trên HMAC, CSRF, giới hạn tần suất, cookie nghiêm ngặt và CSP hạn chế.
- **Bản phát hành bất biến:** cổng và bundle tĩnh được phục vụ từ thư mục đã duyệt; bí mật và trạng thái nằm bên ngoài.

## Kiến trúc

```text
browser
  -> Caddy TLS ingress
  -> authenticated LazyGameWeb portal (cloud loopback)
  -> private LazyEdge listener
  -> dedicated reverse-SSH tunnel
  -> worker guard + strict game gateway (local loopback)
  -> deterministic game services and bounded engines
```

Máy chủ công khai chỉ phơi bày cổng. Listener LazyEdge riêng, gateway cục bộ, API trò chơi, cơ sở dữ liệu, engine, token và mô hình đều không công khai. Xem [Ranh giới bảo mật](../docs/security-boundaries.md) để hiểu mô hình tin cậy.

## Nội dung hiện tại

| Đường dẫn | Mục đích |
| --- | --- |
| [`apps/portal/`](../apps/portal/) | Cổng xác thực không có phụ thuộc runtime ngoài và BFF với hợp đồng cố định |
| [`deploy/game.lazying.art/`](../deploy/game.lazying.art/) | Manifest LazyEdge không chứa bí mật, hình dạng binding và mẫu systemd gia cố |
| [`docs/security-boundaries.md`](../docs/security-boundaries.md) | Ranh giới tin cậy, quyền sở hữu thông tin xác thực và yêu cầu proxy |
| [`scripts/check-public-repo.sh`](../scripts/check-public-repo.sh) | Kiểm thử, kiểm tra cú pháp và chặn bí mật trước khi công khai |

Các bản build Weiqi, Chess/Xiangqi/Shogi, Mahjong và trò chơi bài là đầu vào của bản phát hành, không phải hiện vật được commit. Engine, trọng số mô hình, cơ sở dữ liệu, binding riêng, thông tin xác thực, biên nhận runtime, cache và phiên cũng bị loại trừ.

## Bắt đầu nhanh

Cần Node.js 20.19 trở lên và Bash.

```bash
git clone https://github.com/lachlanchen/LazyGameWeb.git
cd LazyGameWeb
npm test
npm run check
```

Sao chép `apps/portal/config.example.json` tới vị trí riêng bên ngoài kho mã và cung cấp tệp thông tin xác thực chỉ chủ sở hữu được đọc. Không truyền mật khẩu hay Bearer capability qua dòng lệnh. Kiểm tra hợp đồng triển khai bằng:

```bash
lazyedge validate --config deploy/game.lazying.art/lazyedge.yaml
lazyedge plan --config deploy/game.lazying.art/lazyedge.yaml
```

## Lưu ý bảo mật và triển khai

Các ví dụ là mẫu đã duyệt, không phải trình cài đặt tự động. Hãy kiểm tra người dùng, đường dẫn, cổng và danh tính GPU cho máy chủ của bạn. Proxy công khai phải ghi đè `X-Lazying-Client-Address` bằng địa chỉ peer trực tiếp, giữ `Host` và `Cookie` mong đợi, đồng thời loại bỏ `Authorization` và `Proxy-Authorization` đầu vào. Không công khai listener riêng hay cổng trò chơi cục bộ. Báo cáo lỗ hổng riêng tư theo [SECURITY.md](../SECURITY.md).

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
