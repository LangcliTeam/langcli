import * as React from 'react'
import { Pane } from '../../components/design-system/Pane.js'
import { Select } from '../../components/CustomSelect/select.js'
import { Box, Text } from '../../ink.js'
import { useKeybinding } from '../../keybindings/useKeybinding.js'
import type { CommandResultDisplay } from '../../commands.js'
import type { LocalJSXCommandCall } from '../../types/command.js'
import {
  getSettings_DEPRECATED,
  getSettingsFilePathForSource,
  updateSettingsForSource,
} from '../../utils/settings/settings.js'
import { applyConfigEnvironmentVariables } from '../../utils/managedEnv.js'
import TextInput from '../../components/TextInput.js'
import { useTerminalSize } from '../../hooks/useTerminalSize.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConnectOption = 'langrouter' | 'deepseek' | 'mimo-go' | 'mimo-plan' | 'custom'

type Props = {
  onDone: (
    result?: string,
    options?: {
      display?: CommandResultDisplay
      nextInput?: string
      submitNextInput?: boolean
    },
  ) => void
}

/** Describes a model entry to write into settings.modelProviders.openai */
type ModelEntry = {
  id: string
  name: string
  envKey: string
  baseUrl: string
  generationConfig: {
    timeout: number
    maxRetries: number
    contextWindowSize: number
    samplingParams: {
      temperature: number
      top_p: number
      max_tokens: number
    }
  }
}

/** Config for a generic provider connect flow */
type ProviderConfig = {
  label: string          // e.g. "Deepseek", "Mimo (Pay as go)"
  models: ModelEntry[]
  envKeyName: string     // e.g. "DEEPSEEK_API_KEY", "MIMO_API_KEY"
  modelIds: string[]     // IDs to check for existing config & to de-duplicate
}

// ---------------------------------------------------------------------------
// Model definitions
// ---------------------------------------------------------------------------

const DEEPSEEK_MODELS: ModelEntry[] = [
  {
    id: 'deepseek-flash[1m]',
    name: 'Deepseek-v4.1-flash[1m] (custom)',
    envKey: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com',
    generationConfig: {
      timeout: 300000,
      maxRetries: 2,
      contextWindowSize: 1000000,
      samplingParams: {
        temperature: 0.3,
        top_p: 0.95,
        max_tokens: 384000,
      },
    },
  },
  {
    id: 'deepseek-v4-pro[1m]',
    name: 'Deepseek-v4-pro[1m] (custom)',
    envKey: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com',
    generationConfig: {
      timeout: 300000,
      maxRetries: 2,
      contextWindowSize: 1000000,
      samplingParams: {
        temperature: 0.3,
        top_p: 0.95,
        max_tokens: 384000,
      },
    },
  },
]

const MIMO_GO_MODELS: ModelEntry[] = [
  {
    id: 'mimo-v2.5[1m]',
    name: 'Mimo-v2.5[1m]-GO (custom)',
    envKey: 'MIMO_API_KEY',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    generationConfig: {
      timeout: 300000,
      maxRetries: 2,
      contextWindowSize: 1000000,
      samplingParams: {
        temperature: 0.3,
        top_p: 0.95,
        max_tokens: 384000,
      },
    },
  },
  {
    id: 'mimo-v2.5-pro[1m]',
    name: 'Mimo-v2.5-pro[1m]-Go (custom)',
    envKey: 'MIMO_API_KEY',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    generationConfig: {
      timeout: 300000,
      maxRetries: 2,
      contextWindowSize: 1000000,
      samplingParams: {
        temperature: 0.3,
        top_p: 0.95,
        max_tokens: 384000,
      },
    },
  },
]

const MIMO_PLAN_MODELS: ModelEntry[] = [
  {
    id: 'mimo-v2.5[1m]',
    name: 'Mimo-v2.5[1m]-Plan (custom)',
    envKey: 'MIMO_API_KEY',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    generationConfig: {
      timeout: 300000,
      maxRetries: 2,
      contextWindowSize: 1000000,
      samplingParams: {
        temperature: 0.3,
        top_p: 0.95,
        max_tokens: 384000,
      },
    },
  },
  {
    id: 'mimo-v2.5-pro[1m]',
    name: 'Mimo-v2.5-pro[1m]-Plan (custom)',
    envKey: 'MIMO_API_KEY',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    generationConfig: {
      timeout: 300000,
      maxRetries: 2,
      contextWindowSize: 1000000,
      samplingParams: {
        temperature: 0.3,
        top_p: 0.95,
        max_tokens: 384000,
      },
    },
  },
]

/** Provider configs keyed by ConnectOption value */
const PROVIDER_CONFIGS: Record<'deepseek' | 'mimo-go' | 'mimo-plan', ProviderConfig> = {
  deepseek: {
    label: 'Deepseek',
    models: DEEPSEEK_MODELS,
    envKeyName: 'DEEPSEEK_API_KEY',
    modelIds: ['deepseek-flash[1m]', 'deepseek-v4-pro[1m]'],
  },
  'mimo-go': {
    label: 'Mimo (Pay as go)',
    models: MIMO_GO_MODELS,
    envKeyName: 'MIMO_API_KEY',
    modelIds: ['mimo-v2.5[1m]', 'mimo-v2.5-pro[1m]'],
  },
  'mimo-plan': {
    label: 'Mimo (Token plan)',
    models: MIMO_PLAN_MODELS,
    envKeyName: 'MIMO_API_KEY',
    modelIds: ['mimo-v2.5[1m]', 'mimo-v2.5-pro[1m]'],
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check whether settings already contain any of the given model IDs */
function hasProviderConfigured(modelIds: string[]): boolean {
  const settings = getSettings_DEPRECATED()
  const openaiModels = settings?.modelProviders?.openai
  if (!openaiModels || openaiModels.length === 0) return false
  return openaiModels.some((m: { id: string }) => modelIds.includes(m.id))
}

// ---------------------------------------------------------------------------
// Generic ProviderConnect component
// ---------------------------------------------------------------------------

function ProviderConnect({ config, onDone, onBack }: { config: ProviderConfig; onDone: Props['onDone']; onBack: () => void }): React.ReactNode {
  const [apiKey, setApiKey] = React.useState('')
  const [cursorOffset, setCursorOffset] = React.useState(0)
  const [isSaving, setIsSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const { columns } = useTerminalSize()
  const textInputColumns = columns - 4

  const alreadyConfigured = hasProviderConfigured(config.modelIds)

  const handleCancel = React.useCallback(() => {
    onBack()
  }, [onBack])

  useKeybinding('confirm:no', handleCancel, { context: 'Confirmation' })

  if (alreadyConfigured) {
    return (
      <Pane color="permission">
        <Box flexDirection="column" gap={1}>
          <Text bold color="success">
            {config.label} API key is already configured
          </Text>
          <Text dimColor>
            Settings file: {getSettingsFilePathForSource('userSettings')}
          </Text>
          <Text dimColor>
            Open this file to verify your configuration.
          </Text>
          <Text dimColor italic>
            Esc to go back
          </Text>
        </Box>
      </Pane>
    )
  }

  const handleSubmit = async (value: string) => {
    if (!value.trim()) {
      setSaveError('Please enter a valid API key')
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const currentSettings = getSettings_DEPRECATED() || {}
      const currentOpenAI = currentSettings.modelProviders?.openai || []

      // Remove any existing models for this provider to avoid duplicates, then add ours
      const filteredModels = currentOpenAI.filter(
        (m: { id: string }) => !config.modelIds.includes(m.id),
      )

      const result = updateSettingsForSource('userSettings', {
        env: {
          [config.envKeyName]: value.trim(),
        },
        modelProviders: {
          openai: [...filteredModels, ...config.models],
          anthropic: currentSettings.modelProviders?.anthropic || [],
          gemini: currentSettings.modelProviders?.gemini || [],
        },
      })

      if (result.error) {
        setSaveError(result.error.message)
        return
      }

      applyConfigEnvironmentVariables()
      onDone(`${config.label} API key saved successfully`, { display: 'system' })
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Pane color="permission">
      <Box flexDirection="column" gap={1}>
        <Text bold color="permission">
          Connect to {config.label} Official
        </Text>
        <Text>Please input your {config.label} API key and press Enter to continue:</Text>
        <Box borderStyle="round" borderColor="background" flexDirection="column" paddingX={1}>
          <TextInput
            value={apiKey}
            onChange={setApiKey}
            onSubmit={handleSubmit}
            cursorOffset={cursorOffset}
            onChangeCursorOffset={setCursorOffset}
            columns={textInputColumns}
            placeholder={`Enter your ${config.label} API key here...`}
            focus={true}
            showCursor={true}
          />
        </Box>
        {saveError && <Text color="error">{saveError}</Text>}
        {isSaving && <Text dimColor>Saving...</Text>}
        <Text dimColor italic>
          Esc to go back
        </Text>
      </Box>
    </Pane>
  )
}

// ---------------------------------------------------------------------------
// Select screen
// ---------------------------------------------------------------------------

function ConnectScreen({ onDone }: Props): React.ReactNode {
  const [selectedOption, setSelectedOption] = React.useState<ConnectOption | null>(null)

  const handleCancel = React.useCallback(() => {
    if (selectedOption) {
      setSelectedOption(null)
    } else {
      onDone('Connect cancelled', { display: 'system' })
    }
  }, [selectedOption, onDone])

  useKeybinding('confirm:no', handleCancel, { context: 'Confirmation' })

  // Provider connect sub-screens
  if (selectedOption === 'deepseek' || selectedOption === 'mimo-go' || selectedOption === 'mimo-plan') {
    return <ProviderConnect config={PROVIDER_CONFIGS[selectedOption]} onDone={onDone} onBack={() => setSelectedOption(null)} />
  }

  if (selectedOption === 'custom') {
    return (
      <Pane color="permission">
        <Box flexDirection="column" gap={1}>
          <Text bold color="permission">
            Custom Configuration
          </Text>
          <Text>
            You can configure your API key and models in settings.json
          </Text>
          <Text dimColor>
            Refer to the documentation for setup instructions
          </Text>
          <Text color="suggestion" dimColor>
            https://langcli.com/docs/model-providers/
          </Text>
          <Text dimColor italic>
            Esc to go back
          </Text>
        </Box>
      </Pane>
    )
  }

  return (
    <Pane color="permission">
      <Box flexDirection="column" gap={1}>
        <Text bold color="permission">
          Select API Key Type
        </Text>
        <Select<ConnectOption>
          hideIndexes
          options={[
            {
              label: 'LangRouter.ai API Key',
              value: 'langrouter',
              description: 'The convenient way to use mainstream LLM models.',
              dimDescription: false,
            },
            {
              label: 'Deepseek',
              value: 'deepseek',
              description: 'Connect to Deepseek official',
              dimDescription: false,
            },
            {
              label: 'Mimo (Token plan)',
              value: 'mimo-plan',
              description: 'Connect to Xiaomi Mimo official',
              dimDescription: false,
            },
            {
              label: 'Mimo (Pay as go)',
              value: 'mimo-go',
              description: 'Connect to Xiaomi Mimo official',
              dimDescription: false,
            },
            {
              label: 'Custom API Key',
              value: 'custom',
              description: 'For other OpenAI / Anthropic / Gemini-compatible providers',
              dimDescription: false,
            },
          ]}
          onChange={value => {
            if (value === 'langrouter') {
              onDone(undefined, { nextInput: '/login', submitNextInput: true })
            } else {
              setSelectedOption(value)
            }
          }}
          onCancel={handleCancel}
          layout="expanded"
        />
        <Text dimColor italic>
          Esc to go back
        </Text>
      </Box>
    </Pane>
  )
}

// ---------------------------------------------------------------------------
// Command entrypoint
// ---------------------------------------------------------------------------

export const call: LocalJSXCommandCall = async (onDone, _context) => {
  return <ConnectScreen onDone={onDone} />
}