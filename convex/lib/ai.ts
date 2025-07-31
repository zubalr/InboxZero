import {
  ModelMessage,
  generateObject as aiGenerateObject,
  generateText as aiGenerateText,
  streamObject,
  streamText,
  NoObjectGeneratedError,
} from 'ai';
import { createCerebras } from '@ai-sdk/cerebras';
import { z } from 'zod';

// Configure Cerebras provider with optimal settings
const cerebras = createCerebras({
  apiKey: process.env.CEREBRAS_API_KEY,
  baseURL: process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1',
});

// Default model with high performance and good capabilities
const DEFAULT_MODEL = 'llama3.1-8b';

// Available models with their capabilities
export const CEREBRAS_MODELS = {
  'llama3.1-8b': {
    contextWindow: 8192,
    capabilities: ['text', 'object', 'tool'],
    description: 'Fast and efficient for most tasks',
  },
  'llama3.1-70b': {
    contextWindow: 8192,
    capabilities: ['text', 'object', 'tool'],
    description: 'Higher quality for complex reasoning',
  },
  'llama-3.3-70b': {
    contextWindow: 8192,
    capabilities: ['text', 'object', 'tool'],
    description: 'Latest model with improved performance',
  },
} as const;

export type CerebrasModel = keyof typeof CEREBRAS_MODELS;

// Enhanced configuration interface
interface AIConfig {
  model?: CerebrasModel;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  system?: string;
  maxRetries?: number;
  timeout?: number;
}

// Usage tracking interface compatible with AI SDK v5
interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// Enhanced result interface
interface AIResult<T = any> {
  data: T;
  usage?: UsageInfo;
  model: string;
  finishReason?: string;
  warnings?: string[];
}

/**
 * Convert AI SDK v5 usage to our format
 */
function convertUsage(usage: any): UsageInfo | undefined {
  if (!usage) return undefined;

  return {
    promptTokens: usage.promptTokens ?? 0,
    completionTokens: usage.completionTokens ?? 0,
    totalTokens:
      usage.totalTokens ??
      (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0),
  };
}

/**
 * Convert AI SDK v5 warnings to string array
 */
function convertWarnings(warnings: any[]): string[] {
  if (!warnings) return [];
  return warnings.map((w) =>
    typeof w === 'string' ? w : w.type || 'Unknown warning'
  );
}

// Enhanced result interface
interface AIResult<T = any> {
  data: T;
  usage?: UsageInfo;
  model: string;
  finishReason?: string;
  warnings?: string[];
}

/**
 * Generate structured object using AI SDK v5 with comprehensive error handling
 * Note: Cerebras models use generateText with JSON mode for structured outputs
 * @param args Configuration for object generation
 * @returns Promise resolving to typed object with metadata
 */
export async function generateObject<S extends z.ZodObject<any>>(args: {
  prompt: string | ModelMessage[];
  schema: S;
  schemaName?: string;
  schemaDescription?: string;
  config?: AIConfig;
}): Promise<AIResult<z.infer<S>>> {
  const { prompt, schema, schemaName, schemaDescription, config = {} } = args;

  const {
    model = DEFAULT_MODEL,
    temperature = 0.1, // Low temperature for structured data
    topP = 0.95,
    system = 'You are a precise assistant that extracts structured data from user input. Follow the schema exactly and provide accurate information.',
    maxRetries = 3,
    timeout = 30000,
  } = config;

  const messages: ModelMessage[] = Array.isArray(prompt)
    ? prompt
    : [{ role: 'user', content: prompt }];

  // Create a detailed system prompt that includes the schema
  const schemaInstructions = `
    You must respond with valid JSON that matches this exact schema:
    ${JSON.stringify(schema.shape, null, 2)}
    
    ${schemaName ? `Schema name: ${schemaName}` : ''}
    ${schemaDescription ? `Schema description: ${schemaDescription}` : ''}
    
    Important:
    - Respond ONLY with valid JSON
    - Include all required fields
    - Follow the exact data types specified
    - Do not include any explanatory text outside the JSON
  `;

  const enhancedSystem = `${system}\n\n${schemaInstructions}`;

  let lastError: Error | null = null;

  // Retry logic with exponential backoff
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();

      const result = await Promise.race([
        aiGenerateText({
          model: cerebras(model),
          system: enhancedSystem,
          messages,
          temperature,
          topP,
          frequencyPenalty: config.frequencyPenalty,
          presencePenalty: config.presencePenalty,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        ),
      ]);

      // Parse and validate the JSON response
      let parsedObject: any;
      try {
        parsedObject = JSON.parse(result.text.trim());
      } catch (parseError) {
        throw new Error(`Failed to parse JSON response: ${parseError}`);
      }

      // Validate against schema
      const validatedObject = schema.parse(parsedObject);

      // Success - log and return
      console.log(`[AI] Object generated successfully:`, {
        model,
        attempt,
        duration: Date.now() - startTime,
        usage: result.usage,
        finishReason: result.finishReason,
      });

      return {
        data: validatedObject as z.infer<S>,
        usage: convertUsage(result.usage),
        model,
        finishReason: result.finishReason,
        warnings: convertWarnings(result.warnings || []),
      };
    } catch (error) {
      lastError = error as Error;

      // Log the error
      console.error(
        `[AI] Object generation failed (attempt ${attempt}/${maxRetries}):`,
        {
          error: error instanceof Error ? error.message : String(error),
          model,
          prompt:
            typeof prompt === 'string'
              ? prompt.slice(0, 100)
              : `${messages.length} messages`,
          attempt,
        }
      );

      // Don't retry on certain errors
      if (
        error instanceof Error &&
        (error.message.includes('401') ||
          error.message.includes('403') ||
          error.message.includes('Invalid API key'))
      ) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  throw new Error(
    `Failed to generate object after ${maxRetries} attempts. Last error: ${lastError?.message}`
  );
}

/**
 * Generate text using AI SDK v5 with comprehensive error handling
 * @param args Configuration for text generation
 * @returns Promise resolving to generated text with metadata
 */
export async function generateText(args: {
  prompt: string | ModelMessage[];
  system?: string;
  config?: AIConfig;
}): Promise<AIResult<string>> {
  const { prompt, system, config = {} } = args;

  const {
    model = DEFAULT_MODEL,
    temperature = 0.3, // Slightly higher for creative text
    topP = 0.95,
    maxRetries = 3,
    timeout = 45000, // Longer timeout for text generation
  } = config;

  const messages: ModelMessage[] = Array.isArray(prompt)
    ? prompt
    : [{ role: 'user', content: prompt }];

  let lastError: Error | null = null;

  // Retry logic with exponential backoff
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();

      const result = await Promise.race([
        aiGenerateText({
          model: cerebras(model),
          system:
            system || 'You are a helpful, precise, and concise assistant.',
          messages,
          temperature,
          topP,
          frequencyPenalty: config.frequencyPenalty,
          presencePenalty: config.presencePenalty,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout)
        ),
      ]);

      // Success - log and return
      console.log(`[AI] Text generated successfully:`, {
        model,
        attempt,
        duration: Date.now() - startTime,
        usage: result.usage,
        finishReason: result.finishReason,
        textLength: result.text.length,
      });

      return {
        data: result.text,
        usage: convertUsage(result.usage),
        model,
        finishReason: result.finishReason,
        warnings: convertWarnings(result.warnings || []),
      };
    } catch (error) {
      lastError = error as Error;

      // Log the error
      console.error(
        `[AI] Text generation failed (attempt ${attempt}/${maxRetries}):`,
        {
          error: error instanceof Error ? error.message : String(error),
          model,
          prompt:
            typeof prompt === 'string'
              ? prompt.slice(0, 100)
              : `${messages.length} messages`,
          attempt,
        }
      );

      // Don't retry on certain errors
      if (
        error instanceof Error &&
        (error.message.includes('401') ||
          error.message.includes('403') ||
          error.message.includes('Invalid API key'))
      ) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  throw new Error(
    `Failed to generate text after ${maxRetries} attempts. Last error: ${lastError?.message}`
  );
}

/**
 * Stream object generation using AI SDK v5 for real-time updates
 * Note: Cerebras models use streamText with JSON parsing for structured outputs
 * @param args Configuration for streaming object generation
 * @returns Object with streaming capabilities and promises
 */
export async function streamObjectGeneration<S extends z.ZodObject<any>>(args: {
  prompt: string | ModelMessage[];
  schema: S;
  schemaName?: string;
  schemaDescription?: string;
  config?: AIConfig;
  onProgress?: (partial: Partial<z.infer<S>>) => void;
  onError?: (error: Error) => void;
}) {
  const {
    prompt,
    schema,
    schemaName,
    schemaDescription,
    config = {},
    onProgress,
    onError,
  } = args;

  const {
    model = DEFAULT_MODEL,
    temperature = 0.1,
    topP = 0.95,
    system = 'You are a precise assistant that extracts structured data from user input. Follow the schema exactly and provide accurate information.',
  } = config;

  const messages: ModelMessage[] = Array.isArray(prompt)
    ? prompt
    : [{ role: 'user', content: prompt }];

  // Create schema instructions similar to generateObject
  const schemaInstructions = `
    You must respond with valid JSON that matches this exact schema:
    ${JSON.stringify(schema.shape, null, 2)}
    
    ${schemaName ? `Schema name: ${schemaName}` : ''}
    ${schemaDescription ? `Schema description: ${schemaDescription}` : ''}
    
    Important:
    - Respond ONLY with valid JSON
    - Include all required fields
    - Follow the exact data types specified
    - Do not include any explanatory text outside the JSON
  `;

  const enhancedSystem = `${system}\n\n${schemaInstructions}`;

  const startTime = Date.now();

  const result = streamText({
    model: cerebras(model),
    system: enhancedSystem,
    messages,
    temperature,
    topP,
    frequencyPenalty: config.frequencyPenalty,
    presencePenalty: config.presencePenalty,
    onChunk: ({ chunk }) => {
      if (chunk.type === 'text-delta' && onProgress) {
        // Try to parse partial JSON for progress updates
        try {
          const currentText = chunk.text;
          if (currentText.trim().startsWith('{')) {
            const partialObject = JSON.parse(currentText);
            onProgress(partialObject as Partial<z.infer<S>>);
          }
        } catch {
          // Ignore parsing errors for partial content
        }
      }
    },
    onFinish: ({ text, usage, finishReason }) => {
      console.log(`[AI] Stream object completed:`, {
        model,
        duration: Date.now() - startTime,
        usage,
        finishReason,
        textLength: text.length,
      });
    },
  });

  // Create a promise for the final parsed object
  const objectPromise = result.text.then((text) => {
    try {
      const parsedObject = JSON.parse(text.trim());
      return schema.parse(parsedObject) as z.infer<S>;
    } catch (error) {
      const parseError = new Error(
        `Failed to parse or validate final object: ${error}`
      );
      onError?.(parseError);
      throw parseError;
    }
  });

  return {
    // For compatibility with the original interface, create a mock partialObjectStream
    partialObjectStream: (async function* () {
      try {
        const finalObject = await objectPromise;
        yield finalObject;
      } catch (error) {
        console.error('[AI] Error in partial object stream:', error);
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    })(),
    object: objectPromise,
    usage: result.usage,
    finishReason: result.finishReason,
    warnings: result.warnings,
  };
}

/**
 * Stream text generation using AI SDK v5 for real-time updates
 * @param args Configuration for streaming text generation
 * @returns Object with streaming capabilities and promises
 */
export async function streamTextGeneration(args: {
  prompt: string | ModelMessage[];
  system?: string;
  config?: AIConfig;
  onProgress?: (text: string) => void;
  onError?: (error: Error) => void;
}) {
  const { prompt, system, config = {}, onProgress, onError } = args;

  const { model = DEFAULT_MODEL, temperature = 0.3, topP = 0.95 } = config;

  const messages: ModelMessage[] = Array.isArray(prompt)
    ? prompt
    : [{ role: 'user', content: prompt }];

  const startTime = Date.now();

  const result = streamText({
    model: cerebras(model),
    system: system || 'You are a helpful, precise, and concise assistant.',
    messages,
    temperature,
    topP,
    frequencyPenalty: config.frequencyPenalty,
    presencePenalty: config.presencePenalty,
    onChunk: ({ chunk }) => {
      if (chunk.type === 'text-delta' && onProgress) {
        onProgress(chunk.text);
      }
    },
    onFinish: ({ text, usage, finishReason }) => {
      console.log(`[AI] Stream text completed:`, {
        model,
        duration: Date.now() - startTime,
        usage,
        finishReason,
        textLength: text.length,
      });
    },
  });

  return {
    textStream: result.textStream,
    fullStream: result.fullStream,
    text: result.text,
    usage: result.usage,
    finishReason: result.finishReason,
    warnings: result.warnings,
  };
}

/**
 * Utility function to validate model compatibility
 * @param model Model to validate
 * @param capability Required capability
 * @returns Whether the model supports the capability
 */
export function validateModelCapability(
  model: CerebrasModel,
  capability: 'text' | 'object' | 'tool'
): boolean {
  const modelInfo = CEREBRAS_MODELS[model];
  return modelInfo?.capabilities.includes(capability) ?? false;
}

/**
 * Get estimated token count for a prompt (rough estimation)
 * @param text Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokenCount(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Check if prompt fits within model context window
 * @param prompt Prompt to check
 * @param model Model to check against
 * @param reservedTokens Tokens to reserve for output
 * @returns Whether prompt fits in context
 */
export function validateContextWindow(
  prompt: string | ModelMessage[],
  model: CerebrasModel = DEFAULT_MODEL,
  reservedTokens: number = 1000
): { fits: boolean; estimatedTokens: number; maxTokens: number } {
  const text =
    typeof prompt === 'string'
      ? prompt
      : prompt.map((m) => m.content).join(' ');

  const estimatedTokens = estimateTokenCount(text);
  const modelInfo = CEREBRAS_MODELS[model];
  const maxTokens = modelInfo?.contextWindow ?? 8192;
  const fits = estimatedTokens + reservedTokens <= maxTokens;

  return { fits, estimatedTokens, maxTokens };
}

// Export common schemas for reuse
export const commonSchemas = {
  sentiment: z.object({
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    confidence: z.number().min(0).max(1),
    reasoning: z.string().optional(),
  }),

  classification: z.object({
    category: z.string(),
    confidence: z.number().min(0).max(1),
    subcategory: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),

  summary: z.object({
    summary: z.string(),
    keyPoints: z.array(z.string()),
    wordCount: z.number(),
    originalLength: z.number(),
  }),

  extraction: z.object({
    entities: z.array(
      z.object({
        text: z.string(),
        type: z.string(),
        confidence: z.number().min(0).max(1),
      })
    ),
    keywords: z.array(z.string()),
    topics: z.array(z.string()),
  }),
} as const;
