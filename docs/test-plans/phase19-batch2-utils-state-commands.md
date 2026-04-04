# Phase 19 - Batch 2: 更多 utils + state + commands

> 预计 ~120 tests / 8 文件 | 部分需轻量 mock

---

## 1. `src/utils/__tests__/collapseTeammateShutdowns.test.ts` (~10 tests)

**源文件**: `src/utils/collapseTeammateShutdowns.ts` (56 行)
**依赖**: 仅类型

### 测试用例

```typescript
describe("collapseTeammateShutdowns", () => {
  test("returns same messages when no teammate shutdowns")
  test("leaves single shutdown message unchanged")
  test("collapses consecutive shutdown messages into batch")
  test("batch attachment has correct count")
  test("does not collapse non-consecutive shutdowns")
  test("preserves non-shutdown messages between shutdowns")
  test("handles empty array")
  test("handles mixed message types")
  test("collapses more than 2 consecutive shutdowns")
  test("non-teammate task_status messages are not collapsed")
})
```

### Mock 需求
构造 `RenderableMessage` mock 对象（带 `task_status` attachment，`status=completed`，`taskType=in_process_teammate`）

---

## 2. `src/utils/__tests__/privacyLevel.test.ts` (~12 tests)

**源文件**: `src/utils/privacyLevel.ts` (56 行)
**依赖**: `process.env`

### 测试用例

```typescript
describe("getPrivacyLevel", () => {
  test("returns 'default' when no env vars set")
  test("returns 'essential-traffic' when CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC is set")
  test("returns 'no-telemetry' when DISABLE_TELEMETRY is set")
  test("'essential-traffic' takes priority over 'no-telemetry'")
})

describe("isEssentialTrafficOnly", () => {
  test("returns true for 'essential-traffic' level")
  test("returns false for 'default' level")
  test("returns false for 'no-telemetry' level")
})

describe("isTelemetryDisabled", () => {
  test("returns true for 'no-telemetry' level")
  test("returns true for 'essential-traffic' level")
  test("returns false for 'default' level")
})

describe("getEssentialTrafficOnlyReason", () => {
  test("returns env var name when restricted")
  test("returns null when unrestricted")
})
```

### Mock 需求
`process.env` 保存/恢复模式（参考现有 `envUtils.test.ts`）

---

## 3. `src/utils/__tests__/textHighlighting.test.ts` (~18 tests)

**源文件**: `src/utils/textHighlighting.ts` (167 行)
**依赖**: `@alcalzone/ansi-tokenize`

### 测试用例

```typescript
describe("segmentTextByHighlights", () => {
  // 基本
  test("returns single segment with no highlights")
  test("returns highlighted segment for single highlight")
  test("returns two segments for highlight covering middle portion")
  test("returns three segments for highlight in the middle")

  // 多高亮
  test("handles non-overlapping highlights")
  test("handles overlapping highlights (priority-based)")
  test("handles adjacent highlights")

  // 边界
  test("highlight starting at 0")
  test("highlight ending at text length")
  test("highlight covering entire text")
  test("empty text with highlights")
  test("empty highlights array returns single segment")

  // ANSI 处理
  test("correctly segments text with ANSI escape codes")
  test("handles text with mixed ANSI and highlights")

  // 属性
  test("preserves highlight color property")
  test("preserves highlight priority property")
  test("preserves dimColor and inverse flags")
  test("highlights with start > end are handled gracefully")
})
```

### Mock 需求
可能需要 mock `@alcalzone/ansi-tokenize`，或直接使用（如果有安装）

---

## 4. `src/utils/__tests__/detectRepository.test.ts` (~15 tests)

**源文件**: `src/utils/detectRepository.ts` (179 行)
**依赖**: git 命令（`getRemoteUrl`）

### 重点测试函数

**`parseGitRemote(input: string): ParsedRepository | null`** — 纯正则解析
**`parseGitHubRepository(input: string): string | null`** — 纯函数

### 测试用例

```typescript
describe("parseGitRemote", () => {
  // HTTPS
  test("parses HTTPS URL: https://github.com/owner/repo.git")
  test("parses HTTPS URL without .git suffix")
  test("parses HTTPS URL with subdirectory path (only takes first 2 segments)")

  // SSH
  test("parses SSH URL: git@github.com:owner/repo.git")
  test("parses SSH URL without .git suffix")

  // ssh://
  test("parses ssh:// URL: ssh://git@github.com/owner/repo.git")

  // git://
  test("parses git:// URL")

  // 边界
  test("returns null for invalid URL")
  test("returns null for empty string")
  test("handles GHE hostname")
  test("handles port number in URL")
})

describe("parseGitHubRepository", () => {
  test("extracts 'owner/repo' from valid remote URL")
  test("handles plain 'owner/repo' string input")
  test("returns null for non-GitHub host (if restricted)")
  test("returns null for invalid input")
  test("is case-sensitive for owner/repo")
})
```

### Mock 需求
仅测试 `parseGitRemote` 和 `parseGitHubRepository`（纯函数），不需要 mock git

---

## 5. `src/utils/__tests__/markdown.test.ts` (~20 tests)

**源文件**: `src/utils/markdown.ts` (382 行)
**依赖**: `marked`, `cli-highlight`, theme types

### 重点测试函数

**`padAligned(content, displayWidth, targetWidth, align)`** — 纯函数

### 测试用例

```typescript
describe("padAligned", () => {
  test("left-aligns: pads with spaces on right")
  test("right-aligns: pads with spaces on left")
  test("center-aligns: pads with spaces on both sides")
  test("no padding when displayWidth equals targetWidth")
  test("handles content wider than targetWidth")
  test("null/undefined align defaults to left")
  test("handles empty string content")
  test("handles zero displayWidth")
  test("handles zero targetWidth")
  test("center alignment with odd padding distribution")
})
```

注意：`numberToLetter`/`numberToRoman`/`getListNumber` 是私有函数，除非从模块导出否则无法直接测试。如果确实私有，则通过 `applyMarkdown` 间接测试列表渲染：

```typescript
describe("list numbering (via applyMarkdown)", () => {
  test("numbered list renders with digits")
  test("nested ordered list uses letters (a, b, c)")
  test("deep nested list uses roman numerals")
  test("unordered list uses bullet markers")
})
```

### Mock 需求
`padAligned` 无需 mock。`applyMarkdown` 可能需要 mock theme 依赖。

---

## 6. `src/state/__tests__/store.test.ts` (~15 tests)

**源文件**: `src/state/store.ts` (35 行)
**依赖**: 无

### 测试用例

```typescript
describe("createStore", () => {
  test("returns object with getState, setState, subscribe")
  test("getState returns initial state")
  test("setState updates state via updater function")
  test("setState does not notify when state unchanged (Object.is)")
  test("setState notifies subscribers on change")
  test("subscribe returns unsubscribe function")
  test("unsubscribe stops notifications")
  test("multiple subscribers all get notified")
  test("onChange callback is called on state change")
  test("onChange is not called when state unchanged")
  test("works with complex state objects")
  test("works with primitive state")
  test("updater receives previous state")
  test("sequential setState calls produce final state")
  test("subscriber called after all state changes in synchronous batch")
})
```

### Mock 需求
无

---

## 7. `src/commands/plugin/__tests__/parseArgs.test.ts` (~18 tests)

**源文件**: `src/commands/plugin/parseArgs.ts` (104 行)
**依赖**: 无

### 测试用例

```typescript
describe("parsePluginArgs", () => {
  // 无参数
  test("returns { type: 'menu' } for undefined")
  test("returns { type: 'menu' } for empty string")
  test("returns { type: 'menu' } for whitespace only")

  // help
  test("returns { type: 'help' } for 'help'")

  // install
  test("parses 'install my-plugin' -> { type: 'install', name: 'my-plugin' }")
  test("parses 'install my-plugin@github' with marketplace")
  test("parses 'install https://github.com/...' as URL marketplace")

  // uninstall
  test("returns { type: 'uninstall', name: '...' }")

  // enable/disable
  test("returns { type: 'enable', name: '...' }")
  test("returns { type: 'disable', name: '...' }")

  // validate
  test("returns { type: 'validate', name: '...' }")

  // manage
  test("returns { type: 'manage' }")

  // marketplace 子命令
  test("parses 'marketplace add ...'")
  test("parses 'marketplace remove ...'")
  test("parses 'marketplace list'")

  // 边界
  test("handles extra whitespace")
  test("handles unknown subcommand gracefully")
})
```

### Mock 需求
无
