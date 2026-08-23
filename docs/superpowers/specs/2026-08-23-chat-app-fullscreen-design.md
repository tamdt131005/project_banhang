# Design Spec: Standalone Next.js Fullscreen Chat Application (`chat-app`)

**Status:** Approved  
**Date:** 2026-08-23  
**Target Folder:** `chat-app/`  

---

## 1. Overview & Goals
The goal is to build an independent, standalone fullstack chat application located in a dedicated folder `chat-app/`. It features a distraction-free, 100% fullscreen chat interface (no outer e-commerce menus/sidebars), powered by **Next.js (App Router)** with a custom Node.js HTTP server integrating **Socket.IO** and **Prisma ORM**.

The app supports a **Hybrid Chat Model**:
1. **AI Assistant Mode (Default):** Fast streaming AI responses (SSE / Text Stream) with full Markdown support, code block highlighting, and typing cursor. Includes smart fallback mock responses if no API key is provided.
2. **Human Support Mode (Realtime 2-way):** Realtime WebSocket communication via Socket.IO for customer support interactions with typing indicators and instant message delivery.

---

## 2. System Architecture

```
+-----------------------------------------------------------------------------------+
|                                 Next.js Frontend                                  |
|  - Fullscreen Viewport (100dvh)                                                   |
|  - ChatHeader (Mode Switcher: AI / Human Support, Connection Status, New Chat)    |
|  - MessageList (Auto-scroll, Markdown, Code syntax highlight, Copy code)         |
|  - ChatInput (Auto-expanding textarea, Enter to send, Stop AI generation button) |
+----------------------------------------+------------------------------------------+
                                         |
                       +-----------------+-----------------+
                       | REST / SSE Stream                 | Socket.IO WebSockets
                       v                                   v
+-----------------------------------------------------------------------------------+
|                        Next.js Custom Server (`server.ts`)                        |
|  - HTTP Request Handler (Next.js App Router API Routes)                          |
|  - Socket.IO Server Instance (Rooms, Typing events, Broadcasts)                   |
|  - AI Orchestrator (OpenAI / Claude / Gemini / Smart Mock Fallback)              |
|  - Prisma ORM Data Layer (MySQL / MariaDB / PostgreSQL / SQLite)                 |
+-----------------------------------------------------------------------------------+
```

---

## 3. Directory Structure

```
chat-app/
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── .env.example
├── server.ts                       # Custom Node HTTP Server + Socket.IO + Next.js
├── prisma/
│   └── schema.prisma               # Prisma Schema for Conversation & Message models
└── src/
    ├── app/
    │   ├── layout.tsx              # Base HTML layout, Fonts, Theme
    │   ├── page.tsx                # Main and only page: Fullscreen Chat UI
    │   ├── globals.css             # Tailwind styling and custom scrollbars
    │   └── api/
    │       ├── chat/ai/route.ts    # AI Stream Endpoint (SSE/ReadableStream)
    │       └── conversations/
    │           ├── route.ts        # GET all or POST new conversation
    │           └── [id]/
    │               ├── route.ts    # GET conversation history
    │               └── mode/route.ts # POST switch mode (AI <-> HUMAN)
    ├── components/
    │   ├── ChatHeader.tsx          # Top bar with title, status, mode toggle, new chat
    │   ├── MessageList.tsx         # Message history container with auto-scroll management
    │   ├── MessageItem.tsx         # Chat bubble with avatar, timestamp, markdown & code render
    │   ├── ChatInput.tsx           # Text input with submit/stop buttons and keyboard shortcuts
    │   ├── TypingIndicator.tsx     # Animated dots indicator for AI / Agent typing
    │   └── MarkdownRenderer.tsx    # Markdown parser with syntax highlighting
    ├── hooks/
    │   ├── useChat.ts              # Core hook uniting messages, AI streaming, socket events
    │   └── useAutoScroll.ts        # Intelligent auto-scrolling hook
    └── lib/
        ├── prisma.ts               # Prisma client singleton
        ├── socket-server.ts        # Socket.IO event handlers and room manager
        └── ai-service.ts           # AI service supporting streaming & mock fallback
```

---

## 4. Database Schema (Prisma)

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
  id          String             @id @default(cuid())
  title       String             @default("Cuộc trò chuyện mới")
  mode        ConversationMode   @default(AI)
  status      ConversationStatus @default(ACTIVE)
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
  messages    Message[]

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

---

## 5. API & Realtime Specifications

### 5.1 REST Endpoints
- `GET /api/conversations`: Return active conversation or initialize default one.
- `GET /api/conversations/[id]`: Return conversation details with ordered messages.
- `POST /api/conversations`: Create new conversation session.
- `POST /api/conversations/[id]/mode`: Update mode (`AI` or `HUMAN`), append a system notification message.

### 5.2 AI Streaming Endpoint (`POST /api/chat/ai`)
- Request body: `{ conversationId: string, message: string }`
- Behavior:
  1. Saves `USER` message to Prisma database immediately.
  2. Initiates text stream response (via OpenAI/Anthropic SDK or built-in mock stream generator).
  3. Flushes chunks with SSE header `text/event-stream; charset=utf-8`.
  4. On stream completion, saves the generated `AI` message to the database.

### 5.3 Socket.IO Events (Human Support Mode)
- **Client -> Server:**
  - `join_room` (`{ conversationId: string, role: "user" | "agent", name?: string }`): Joins room `conversation:{id}`.
  - `send_message` (`{ conversationId: string, content: string, sender: "USER" | "AGENT", senderName?: string }`): Saves message and broadcasts.
  - `typing_start` (`{ conversationId: string, senderName: string }`): Emits typing signal to others in the room.
  - `typing_stop` (`{ conversationId: string }`): Stops typing signal.
- **Server -> Client:**
  - `new_message`: Delivers newly created message object.
  - `user_typing`: Broadcasts `{ senderName: string, isTyping: boolean }`.
  - `mode_changed`: Broadcasts `{ mode: "AI" | "HUMAN" }`.

---

## 6. UI/UX Specification

- **Fullscreen Container:** `100dvh` height, `100vw` width, flex column layout with zero window padding/margin.
- **Header (Top - 56px):**
  - Brand Logo + App Title.
  - Network Indicator (Green: connected, Orange: reconnecting, Red: offline).
  - Mode Switcher pill (`🤖 Trợ lý AI` / `👤 Tư vấn viên`).
  - Action button: `➕ Cuộc trò chuyện mới`.
- **Message Area (Center - flex-1):**
  - Messages bubble grouped by timestamp.
  - AI messages support Markdown headers, bullet lists, code blocks with "Copy" button.
  - Floating indicator "Scroll to bottom" when user scrolls up during incoming stream.
- **Input Area (Bottom):**
  - Multi-line textarea auto-growing up to 5 lines.
  - Action buttons: Send (Airplane icon) / Stop Streaming (Square stop icon).
  - Keyboard shortcut: `Enter` to send, `Shift+Enter` for newline.

---

## 7. Configuration & Environment Variables

`.env.example` file:
```env
PORT=3005
DATABASE_URL="mysql://root:@localhost:3306/projectcv"
# AI Configuration (Optional - Smart Mock will activate if left blank)
AI_PROVIDER="openai" # openai | anthropic | mock
AI_API_KEY=""
AI_MODEL="gpt-4o-mini"
```

---

## 8. Verification & Testing Criteria
1. Project scaffolds cleanly in `chat-app/` with independent dependencies.
2. `npm run dev` starts the custom server on `http://localhost:3005`.
3. Loading `http://localhost:3005` displays the fullscreen chat interface immediately.
4. Sending a message in AI mode streams response token-by-token and persists to DB.
5. Switching to Human mode connects to Socket.IO, allows sending/receiving realtime messages, and shows typing indicators.
6. Creating a new chat clears the view and initiates a new conversation session.
