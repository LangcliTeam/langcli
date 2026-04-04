# Phase 19 - Batch 1: 零依赖微型 utils

> 预计 ~154 tests / 13 文件 | 全部纯函数，无需 mock

---

## 1. `src/utils/__tests__/semanticBoolean.test.ts` (~8 tests)

**源文件**: `src/utils/semanticBoolean.ts` (30 行)
**依赖**: `zod/v4`

### 测试用例

```typescript
describe("semanticBoolean", () => {
  // 基本 Zod 行为
  test("parses boolean true to true")
  test("parses boolean false to false")
  test("parses string 'true' to true")
  test("parses string 'false' to false")
  // 边界
  test("rejects string 'TRUE' (case-sensitive)")
  test("rejects string 'FALSE' (case-sensitive)")
  test("rejects number 1")
  test("rejects null")
  test("rejects undefined")
  // 自定义 inner schema
  test("works with custom inner schema (z.boolean().optional())")
})
```

### Mock 需求
无

---

## 2. `src/utils/__tests__/semanticNumber.test.ts` (~10 tests)

**源文件**: `src/utils/semanticNumber.ts` (37 行)
**依赖**: `zod/v4`

### 测试用例

```typescript
describe("semanticNumber", () => {
  test("parses number 42")
  test("parses number 0")
  test("parses negative number -5")
  test("parses float 3.14")
  test("parses string '42' to 42")
  test("parses string '-7.5' to -7.5")
  test("rejects string 'abc'")
  test("rejects empty string ''")
  test("rejects null")
  test("rejects boolean true")
  test("works with custom inner schema (z.number().int().min(0))")
})
```

### Mock 需求
无

---

## 3. `src/utils/__tests__/lazySchema.test.ts` (~6 tests)

**源文件**: `src/utils/lazySchema.ts` (9 行)
**依赖**: 无

### 测试用例

```typescript
describe("lazySchema", () => {
  test("returns a function")
  test("calls factory on first invocation")
  test("returns cached result on subsequent invocations")
  test("factory is called only once (call count verification)")
  test("works with different return types")
  test("each call to lazySchema returns independent cache")
})
```

### Mock 需求
无

---

## 4. `src/utils/__tests__/withResolvers.test.ts` (~8 tests)

**源文件**: `src/utils/withResolvers.ts` (14 行)
**依赖**: 无

### 测试用例

```typescript
describe("withResolvers", () => {
  test("returns object with promise, resolve, reject")
  test("promise resolves when resolve is called")
  test("promise rejects when reject is called")
  test("resolve passes value through")
  test("reject passes error through")
  test("promise is instanceof Promise")
  test("works with generic type parameter")
  test("resolve/reject can be called asynchronously")
})
```

### Mock 需求
无

---

## 5. `src/utils/__tests__/userPromptKeywords.test.ts` (~12 tests)

**源文件**: `src/utils/userPromptKeywords.ts` (28 行)
**依赖**: 无

### 测试用例

```typescript
describe("matchesNegativeKeyword", () => {
  test("matches 'wtf'")
  test("matches 'shit'")
  test("matches 'fucking broken'")
  test("does not match normal input like 'fix the bug'")
  test("is case-insensitive")
  test("matches partial word in sentence")
})

describe("matchesKeepGoingKeyword", () => {
  test("matches exact 'continue'")
  test("matches 'keep going'")
  test("matches 'go on'")
  test("does not match 'cont'")
  test("does not match empty string")
  test("matches within larger sentence 'please continue'")
})
```

### Mock 需求
无

---

## 6. `src/utils/__tests__/xdg.test.ts` (~15 tests)

**源文件**: `src/utils/xdg.ts` (66 行)
**依赖**: 无（通过 options 参数注入）

### 测试用例

```typescript
describe("getXDGStateHome", () => {
  test("returns ~/.local/state by default")
  test("respects XDG_STATE_HOME env var")
  test("uses custom homedir from options")
})

describe("getXDGCacheHome", () => {
  test("returns ~/.cache by default")
  test("respects XDG_CACHE_HOME env var")
})

describe("getXDGDataHome", () => {
  test("returns ~/.local/share by default")
  test("respects XDG_DATA_HOME env var")
})

describe("getUserBinDir", () => {
  test("returns ~/.local/bin")
  test("uses custom homedir from options")
})

describe("resolveOptions", () => {
  test("defaults env to process.env")
  test("defaults homedir to os.homedir()")
  test("merges partial options")
})

describe("path construction", () => {
  test("all paths end with correct subdirectory")
  test("respects HOME env via homedir override")
})
```

### Mock 需求
无（通过 options.env 和 options.homedir 注入）

---

## 7. `src/utils/__tests__/horizontalScroll.test.ts` (~20 tests)

**源文件**: `src/utils/horizontalScroll.ts` (138 行)
**依赖**: 无

### 测试用例

```typescript
describe("calculateHorizontalScrollWindow", () => {
  // 基本场景
  test("all items fit within available width")
  test("single item selected within view")
  test("selected item at beginning")
  test("selected item at end")
  test("selected item beyond visible range scrolls right")
  test("selected item before visible range scrolls left")

  // 箭头指示器
  test("showLeftArrow when items hidden on left")
  test("showRightArrow when items hidden on right")
  test("no arrows when all items visible")
  test("both arrows when items hidden on both sides")

  // 边界条件
  test("empty itemWidths array")
  test("single item")
  test("available width is 0")
  test("item wider than available width")
  test("all items same width")
  test("varying item widths")
  test("firstItemHasSeparator adds separator width to first item")
  test("selectedIdx in middle of overflow")
  test("scroll snaps to show selected at left edge")
  test("scroll snaps to show selected at right edge")
})
```

### Mock 需求
无

---

## 8. `src/utils/__tests__/generators.test.ts` (~18 tests)

**源文件**: `src/utils/generators.ts` (89 行)
**依赖**: 无

### 测试用例

```typescript
describe("lastX", () => {
  test("returns last yielded value")
  test("returns only value from single-yield generator")
  test("throws on empty generator")
})

describe("returnValue", () => {
  test("returns generator return value")
  test("returns undefined for void return")
})

describe("toArray", () => {
  test("collects all yielded values")
  test("returns empty array for empty generator")
  test("preserves order")
})

describe("fromArray", () => {
  test("yields all array elements")
  test("yields nothing for empty array")
})

describe("all", () => {
  test("merges multiple generators preserving yield order")
  test("respects concurrency cap")
  test("handles empty generator array")
  test("handles single generator")
  test("handles generators of different lengths")
  test("yields all values from all generators")
})
```

### Mock 需求
无（用 fromArray 构造测试数据）

---

## 9. `src/utils/__tests__/sequential.test.ts` (~12 tests)

**源文件**: `src/utils/sequential.ts` (57 行)
**依赖**: 无

### 测试用例

```typescript
describe("sequential", () => {
  test("wraps async function, returns same result")
  test("single call resolves normally")
  test("concurrent calls execute sequentially (FIFO order)")
  test("preserves arguments correctly")
  test("error in first call does not block subsequent calls")
  test("preserves rejection reason")
  test("multiple args passed correctly")
  test("returns different wrapper for each call to sequential")
  test("handles rapid concurrent calls")
  test("execution order matches call order")
  test("works with functions returning different types")
  test("wrapper has same arity expectations")
})
```

### Mock 需求
无

---

## 10. `src/utils/__tests__/fingerprint.test.ts` (~15 tests)

**源文件**: `src/utils/fingerprint.ts` (77 行)
**依赖**: `crypto` (内置)

### 测试用例

```typescript
describe("FINGERPRINT_SALT", () => {
  test("has expected value '59cf53e54c78'")
})

describe("extractFirstMessageText", () => {
  test("extracts text from first user message")
  test("extracts text from single user message with array content")
  test("returns empty string when no user messages")
  test("skips assistant messages")
  test("handles mixed content blocks (text + image)")
})

describe("computeFingerprint", () => {
  test("returns deterministic 3-char hex string")
  test("same input produces same fingerprint")
  test("different message text produces different fingerprint")
  test("different version produces different fingerprint")
  test("handles short strings (length < 21)")
  test("handles empty string")
  test("fingerprint is valid hex")
})

describe("computeFingerprintFromMessages", () => {
  test("end-to-end: messages -> fingerprint")
})
```

### Mock 需求
需要 `mock.module` 处理 `UserMessage`/`AssistantMessage` 类型依赖（查看实际 import 情况）

---

## 11. `src/utils/__tests__/configConstants.test.ts` (~8 tests)

**源文件**: `src/utils/configConstants.ts` (22 行)
**依赖**: 无

### 测试用例

```typescript
describe("NOTIFICATION_CHANNELS", () => {
  test("contains expected channels")
  test("is readonly array")
  test("includes 'auto', 'iterm2', 'terminal_bell'")
})

describe("EDITOR_MODES", () => {
  test("contains 'normal' and 'vim'")
  test("has exactly 2 entries")
})

describe("TEAMMATE_MODES", () => {
  test("contains 'auto', 'tmux', 'in-process'")
  test("has exactly 3 entries")
})
```

### Mock 需求
无

---

## 12. `src/utils/__tests__/directMemberMessage.test.ts` (~12 tests)

**源文件**: `src/utils/directMemberMessage.ts` (70 行)
**依赖**: 仅类型（可 mock）

### 测试用例

```typescript
describe("parseDirectMemberMessage", () => {
  test("parses '@agent-name hello world'")
  test("parses '@agent-name single-word'")
  test("returns null for non-matching input")
  test("returns null for empty string")
  test("returns null for '@name' without message")
  test("handles hyphenated agent names like '@my-agent msg'")
  test("handles multiline message content")
  test("extracts correct recipientName and message")
})

// sendDirectMemberMessage 需要 mock teamContext/writeToMailbox
describe("sendDirectMemberMessage", () => {
  test("returns error when no team context")
  test("returns error for unknown recipient")
  test("calls writeToMailbox with correct args for valid recipient")
  test("returns success for valid message")
})
```

### Mock 需求
`sendDirectMemberMessage` 需要 mock `AppState['teamContext']` 和 `WriteToMailboxFn`

---

## 13. `src/utils/__tests__/collapseHookSummaries.test.ts` (~12 tests)

**源文件**: `src/utils/collapseHookSummaries.ts` (60 行)
**依赖**: 仅类型

### 测试用例

```typescript
describe("collapseHookSummaries", () => {
  test("returns same messages when no hook summaries")
  test("collapses consecutive messages with same hookLabel")
  test("does not collapse messages with different hookLabels")
  test("aggregates hookCount across collapsed messages")
  test("merges hookInfos arrays")
  test("merges hookErrors arrays")
  test("takes max totalDurationMs")
  test("takes any truthy preventContinuation")
  test("leaves single hook summary unchanged")
  test("handles three consecutive same-label summaries")
  test("preserves non-hook messages in between")
  test("returns empty array for empty input")
})
```

### Mock 需求
需要构造 `RenderableMessage` mock 对象
