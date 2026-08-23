# Standalone Fullscreen Chat Application (`chat-app`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a standalone fullstack chat application inside `chat-app/` featuring a fullscreen chat UI with hybrid AI streaming (SSE) and realtime human support (Socket.IO) backed by Prisma ORM.

**Architecture:** Next.js (App Router) combined with a custom Node.js HTTP server running Socket.IO on the same port. Next.js Route Handlers handle conversation persistence and AI streaming with fallback mock capability. Frontend delivers a zero-clutter fullscreen chat interface (100dvh) with TailwindCSS and Markdown support.

**Tech Stack:** Next.js 15+, React 19, TypeScript, Socket.IO & Socket.IO Client, Prisma ORM (@prisma/client), TailwindCSS 4, Lucide React (or SVG icons).

## Global Constraints
- All application code and configuration must reside strictly inside `chat-app/`.
- No `git push` command shall be executed (all work remains on local branch `chat`).
- AI streaming must have built-in mock fallback if no `AI_API_KEY` is provided so the app runs out-of-the-box.
- Interface must be strictly 100% fullscreen (`h-screen`, `100dvh`, no ecommerce navigation or sidebars).

---

### Task 1: Initialize `chat-app` Project Configuration & Dependencies

**Files:**
- Create: `chat-app/package.json`
- Create: `chat-app/tsconfig.json`
- Create: `chat-app/next.config.ts`
- Create: `chat-app/postcss.config.mjs`
- Create: `chat-app/.env.example`
- Create: `chat-app/.env`
- Create: `chat-app/.gitignore`

**Interfaces:**
- Produces: Base configuration and node package environment for `chat-app/`.

- [ ] **Step 1: Create `chat-app/package.json`**

```json
{
  "name": "chat-app",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx server.ts",
    "build": "next build",
    "start": "NODE_ENV=production tsx server.ts",
    "typecheck": "tsc --noEmit",
    "prisma:generate": "prisma generate",
    "prisma:push": "prisma db push"
  },
  "dependencies": {
    "@prisma/client": "^6.4.1",
    "clsx": "^2.1.1",
    "dotenv": "^16.4.7",
    "next": "^15.2.1",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "socket.io": "^4.8.1",
    "socket.io-client": "^4.8.1",
    "tailwind-merge": "^3.0.2"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.9",
    "@types/node": "^22.13.9",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "postcss": "^8.5.3",
    "prisma": "^6.4.1",
    "tailwindcss": "^4.0.9",
    "tsx": "^4.19.3",
    "typescript": "^5.8.2"
  }
}
```

- [ ] **Step 2: Create `chat-app/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `chat-app/next.config.ts`, `postcss.config.mjs`, `.env.example`, `.env`, `.gitignore`**

```typescript
// chat-app/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

```javascript
// chat-app/postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

```env
# chat-app/.env.example and chat-app/.env
PORT=3005
DATABASE_URL="mysql://root:@localhost:3306/projectcv"
AI_PROVIDER="mock"
AI_API_KEY=""
AI_MODEL="gpt-4o-mini"
```

```gitignore
# chat-app/.gitignore
node_modules
.next
dist
.env
```

- [ ] **Step 4: Install dependencies in `chat-app/`**

Run: `npm --prefix chat-app install`
Expected: Dependencies installed with zero errors.

- [ ] **Step 5: Commit configuration**

```bash
git add chat-app/package.json chat-app/tsconfig.json chat-app/next.config.ts chat-app/postcss.config.mjs chat-app/.env.example chat-app/.gitignore
git commit -m "chore(chat-app): initialize standalone project configuration and dependencies"
```

---

### Task 2: Configure Database Schema & Prisma Client Singleton

**Files:**
- Create: `chat-app/prisma/schema.prisma`
- Create: `chat-app/src/lib/prisma.ts`

**Interfaces:**
- Produces: `prisma` singleton instance exporting `Conversation` and `Message` accessors.

- [ ] **Step 1: Create `chat-app/prisma/schema.prisma`**

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum ConversationMode {
  AI
  HUMAN
}

enum ConversationStatus {
  ACTIVE
  RESOLVED
  ARCHIVED
}

enum MessageSender {
  USER
  AI
  AGENT
  SYSTEM
}

model Conversation {
  id        String             @id @default(cuid())
  title     String             @default("Cuộc trò chuyện mới")
  mode      ConversationMode   @default(AI)
  status    ConversationStatus @default(ACTIVE)
  createdAt DateTime           @default(now())
  updatedAt DateTime           @updatedAt
  messages  Message[]

  @@map("chat_conversations")
}

model Message {
  id             String        @id @default(cuid())
  conversationId String
  conversation   Conversation  @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender         MessageSender
  senderName     String?
  content        String        @db.Text
  createdAt      DateTime      @default(now())

  @@index([conversationId])
  @@map("chat_messages")
}
```

- [ ] **Step 2: Generate Prisma Client**

Run: `npm --prefix chat-app run prisma:generate`
Expected: `Generated Prisma Client` successfully.

- [ ] **Step 3: Create `chat-app/src/lib/prisma.ts`**

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 4: Commit database module**

```bash
git add chat-app/prisma/schema.prisma chat-app/src/lib/prisma.ts
git commit -m "feat(chat-app): setup prisma schema and client singleton"
```

---

### Task 3: Implement Backend Services (AI Engine & Socket.IO Handler)

**Files:**
- Create: `chat-app/src/lib/ai-service.ts`
- Create: `chat-app/src/lib/socket-server.ts`

**Interfaces:**
- Produces: `streamAiReply(userPrompt: string, history: Array<{ role: string; content: string }>): AsyncGenerator<string>`
- Produces: `initSocketServer(io: Server): void`

- [ ] **Step 1: Create `chat-app/src/lib/ai-service.ts`**

```typescript
export interface ChatContextMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function* streamAiReply(
  userPrompt: string,
  history: ChatContextMessage[] = []
): AsyncGenerator<string, void, unknown> {
  const apiKey = process.env.AI_API_KEY?.trim();
  const provider = process.env.AI_PROVIDER || 'mock';

  if (!apiKey || provider === 'mock') {
    // Built-in intelligent mock streamer with typing effect
    const mockResponses = [
      `Chào bạn! Tôi là **Trợ lý AI** của hệ thống.\n\nTôi đã nhận được tin nhắn: *"${userPrompt}"*.\n\nTôi có thể hỗ trợ bạn:\n1. 🔍 Giải đáp thông tin & hỗ trợ kỹ thuật\n2. 💡 Hướng dẫn sử dụng các tính năng\n3. 👤 Kết nối trực tiếp tới nhân viên tư vấn bất kỳ lúc nào qua nút trên thanh tiêu đề!`,
      `Cảm ơn câu hỏi của bạn về: **${userPrompt}**.\n\nDưới đây là thông tin chi tiết:\n- Hệ thống đang chạy ở chế độ **Fullscreen Chat Standalone**.\n- Bạn có thể gửi tin nhắn liên tục hoặc chuyển sang chế độ **Tư vấn viên** để chat realtime 2 chiều qua Socket.IO nhé!`
    ];
    const chosen = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    const words = chosen.split(' ');

    for (const word of words) {
      yield word + ' ';
      await new Promise((res) => setTimeout(res, 35));
    }
    return;
  }

  // OpenAI / Compatible streaming implementation
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Bạn là trợ lý AI thông minh, thân thiện, trả lời chuẩn Markdown.' },
          ...history,
          { role: 'user', content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      yield `Đã xảy ra lỗi khi gọi AI API (${response.statusText}). Vui lòng kiểm tra lại cấu hình.`;
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const delta = data.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // Ignore parse errors on malformed chunks
          }
        }
      }
    }
  } catch (error) {
    yield `Lỗi kết nối AI Service: ${(error as Error).message}`;
  }
}
```

- [ ] **Step 2: Create `chat-app/src/lib/socket-server.ts`**

```typescript
import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from './prisma.js';

export function initSocketServer(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Join conversation room
    socket.on('join_room', async ({ conversationId, role, name }: { conversationId: string; role?: string; name?: string }) => {
      if (!conversationId) return;
      socket.join(`conversation:${conversationId}`);
      console.log(`[Socket.IO] Socket ${socket.id} (${name || role || 'User'}) joined room: conversation:${conversationId}`);
    });

    // Send realtime message (Human Support)
    socket.on('send_message', async ({ conversationId, content, sender, senderName }: {
      conversationId: string;
      content: string;
      sender: 'USER' | 'AGENT';
      senderName?: string;
    }) => {
      if (!conversationId || !content?.trim()) return;

      try {
        const savedMessage = await prisma.message.create({
          data: {
            conversationId,
            content: content.trim(),
            sender: sender || 'USER',
            senderName: senderName || (sender === 'AGENT' ? 'Tư vấn viên' : 'Khách hàng'),
          },
        });

        // Broadcast to everyone in room including sender
        io.to(`conversation:${conversationId}`).emit('new_message', savedMessage);
      } catch (err) {
        console.error('[Socket.IO] Error saving message:', err);
      }
    });

    // Typing indicators
    socket.on('typing_start', ({ conversationId, senderName }: { conversationId: string; senderName?: string }) => {
      socket.to(`conversation:${conversationId}`).emit('user_typing', {
        senderName: senderName || 'Đối phương',
        isTyping: true,
      });
    });

    socket.on('typing_stop', ({ conversationId }: { conversationId: string }) => {
      socket.to(`conversation:${conversationId}`).emit('user_typing', {
        isTyping: false,
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
}
```

- [ ] **Step 3: Commit backend services**

```bash
git add chat-app/src/lib/ai-service.ts chat-app/src/lib/socket-server.ts
git commit -m "feat(chat-app): implement AI streaming service and Socket.IO realtime server"
```

---

### Task 4: Implement Next.js REST & Streaming Route Handlers

**Files:**
- Create: `chat-app/src/app/api/conversations/route.ts`
- Create: `chat-app/src/app/api/conversations/[id]/route.ts`
- Create: `chat-app/src/app/api/conversations/[id]/mode/route.ts`
- Create: `chat-app/src/app/api/chat/ai/route.ts`

**Interfaces:**
- Produces: API endpoints for Conversation CRUD, Mode toggling, and AI SSE streaming.

- [ ] **Step 1: Create `chat-app/src/app/api/conversations/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    let conversation = await prisma.conversation.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          title: 'Cuộc trò chuyện mới',
          mode: 'AI',
          status: 'ACTIVE',
          messages: {
            create: {
              sender: 'AI',
              senderName: 'Trợ lý AI',
              content: 'Xin chào! Tôi là **Trợ lý AI**. Tôi có thể hỗ trợ gì cho bạn hôm nay?',
            },
          },
        },
        include: {
          messages: true,
        },
      });
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Failed to get conversation:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const conversation = await prisma.conversation.create({
      data: {
        title: 'Cuộc trò chuyện mới',
        mode: 'AI',
        status: 'ACTIVE',
        messages: {
          create: {
            sender: 'AI',
            senderName: 'Trợ lý AI',
            content: 'Xin chào! Tôi là **Trợ lý AI**. Tôi có thể hỗ trợ gì cho bạn hôm nay?',
          },
        },
      },
      include: {
        messages: true,
      },
    });

    return NextResponse.json(conversation);
  } catch (error) {
    console.error('Failed to create conversation:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `chat-app/src/app/api/conversations/[id]/route.ts` and mode toggle route**

```typescript
// chat-app/src/app/api/conversations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json(conversation);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
  }
}
```

```typescript
// chat-app/src/app/api/conversations/[id]/mode/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { mode } = await req.json();

    if (mode !== 'AI' && mode !== 'HUMAN') {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: { mode },
    });

    // Create system notification message
    const systemNotice = mode === 'HUMAN' 
      ? 'Đã kết nối với phòng tư vấn viên. Nhân viên hỗ trợ sẽ phản hồi bạn trong giây lát.' 
      : 'Đã chuyển về chế độ Trợ lý AI tự động.';

    await prisma.message.create({
      data: {
        conversationId: id,
        sender: 'SYSTEM',
        content: systemNotice,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update mode' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create `chat-app/src/app/api/chat/ai/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { streamAiReply, ChatContextMessage } from '@/lib/ai-service';

export async function POST(req: NextRequest) {
  try {
    const { conversationId, content } = await req.json();

    if (!conversationId || !content?.trim()) {
      return NextResponse.json({ error: 'Missing conversationId or content' }, { status: 400 });
    }

    // 1. Save USER message to database
    await prisma.message.create({
      data: {
        conversationId,
        sender: 'USER',
        senderName: 'Bạn',
        content: content.trim(),
      },
    });

    // 2. Fetch past context (up to last 10 messages)
    const recentMessages = await prisma.message.findMany({
      where: { conversationId, sender: { in: ['USER', 'AI'] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const history: ChatContextMessage[] = recentMessages.reverse().map((msg) => ({
      role: msg.sender === 'USER' ? 'user' : 'assistant',
      content: msg.content,
    }));

    // 3. Create SSE ReadableStream
    const encoder = new TextEncoder();
    let accumulatedAiResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamAiReply(content, history)) {
            accumulatedAiResponse += chunk;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
          }

          // Save complete AI response into database
          if (accumulatedAiResponse.trim()) {
            await prisma.message.create({
              data: {
                conversationId,
                sender: 'AI',
                senderName: 'Trợ lý AI',
                content: accumulatedAiResponse.trim(),
              },
            });
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI chat endpoint error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Commit API route handlers**

```bash
git add chat-app/src/app/api/
git commit -m "feat(chat-app): add API route handlers for conversations and AI streaming"
```

---

### Task 5: Implement Custom Node.js HTTP & Socket.IO Server

**Files:**
- Create: `chat-app/server.ts`

**Interfaces:**
- Produces: Integrated Node server on `PORT` (default 3005) handling Next.js web requests and Socket.IO WebSockets concurrently.

- [ ] **Step 1: Create `chat-app/server.ts`**

```typescript
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { initSocketServer } from './src/lib/socket-server.js';

dotenv.config();

const port = parseInt(process.env.PORT || '3005', 10);
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  initSocketServer(io);

  server.listen(port, () => {
    console.log(`> Fullscreen Chat App ready on http://localhost:${port}`);
    console.log(`> Mode: ${dev ? 'Development' : 'Production'}`);
  });
});
```

- [ ] **Step 2: Commit custom server**

```bash
git add chat-app/server.ts
git commit -m "feat(chat-app): add custom Node.js server with Socket.IO and Next.js integration"
```

---

### Task 6: Implement Frontend UI Components

**Files:**
- Create: `chat-app/src/components/MarkdownRenderer.tsx`
- Create: `chat-app/src/components/TypingIndicator.tsx`
- Create: `chat-app/src/components/MessageItem.tsx`
- Create: `chat-app/src/components/ChatHeader.tsx`
- Create: `chat-app/src/components/ChatInput.tsx`
- Create: `chat-app/src/components/MessageList.tsx`

**Interfaces:**
- Produces: Polished, responsive, accessible React components for the chat UI.

- [ ] **Step 1: Create `chat-app/src/components/MarkdownRenderer.tsx`**

```tsx
'use client';

import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Simple clean markdown parser for bold, italic, code blocks, lists, links
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];

    return lines.map((line, idx) => {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          inCodeBlock = false;
          const codeText = codeBlockContent.join('\n');
          codeBlockContent = [];
          return (
            <div key={idx} className="my-3 rounded-lg bg-zinc-900 p-3 text-sm text-emerald-400 overflow-x-auto font-mono">
              <pre><code>{codeText}</code></pre>
            </div>
          );
        } else {
          inCodeBlock = true;
          return null;
        }
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return null;
      }

      // Headers
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="text-base font-bold my-1 text-zinc-900 dark:text-zinc-100">{line.slice(4)}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} className="text-lg font-bold my-2 text-zinc-900 dark:text-zinc-100">{line.slice(3)}</h2>;
      }
      if (line.startsWith('# ')) {
        return <h1 key={idx} className="text-xl font-extrabold my-2 text-zinc-900 dark:text-zinc-100">{line.slice(2)}</h1>;
      }

      // Unordered list
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={idx} className="ml-4 list-disc text-zinc-800 dark:text-zinc-200">
            {formatInline(line.slice(2))}
          </li>
        );
      }

      // Regular line
      return (
        <p key={idx} className="min-h-[1.25rem] my-0.5 leading-relaxed text-zinc-800 dark:text-zinc-200">
          {formatInline(line)}
        </p>
      );
    });
  };

  const formatInline = (text: string) => {
    // Bold: **text**
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-zinc-900 dark:text-white">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={i} className="italic">{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="rounded bg-zinc-200 dark:bg-zinc-800 px-1.5 py-0.5 text-xs font-mono text-pink-600 dark:text-pink-400">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  return <div className="space-y-1 text-sm sm:text-base">{renderFormattedText(content)}</div>;
};
```

- [ ] **Step 2: Create `chat-app/src/components/TypingIndicator.tsx` and `MessageItem.tsx`**

```tsx
// chat-app/src/components/TypingIndicator.tsx
'use client';

import React from 'react';

export const TypingIndicator: React.FC<{ senderName?: string }> = ({ senderName = 'Đang gõ' }) => {
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-zinc-500 italic animate-pulse">
      <span className="font-medium">{senderName}</span>
      <div className="flex space-x-1">
        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></div>
      </div>
    </div>
  );
};
```

```tsx
// chat-app/src/components/MessageItem.tsx
'use client';

import React from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';

export interface ChatMessage {
  id?: string;
  sender: 'USER' | 'AI' | 'AGENT' | 'SYSTEM';
  senderName?: string | null;
  content: string;
  createdAt?: string | Date;
  isStreaming?: boolean;
}

export const MessageItem: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.sender === 'USER';
  const isSystem = message.sender === 'SYSTEM';
  const isAgent = message.sender === 'AGENT';

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex w-full my-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] sm:max-w-[75%] md:max-w-[65%] gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${
          isUser 
            ? 'bg-blue-600 text-white' 
            : isAgent 
            ? 'bg-emerald-600 text-white' 
            : 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white'
        }`}>
          {isUser ? '👤' : isAgent ? '🎧' : '✨'}
        </div>

        {/* Message bubble */}
        <div className="flex flex-col">
          <div className={`flex items-center gap-2 mb-1 text-xs text-zinc-400 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <span className="font-semibold">{message.senderName || (isUser ? 'Bạn' : isAgent ? 'Tư vấn viên' : 'Trợ lý AI')}</span>
            {message.createdAt && (
              <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            )}
          </div>

          <div className={`rounded-2xl px-4 py-3 shadow-sm ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-none'
              : isAgent
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-zinc-900 dark:text-zinc-100 rounded-tl-none'
              : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-tl-none'
          }`}>
            {isUser ? (
              <p className="whitespace-pre-wrap text-sm sm:text-base leading-relaxed">{message.content}</p>
            ) : (
              <div className="relative">
                <MarkdownRenderer content={message.content} />
                {message.isStreaming && (
                  <span className="inline-block w-2 h-4 ml-1 bg-indigo-500 animate-pulse align-middle" />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Create `chat-app/src/components/ChatHeader.tsx`, `ChatInput.tsx`, and `MessageList.tsx`**

```tsx
// chat-app/src/components/ChatHeader.tsx
'use client';

import React from 'react';

interface ChatHeaderProps {
  mode: 'AI' | 'HUMAN';
  onToggleMode: (newMode: 'AI' | 'HUMAN') => void;
  onNewChat: () => void;
  isConnected: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  mode,
  onToggleMode,
  onNewChat,
  isConnected,
}) => {
  return (
    <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur px-4 flex items-center justify-between flex-shrink-0 z-10">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold shadow-md">
          💬
        </div>
        <div>
          <h1 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
            Fullscreen Chat Hub
            <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} title={isConnected ? 'Connected' : 'Connecting'} />
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Mode Toggle */}
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => onToggleMode('AI')}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
              mode === 'AI'
                ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            🤖 AI Bot
          </button>
          <button
            onClick={() => onToggleMode('HUMAN')}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
              mode === 'HUMAN'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            👤 Tư vấn viên
          </button>
        </div>

        {/* New Chat */}
        <button
          onClick={onNewChat}
          className="p-1.5 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition text-xs flex items-center gap-1 font-medium px-2.5"
          title="Tạo hội thoại mới"
        >
          <span>➕</span>
          <span className="hidden sm:inline">Mới</span>
        </button>
      </div>
    </header>
  );
};
```

```tsx
// chat-app/src/components/ChatInput.tsx
'use client';

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  onTyping?: (isTyping: boolean) => void;
  isStreaming?: boolean;
  onStopStreaming?: () => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onTyping,
  isStreaming,
  onStopStreaming,
  disabled,
}) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (onTyping) {
      onTyping(true);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        onTyping(false);
      }, 1500);
    }
  };

  const handleSubmit = () => {
    if (!text.trim() || disabled || isStreaming) return;
    onSendMessage(text.trim());
    setText('');
    if (onTyping) onTyping(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="p-3 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex-shrink-0">
      <div className="max-w-4xl mx-auto flex items-end gap-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition shadow-inner">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Nhập tin nhắn... (Enter để gửi, Shift + Enter để xuống dòng)"
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-transparent px-3 py-2 text-sm sm:text-base text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none max-h-32"
        />

        {isStreaming ? (
          <button
            onClick={onStopStreaming}
            className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs flex items-center gap-1 transition shadow-sm"
          >
            ⏹ Dừng
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || disabled}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-medium transition shadow-sm"
          >
            🚀
          </button>
        )}
      </div>
    </div>
  );
};
```

```tsx
// chat-app/src/components/MessageList.tsx
'use client';

import React from 'react';
import { MessageItem, ChatMessage } from './MessageItem';
import { TypingIndicator } from './TypingIndicator';

interface MessageListProps {
  messages: ChatMessage[];
  partnerTyping?: { isTyping: boolean; senderName: string };
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  partnerTyping,
  containerRef,
}) => {
  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 bg-zinc-50/50 dark:bg-zinc-900/20"
    >
      <div className="max-w-4xl mx-auto flex flex-col justify-end min-h-full">
        {messages.map((msg, index) => (
          <MessageItem key={msg.id || index} message={msg} />
        ))}
        {partnerTyping?.isTyping && (
          <TypingIndicator senderName={partnerTyping.senderName} />
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Commit frontend UI components**

```bash
git add chat-app/src/components/
git commit -m "feat(chat-app): implement modular UI components for fullscreen chat"
```

---

### Task 7: Implement Chat Hooks (Auto-scroll & Unified Chat State)

**Files:**
- Create: `chat-app/src/hooks/useAutoScroll.ts`
- Create: `chat-app/src/hooks/useChat.ts`

**Interfaces:**
- Produces: `useAutoScroll()` for smooth scroll management.
- Produces: `useChat()` encapsulating REST fetch, Socket.IO realtime, and SSE AI stream.

- [ ] **Step 1: Create `chat-app/src/hooks/useAutoScroll.ts`**

```typescript
'use client';

import { useEffect, useRef } from 'react';

export function useAutoScroll<T>(dependencies: T[]) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = (smooth = true) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  useEffect(() => {
    scrollToBottom(true);
  }, dependencies);

  return { containerRef, scrollToBottom };
}
```

- [ ] **Step 2: Create `chat-app/src/hooks/useChat.ts`**

```typescript
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ChatMessage } from '@/components/MessageItem';

export function useChat() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [mode, setMode] = useState<'AI' | 'HUMAN'>('AI');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [partnerTyping, setPartnerTyping] = useState<{ isTyping: boolean; senderName: string }>({
    isTyping: false,
    senderName: '',
  });

  const socketRef = useRef<Socket | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize or fetch active conversation
  const loadConversation = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations');
      if (!res.ok) throw new Error('Failed to load conversation');
      const data = await res.json();
      setConversationId(data.id);
      setMode(data.mode);
      setMessages(data.messages || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Initialize socket connection
  useEffect(() => {
    const socket = io({ path: '/socket.io' });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      if (conversationId) {
        socket.emit('join_room', { conversationId, role: 'user', name: 'Khách hàng' });
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('new_message', (msg: ChatMessage) => {
      setMessages((prev) => {
        // avoid duplicate if already in state
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on('user_typing', ({ senderName, isTyping }: { senderName: string; isTyping: boolean }) => {
      setPartnerTyping({ isTyping, senderName });
    });

    return () => {
      socket.disconnect();
    };
  }, [conversationId]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  // Send message
  const sendMessage = async (text: string) => {
    if (!conversationId) return;

    if (mode === 'HUMAN') {
      // Send via Socket.IO
      socketRef.current?.emit('send_message', {
        conversationId,
        content: text,
        sender: 'USER',
        senderName: 'Bạn',
      });
    } else {
      // Send to AI Streaming endpoint
      const tempUserMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        sender: 'USER',
        senderName: 'Bạn',
        content: text,
        createdAt: new Date(),
      };

      const tempAiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'AI',
        senderName: 'Trợ lý AI',
        content: '',
        createdAt: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, tempUserMsg, tempAiMsg]);
      setIsStreaming(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await fetch('/api/chat/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, content: text }),
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) throw new Error('AI Stream request failed');

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') break;
              try {
                const parsed = JSON.parse(dataStr);
                accumulated += parsed.text;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === tempAiMsg.id ? { ...msg, content: accumulated } : msg
                  )
                );
              } catch {}
            }
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error(err);
        }
      } finally {
        setIsStreaming(false);
        setMessages((prev) =>
          prev.map((msg) => (msg.id === tempAiMsg.id ? { ...msg, isStreaming: false } : msg))
        );
      }
    }
  };

  const stopStreaming = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  };

  const toggleMode = async (newMode: 'AI' | 'HUMAN') => {
    if (!conversationId) return;
    try {
      await fetch(`/api/conversations/${conversationId}/mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });
      setMode(newMode);
      loadConversation();
    } catch (err) {
      console.error(err);
    }
  };

  const createNewChat = async () => {
    try {
      const res = await fetch('/api/conversations', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create new conversation');
      const data = await res.json();
      setConversationId(data.id);
      setMode(data.mode);
      setMessages(data.messages || []);
    } catch (err) {
      console.error(err);
    }
  };

  const emitTyping = (isTyping: boolean) => {
    if (!conversationId || mode !== 'HUMAN') return;
    if (isTyping) {
      socketRef.current?.emit('typing_start', { conversationId, senderName: 'Khách hàng' });
    } else {
      socketRef.current?.emit('typing_stop', { conversationId });
    }
  };

  return {
    conversationId,
    mode,
    messages,
    isStreaming,
    isConnected,
    partnerTyping,
    sendMessage,
    stopStreaming,
    toggleMode,
    createNewChat,
    emitTyping,
  };
}
```

- [ ] **Step 3: Commit hooks**

```bash
git add chat-app/src/hooks/
git commit -m "feat(chat-app): implement useAutoScroll and useChat state orchestration hook"
```

---

### Task 8: Assemble Fullscreen Page & App Layout

**Files:**
- Create: `chat-app/src/app/globals.css`
- Create: `chat-app/src/app/layout.tsx`
- Create: `chat-app/src/app/page.tsx`
- Modify: `package.json` (add convenience script `chat:dev`)

**Interfaces:**
- Produces: 100% Fullscreen Chat View (`http://localhost:3005`).

- [ ] **Step 1: Create `chat-app/src/app/globals.css`**

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #09090b;
    --foreground: #ededed;
  }
}

body {
  color: var(--foreground);
  background: var(--background);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  overflow: hidden;
}

/* Custom scrollbars */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(150, 150, 150, 0.3);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(150, 150, 150, 0.5);
}
```

- [ ] **Step 2: Create `chat-app/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fullscreen Chat Hub',
  description: 'AI & Realtime Support Chat Experience',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full">
      <body className="h-full w-full overflow-hidden antialiased bg-zinc-50 dark:bg-zinc-950">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Create `chat-app/src/app/page.tsx`**

```tsx
'use client';

import React from 'react';
import { useChat } from '@/hooks/useChat';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { ChatHeader } from '@/components/ChatHeader';
import { MessageList } from '@/components/MessageList';
import { ChatInput } from '@/components/ChatInput';

export default function FullscreenChatPage() {
  const {
    mode,
    messages,
    isStreaming,
    isConnected,
    partnerTyping,
    sendMessage,
    stopStreaming,
    toggleMode,
    createNewChat,
    emitTyping,
  } = useChat();

  const { containerRef } = useAutoScroll([messages, isStreaming, partnerTyping.isTyping]);

  return (
    <main className="h-screen w-screen flex flex-col overflow-hidden bg-white dark:bg-zinc-950">
      {/* Header */}
      <ChatHeader
        mode={mode}
        onToggleMode={toggleMode}
        onNewChat={createNewChat}
        isConnected={isConnected}
      />

      {/* Main Message View Area */}
      <MessageList
        messages={messages}
        partnerTyping={partnerTyping}
        containerRef={containerRef}
      />

      {/* Floating Bottom Input Bar */}
      <ChatInput
        onSendMessage={sendMessage}
        onTyping={emitTyping}
        isStreaming={isStreaming}
        onStopStreaming={stopStreaming}
      />
    </main>
  );
}
```

- [ ] **Step 4: Add convenience script to root `package.json`**

Modify root `package.json` scripts to add:
`"dev:chat": "npm --prefix chat-app run dev"`

- [ ] **Step 5: Commit page and root integration**

```bash
git add chat-app/src/app/ package.json
git commit -m "feat(chat-app): build fullscreen chat view and add dev:chat runner"
```

---

### Task 9: Verification & Typecheck

**Files:**
- Test all components and servers locally in `chat-app/`.

- [ ] **Step 1: Run typecheck in `chat-app/`**

Run: `npm --prefix chat-app run typecheck`
Expected: 0 errors.

- [ ] **Step 2: Run Next.js build verification**

Run: `npm --prefix chat-app run build`
Expected: Static & dynamic routes compiled successfully.

- [ ] **Step 3: Commit final verification adjustments (if any)**

```bash
git add .
git commit -m "chore(chat-app): complete standalone fullscreen chat application setup"
```
