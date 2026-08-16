import { env } from '../../config/env.js';
import type {
  AIProvider,
  AIProviderMessage,
  AIProviderTurn,
  AIProviderTurnInput,
  AIToolCall,
} from './chat.ai.js';

type OpenAIMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string | null; tool_calls?: OpenAIToolCall[] }
  | { role: 'tool'; tool_call_id: string; name?: string; content: string };

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIChoice {
  message?: {
    content?: string | null;
    tool_calls?: OpenAIToolCall[];
  };
  delta?: {
    content?: string;
    tool_calls?: OpenAIToolCall[];
  };
}

interface OpenAIResponse {
  choices?: OpenAIChoice[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toJsonText(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: 'UNSERIALIZABLE_TOOL_RESPONSE' });
  }
}

function toolCallToOpenAI(call: AIToolCall, index: number): OpenAIToolCall {
  return {
    id: call.id ?? `call_${index}`,
    type: 'function',
    function: {
      name: call.name,
      arguments: toJsonText(call.args),
    },
  };
}

function toOpenAIMessage(message: AIProviderMessage): OpenAIMessage[] {
  if ('text' in message) {
    return [
      {
        role: message.role === 'model' ? 'assistant' : 'user',
        content: message.text,
      },
    ];
  }

  if ('toolCalls' in message) {
    return [
      {
        role: 'assistant',
        content: null,
        tool_calls: message.toolCalls.map(toolCallToOpenAI),
      },
    ];
  }

  return message.toolResponses.map((toolResponse) => ({
    role: 'tool',
    tool_call_id: toolResponse.id ?? toolResponse.name,
    name: toolResponse.name,
    content: toJsonText(toolResponse.response),
  }));
}

function parseToolArguments(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function parseTurn(response: OpenAIResponse): AIProviderTurn {
  const message = response.choices?.[0]?.message;
  const text = typeof message?.content === 'string' ? message.content : undefined;
  const toolCalls = message?.tool_calls?.map((call) => ({
    id: call.id,
    name: call.function.name,
    args: parseToolArguments(call.function.arguments),
  }));
  return { text, toolCalls };
}

function mergeDeltaToolCalls(existing: Map<number, OpenAIToolCall>, next: unknown) {
  if (!Array.isArray(next)) return;
  next.forEach((entry, index) => {
    if (!isRecord(entry)) return;
    const rawIndex = typeof entry['index'] === 'number' ? entry['index'] : index;
    const current =
      existing.get(rawIndex) ??
      ({
        id: '',
        type: 'function',
        function: { name: '', arguments: '' },
      } satisfies OpenAIToolCall);

    if (typeof entry['id'] === 'string') current.id = entry['id'];
    const fn = entry['function'];
    if (isRecord(fn)) {
      if (typeof fn['name'] === 'string') current.function.name += fn['name'];
      if (typeof fn['arguments'] === 'string') current.function.arguments += fn['arguments'];
    }
    existing.set(rawIndex, current);
  });
}

function parseServerSentEvents(raw: string): AIProviderTurn {
  let text = '';
  const toolCalls = new Map<number, OpenAIToolCall>();

  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice('data:'.length).trim();
    if (!payload || payload === '[DONE]') continue;

    try {
      const chunk = JSON.parse(payload) as OpenAIResponse;
      const delta = chunk.choices?.[0]?.delta;
      if (typeof delta?.content === 'string') text += delta.content;
      mergeDeltaToolCalls(toolCalls, delta?.tool_calls);
    } catch {
      // Ignore malformed chunks from an upstream-compatible router and keep any valid chunks.
    }
  }

  return {
    text: text || undefined,
    toolCalls: [...toolCalls.values()].map((call) => ({
      id: call.id,
      name: call.function.name,
      args: parseToolArguments(call.function.arguments),
    })),
  };
}

async function parseResponseBody(response: Response): Promise<AIProviderTurn> {
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Custom AI provider failed (${response.status}): ${raw.slice(0, 500)}`);
  }
  if (raw.trimStart().startsWith('data:')) return parseServerSentEvents(raw);
  return parseTurn(JSON.parse(raw) as OpenAIResponse);
}

export class OpenAICompatibleAIProvider implements AIProvider {
  constructor(
    private readonly baseUrl = env.CUSTOM_AI_BASE_URL,
    private readonly model = env.CUSTOM_AI_MODEL,
    private readonly apiKey = env.CUSTOM_AI_API_KEY,
  ) {}

  async generateTurn(input: AIProviderTurnInput): Promise<AIProviderTurn> {
    const messages: OpenAIMessage[] = [
      { role: 'system', content: input.systemInstruction },
      ...input.messages.flatMap(toOpenAIMessage),
    ];

    const response = await fetch(`${this.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      signal: input.abortSignal,
      headers: {
        'content-type': 'application/json',
        ...(this.apiKey.trim() === '' ? {} : { authorization: `Bearer ${this.apiKey}` }),
      },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        messages,
        tools: input.tools.map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parametersJsonSchema,
          },
        })),
        tool_choice: 'auto',
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 1800,
      }),
    });

    return parseResponseBody(response);
  }
}
