# BeamShare - Cải tiến thông tin thiết bị

## Tổng quan
Đã cải tiến phần hiển thị thông tin thiết bị trong ứng dụng BeamShare (trước đây là PairDrop) để hiển thị thông tin chi tiết và chính xác hơn về các thiết bị kết nối.

## Những thay đổi chính

### 1. Đổi tên ứng dụng
- **Trước:** PairDrop
- **Sau:** BeamShare
- Cập nhật tất cả tham chiếu trong HTML, JavaScript và file dịch thuật

### 2. Cải tiến phát hiện thông tin thiết bị

#### Thông tin hệ điều hành chi tiết
- **Windows:** Phát hiện chính xác Windows 7, 8, 8.1, 10, 11
- **macOS:** Phát hiện phiên bản macOS với tên code (Catalina, Mojave, etc.)
- **Linux:** Phát hiện các distro phổ biến (Ubuntu, Fedora, CentOS)
- **Mobile:** Phát hiện iOS và Android với phiên bản

#### Thông tin trình duyệt nâng cao
- Hiển thị tên trình duyệt và phiên bản chính xác
- Hỗ trợ: Chrome, Firefox, Safari, Edge, Opera
- Ví dụ: "Chrome 120.0", "Firefox 121.0", "Edge 139.0"

#### Thông tin thiết bị di động
- Phát hiện model iPhone (iPhone 15, 14, 13, 12)
- Phát hiện loại iPad (iPad Pro, Air, Mini)
- Trích xuất tên thiết bị Android từ User Agent
- Phân biệt smartphone và tablet

### 3. Hiển thị thông tin hệ thống

#### Thông tin phần cứng
- Số lõi CPU (nếu có)
- Dung lượng RAM (nếu có)
- Độ phân giải màn hình
- Tỷ lệ pixel (device pixel ratio)

#### Thông tin mạng
- Loại kết nối (4G, 3G, WiFi)
- Tốc độ kết nối (nếu có)
- Độ trễ mạng (RTT)

#### Thông tin khác
- Ngôn ngữ hệ thống
- Múi giờ
- Độ sâu màu

### 4. Giao diện cải tiến

#### Card thiết bị của bạn
```html
<div class="device-card">
    <div>Thiết bị của bạn</div>
    <div class="device-name">📱 iPhone 15 Pro</div>
    <div id="device-details">Chrome 120.0 • iOS 17.2 • 6 cores • 8GB RAM • 1179x2556</div>
    <div id="my-id">Device ID: abc123...</div>
</div>
```

#### Card thiết bị gần đây
- Hiển thị thông tin chi tiết hơn về từng thiết bị
- Phân biệt rõ ràng thiết bị đang kết nối và offline
- Hiển thị model thiết bị (nếu có)

### 5. Cấu trúc code

#### File mới/cập nhật:
- `utils.js`: Thêm `getDetailedDeviceInfo()` và `getSystemInfo()`
- `script.js`: Thêm `updateSystemInfoDisplay()`
- `ui-manager.js`: Thêm `updateLocalDeviceDisplay()`
- `device-discovery.js`: Cải tiến hiển thị thông tin thiết bị
- `translations.js`: Cập nhật tên ứng dụng

#### Các function chính:
```javascript
// Lấy thông tin thiết bị chi tiết
getDetailedDeviceInfo() -> {
    name: "📱 iPhone 15 Pro",
    type: "mobile",
    os: "iOS",
    osVersion: "17.2",
    model: "iPhone 15 Pro",
    platform: "iPhone"
}

// Lấy thông tin hệ thống đầy đủ
getSystemInfo() -> {
    deviceName: "📱 iPhone 15 Pro",
    browser: "Chrome 120.0",
    hardwareConcurrency: 6,
    memory: "8GB",
    screenResolution: "1179x2556",
    connection: { effectiveType: "4g" }
    // ... và nhiều thông tin khác
}
```

## Kết quả

### Trước khi cải tiến:
- Hiển thị thông tin cơ bản: "Android Device", "Windows PC"
- Thông tin trình duyệt đơn giản: "Chrome", "Firefox"
- Không có thông tin phần cứng

### Sau khi cải tiến:
- Hiển thị chi tiết: "📱 Samsung Galaxy S23", "🖥️ Windows 11 PC"
- Thông tin trình duyệt đầy đủ: "Chrome 120.0.6099.129"
- Thông tin phần cứng: "8 cores • 16GB RAM • 1920x1080"
- Thông tin mạng: "4G • 50Mbps"

## Cách sử dụng

1. Khởi động server:
```bash
cd simple-airdrop
npm start
```

2. Mở trình duyệt và truy cập: http://localhost:3000

3. Quan sát thông tin thiết bị chi tiết trong:
   - Card "Thiết bị của bạn"
   - Danh sách "Nearby Devices"
   - Console log để debug

## Tương thích

- ✅ Chrome/Chromium browsers
- ✅ Firefox
- ✅ Safari (iOS/macOS)
- ✅ Edge
- ✅ Mobile browsers
- ✅ Tất cả hệ điều hành chính

## Lưu ý

- Một số thông tin phần cứng chỉ có sẵn trên các trình duyệt hiện đại
- Thông tin mạng yêu cầu API Network Information (chủ yếu Chrome)
- Thông tin thiết bị di động có thể bị hạn chế do chính sách bảo mật
