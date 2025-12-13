/**
 * Model-specific context window limits (in tokens)
 */
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
    // OpenAI
    'gpt-4': 8192,
    'gpt-4-turbo': 128000,
    'gpt-4o': 128000,
    'gpt-3.5-turbo': 16385,

    // Anthropic
    'claude-3-5-sonnet-20241022': 200000,
    'claude-3-opus-20240229': 200000,
    'claude-3-sonnet-20240229': 200000,
    'claude-3-haiku-20240307': 200000,

    // Ollama (defaults)
    'llama3': 8192,
    'llama2': 4096,
    'mistral': 8192,
    'codellama': 16384,
    'mixtral': 32768,
};

/**
 * Get context limit for a given model
 * @param model Model name
 * @returns Token limit (defaults to 8192 if unknown)
 */
export function getModelContextLimit(model: string): number {
    return MODEL_CONTEXT_LIMITS[model] || 8192;
}
