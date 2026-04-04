# Claude in Chrome MCP — 恢复计划

更新时间：2026-04-03
参考项目：`E:\源码\claude-code-source-main\claude-code-source-main`

## 1. 功能概述

Claude in Chrome 让 Claude Code CLI 通过 MCP 协议控制用户的 Chrome 浏览器：导航网页、填写表单、截图、录制 GIF、读取 DOM、执行 JS、监控网络请求和控制台日志。

通信方式有两种：
- **本地 Socket**：Chrome 扩展通过 Native Messaging Host 与 CLI 建立 Unix socket 连接
- **Bridge WebSocket**：通过 Anthropic 的 bridge 服务中转，支持远程浏览器

## 2. 完整加载链路

```
CLI 启动
  │
  ▼
src/main.tsx:1003
  .option('--chrome', 'Enable Claude in Chrome integration')
  │
  ▼
src/main.tsx:1522-1527
  setChromeFlagOverride(chromeOpts.chrome)
  │
  ▼
src/utils/claudeInChrome/setup.ts
  shouldEnableClaudeInChrome()
  ├── --chrome flag → true
  ├── --no-chrome flag → false
  ├── 非交互模式 → false
  ├── 环境变量 CLAUDE_CODE_DISABLE_CHROME → false
  ├── 配置 claudeInChromeDefaultEnabled → true/false
  └── Chrome 扩展已安装 + GrowthBook tengu_chrome_auto_enable → auto
  │
  ▼
src/utils/claudeInChrome/setup.ts
  setupClaudeInChrome()
  ├── 生成 MCP server 配置
  └── 返回 mcpConfig + allowedTools
  │
  ▼
src/utils/claudeInChrome/mcpServer.ts
  import { createClaudeForChromeMcpServer } from '@ant/claude-for-chrome-mcp'
  │
  ▼
packages/@ant/claude-for-chrome-mcp/src/index.ts  ← 当前是 STUB
  export function createClaudeForChromeMcpServer() { return null }
  export const BROWSER_TOOLS = []
```

## 3. 阻塞点清单

| # | 阻塞点 | 位置 | 状态 |
|---|--------|------|------|
| ① | `@ant/claude-for-chrome-mcp` 是 stub | `packages/@ant/claude-for-chrome-mcp/src/index.ts` | **6 行空壳，返回 null** |
| ② | 缺少完整实现（7 个文件，3038 行） | `packages/@ant/claude-for-chrome-mcp/src/` | 只有 1 个 stub 文件 |

**不需要任何 feature flag** — `/chrome` 命令无条件注册在 `src/commands.ts:264`。

**不需要改 `src/` 下任何文件** — 以下文件全部与参考项目 0 行差异：
- `src/utils/claudeInChrome/setup.ts`
- `src/utils/claudeInChrome/mcpServer.ts`
- `src/utils/claudeInChrome/common.ts`
- `src/utils/claudeInChrome/chromeNativeHost.ts`
- `src/utils/claudeInChrome/prompt.ts`
- `src/utils/claudeInChrome/setupPortable.ts`
- `src/utils/claudeInChrome/toolRendering.tsx`
- `src/commands/chrome/index.ts`
- `src/commands/chrome/chrome.tsx`（仅 sourcemap 差异）
- `src/skills/bundled/claudeInChrome.ts`

## 4. 参考项目完整实现清单

参考项目路径：`deps/@ant/claude-for-chrome-mcp/src/`

| 文件 | 行数 | 职责 |
|------|------|------|
| `index.ts` | 15 | 导出入口：`createBridgeClient`、`BROWSER_TOOLS`、`createChromeSocketClient`、`createClaudeForChromeMcpServer`、`localPlatformLabel` + 类型导出 |
| `types.ts` | 134 | 类型定义：`Logger`、`PermissionMode`、`BridgeConfig`、`ChromeExtensionInfo`、`ClaudeForChromeContext`、`SocketClient`、`BridgePermissionRequest/Response`、`PermissionOverrides` |
| `browserTools.ts` | 546 | 17 个浏览器工具定义（MCP tool schema） |
| `mcpServer.ts` | 96 | MCP Server 创建：注册 `ListTools`/`CallTool` handler，选择 socket/bridge 传输 |
| `mcpSocketClient.ts` | 493 | Unix Socket 客户端：连接 Chrome Native Messaging Host，JSON-RPC 通信 |
| `mcpSocketPool.ts` | 327 | Socket 连接池：多 Chrome profile 支持，按 tabId 路由 |
| `bridgeClient.ts` | 1126 | Bridge WebSocket 客户端：连接 Anthropic bridge 服务，扩展发现、设备配对、权限管理 |
| `toolCalls.ts` | 301 | 工具调用路由：连接状态处理、结果转换、权限模式切换、浏览器切换 |

### 17 个浏览器工具

| 工具名 | 功能 |
|--------|------|
| `javascript_tool` | 在页面上下文执行 JavaScript |
| `read_page` | 获取页面可访问性树（DOM） |
| `find` | 自然语言搜索页面元素 |
| `form_input` | 填写表单字段 |
| `computer` | 鼠标键盘操作 + 截图（13 种 action） |
| `navigate` | URL 导航 / 前进后退 |
| `resize_window` | 调整浏览器窗口尺寸 |
| `gif_creator` | GIF 录制和导出 |
| `upload_image` | 图片上传到文件输入框或拖拽区域 |
| `get_page_text` | 提取页面纯文本 |
| `tabs_context_mcp` | 获取当前标签组信息 |
| `tabs_create_mcp` | 创建新标签页 |
| `update_plan` | 向用户提交操作计划供审批 |
| `read_console_messages` | 读取浏览器控制台日志 |
| `read_network_requests` | 读取网络请求 |
| `shortcuts_list` | 列出可用快捷方式 |
| `shortcuts_execute` | 执行快捷方式 |
| `switch_browser` | 切换到其他 Chrome 浏览器（仅 bridge 模式） |

### 外部依赖

| 依赖 | 用途 | 我们项目是否已有 |
|------|------|----------------|
| `ws` | WebSocket 客户端（bridge 模式） | ✅ 有 |
| `@modelcontextprotocol/sdk` | MCP Server + 类型 | ✅ 有 |
| `fs`/`net`/`os`/`path` | Node.js 内置 | ✅ |

## 5. 修复步骤

### 步骤 1：复制完整实现到 stub 包目录

```bash
# 从参考项目复制 7 个文件（覆盖现有的 1 个 stub）
cp "E:/源码/claude-code-source-main/claude-code-source-main/deps/@ant/claude-for-chrome-mcp/src/"*.ts \
   "E:/源码/Claude-code-bast/packages/@ant/claude-for-chrome-mcp/src/"
```

复制后 `packages/@ant/claude-for-chrome-mcp/src/` 应包含 8 个文件：

```
packages/@ant/claude-for-chrome-mcp/src/
├── index.ts           ← 覆盖 stub（15 行，导出入口）
├── types.ts           ← 新增（134 行）
├── browserTools.ts    ← 新增（546 行）
├── mcpServer.ts       ← 新增（96 行）
├── mcpSocketClient.ts ← 新增（493 行）
├── mcpSocketPool.ts   ← 新增（327 行）
├── bridgeClient.ts    ← 新增（1126 行）
└── toolCalls.ts       ← 新增（301 行）
```

### 步骤 2：验证构建

```bash
bun run build
```

不需要改 `scripts/dev.ts` 或 `build.ts`（无 feature flag）。

### 步骤 3：功能验证

```bash
# 启动（手动启用 chrome）
bun run dev -- --chrome

# 在 REPL 中：
# 1. /chrome 命令应显示 Chrome 设置菜单
# 2. 如果 Chrome 扩展已安装 → 状态显示 "Enabled"
# 3. 如果未安装 → 提示安装扩展链接
```

## 6. 验证测试项

### 6.1 构建验证

| 测试项 | 预期结果 | 验证命令 |
|--------|---------|---------|
| build 成功 | 无报错 | `bun run build` |
| BROWSER_TOOLS 非空 | 产物中包含 17 个工具定义 | `grep "javascript_tool" dist/*.js` |
| createClaudeForChromeMcpServer 非 null | 产物中包含 MCP Server 创建逻辑 | `grep "ListToolsRequestSchema" dist/*.js` |
| Bridge WebSocket 逻辑在产物中 | 包含 bridge 连接代码 | `grep "bridge.claudeusercontent.com" dist/*.js` |

### 6.2 命令注册验证

| 测试项 | 预期结果 |
|--------|---------|
| `/chrome` 命令可见 | REPL 中输入 `/chrome` 显示设置菜单 |
| `--chrome` 参数可用 | `bun run dev -- --chrome` 不报错 |
| `--no-chrome` 参数可用 | `bun run dev -- --no-chrome` 不报错 |

### 6.3 MCP Server 验证（需要 Chrome 扩展）

| 测试项 | 预期结果 |
|--------|---------|
| Chrome 扩展检测 | 已安装扩展时 `/chrome` 显示 "Extension: Installed" |
| Socket 连接 | 扩展连接后 MCP tools 可用 |
| BROWSER_TOOLS 注册 | `tabs_context_mcp` 等 17 个工具在 MCP 工具列表中可见 |

### 6.4 工具功能验证（需要 Chrome 扩展 + 连接）

| 测试项 | 预期结果 |
|--------|---------|
| `tabs_context_mcp` | 返回当前标签组信息 |
| `navigate` | 能导航到指定 URL |
| `computer` + `screenshot` | 返回页面截图 |
| `read_page` | 返回 DOM 可访问性树 |
| `javascript_tool` | 执行 JS 并返回结果 |

### 6.5 不影响现有功能

| 测试项 | 预期结果 |
|--------|---------|
| 不带 `--chrome` 启动 | 正常运行，无 chrome 相关报错 |
| `/voice` 命令 | 不受影响 |
| `/schedule` 命令 | 不受影响 |
| `bun test` | 现有测试全部通过 |

## 7. 改动总结

| 操作 | 文件 | 说明 |
|------|------|------|
| 覆盖 stub | `packages/@ant/claude-for-chrome-mcp/src/index.ts` | 6 行 stub → 15 行完整导出 |
| 新增 | `packages/@ant/claude-for-chrome-mcp/src/types.ts` | 134 行类型定义 |
| 新增 | `packages/@ant/claude-for-chrome-mcp/src/browserTools.ts` | 546 行，17 个工具定义 |
| 新增 | `packages/@ant/claude-for-chrome-mcp/src/mcpServer.ts` | 96 行 MCP Server |
| 新增 | `packages/@ant/claude-for-chrome-mcp/src/mcpSocketClient.ts` | 493 行 Socket 客户端 |
| 新增 | `packages/@ant/claude-for-chrome-mcp/src/mcpSocketPool.ts` | 327 行连接池 |
| 新增 | `packages/@ant/claude-for-chrome-mcp/src/bridgeClient.ts` | 1126 行 Bridge 客户端 |
| 新增 | `packages/@ant/claude-for-chrome-mcp/src/toolCalls.ts` | 301 行工具调用路由 |

**不改动**：`src/` 下所有文件（已与参考项目一致）、`scripts/dev.ts`、`build.ts`。

## 8. 运行时依赖

| 依赖 | 必需？ | 说明 |
|------|--------|------|
| Chrome 浏览器 | 是 | 需安装 Chrome |
| Claude in Chrome 扩展 | 是 | 从 https://claude.ai/chrome 安装 |
| claude.ai OAuth 登录 | Bridge 模式需要 | 本地 Socket 模式不需要 |
| Native Messaging Host | 本地 Socket 需要 | 扩展安装时自动注册 |

## 9. 与 /voice、/schedule 恢复方式对比

| 项 | `/schedule` | `/voice` | Claude in Chrome |
|---|---|---|---|
| 编译开关 | `AGENT_TRIGGERS_REMOTE` | `VOICE_MODE` | **无需** |
| 改 dev.ts/build.ts | ✅ | ✅ | **不需要** |
| 缺失的 vendor 二进制 | 无 | `.node` 文件 | 无 |
| 需要替换的 stub | 无 | `audio-capture-napi` | `@ant/claude-for-chrome-mcp`（7 个文件） |
| 改动 src/ 源码 | 无 | 无 | 无 |
| 平台限制 | 无 | 需原生 `.node` | 需 Chrome 浏览器 |
