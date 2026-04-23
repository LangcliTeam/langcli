import type { Command } from '../../commands.js'

const connect = {
  type: 'local-jsx',
  name: 'connect',
  description: 'Connect to a model provider',
  load: () => import('./connect.js'),
} satisfies Command

export default connect
