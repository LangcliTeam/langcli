import {
  LANGROUTER_AUTO_CONFIG,
  DEEPSEEK_V4_FLASH_CONFIG,
  DEEPSEEK_V4_PRO_CONFIG,
  MOONSHOT_KIMI_K2_5_CONFIG,
  MINIMAX_M2_5_CONFIG,
  CLAUDE_OPUS_4_6_CONFIG,
  GLM_5_1_CONFIG,
  GPT_5_3_CODEX_CONFIG,
  MOONSHOT_KIMI_K2_6_CONFIG,
} from './configs.js'
import { getSettings_DEPRECATED } from '../settings/settings.js'
import { getGlobalConfig } from '../config.js'
import { isModelAllowed } from './modelAllowlist.js'
import type { ModelProviders } from '../settings/types.js'

export type ModelOption = {
  value: string
  label: string
  description: string
  descriptionForModel?: string
}

export function getDefaultOptionForUser(): ModelOption {
  return {
    value: LANGROUTER_AUTO_CONFIG,
    label: 'Auto (free)',
    description: `Use the auto-free model (${LANGROUTER_AUTO_CONFIG})`,
  }
}

function getDeepSeekOption(): ModelOption {
  return {
    value: DEEPSEEK_V4_FLASH_CONFIG,
    label: 'DeepSeek V4 flash',
    description: 'DeepSeek V4 flash · Best for everyday tasks',
    descriptionForModel: 'DeepSeek V4 flash - best for everyday tasks',
  }
}

function getDeepSeekThinkOption(): ModelOption {
  return {
    value: DEEPSEEK_V4_PRO_CONFIG,
    label: 'DeepSeek V4 pro',
    description: 'DeepSeek V4 pro · Enhanced reasoning',
    descriptionForModel: 'DeepSeek V4 pro - enhanced reasoning',
  }
}

function getMoonshotK26Option(): ModelOption {
  return {
    value: MOONSHOT_KIMI_K2_6_CONFIG,
    label: 'Kimi K2.6',
    description: 'Kimi K2.6 · Flagship model',
    descriptionForModel: 'Kimi K2.6 - Flagship model',
  }
}

function getMoonshotK25Option(): ModelOption {
  return {
    value: MOONSHOT_KIMI_K2_5_CONFIG,
    label: 'Kimi K2.5',
    description: 'Kimi K2.5 · Fast and capable',
    descriptionForModel: 'Kimi K2.5 - fast and capable',
  }
}

function getMiniMaxOption(): ModelOption {
  return {
    value: MINIMAX_M2_5_CONFIG,
    label: 'MiniMax M2.5',
    description: 'MiniMax M2.5 · Most capable for complex work',
    descriptionForModel: 'MiniMax M2.5 - most capable for complex work',
  }
}

function getClaudeOpusOption(): ModelOption {
  return {
    value: CLAUDE_OPUS_4_6_CONFIG,
    label: 'Claude Opus 4.6',
    description: 'Claude Opus 4.6 · Anthropic flagship model',
    descriptionForModel: 'Claude Opus 4.6 - Anthropic flagship model',
  }
}

function getGlm51Option(): ModelOption {
  return {
    value: GLM_5_1_CONFIG,
    label: 'GLM 5.1',
    description: 'GLM 5.1 · Z.ai flagship model',
    descriptionForModel: 'GLM 5.1 - Z.ai flagship model',
  }
}

function getGptCodexOption(): ModelOption {
  return {
    value: GPT_5_3_CODEX_CONFIG,
    label: 'GPT 5.3 codex',
    description: 'GPT 5.3 codex · Openai flagship coding model',
    descriptionForModel: 'GPT 5.3 codex · Openai flagship coding model',
  }
}

function getModelOptionsBase(): ModelOption[] {
  return [
    getDefaultOptionForUser(),
    getDeepSeekOption(),
    getDeepSeekThinkOption(),
    getMoonshotK26Option(),
    getGlm51Option(),
    getMoonshotK25Option(),
    getMiniMaxOption(),
    getClaudeOpusOption(),
    getGptCodexOption(),
  ]
}

function getCustomModelProvidersOptions(): ModelOption[] {
  const settings = getSettings_DEPRECATED() || {}
  const modelProviders = settings.modelProviders as ModelProviders | undefined
  if (!modelProviders) return []

  const options: ModelOption[] = []
  for (const [_provider, models] of Object.entries(modelProviders)) {
    for (const model of models) {
      if (
        !options.some(existing => existing.value === `custom:${model.id}`)
      ) {
        options.push({
          value: `custom:${model.id}`,
          label: model.name || model.id,
          description: `Custom model (${model.id})`,
        })
      }
    }
  }
  return options
}

export function getModelOptions(_fastMode = false): ModelOption[] {
  const options = getModelOptionsBase()

  const customModelEnv = process.env.ANTHROPIC_CUSTOM_MODEL_OPTION
  if (
    customModelEnv &&
    !options.some(existing => existing.value === customModelEnv)
  ) {
    options.push({
      value: customModelEnv,
      label: process.env.ANTHROPIC_CUSTOM_MODEL_OPTION_NAME ?? customModelEnv,
      description:
        process.env.ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION ??
        `Custom model (${customModelEnv})`,
    })
  }

  for (const opt of getGlobalConfig().additionalModelOptionsCache ?? []) {
    if (!options.some(existing => existing.value === opt.value)) {
      options.push(opt)
    }
  }

  const customProviderOptions = getCustomModelProvidersOptions()
  for (const opt of customProviderOptions) {
    if (!options.some(existing => existing.value === opt.value)) {
      options.push(opt)
    }
  }

  return filterModelOptionsByAllowlist(options)
}

function filterModelOptionsByAllowlist(options: ModelOption[]): ModelOption[] {
  const settings = getSettings_DEPRECATED() || {}
  if (!settings.availableModels) {
    return options
  }
  return options.filter(
    opt =>
      opt.value === 'default' ||
      (opt.value !== null && isModelAllowed(opt.value)),
  )
}
