# ULTRAPLAN（增强规划）实现分析

> 生成日期：2026-04-02
> Feature Flag：`FEATURE_ULTRAPLAN=1`
> 引用数：10（跨 8 个文件）

---

## 一、功能概述

ULTRAPLAN 是一个**远程增强规划**功能，将用户的规划请求发送到 Claude Code on the Web（CCR，云端容器）执行。使用 Opus 模型在云端生成高级计划，用户可以在浏览器中编辑和审批，然后选择在云端继续执行或将计划"传送"回本地终端执行。

**核心卖点**：
- 终端不被阻塞 — 远程在云端规划，本地可继续工作
- 使用最强大的模型（Opus）
- 用户可在浏览器中实时查看和编辑计划
- 支持多轮迭代（云端可追问，用户在浏览器回复）

---

## 二、架构总览

```
用户输入 "ultraplan xxx"
        │
        ▼
┌─────────────────────────────────┐
│  关键字检测层 (keyword.ts)       │  识别 "ultraplan" 关键字
│  + 输入处理层 (processUserInput) │  重写为 /ultraplan 命令
└───────────┬─────────────────────┘
            │
            ▼
┌─────────────────────────────────┐
│  命令处理层 (ultraplan.tsx)      │  launchUltraplan()
│  - 前置校验（资格、防重入）      │  → launchDetached()
│  - 构建提示词                    │  buildUltraplanPrompt()
└───────────┬─────────────────────┘
            │
            ▼
┌─────────────────────────────────┐
│  远程会话层                      │  teleportToRemote()
│  - 创建 CCR 云端会话             │  permissionMode: 'plan'
│  - 设置 plan 权限模式            │  model: Opus
└───────────┬─────────────────────┘
            │
            ▼
┌─────────────────────────────────┐
│  轮询层 (ccrSession.ts)         │  pollForApprovedExitPlanMode()
│  - ExitPlanModeScanner          │  每 3 秒轮询事件流
│  - 状态机: running → needs_input │  超时: 30 分钟
│                → plan_ready      │
└───────────┬─────────────────────┘
            │
      ┌─────┴─────┐
      ▼           ▼
   approved    teleport
  (云端执行)   (传送回本地)
      │           │
      │           ▼
      │    UltraplanChoiceDialog
      │    用户选择执行方式
      ▼           ▼
   完成通知    本地执行计划
```

---

## 三、模块详解

### 3.1 关键字检测 — `src/utils/ultraplan/keyword.ts`

负责检测用户输入中的 "ultraplan" 关键字。检测逻辑相当精细，避免误触发：

**触发条件**：输入中包含独立的 `ultraplan` 单词（大小写不敏感）。

**不触发的场景**：
- 在引号/括号内：`` `ultraplan` ``、`"ultraplan"`、`[ultraplan]`、`{ultraplan}`
- 路径/标识符上下文：`src/ultraplan/foo.ts`、`ultraplan.tsx`、`--ultraplan-mode`
- 问句：`ultraplan?`
- 斜杠命令内：`/rename ultraplan foo`
- 已有 ultraplan 会话运行中或正在启动时

**关键字替换**：触发后将 `ultraplan` 替换为 `plan`，保持语法通顺（如 "please ultraplan this" → "please plan this"）。

```typescript
// 核心导出函数
findUltraplanTriggerPositions(text)  // 返回触发位置数组
hasUltraplanKeyword(text)            // 布尔判断
replaceUltraplanKeyword(text)        // 替换第一个触发词为 "plan"
```

### 3.2 命令注册 — `src/commands.ts`

```typescript
const ultraplan = feature('ULTRAPLAN')
  ? require('./commands/ultraplan.js').default
  : null
```

命令仅在 `FEATURE_ULTRAPLAN=1` 时加载。命令定义：

```typescript
{
  type: 'local-jsx',
  name: 'ultraplan',
  description: '~10–30 min · Claude Code on the web drafts an advanced plan...',
  argumentHint: '<prompt>',
  isEnabled: () => process.env.USER_TYPE === 'ant',  // 仅 ant 用户可用
}
```

> 注意：`isEnabled` 检查 `USER_TYPE === 'ant'`（Anthropic 内部用户），这是命令级限制。关键字触发路径没有此限制，只要 feature flag 开启即可。

### 3.3 核心命令实现 — `src/commands/ultraplan.tsx`

#### 3.3.1 入口函数 `call()`

处理 `/ultraplan <prompt>` 斜杠命令：

1. **无参数调用**：显示使用帮助文本
2. **已有活跃会话**：返回 "already polling" 提示
3. **正常调用**：设置 `ultraplanLaunchPending` 状态，触发 `UltraplanLaunchDialog` 对话框

#### 3.3.2 `launchUltraplan()`

公共启动入口，被三个路径共享：
- 斜杠命令 (`/ultraplan`)
- 关键字触发 (`processUserInput.ts`)
- Plan 审批对话框的 "Ultraplan" 按钮 (`ExitPlanModePermissionRequest`)

关键逻辑：
1. 防重入检查（`ultraplanSessionUrl` / `ultraplanLaunching`）
2. 同步设置 `ultraplanLaunching = true` 防止竞态
3. 异步调用 `launchDetached()`
4. 立即返回启动消息（不等远程会话创建）

#### 3.3.3 `launchDetached()`

异步后台流程：

1. **获取模型**：从 GrowthBook 读取 `tengu_ultraplan_model`，默认 `opus46` 的 firstParty ID
2. **资格检查**：`checkRemoteAgentEligibility()` — 验证用户是否有权限使用远程 agent
3. **构建提示词**：`buildUltraplanPrompt(blurb, seedPlan)`
   - 如有 `seedPlan`（来自 plan 审批对话框），作为草稿前缀
   - 加载 `prompt.txt` 中的指令模板
   - 附加用户 blurb
4. **创建远程会话**：`teleportToRemote()`
   - `permissionMode: 'plan'` — 远程以 plan 模式运行
   - `ultraplan: true` — 标记为 ultraplan 会话
   - `useDefaultEnvironment: true` — 使用默认云端环境
5. **注册任务**：`registerRemoteAgentTask()` 创建 `RemoteAgentTask` 追踪条目
6. **启动轮询**：`startDetachedPoll()` 后台轮询审批状态

#### 3.3.4 提示词构建

```
buildUltraplanPrompt(blurb, seedPlan?)
```

- `prompt.txt`：当前为空文件（反编译丢失），原始内容应包含指导远程 agent 生成计划的系统指令
- 开发者可通过 `ULTRAPLAN_PROMPT_FILE` 环境变量覆盖提示词文件（仅 `USER_TYPE=ant` 时生效）

#### 3.3.5 `startDetachedPoll()`

后台轮询管理：

1. 调用 `pollForApprovedExitPlanMode()` 等待计划审批
2. 阶段变化时更新 `RemoteAgentTask.ultraplanPhase`（UI 展示）
3. 审批完成后的两种路径：
   - **`executionTarget: 'remote'`**：用户选择在云端执行
     - 标记任务完成
     - 清除 `ultraplanSessionUrl`
     - 发送通知：结果将以 PR 形式提交
   - **`executionTarget: 'local'`**：用户选择传送回本地（teleport）
     - 设置 `ultraplanPendingChoice`
     - 触发 `UltraplanChoiceDialog` 对话框
4. 失败时：归档远程会话、清除状态、发送错误通知

#### 3.3.6 `stopUltraplan()`

用户主动停止：

1. `RemoteAgentTask.kill()` 归档远程会话
2. 清除所有 ultraplan 状态（`ultraplanSessionUrl`、`ultraplanPendingChoice`、`ultraplanLaunching`）
3. 发送停止通知

### 3.4 CCR 会话轮询 — `src/utils/ultraplan/ccrSession.ts`

#### 3.4.1 `ExitPlanModeScanner`

纯状态机，无 I/O。摄入 `SDKMessage[]` 事件批次，分类 `ExitPlanMode` 工具调用的结果。

**状态类型**：

```typescript
type ScanResult =
  | { kind: 'approved' }   // 用户批准了计划
  | { kind: 'teleport' }   // 用户点击"传送回本地"
  | { kind: 'rejected' }   // 用户拒绝（可继续迭代）
  | { kind: 'pending' }    // 等待用户审批中
  | { kind: 'terminated' } // 远程会话意外终止
  | { kind: 'unchanged' }  // 无新事件，状态不变
```

**优先级**：approved > terminated > rejected > pending > unchanged

**关键设计**：
- 同一批事件可能包含审批和后续崩溃 — 不丢弃已审批的计划
- 拒绝后重新扫描（`rescanAfterRejection`），因为新事件可能包含修改后的计划
- 使用 `is_error: true` 判断拒绝，`content` 中查找标记提取计划文本

#### 3.4.2 `pollForApprovedExitPlanMode()`

轮询主循环：

- **轮询间隔**：3 秒
- **超时**：30 分钟
- **容错**：连续 5 次网络错误才放弃
- **阶段推断**：
  - `hasPendingPlan`（有 ExitPlanMode 无结果）→ `plan_ready`
  - `quietIdle`（空闲且无新事件）→ `needs_input`（远程在等用户输入）
  - 其他 → `running`

#### 3.4.3 计划文本提取

两种提取路径：

1. **Approved**：从 `tool_result` 中查找 `## Approved Plan:\n` 或 `## Approved Plan (edited by user):\n` 标记
2. **Teleport**：从 `tool_result` 中查找 `__ULTRAPLAN_TELEPORT_SENTINEL__` 标记（浏览器端嵌入）

### 3.5 输入处理集成 — `src/utils/processUserInput/processUserInput.ts`

关键字触发路径（在斜杠命令处理之前）：

```typescript
if (feature('ULTRAPLAN') &&
    mode === 'prompt' &&               // 非非交互模式
    !isNonInteractiveSession &&         // 非后台会话
    inputString !== null &&
    !inputString.startsWith('/') &&     // 非斜杠命令
    !ultraplanSessionUrl &&             // 无活跃会话
    !ultraplanLaunching &&              // 非正在启动
    hasUltraplanKeyword(inputString)) {
  // 重写为 /ultraplan 命令
  const rewritten = replaceUltraplanKeyword(inputString).trim()
  await processSlashCommand(`/ultraplan ${rewritten}`, ...)
}
```

### 3.6 UI 层

#### 3.6.1 彩虹高亮 — `src/components/PromptInput/PromptInput.tsx`

当输入中检测到 `ultraplan` 关键字时：
- 对每个字符施加**彩虹渐变色**高亮（`getRainbowColor()`）
- 显示通知："This prompt will launch an ultraplan session in Claude Code on the web"

#### 3.6.2 预启动对话框 — `UltraplanLaunchDialog`

在 REPL 的 `focusedInputDialog === 'ultraplan-launch'` 时渲染。

用户选择：
- **确认**：调用 `launchUltraplan()`，先添加命令回显，异步启动远程会话
- **取消**：清除 `ultraplanLaunchPending` 状态

#### 3.6.3 计划选择对话框 — `UltraplanChoiceDialog`

在 `focusedInputDialog === 'ultraplan-choice'` 时渲染。

当 teleport 路径返回已审批计划时，用户可选择执行方式。

#### 3.6.4 Plan 审批按钮 — `ExitPlanModePermissionRequest`

本地 Plan Mode 的审批对话框中，如果 `feature('ULTRAPLAN')` 开启，会显示额外的 "Ultraplan" 按钮：
- 将当前本地计划作为 `seedPlan` 发送给远程
- 按钮仅在无活跃 ultraplan 会话时显示

### 3.7 应用状态 — `src/state/AppStateStore.ts`

```typescript
interface AppState {
  ultraplanLaunching?: boolean    // 防重入锁（5 秒窗口）
  ultraplanSessionUrl?: string    // 活跃远程会话 URL
  ultraplanPendingChoice?: {      // 已审批计划等待选择
    plan: string
    sessionId: string
    taskId: string
  }
  ultraplanLaunchPending?: {      // 预启动对话框
    blurb: string
  }
  isUltraplanMode?: boolean       // 远程端：CCR 侧的 ultraplan 标记
}
```

### 3.8 远程任务追踪 — `src/tasks/RemoteAgentTask/RemoteAgentTask.tsx`

Ultraplan 使用 `RemoteAgentTask` 基础设施追踪远程会话：

```typescript
registerRemoteAgentTask({
  remoteTaskType: 'ultraplan',
  session: { id, title },
  command: blurb,
  isUltraplan: true  // 特殊标记，跳过通用轮询逻辑
})
```

`extractPlanFromLog()` 从 `<ultraplan>...</ultraplan>` XML 标签中提取计划内容。

---

## 四、数据流时序

```
时间线 →

用户                    本地 CLI                     CCR 云端
 │                       │                             │
 │ "ultraplan xxx"       │                             │
 │──────────────────────>│                             │
 │                       │ keyword 检测 + 重写          │
 │                       │ /ultraplan "plan xxx"        │
 │                       │                             │
 │  [UltraplanLaunch     │                             │
 │   Dialog]             │                             │
 │──── confirm ─────────>│                             │
 │                       │ launchDetached()             │
 │                       │─────────────────────────────>│
 │                       │  teleportToRemote()          │
 │                       │  (permissionMode: 'plan')    │
 │                       │                             │
 │  "Starting..."        │                             │
 │<──────────────────────│                             │
 │                       │                             │
 │  (终端空闲，可继续)    │  startDetachedPoll()        │
 │                       │  ═══ 3s 轮询循环 ═══         │
 │                       │                             │
 │                       │                   [浏览器打开]│
 │                       │                   [云端生成计划]
 │                       │                             │
 │                       │  ← needs_input ─────────────│
 │                       │    (云端追问用户)             │
 │                       │                             │
 │                       │                   [用户在浏览器回复]
 │                       │                             │
 │                       │  ← plan_ready ──────────────│
 │                       │    (ExitPlanMode 等待审批)    │
 │                       │                             │
 │                       │                   [用户审批/编辑]
 │                       │                             │
 │               ┌───────┤  ← approved ────────────────│
 │               │       │                             │
 │    [远程执行]  │       │                             │
 │    通知完成    │       │                             │
 │               │       │                             │
 │               └── OR ─┤  ← teleport ───────────────│
 │                       │                             │
 │  [UltraplanChoice     │                             │
 │   Dialog]             │                             │
 │── 选择执行方式 ───────>│                             │
 │                       │ 本地执行计划                  │
```

---

## 五、关键文件清单

| 文件 | 职责 |
|------|------|
| `src/utils/ultraplan/keyword.ts` | 关键字检测、高亮位置计算、关键字替换 |
| `src/utils/ultraplan/ccrSession.ts` | CCR 会话轮询、ExitPlanMode 状态机、计划文本提取 |
| `src/utils/ultraplan/prompt.txt` | 远程指令模板（当前为空，需重建） |
| `src/commands/ultraplan.tsx` | `/ultraplan` 命令、启动/停止逻辑、提示词构建 |
| `src/utils/processUserInput/processUserInput.ts` | 关键字触发 → `/ultraplan` 命令路由 |
| `src/components/PromptInput/PromptInput.tsx` | 彩虹高亮 + 通知提示 |
| `src/screens/REPL.tsx` | 对话框渲染（UltraplanLaunchDialog / UltraplanChoiceDialog） |
| `src/components/permissions/ExitPlanModePermissionRequest/` | Plan 审批中的 "Ultraplan" 按钮 |
| `src/state/AppStateStore.ts` | ultraplan 相关状态字段定义 |
| `src/tasks/RemoteAgentTask/RemoteAgentTask.tsx` | 远程任务追踪 + `<ultraplan>` 标签提取 |
| `src/constants/xml.ts` | `ULTRAPLAN_TAG = 'ultraplan'` |

---

## 六、依赖关系

### 外部依赖

| 依赖 | 用途 | 必要性 |
|------|------|--------|
| `teleportToRemote()` | 创建 CCR 云端会话 | 必须 — 核心功能 |
| `checkRemoteAgentEligibility()` | 验证用户远程 agent 使用资格 | 必须 — 前置检查 |
| `archiveRemoteSession()` | 归档/终止远程会话 | 必须 — 清理 |
| GrowthBook `tengu_ultraplan_model` | 获取使用的模型 ID | 可选 — 默认 opus46 |
| `@anthropic-ai/sdk` | SDKMessage 类型 | 必须 — 类型定义 |
| `pollRemoteSessionEvents()` | 事件流分页轮询 | 必须 — 轮询基础设施 |

### 内部依赖

- **ExitPlanModeV2Tool**：远程端调用的工具，触发 plan 审批流程
- **RemoteAgentTask**：任务追踪和状态管理基础设施
- **AppState Store**：ultraplan 状态管理

---

## 七、当前状态与补全要点

| 组件 | 状态 | 说明 |
|------|------|------|
| 关键字检测 | ✅ 完整 | `keyword.ts` 逻辑完善 |
| 命令框架 | ✅ 完整 | 注册、路由、防重入完整 |
| 启动流程 | ✅ 完整 | `launchUltraplan` / `launchDetached` 完整 |
| CCR 轮询 | ✅ 完整 | `ccrSession.ts` 状态机完整 |
| UI 高亮/通知 | ✅ 完整 | 彩虹高亮 + 提示通知完整 |
| 状态管理 | ✅ 完整 | AppState 字段完整 |
| `prompt.txt` | ❌ 空文件 | 需要重建远程指令模板 |
| `UltraplanLaunchDialog` | ⚠️ 全局声明 | 组件实现未找到（可能在内置包中） |
| `UltraplanChoiceDialog` | ⚠️ 全局声明 | 组件实现未找到（可能在内置包中） |
| `isEnabled` 限制 | ⚠️ `USER_TYPE === 'ant'` | 命令级限制，仅 Anthropic 内部用户 |

### 补全建议

1. **重建 `prompt.txt`**：这是远程 agent 的核心指令，定义如何进行多 agent 探索式规划。需要设计：
   - 规划方法论（多角度分析、风险评估、分阶段执行）
   - ExitPlanMode 工具的使用引导
   - 输出格式要求

2. **对话框组件**：`UltraplanLaunchDialog` 和 `UltraplanChoiceDialog` 在 `global.d.ts` 中声明但实现缺失，需要新建：
   - Launch Dialog：确认对话框（含 CCR 使用条款链接）
   - Choice Dialog：展示已审批计划 + 执行方式选择

3. **放宽 `isEnabled`**：如果要让非 ant 用户使用斜杠命令，需移除 `USER_TYPE === 'ant'` 检查

---

## 八、与相关 Feature 的关系

| Feature | 关系 |
|---------|------|
| `ULTRATHINK` | 类似的高能力模式，但 `ULTRATHINK` 只调高 effort，不启动远程会话 |
| `FORK_SUBAGENT` | Ultraplan 不使用 fork subagent，使用的是 CCR 远程 agent |
| `COORDINATOR_MODE` | 不同范式的多 agent，Coordinator 在本地编排，Ultraplan 在云端 |
| `BRIDGE_MODE` | 底层依赖相同的 `teleportToRemote()` 基础设施 |
| `ExitPlanModeTool` | 远程端的审批机制，Ultraplan 的核心交互模型 |
