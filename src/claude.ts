import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

export async function generate(
  prompt: string,
  options: {
    system?: string;
    model?: string;
    maxTokens?: number;
  } = {}
): Promise<string> {
  const anthropic = getClient();
  const model = options.model || 'claude-sonnet-4-5';
  const maxTokens = options.maxTokens || 8192;

  const stream = anthropic.messages.stream({
    model,
    max_tokens: maxTokens,
    system: options.system || 'You are an expert educational content creator.',
    messages: [{ role: 'user', content: prompt }],
  });

  const response = await stream.finalMessage();
  const textBlock = response.content.find(b => b.type === 'text');
  return textBlock?.text ?? '';
}

export async function generateParallel(
  prompts: { prompt: string; system?: string }[],
  options: { model?: string; maxTokens?: number } = {}
): Promise<string[]> {
  const results = await Promise.all(
    prompts.map(p =>
      generate(p.prompt, {
        system: p.system,
        model: options.model,
        maxTokens: options.maxTokens,
      })
    )
  );
  return results;
}
