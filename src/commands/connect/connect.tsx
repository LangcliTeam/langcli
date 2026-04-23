import * as React from 'react'
import { Pane } from '../../components/design-system/Pane.js'
import { Select } from '../../components/CustomSelect/select.js'
import { Box, Text, useInput } from '../../ink.js'
import { useKeybinding } from '../../keybindings/useKeybinding.js'
import type { CommandResultDisplay } from '../../commands.js'
import type { LocalJSXCommandCall } from '../../types/command.js'

type ConnectOption = 'langrouter' | 'custom'

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

function ConnectScreen({ onDone }: Props): React.ReactNode {
  const [selectedOption, setSelectedOption] = React.useState<ConnectOption | null>(null)

  const handleCancel = React.useCallback(() => {
    if (selectedOption === 'custom') {
      setSelectedOption(null)
    } else {
      onDone('Connect cancelled', { display: 'system' })
    }
  }, [selectedOption, onDone])

  useKeybinding('confirm:no', handleCancel, { context: 'Confirmation' })

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

export const call: LocalJSXCommandCall = async (onDone, _context) => {
  return <ConnectScreen onDone={onDone} />
}
