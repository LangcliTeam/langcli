import {
  LANGROUTER_AUTO_CONFIG,
  DEEPSEEK_V3_2_CONFIG,
  DEEPSEEK_V3_2_THINK_CONFIG,
  MOONSHOT_KIMI_K2_5_CONFIG,
  MINIMAX_M2_5_CONFIG,
  CLAUDE_OPUS_4_6_CONFIG,
  GLM_5_1_CONFIG,
} from './configs.js'
import { getSettings_DEPRECATED } from '../settings/settings.js'
import { getGlobalConfig } from '../config.js'
import { isModelAllowed } from './modelAllowlist.js'

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
    value: DEEPSEEK_V3_2_CONFIG,
    label: 'DeepSeek V3.2',
    description: 'DeepSeek V3.2 · Best for everyday tasks',
    descriptionForModel: 'DeepSeek V3.2 - best for everyday tasks',
  }
}

function getDeepSeekThinkOption(): ModelOption {
  return {
    value: DEEPSEEK_V3_2_THINK_CONFIG,
    label: 'DeepSeek V3.2 Think',
    description: 'DeepSeek V3.2 Think · Enhanced reasoning',
    descriptionForModel: 'DeepSeek V3.2 Think - enhanced reasoning',
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

function getModelOptionsBase(): ModelOption[] {
  return [
    getDefaultOptionForUser(),
    getMoonshotK25Option(),
    getMiniMaxOption(),
    getGlm51Option(),
    getDeepSeekOption(),
    getDeepSeekThinkOption(),
    getClaudeOpusOption(),
  ]
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
