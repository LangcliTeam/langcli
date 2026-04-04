# Phase 19 - Batch 5: MCP 配置 + modelCost

> 预计 ~80 tests / 4 文件 | 需中等 mock

---

## 1. `src/services/mcp/__tests__/configUtils.test.ts` (~30 tests)

**源文件**: `src/services/mcp/config.ts` (1580 行)
**目标函数**: `unwrapCcrProxyUrl`, `urlPatternToRegex` (私有), `commandArraysMatch` (私有), `toggleMembership` (私有), `addScopeToServers` (私有), `dedupPluginMcpServers`, `getMcpServerSignature` (如导出)

### 测试策略
私有函数如不可直接测试，通过公开的 `dedupPluginMcpServers` 间接覆盖。导出函数直接测。

### 测试用例

```typescript
describe("unwrapCcrProxyUrl", () => {
  test("returns original URL when no CCR proxy markers")
  test("extracts mcp_url from CCR proxy URL with /v2/session_ingress/shttp/mcp/")
  test("extracts mcp_url from CCR proxy URL with /v2/ccr-sessions/")
  test("returns original URL when mcp_url param is missing")
  test("handles malformed URL gracefully")
  test("handles URL with both proxy marker and mcp_url")
  test("preserves non-CCR URLs unchanged")
})

describe("dedupPluginMcpServers", () => {
  test("keeps unique plugin servers")
  test("suppresses plugin server duplicated by manual config")
  test("suppresses plugin server duplicated by earlier plugin")
  test("keeps servers with null signature")
  test("returns empty for empty inputs")
  test("reports suppressed with correct duplicateOf name")
  test("handles multiple plugins with same config")
})

describe("toggleMembership (via integration)", () => {
  test("adds item when shouldContain=true and not present")
  test("removes item when shouldContain=false and present")
  test("returns same array when already in desired state")
})

describe("addScopeToServers (via integration)", () => {
  test("adds scope to each server config")
  test("returns empty object for undefined input")
  test("returns empty object for empty input")
  test("preserves all original config properties")
})

describe("urlPatternToRegex (via integration)", () => {
  test("matches exact URL")
  test("matches wildcard pattern *.example.com")
  test("matches multiple wildcards")
  test("does not match non-matching URL")
  test("escapes regex special characters in pattern")
})

describe("commandArraysMatch (via integration)", () => {
  test("returns true for identical arrays")
  test("returns false for different lengths")
  test("returns false for same length different elements")
  test("returns true for empty arrays")
})
```

### Mock 需求
需 mock `feature()` (bun:bundle), `jsonStringify`, `safeParseJSON`, `log` 等
通过 `mock.module()` + `await import()` 解锁

---

## 2. `src/services/mcp/__tests__/filterUtils.test.ts` (~20 tests)

**源文件**: `src/services/mcp/utils.ts` (576 行)
**目标函数**: `filterToolsByServer`, `hashMcpConfig`, `isToolFromMcpServer`, `isMcpTool`, `parseHeaders`

### 测试用例

```typescript
describe("filterToolsByServer", () => {
  test("filters tools matching server name prefix")
  test("returns empty for no matching tools")
  test("handles empty tools array")
  test("normalizes server name for matching")
})

describe("hashMcpConfig", () => {
  test("returns 16-char hex string")
  test("is deterministic")
  test("excludes scope from hash")
  test("different configs produce different hashes")
  test("key order does not affect hash (sorted)")
})

describe("isToolFromMcpServer", () => {
  test("returns true when tool belongs to specified server")
  test("returns false for different server")
  test("returns false for non-MCP tool name")
  test("handles empty tool name")
})

describe("isMcpTool", () => {
  test("returns true for tool name starting with 'mcp__'")
  test("returns true when tool.isMcp is true")
  test("returns false for regular tool")
  test("returns false when neither condition met")
})

describe("parseHeaders", () => {
  test("parses 'Key: Value' format")
  test("parses multiple headers")
  test("trims whitespace around key and value")
  test("throws on missing colon")
  test("throws on empty key")
  test("handles value with colons (like URLs)")
  test("returns empty object for empty array")
  test("handles duplicate keys (last wins)")
})
```

### Mock 需求
需 mock `normalizeNameForMCP`, `mcpInfoFromString`, `jsonStringify`, `createHash` 等
`parseHeaders` 是最独立的，可能不需要太多 mock

---

## 3. `src/services/mcp/__tests__/channelNotification.test.ts` (~15 tests)

**源文件**: `src/services/mcp/channelNotification.ts` (317 行)
**目标函数**: `wrapChannelMessage`, `findChannelEntry`

### 测试用例

```typescript
describe("wrapChannelMessage", () => {
  test("wraps content in <channel> tag with source attribute")
  test("escapes server name in attribute")
  test("includes meta attributes when provided")
  test("escapes meta values via escapeXmlAttr")
  test("filters out meta keys not matching SAFE_META_KEY pattern")
  test("handles empty meta")
  test("handles content with special characters")
  test("formats with newlines between tags and content")
})

describe("findChannelEntry", () => {
  test("finds server entry by exact name match")
  test("finds plugin entry by matching second segment")
  test("returns undefined for no match")
  test("handles empty channels array")
  test("handles server name without colon")
  test("handles 'plugin:name' format correctly")
  test("prefers exact match over partial match")
})
```

### Mock 需求
需 mock `escapeXmlAttr`（来自 xml.ts，已有测试）或直接使用
`CHANNEL_TAG` 常量需确认导出

---

## 4. `src/utils/__tests__/modelCost.test.ts` (~15 tests)

**源文件**: `src/utils/modelCost.ts` (232 行)
**目标函数**: `formatModelPricing`, `COST_TIER_*` 常量

### 测试用例

```typescript
describe("COST_TIER constants", () => {
  test("COST_TIER_3_15 has inputTokens=3, outputTokens=15")
  test("COST_TIER_15_75 has inputTokens=15, outputTokens=75")
  test("COST_TIER_5_25 has inputTokens=5, outputTokens=25")
  test("COST_TIER_30_150 has inputTokens=30, outputTokens=150")
  test("COST_HAIKU_35 has inputTokens=0.8, outputTokens=4")
  test("COST_HAIKU_45 has inputTokens=1, outputTokens=5")
})

describe("formatModelPricing", () => {
  test("formats integer prices without decimals: '$3/$15 per Mtok'")
  test("formats float prices with 2 decimals: '$0.80/$4.00 per Mtok'")
  test("formats mixed: '$5/$25 per Mtok'")
  test("formats large prices: '$30/$150 per Mtok'")
  test("formats $1/$5 correctly (integer but small)")
  test("handles zero prices: '$0/$0 per Mtok'")
})

describe("MODEL_COSTS", () => {
  test("maps known model names to cost tiers")
  test("contains entries for claude-sonnet-4-6")
  test("contains entries for claude-opus-4-6")
  test("contains entries for claude-haiku-4-5")
})
```

### Mock 需求
需 mock `log`, `slowOperations` 等重依赖（modelCost.ts 通常 import 链较重）
`formatModelPricing` 和 `COST_TIER_*` 是纯数据/纯函数，mock 成功后直接测
