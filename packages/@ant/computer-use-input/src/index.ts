/**
 * @ant/computer-use-input — cross-platform keyboard & mouse simulation
 *
 * Platform backends:
 *   - darwin: AppleScript/JXA via CoreGraphics events
 *   - win32:  PowerShell via Win32 P/Invoke (SetCursorPos, SendInput, keybd_event)
 *
 * Add new platforms by creating backends/<platform>.ts implementing InputBackend.
 */

import type { FrontmostAppInfo, InputBackend } from './types.js'

export type { FrontmostAppInfo, InputBackend } from './types.js'

// ---------------------------------------------------------------------------
// Platform dispatch
// ---------------------------------------------------------------------------

function loadBackend(): InputBackend | null {
  try {
    switch (process.platform) {
      case 'darwin':
        return require('./backends/darwin.js') as InputBackend
      case 'win32':
        return require('./backends/win32.js') as InputBackend
      case 'linux':
        return require('./backends/linux.js') as InputBackend
      default:
        return null
    }
  } catch {
    return null
  }
}

const backend = loadBackend()

// ---------------------------------------------------------------------------
// Unsupported stub (throws on call — guards via isSupported check)
// ---------------------------------------------------------------------------

function unsupported(): never {
  throw new Error(`computer-use-input is not supported on ${process.platform}`)
}

// ---------------------------------------------------------------------------
// Public API — matches the original export surface
// ---------------------------------------------------------------------------

export const isSupported = backend !== null

export const moveMouse = backend?.moveMouse ?? unsupported
export const key = backend?.key ?? unsupported
export const keys = backend?.keys ?? unsupported
export const mouseLocation = backend?.mouseLocation ?? unsupported
export const mouseButton = backend?.mouseButton ?? unsupported
export const mouseScroll = backend?.mouseScroll ?? unsupported
export const typeText = backend?.typeText ?? unsupported
export const getFrontmostAppInfo = backend?.getFrontmostAppInfo ?? (() => null)

// Legacy class type — used by inputLoader.ts for type narrowing
export class ComputerUseInputAPI {
  declare moveMouse: InputBackend['moveMouse']
  declare key: InputBackend['key']
  declare keys: InputBackend['keys']
  declare mouseLocation: InputBackend['mouseLocation']
  declare mouseButton: InputBackend['mouseButton']
  declare mouseScroll: InputBackend['mouseScroll']
  declare typeText: InputBackend['typeText']
  declare getFrontmostAppInfo: InputBackend['getFrontmostAppInfo']
  declare isSupported: true
}

interface ComputerUseInputUnsupported {
  isSupported: false
}

export type ComputerUseInput = ComputerUseInputAPI | ComputerUseInputUnsupported
