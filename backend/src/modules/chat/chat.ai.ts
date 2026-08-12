/** Future AI boundary. V1 intentionally provides contracts only and registers no provider or tool. */
export interface AIProvider {
  generate(input: { conversationId: number; userId: number; prompt: string }): Promise<{
    content: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface AIChatTool {
  readonly name: string;
  execute(input: unknown): Promise<unknown>;
}

export interface AIToolRegistry {
  get(name: string): AIChatTool | undefined;
}

export interface AIOrchestrator {
  respond(input: { conversationId: number; userId: number; content: string }): Promise<void>;
}
