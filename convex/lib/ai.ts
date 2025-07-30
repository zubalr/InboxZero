import { CoreMessage, streamObject, streamText } from 'ai';
import { createCerebras } from '@ai-sdk/cerebras';
import { z } from 'zod';

const cerebras = createCerebras({
  apiKey: process.env.CEREBRAS_API_KEY,
});

const DEFAULT_MODEL = 'llama3.1-8b';

export async function generateObject<S extends z.ZodObject<any>>(args: {
  prompt: string | CoreMessage[];
  schema: S;
  model?: string;
}): Promise<z.infer<S>> {
  const { prompt, schema, model = DEFAULT_MODEL } = args;

  const messages: CoreMessage[] = Array.isArray(prompt)
    ? prompt
    : [{ role: 'user', content: prompt }];

  const { partialObjectStream } = await streamObject({
    model: cerebras(model),
    system:
      'You are a helpful assistant that extracts structured data from the user prompt.',
    messages,
    schema,
  });

  let finalObject: any = {};
  for await (const partial of partialObjectStream) {
    finalObject = partial;
  }

  return finalObject;
}

export async function generateText(args: {
  prompt: string | CoreMessage[];
  system?: string;
  model?: string;
}): Promise<string> {
  const { prompt, system, model = DEFAULT_MODEL } = args;

  const messages: CoreMessage[] = Array.isArray(prompt)
    ? prompt
    : [{ role: 'user', content: prompt }];

  const { textStream } = await streamText({
    model: cerebras(model),
    system: system || 'You are a helpful assistant.',
    messages,
  });

  let finalText = '';
  for await (const chunk of textStream) {
    finalText += chunk;
  }

  return finalText;
}
