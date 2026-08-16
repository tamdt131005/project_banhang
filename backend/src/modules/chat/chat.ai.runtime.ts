import { env } from '../../config/env.js';
import type { AIOrchestrator, AIProvider } from './chat.ai.js';
import { OpenAICompatibleAIProvider } from './chat.ai.openai-compatible.js';
import { ChatAIOrchestrator } from './chat.ai.orchestrator.js';
import { DefaultAIToolRegistry } from './chat.ai.tools.js';

let providerOverride: AIProvider | null = null;
let orchestratorOverride: AIOrchestrator | null = null;
let orchestrator: AIOrchestrator | null = null;
const pendingRuns = new Set<Promise<void>>();

function createDefaultOrchestrator() {
  return new ChatAIOrchestrator(new OpenAICompatibleAIProvider(), new DefaultAIToolRegistry());
}

function getOrchestrator() {
  if (orchestratorOverride) return orchestratorOverride;
  if (providerOverride) return new ChatAIOrchestrator(providerOverride, new DefaultAIToolRegistry());
  orchestrator ??= createDefaultOrchestrator();
  return orchestrator;
}

export function isAIChatReady() {
  return providerOverride !== null || orchestratorOverride !== null || env.AI_CHAT_ENABLED;
}

export function queueAIResponse(input: {
  conversationId: number;
  userId: number;
  runId: string;
  triggerMessageId: number;
}) {
  const run = getOrchestrator()
    .respond(input)
    .catch((error) => {
      if (process.env['NODE_ENV'] !== 'test') console.error('[chat-ai-runtime]', error);
    })
    .finally(() => {
      pendingRuns.delete(run);
    });
  pendingRuns.add(run);
}

export async function drainAIResponsesForTests() {
  await Promise.all([...pendingRuns]);
}

export function setAIProviderForTests(provider: AIProvider | null) {
  providerOverride = provider;
  orchestratorOverride = null;
  orchestrator = null;
}

export function setAIOrchestratorForTests(next: AIOrchestrator | null) {
  orchestratorOverride = next;
  providerOverride = null;
  orchestrator = null;
}
