# Phase 17 — Tool 子模块纯逻辑测试

> 创建日期：2026-04-02
> 预计：+150 tests / 11 files
> 目标：覆盖 Tool 目录下有丰富纯逻辑但零测试的子模块

---

## 17.1 `src/tools/PowerShellTool/__tests__/powershellSecurity.test.ts`（~25 tests）

**目标模块**: `src/tools/PowerShellTool/powershellSecurity.ts`（1091 行）

**安全关键** — 检测 ~20 种攻击向量。

| 测试分组 | 测试数 | 验证点 |
|---------|-------|--------|
| Invoke-Expression 检测 | 3 | `IEX`, `Invoke-Expression`, 变形 |
| Download cradle 检测 | 3 | `Net.WebClient`, `Invoke-WebRequest`, pipe |
| Privilege escalation | 3 | `Start-Process -Verb RunAs`, `runas.exe` |
| COM object | 2 | `New-Object -ComObject`, WScript.Shell |
| Scheduled tasks | 2 | `schtasks`, `Register-ScheduledTask` |
| WMI | 2 | `Invoke-WmiMethod`, `Get-WmiObject` |
| Module loading | 2 | `Import-Module` 从网络路径 |
| 安全命令通过 | 3 | `Get-Process`, `Get-ChildItem`, `Write-Host` |
| 混淆绕过尝试 | 3 | base64, 字符串拼接, 空格变形 |
| 组合命令 | 2 | `;` 分隔的多命令 |

**Mock**: 构造 `ParsedPowerShellCommand` 对象（不需要真实 AST）

---

## 17.2 `src/tools/PowerShellTool/__tests__/commandSemantics.test.ts`（~10 tests）

**目标模块**: `src/tools/PowerShellTool/commandSemantics.ts`（143 行）

| 测试用例 | 验证点 |
|---------|--------|
| grep exit 0/1/2 | 语义映射 |
| robocopy exit codes | Windows 特殊退出码 |
| findstr exit codes | Windows find 工具 |
| unknown command | 默认语义 |
| extractBaseCommand — basic | `grep "pattern" file` → `grep` |
| extractBaseCommand — path | `C:\tools\rg.exe` → `rg` |
| heuristicallyExtractBaseCommand | 模糊匹配 |

---

## 17.3 `src/tools/PowerShellTool/__tests__/destructiveCommandWarning.test.ts`（~15 tests）

**目标模块**: `src/tools/PowerShellTool/destructiveCommandWarning.ts`（110 行）

| 测试用例 | 验证点 |
|---------|--------|
| Remove-Item -Recurse -Force | 危险 |
| Format-Volume | 危险 |
| git reset --hard | 危险 |
| DROP TABLE | 危险 |
| Remove-Item (no -Force) | 安全 |
| Get-ChildItem | 安全 |
| 管道组合 | `rm -rf` + pipe |
| 大小写混合 | `ReMoVe-ItEm` |

---

## 17.4 `src/tools/PowerShellTool/__tests__/gitSafety.test.ts`（~12 tests）

**目标模块**: `src/tools/PowerShellTool/gitSafety.ts`（177 行）

| 测试用例 | 验证点 |
|---------|--------|
| normalizeGitPathArg — forward slash | 规范化 |
| normalizeGitPathArg — backslash | Windows 路径规范化 |
| normalizeGitPathArg — NTFS short name | `GITFI~1` → `.git` |
| isGitInternalPathPS — .git/config | true |
| isGitInternalPathPS — normal file | false |
| isDotGitPathPS — hidden git dir | true |
| isDotGitPathPS — .gitignore | false |
| bare repo attack | `.git` 路径遍历 |

---

## 17.5 `src/tools/LSPTool/__tests__/formatters.test.ts`（~20 tests）

**目标模块**: `src/tools/LSPTool/formatters.ts`（593 行）

| 测试用例 | 验证点 |
|---------|--------|
| formatGoToDefinitionResult — single | 单个定义 |
| formatGoToDefinitionResult — multiple | 多个定义（分组） |
| formatFindReferencesResult | 引用列表 |
| formatHoverResult — markdown | markdown 内容 |
| formatHoverResult — plaintext | 纯文本 |
| formatDocumentSymbolResult — classes | 类符号 |
| formatDocumentSymbolResult — functions | 函数符号 |
| formatDocumentSymbolResult — nested | 嵌套符号 |
| formatWorkspaceSymbolResult | 工作区符号 |
| formatPrepareCallHierarchyResult | 调用层次 |
| formatIncomingCallsResult | 入调用 |
| formatOutgoingCallsResult | 出调用 |
| empty results | 各函数空结果 |
| groupByFile helper | 文件分组逻辑 |

---

## 17.6 `src/tools/GrepTool/__tests__/utils.test.ts`（~10 tests）

**目标模块**: `src/tools/GrepTool/GrepTool.ts`（577 行）

| 测试用例 | 验证点 |
|---------|--------|
| applyHeadLimit — within limit | 不截断 |
| applyHeadLimit — exceeds limit | 正确截断 |
| applyHeadLimit — offset + limit | 分页逻辑 |
| applyHeadLimit — zero limit | 边界 |
| formatLimitInfo — basic | 格式化输出 |

**Mock**: `mock.module("src/utils/log.ts", ...)` 解锁导入

---

## 17.7 `src/tools/WebFetchTool/__tests__/utils.test.ts`（~15 tests）

**目标模块**: `src/tools/WebFetchTool/utils.ts`（531 行）

| 测试用例 | 验证点 |
|---------|--------|
| validateURL — valid http | 通过 |
| validateURL — valid https | 通过 |
| validateURL — ftp | 拒绝 |
| validateURL — no protocol | 拒绝 |
| validateURL — localhost | 处理 |
| isPermittedRedirect — same host | 允许 |
| isPermittedRedirect — different host | 拒绝 |
| isPermittedRedirect — subdomain | 处理 |
| isRedirectInfo — valid object | true |
| isRedirectInfo — invalid | false |

---

## 17.8 `src/tools/WebFetchTool/__tests__/preapproved.test.ts`（~10 tests）

**目标模块**: `src/tools/WebFetchTool/preapproved.ts`（167 行）

| 测试用例 | 验证点 |
|---------|--------|
| exact hostname match | 通过 |
| subdomain match | 处理 |
| path prefix match | `/docs/api` 匹配 |
| path non-match | `/internal` 不匹配 |
| unknown hostname | false |
| empty pathname | 边界 |

---

## 17.9 `src/tools/FileReadTool/__tests__/utils.test.ts`（~15 tests）

**目标模块**: `src/tools/FileReadTool/FileReadTool.ts`（1184 行）

| 测试用例 | 验证点 |
|---------|--------|
| isBlockedDevicePath — /dev/sda | true |
| isBlockedDevicePath — /dev/null | 处理 |
| isBlockedDevicePath — normal file | false |
| detectSessionFileType — .jsonl | 会话文件类型 |
| detectSessionFileType — unknown | 未知类型 |
| formatFileLines — basic | 行号格式 |
| formatFileLines — empty | 空文件 |

---

## 17.10 `src/tools/AgentTool/__tests__/agentToolUtils.test.ts`（~18 tests）

**目标模块**: `src/tools/AgentTool/agentToolUtils.ts`（688 行）

| 测试用例 | 验证点 |
|---------|--------|
| filterToolsForAgent — builtin only | 只返回内置工具 |
| filterToolsForAgent — exclude async | 排除异步工具 |
| filterToolsForAgent — permission mode | 权限过滤 |
| resolveAgentTools — wildcard | 通配符展开 |
| resolveAgentTools — explicit list | 显式列表 |
| countToolUses — multiple | 消息中工具调用计数 |
| countToolUses — zero | 无工具调用 |
| extractPartialResult — text only | 提取文本 |
| extractPartialResult — mixed | 混合内容 |
| getLastToolUseName — basic | 最后工具名 |
| getLastToolUseName — no tool use | 无工具调用 |

**Mock**: `mock.module("src/bootstrap/state.ts", ...)`, `mock.module("src/utils/log.ts", ...)`

---

## 17.11 `src/tools/LSPTool/__tests__/schemas.test.ts`（~5 tests）

**目标模块**: `src/tools/LSPTool/schemas.ts`（216 行）

| 测试用例 | 验证点 |
|---------|--------|
| isValidLSPOperation — goToDefinition | true |
| isValidLSPOperation — findReferences | true |
| isValidLSPOperation — hover | true |
| isValidLSPOperation — invalid | false |
| isValidLSPOperation — empty string | false |
