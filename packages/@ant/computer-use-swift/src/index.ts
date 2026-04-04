/**
 * @ant/computer-use-swift — cross-platform display, apps, and screenshot API
 *
 * Platform backends:
 *   - darwin: AppleScript/JXA + screencapture
 *   - win32:  PowerShell + System.Drawing + Win32 P/Invoke
 *
 * Add new platforms by creating backends/<platform>.ts implementing SwiftBackend.
 */

// Re-export all types
export type {
  DisplayGeometry,
  PrepareDisplayResult,
  AppInfo,
  InstalledApp,
  RunningApp,
  ScreenshotResult,
  ResolvePrepareCaptureResult,
  WindowDisplayInfo,
  DisplayAPI,
  AppsAPI,
  ScreenshotAPI,
  SwiftBackend,
} from './types.js'

import type { ResolvePrepareCaptureResult, SwiftBackend } from './types.js'

// ---------------------------------------------------------------------------
// Platform dispatch
// ---------------------------------------------------------------------------

function loadBackend(): SwiftBackend | null {
  try {
    switch (process.platform) {
      case 'darwin':
        return require('./backends/darwin.js') as SwiftBackend
      case 'win32':
        return require('./backends/win32.js') as SwiftBackend
      case 'linux':
        return require('./backends/linux.js') as SwiftBackend
      default:
        return null
    }
  } catch {
    return null
  }
}

const backend = loadBackend()

// ---------------------------------------------------------------------------
// ComputerUseAPI — Main export (preserves original class interface)
// ---------------------------------------------------------------------------

export class ComputerUseAPI {
  // When no backend is loaded (unsupported platform), all APIs are no-op stubs.
  // These stubs should never be reached in practice — callers check isSupported
  // or the feature gate before invoking.

  apps = backend?.apps ?? {
    async prepareDisplay() { return { activated: '', hidden: [] } },
    async previewHideSet() { return [] },
    async findWindowDisplays(ids: string[]) { return ids.map(b => ({ bundleId: b, displayIds: [] as number[] })) },
    async appUnderPoint() { return null },
    async listInstalled() { return [] },
    iconDataUrl() { return null },
    listRunning() { return [] },
    async open() { throw new Error('computer-use-swift: no backend for this platform') },
    async unhide() {},
  }

  display = backend?.display ?? {
    getSize() { throw new Error('computer-use-swift: no backend for this platform') },
    listAll() { throw new Error('computer-use-swift: no backend for this platform') },
  }

  screenshot = backend?.screenshot ?? {
    async captureExcluding() { throw new Error('computer-use-swift: no backend for this platform') },
    async captureRegion() { throw new Error('computer-use-swift: no backend for this platform') },
  }

  async resolvePrepareCapture(
    allowedBundleIds: string[],
    _surrogateHost: string,
    quality: number,
    targetW: number,
    targetH: number,
    displayId?: number,
    _autoResolve?: boolean,
    _doHide?: boolean,
  ): Promise<ResolvePrepareCaptureResult> {
    return this.screenshot.captureExcluding(allowedBundleIds, quality, targetW, targetH, displayId)
  }
}
