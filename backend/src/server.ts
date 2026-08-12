import { createServer } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { attachChatSocket } from './modules/chat/chat.socket.js';

const app = createApp();
const server = createServer(app);
attachChatSocket(server);

server.listen(env.PORT, () => {
  console.log(`API chạy tại http://localhost:${env.PORT}  (${env.NODE_ENV})`);
  console.log(`Kiểm tra:      http://localhost:${env.PORT}/api/health`);
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\nNhận ${signal}, đang đóng kết nối...`);

  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });

  // Không để tiến trình treo mãi nếu còn kết nối chưa đóng.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
