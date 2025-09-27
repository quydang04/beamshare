# VieCloud Share - P2P File Transfer

Nền tảng chia sẻ tệp ngang hàng (P2P) dựa trên WebRTC, tối ưu cho việc gửi nhận tức thời giữa các thiết bị trong cùng mạng nội bộ hoặc qua Internet với tùy chọn máy chủ STUN/TURN.

## 🚀 Tính năng nổi bật

- **Trao đổi tệp trực tiếp**: Thiết lập kết nối WebRTC ngang hàng, hạn chế phụ thuộc vào máy chủ trung gian.
- **Fallback an toàn**: Tùy chọn bật WebSocket fallback khi WebRTC bị chặn.
- **Khả năng mở rộng phòng**: Hỗ trợ ghép cặp theo IP, phòng bí mật (secret room) và phòng công khai với mã ngắn.
- **Chia sẻ đa nền tảng**: Giao diện tối ưu cho Desktop, Tablet, Mobile, hoạt động tốt trên các trình duyệt phổ biến.
- **Theo dõi tiến trình**: Hiển thị thông tin tiến độ truyền file theo thời gian thực, hỗ trợ kéo thả và clipboard.
- **PWA & ngoại tuyến**: Tích hợp Service Worker, cài đặt như ứng dụng độc lập, thông báo tùy chỉnh.

## 🧱 Kiến trúc & Công nghệ

- **Server**: Node.js, Express, WebSocket (`ws`), rate limiting (`express-rate-limit`).
- **Client**: Vanilla JS, WebRTC DataChannel, Web Workers, Service Worker, manifest PWA.
- **Config động**: Máy chủ cung cấp `/config` để client lấy cấu hình nút tín hiệu và các nút CTA.
- **Đóng gói**: Dockerfile, docker-compose cho triển khai nhanh; kịch bản dev với Nginx HTTPS tự ký.

## 📂 Cấu trúc thư mục chính

- `public/`: Tệp tĩnh, giao diện, service worker, manifest và tài nguyên đa phương tiện.
- `public/js/`: Logic WebRTC, quản lý phòng, truyền file, UI.
- `server/`: Máy chủ Express phục vụ tệp tĩnh và WebSocket signaling.
- `dev/`: Công cụ hỗ trợ môi trường phát triển HTTPS (Nginx + OpenSSL).
- `docker-compose*.yml`: Cấu hình triển khai container ở môi trường thật và dev.

## 🔧 Yêu cầu hệ thống

- Node.js >= 16 (theo `engines.node >= 15`, khuyến nghị dùng bản LTS mới nhất).
- npm đi kèm Node.js.
- (Tùy chọn) Docker & Docker Compose cho triển khai container.

## ▶️ Chạy cục bộ bằng Node.js

1. Cài đặt phụ thuộc: `npm install`.
2. (Tùy chọn) tạo file cấu hình TURN/STUN từ `rtc_config_example.json`.
3. Khởi chạy máy chủ: `npm start` (hoặc `npm run start:prod -- --include-ws-fallback` khi cần fallback).
4. Truy cập `http://localhost:3000`.

### Script npm

- `npm start`: khởi động server Express/WebSocket với cấu hình mặc định.
- `npm run start:prod`: bật auto-restart và support tham số `--rate-limit --auto-restart`.

## ⚙️ Biến môi trường quan trọng

| Biến | Giá trị mặc định | Mô tả |
| --- | --- | --- |
| `PORT` | `3000` | Cổng máy chủ HTTP.
| `DEBUG_MODE` | `false` | In log chẩn đoán chi tiết, đồng thời mở endpoint `/ip` khi bật rate limit.
| `RTC_CONFIG` | mặc định STUN Google | Đường dẫn file JSON định nghĩa danh sách máy chủ STUN/TURN.
| `WS_FALLBACK` | `false` | Bật relay qua WebSocket khi WebRTC thất bại.
| `SIGNALING_SERVER` | `false` | URL (không kèm protocol) trỏ tới máy chủ signaling bên ngoài. Khi set, instance hiện tại chỉ phục vụ file tĩnh.
| `RATE_LIMIT` | `false` | Số nguyên (hoặc `true` = 5) giới hạn số request/IP mỗi 5 phút.
| `IPV6_LOCALIZE` | `false` | 1-7: ẩn bớt segment IPv6 khi dùng rooms theo IP.
| `DONATION_BUTTON_*`, `TWITTER_BUTTON_*`, `MASTODON_BUTTON_*`, `BLUESKY_BUTTON_*`, `CUSTOM_BUTTON_*`, `PRIVACYPOLICY_BUTTON_*` | | Tùy chọn hiển thị nút CTA trên UI (`*_ACTIVE`, `*_LINK`, `*_TITLE`).
| `DEBUG_MODE`, `RATE_LIMIT` | | Có thể setting qua docker-compose.

### File cấu hình mẫu

- `rtc_config_example.json`: Ví dụ cấu hình ICE (STUN/TURN) – sao chép và điều chỉnh để sử dụng.
- `turnserver_example.conf`: Tham khảo cấu hình coturn khi triển khai máy chủ TURN riêng.

## 🐳 Chạy bằng Docker

```powershell
docker-compose up -d
```

- File `docker-compose.yml` dùng image chính thức `lscr.io/linuxserver/beamshare`.
- File `docker-compose-dev.yml` build cục bộ và có thêm container Nginx tạo chứng chỉ tự ký, phục vụ HTTP/HTTPS.

## 🔐 HTTPS tự ký cho môi trường dev

- Sử dụng `docker-compose-dev.yml` để tạo chứng chỉ tự ký (`dev/openssl/create.sh`).
- Truy cập giao diện qua `https://localhost:8443` sau khi cấp quyền cho chứng chỉ tự ký.

## ✅ Kiểm thử & vận hành

- Thử truyền file giữa hai trình duyệt trong cùng máy và khác mạng để kiểm tra STUN/TURN.
- Theo dõi log server trong terminal hoặc `docker logs -f beamshare`.

## 🗺 Lộ trình mở rộng gợi ý

- Bổ sung giao diện quản trị thống kê phòng/thiết bị.
- Tích hợp xác thực khi dùng chung máy chủ công cộng.
- Viết test tự động cho logic signaling và truyền file.
