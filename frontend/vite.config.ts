import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Nhờ proxy này, trình duyệt coi frontend và API là cùng origin ở môi
      // trường dev. Cookie httpOnly nhờ vậy hoạt động ngay mà không phải cấu
      // hình SameSite=None hay CORS credentials.
      '/api': { target: 'http://localhost:4000' },
      // Ảnh sản phẩm do backend phục vụ từ thư mục uploads/.
      '/uploads': { target: 'http://localhost:4000' },
    },
  },
});
