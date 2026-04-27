#!/usr/bin/env bun
/**
 * Demo script for testing applyPromptToMarkdown LLM call.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... bun run scripts/demo_llm_call.ts
 *
 * Or set ANTHROPIC_API_KEY in your shell environment / .claude/settings.json
 * before running.
 */

// ── Bootstrap: polyfill MACRO defines (same as cli.tsx dev-mode) ──────────
// The feature() polyfill must run before any module that imports 'bun:bundle'
// is evaluated. We inject it as early as possible.
;(globalThis as any).MACRO ??= {}
;(globalThis.MACRO as any).VERSION ??= '0.0.0-dev'
;(globalThis.MACRO as any).BUILD_TIME ??= new Date().toISOString()

// ── Imports ───────────────────────────────────────────────────────────────
import { enableConfigs } from '../src/utils/config.js'
import { applySafeConfigEnvironmentVariables } from '../src/utils/managedEnv.js'
import { applyPromptToMarkdown } from '../src/tools/WebFetchTool/utils.js'

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  // 1. Initialise the config system (reads .claude/settings.json, etc.)
  enableConfigs()

  // 2. Apply safe environment variables — this populates process.env with
  //    ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN / ANTHROPIC_BASE_URL / model
  //    overrides from settings so that downstream API-client code can find
  //    credentials without the full REPL startup.
  applySafeConfigEnvironmentVariables()

  // Verify we have credentials
  const apiKey = process.env.ANTHROPIC_API_KEY
  const authToken = process.env.ANTHROPIC_AUTH_TOKEN
  if (!apiKey && !authToken) {
    console.error(
      'Error: No API credentials found. Set ANTHROPIC_API_KEY in your environment\n' +
        'or in .claude/settings.json before running this script.',
    )
    process.exit(1)
  }
  console.log(`Using auth: ${apiKey ? 'ANTHROPIC_API_KEY (***' + apiKey.slice(-4) + ')' : 'ANTHROPIC_AUTH_TOKEN'}`)

  // 3. Build test data — simulate a fetched web page
  const markdownContent = `
# Example Page

This is a **test page** with some content.

## Key Information

- Item one: The sky is blue because of Rayleigh scattering.
- Item two: Water boils at 100°C at standard atmospheric pressure.
- Item three: Claude is an AI assistant made by Anthropic.

## References

1. [Rayleigh scattering](https://en.wikipedia.org/wiki/Rayleigh_scattering)
2. [Boiling point](https://en.wikipedia.org/wiki/Boiling_point)

The quick brown fox jumps over the lazy dog. This sentence is used for typography.
`.trim()

  const prompt = 'Summarize this page in 2-3 sentences'

  const controller = new AbortController()

  // Optional: abort after 30s timeout
  const timeout = setTimeout(() => {
    console.log('Aborting after 30s timeout...')
    controller.abort()
  }, 30_000)

  console.log('Calling applyPromptToMarkdown...')
  console.log(`  Prompt: "${prompt}"`)
  console.log(`  Content length: ${markdownContent.length} chars`)
  console.log()

  try {
    const result = await applyPromptToMarkdown(
      prompt,
      markdownContent,
      controller.signal,
      true,  // isNonInteractiveSession
      false, // isPreapprovedDomain — non-preapproved applies 125-char quote limit
    )

    console.log('=== Result ===')
    console.log(result)
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.error('Request was aborted (timeout or manual cancel).')
    } else {
      console.error('Error:', err.message || err)
      if (err.stack) {
        console.error(err.stack)
      }
    }
    process.exitCode = 1
  } finally {
    clearTimeout(timeout)
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})