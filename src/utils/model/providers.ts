import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '../../services/analytics/index.js'
import { getInitialSettings } from '../settings/settings.js'
import type { ModelProviders } from '../settings/types.js'
import { isCustomModel } from './model.js'
import { isEnvTruthy } from '../envUtils.js'

export type APIProvider =
  | 'firstParty'
  | 'bedrock'
  | 'vertex'
  | 'foundry'
  | 'openai'
  | 'gemini'
  | 'grok'

function getCustomModelProvider(model?: string): { provider: APIProvider; useAnthropicClient: boolean } | undefined {
  if (!model || !isCustomModel(model)) return undefined
  const settings = getInitialSettings()
  const modelProviders = settings.modelProviders as ModelProviders | undefined
  if (!modelProviders) return undefined

  const customId = model.slice(7)
  for (const [providerKey, models] of Object.entries(modelProviders)) {
    if (models.some(m => m.id === customId)) {
      // For anthropic custom models, we still use Anthropic SDK (firstParty code path)
      // but with custom baseUrl from the model config
      if (providerKey === 'anthropic') {
        return { provider: 'firstParty', useAnthropicClient: true }
      }
      return { provider: providerKey as APIProvider, useAnthropicClient: false }
    }
  }
  return undefined
}

export function getAPIProvider(model?: string): APIProvider {
  const customModelInfo = getCustomModelProvider(model)
  if (customModelInfo) return customModelInfo.provider

  const modelType = getInitialSettings().modelType
  if (modelType === 'openai') return 'openai'
  if (modelType === 'gemini') return 'gemini'
  if (modelType === 'grok') return 'grok'

  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_BEDROCK)) return 'bedrock'
  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_VERTEX)) return 'vertex'
  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_FOUNDRY)) return 'foundry'

  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_OPENAI)) return 'openai'
  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_GEMINI)) return 'gemini'
  if (isEnvTruthy(process.env.CLAUDE_CODE_USE_GROK)) return 'grok'

  return 'firstParty'
}

export function getAPIProviderForStatsig(model?: string): AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS {
  return getAPIProvider(model) as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
}

/**
 * Check if ANTHROPIC_BASE_URL is a first-party Anthropic API URL.
 * Returns true if not set (default API) or points to api.anthropic.com
 * (or api-staging.anthropic.com for ant users).
 */
export function isFirstPartyAnthropicBaseUrl(): boolean {
  const baseUrl = process.env.ANTHROPIC_BASE_URL
  if (!baseUrl) {
    return true
  }
  try {
    const host = new URL(baseUrl).host
    const allowedHosts = ['api.anthropic.com']
    if (process.env.USER_TYPE === 'ant') {
      allowedHosts.push('api-staging.anthropic.com')
    }
    return allowedHosts.includes(host)
  } catch {
    return false
  }
}
