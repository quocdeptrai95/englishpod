# EnglishPod Modern - Học Tiếng Anh Qua Hội Thoại

Giao diện hiện đại, đẹp mắt cho việc học tiếng Anh thông qua các bài podcast của EnglishPod.

## ✨ Tính Năng

- 🎨 **Giao diện Dark Mode đẹp mắt** - Thiết kế hiện đại, dễ nhìn
- 🎵 **Audio Player tùy chỉnh** - Điều khiển đầy đủ với play, pause, next, previous
- ⚡ **Điều chỉnh tốc độ phát** - Từ 0.5x đến 2x
- 🔄 **Chế độ lặp lại** - Luyện nghe nhiều lần
- 📝 **Transcript/Notes** - Xem nội dung bài học
- 🔍 **Tìm kiếm bài học** - Tìm nhanh theo tên, cấp độ
- ⌨️ **Phím tắt** - Điều khiển bằng bàn phím
- 📱 **Responsive Design** - Hoạt động tốt trên mọi thiết bị

## 🚀 Cách Sử Dụng

1. Mở file `index.html` trong trình duyệt
2. Chọn bài học từ danh sách bên trái
3. Nhấn Play để bắt đầu nghe
4. Click "Show" để xem transcript

## ⌨️ Phím Tắt

- **Space** - Play/Pause
- **← →** - Lùi/Tới 5 giây
- **↑ ↓** - Bài trước/sau
- **M** - Bật/Tắt tiếng

## 🎨 Màu Sắc

- Background: #0f0f0f
- Secondary: #1a1a1a  
- Accent: #6366f1 (Indigo)
- Yellow: #fbbf24

## 📦 Cấu Trúc File

```
EnglishPod-Modern/
├── index.html       # Giao diện chính
├── style.css        # Styles với dark theme
├── script.js        # Logic điều khiển player
├── episodes.js      # Dữ liệu các bài học
└── README.md        # Tài liệu
```

## 🔧 Tùy Chỉnh

### Thêm bài học mới

Chỉnh sửa file `episodes.js`:

```javascript
{
    id: 26,
    title: "Tên bài học",
    level: "Elementary", // hoặc Intermediate, Advanced
    mp3: "link-to-audio.mp3",
    transcript: "link-to-transcript.html"
}
```

### Thay đổi màu sắc

Chỉnh sửa CSS variables trong `style.css`:

```css
:root {
    --bg-primary: #0f0f0f;
    --accent-primary: #6366f1;
    /* ... */
}
```

## 🌟 Tính Năng Nâng Cao

- Audio player với progress bar
- Tự động chuyển bài khi kết thúc
- Hiển thị thời gian hiện tại/tổng thời gian
- Fullscreen mode
- Volume control
- Playback speed control

## 📱 Responsive

- Desktop: Layout 2 cột với sidebar
- Tablet: Responsive sidebar
- Mobile: Stack layout, sidebar collapse

## 🎓 Nguồn Dữ Liệu

Dữ liệu audio và transcript từ:
- Archive.org: https://archive.org/download/englishpod_all/
- Transcript: https://ia600103.us.archive.org/31/items/englishpod_all/

## 📄 License

MIT License

## 💖 Credits

- Design inspired by modern audio players
- Audio content from EnglishPod
- Made with ❤️ by Huynh Thien Tung

---

**Chúc bạn học tiếng Anh vui vẻ! 🎉**
