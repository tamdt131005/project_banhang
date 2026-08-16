export interface AIMatchingVariant {
  id: number;
  size: string;
  color: string;
  available: boolean;
}

export interface AIProductCard {
  id: number;
  name: string;
  slug: string;
  price: number;
  stock: number;
  category: { id: number; name: string; slug: string };
  image: { url: string; thumbUrl: string } | null;
  matchingVariants: AIMatchingVariant[];
}

export interface AIChatResult {
  message: string;
  products: AIProductCard[];
  suggestions: string[];
  handoffRecommended: boolean;
}

export interface AIToolCall {
  id?: string;
  name: string;
  args: unknown;
}

export interface AIToolResponse {
  id?: string;
  name: string;
  response: Record<string, unknown>;
}

export type AIProviderMessage =
  | { role: 'user' | 'model'; text: string }
  | { role: 'model'; toolCalls: AIToolCall[] }
  | { role: 'user'; toolResponses: AIToolResponse[] };

export interface AIToolDeclaration {
  name: string;
  description: string;
  parametersJsonSchema: unknown;
}

export interface AIProviderTurnInput {
  systemInstruction: string;
  messages: AIProviderMessage[];
  tools: AIToolDeclaration[];
  responseJsonSchema: unknown;
  abortSignal: AbortSignal;
}

export interface AIProviderTurn {
  text?: string;
  toolCalls?: AIToolCall[];
}

export interface AIProvider {
  generateTurn(input: AIProviderTurnInput): Promise<AIProviderTurn>;
}

export interface AIToolContext {
  conversationId: number;
  userId: number;
  runId: string;
}

export interface AIToolExecutionResult {
  response: Record<string, unknown>;
  products?: AIProductCard[];
  handoffRequested?: boolean;
}

export interface AIChatTool {
  readonly declaration: AIToolDeclaration;
  execute(context: AIToolContext, args: unknown): Promise<AIToolExecutionResult>;
}

export interface AIToolRegistry {
  declarations(): AIToolDeclaration[];
  execute(
    context: AIToolContext,
    call: AIToolCall,
  ): Promise<AIToolExecutionResult & { name: string; id?: string }>;
}

export interface AIOrchestrator {
  respond(input: {
    conversationId: number;
    userId: number;
    runId: string;
    triggerMessageId: number;
  }): Promise<void>;
}
