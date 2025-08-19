# Simple AirDrop - P2P File Transfer

Ứng dụng chia sẻ file P2P trong browser, được cải tiến từ phiên bản gốc với 2 implementation khác nhau.

## 🚀 Tính năng

- ✅ Chia sẻ file P2P trực tiếp giữa các browser
- ✅ Không cần server lưu trữ file
- ✅ Hỗ trợ file lớn (tested với 100MB+)
- ✅ Real-time progress tracking
- ✅ Auto-retry khi gặp lỗi
- ✅ Cross-browser compatibility
- ✅ Responsive UI

## 📁 Cấu trúc dự án

```
simple-airdrop/
├── public/
│   ├── index.html              # Phiên bản WebRTC thuần (cải tiến)
│   ├── index-peerjs.html       # Phiên bản PeerJS (khuyến nghị)
│   ├── script.js               # WebRTC thuần implementation
│   ├── script-peerjs.js        # PeerJS implementation
│   └── style.css               # Styles chung
├── server/
│   └── server.js               # Express server + WebSocket signaling
├── IMPROVEMENTS.md             # Chi tiết cải tiến WebRTC thuần
├── COMPARISON.md               # So sánh 2 phiên bản
└── package.json
```

## 🛠️ Cài đặt và chạy

### 1. Clone và cài đặt dependencies
```bash
cd simple-airdrop
npm install
```

### 2. Khởi động server
```bash
npm start
```

### 3. Mở browser và test
- **Phiên bản chính (PeerJS)**: http://localhost:3000/
- **Phiên bản demo PeerJS**: http://localhost:3000/index-peerjs.html

**Lưu ý**: Phiên bản chính đã được cập nhật để sử dụng PeerJS thay vì WebRTC thuần để ổn định hơn.

## 🔧 Cách sử dụng

### Phiên bản chính (PeerJS - Đơn giản và ổn định)

1. **Mở 2 tab browser** tại `http://localhost:3000/`
2. **Nhấn "Bắt đầu"** ở cả 2 tab để tạo Peer ID
3. **Copy ID** từ tab 1
4. **Paste ID** vào ô "Kết nối thủ công" ở tab 2 và nhấn "Kết nối"
5. **Chọn file** ở tab 1 và nhấn "Chọn thiết bị để gửi"
6. **Chấp nhận file** ở tab 2

### Tính năng mới:
- ✅ **Kết nối thủ công**: Nhập ID trực tiếp để kết nối
- ✅ **File info**: Hiển thị thông tin file đã chọn
- ✅ **Status indicator**: Màu sắc hiển thị trạng thái kết nối
- ✅ **Enhanced UI**: Giao diện đẹp và dễ sử dụng hơn
- ✅ **Better error handling**: Xử lý lỗi tốt hơn

## 📊 So sánh 2 phiên bản

| Tiêu chí | WebRTC thuần | PeerJS |
|----------|--------------|--------|
| **Độ phức tạp** | Cao (1000+ LOC) | Thấp (500 LOC) |
| **Độ ổn định** | 7/10 | 9/10 |
| **Dễ debug** | Khó | Dễ |
| **Setup time** | Chậm | Nhanh |
| **Khuyến nghị** | Chỉ khi cần control hoàn toàn | Hầu hết use cases |

## 🔍 Cải tiến đã thực hiện

### WebRTC thuần version:
- ✅ Fixed buffer overflow issues
- ✅ Adaptive chunk size (16KB → 64KB cho file lớn)
- ✅ Enhanced retry mechanism (3 attempts)
- ✅ Better timeout handling (adaptive based on file size)
- ✅ Improved progress tracking (update every 500ms)
- ✅ Memory management optimization
- ✅ Connection health monitoring

### PeerJS version:
- ✅ Simplified codebase (50% ít code hơn)
- ✅ Built-in error handling
- ✅ Better browser compatibility
- ✅ Manual peer connection support
- ✅ Enhanced UI/UX
- ✅ Automatic reconnection
- ✅ More stable file transfer

## 🐛 Troubleshooting

### File transfer bị đứng:
1. **Check console logs** để xem lỗi cụ thể
2. **Refresh cả 2 tab** và thử lại
3. **Thử với file nhỏ hơn** trước (< 10MB)
4. **Sử dụng phiên bản PeerJS** thay vì WebRTC thuần

### Không kết nối được:
1. **Kiểm tra firewall/antivirus**
2. **Thử trên localhost** trước
3. **Check browser console** để xem lỗi
4. **Thử browser khác** (Chrome/Firefox)

### Performance chậm:
1. **File lớn** sẽ tự động dùng chunk size lớn hơn
2. **Network quality** ảnh hưởng tốc độ
3. **Đóng các tab khác** để giải phóng memory

## 🚀 Tính năng có thể mở rộng

- [ ] **Room-based connections** (nhiều người trong 1 room)
- [ ] **Resume interrupted transfers** 
- [ ] **Multiple file transfer** (gửi nhiều file cùng lúc)
- [ ] **File encryption** (mã hóa file trước khi gửi)
- [ ] **Mobile app** (React Native/Flutter)
- [ ] **Desktop app** (Electron)

## 📝 Technical Notes

### WebRTC Configuration:
```javascript
const iceServers = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
    ]
};
```

### PeerJS Configuration:
```javascript
const peer = new Peer({
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
        ]
    },
    debug: 2
});
```

## 🤝 Contributing

1. Fork the project
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

MIT License - xem file LICENSE để biết thêm chi tiết.

## 🙏 Acknowledgments

- Inspired by [chidokun/p2p-file-transfer](https://github.com/chidokun/p2p-file-transfer)
- WebRTC documentation và community
- PeerJS library và maintainers
