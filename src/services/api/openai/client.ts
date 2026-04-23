import OpenAI from 'openai'
import { getCustomModelConfig, isCustomModel, getCustomModelId } from 'src/utils/model/model.js'
import { getInitialSettings } from 'src/utils/settings/settings.js'
import type { ModelProviders } from 'src/utils/settings/types.js'
import { getProxyFetchOptions } from 'src/utils/proxy.js'
import { isEnvTruthy } from 'src/utils/envUtils.js'

/**
 * Environment variables:
 *
 * OPENAI_API_KEY: Required. API key for the OpenAI-compatible endpoint.
 * OPENAI_BASE_URL: Recommended. Base URL for the endpoint (e.g. http://localhost:11434/v1).
 * OPENAI_ORG_ID: Optional. Organization ID.
 * OPENAI_PROJECT_ID: Optional. Project ID.
 */

let cachedClient: OpenAI | null = null

function getCustomProviderConfig(model?: string): {
  apiKey?: string
  baseURL?: string
  timeout?: number
  maxRetries?: number
  customHeaders?: Record<string, string>
} | null {
  if (!model || !isCustomModel(model)) return null
  const config = getCustomModelConfig(model)
  if (!config) return null
  return {
    apiKey: config.envKey ? process.env[config.envKey] : undefined,
    baseURL: config.baseUrl,
    timeout: config.generationConfig?.timeout,
    maxRetries: config.generationConfig?.maxRetries,
    customHeaders: config.generationConfig?.customHeaders,
  }
}

export function getOpenAIClient(options?: {
  maxRetries?: number
  fetchOverride?: typeof fetch
  source?: string
  model?: string
}): OpenAI {
  const customConfig = options?.model ? getCustomProviderConfig(options.model) : null

  const apiKey = customConfig?.apiKey || process.env.OPENAI_API_KEY || ''
  const baseURL = customConfig?.baseURL || process.env.OPENAI_BASE_URL

  const client = new OpenAI({
    apiKey,
    ...(baseURL && { baseURL }),
    maxRetries: customConfig?.maxRetries ?? options?.maxRetries ?? 0,
    timeout: customConfig?.timeout ?? parseInt(process.env.API_TIMEOUT_MS || String(600 * 1000), 10),
    dangerouslyAllowBrowser: true,
    ...(process.env.OPENAI_ORG_ID && { organization: process.env.OPENAI_ORG_ID }),
    ...(process.env.OPENAI_PROJECT_ID && { project: process.env.OPENAI_PROJECT_ID }),
    ...(customConfig?.customHeaders && { defaultHeaders: customConfig.customHeaders }),
    fetchOptions: getProxyFetchOptions({ forAnthropicAPI: false }),
    ...(options?.fetchOverride && { fetch: options.fetchOverride }),
  })

  if (!options?.fetchOverride && !customConfig) {
    cachedClient = client
  }

  return client
}

/** Clear the cached client (useful when env vars change). */
export function clearOpenAIClientCache(): void {
  cachedClient = null
}
