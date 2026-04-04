# WORKFLOW_SCRIPTS — 工作流自动化

> Feature Flag: `FEATURE_WORKFLOW_SCRIPTS=1`
> 实现状态：全部 Stub（7 个文件），布线完整
> 引用数：10

## 一、功能概述

WORKFLOW_SCRIPTS 实现基于文件的多步自动化工作流。用户可以定义 YAML/JSON 格式的工作流描述文件，系统将其解析为可执行的多 agent 步骤序列。提供 `/workflows` 命令管理和触发工作流。

## 二、实现架构

### 2.1 模块状态

| 模块 | 文件 | 状态 |
|------|------|------|
| WorkflowTool | `src/tools/WorkflowTool/WorkflowTool.ts` | **Stub** — 空对象 |
| Workflow 权限 | `src/tools/WorkflowTool/WorkflowPermissionRequest.ts` | **Stub** — 返回 null |
| 常量 | `src/tools/WorkflowTool/constants.ts` | **Stub** — 空工具名 |
| 命令创建 | `src/tools/WorkflowTool/createWorkflowCommand.ts` | **Stub** — 空操作 |
| 捆绑工作流 | `src/tools/WorkflowTool/bundled/` | **缺失** — 目录不存在 |
| 本地工作流任务 | `src/tasks/LocalWorkflowTask/LocalWorkflowTask.ts` | **Stub** — 类型 + 空操作 |
| UI 任务组件 | `src/components/tasks/src/tasks/LocalWorkflowTask/` | **Stub** — 空导出 |
| 详情对话框 | `src/components/tasks/WorkflowDetailDialog.ts` | **Stub** — 返回 null |
| 任务注册 | `src/tasks.ts` | **布线** — 动态加载 |
| 工具注册 | `src/tools.ts` | **布线** — 包含 bundled 工作流初始化 |
| 命令注册 | `src/commands.ts` | **布线** — `/workflows` 命令 |

### 2.2 预期数据流

```
用户定义工作流（YAML/JSON 文件）
         │
         ▼
/workflows 命令发现工作流文件
         │
         ▼
createWorkflowCommand() 解析为 Command 对象 [需要实现]
         │
         ▼
WorkflowTool 执行工作流 [需要实现]
         │
         ├── 步骤 1: Agent({ task: "..." })
         ├── 步骤 2: Agent({ task: "..." })
         └── 步骤 N: Agent({ task: "..." })
         │
         ▼
LocalWorkflowTask 协调步骤执行 [需要实现]
         │
         ▼
WorkflowDetailDialog 显示进度 [需要实现]
```

### 2.3 预期工作流 DSL

```
# workflow.yaml（预期格式，需要设计）
name: "代码审查工作流"
steps:
  - name: "静态分析"
    agent: { type: "general-purpose", prompt: "运行 lint 和类型检查" }
  - name: "测试"
    agent: { type: "general-purpose", prompt: "运行测试套件" }
  - name: "综合报告"
    agent: { type: "general-purpose", prompt: "综合分析结果写报告" }
```

## 三、需要补全的内容

| 优先级 | 模块 | 工作量 | 说明 |
|--------|------|--------|------|
| 1 | `WorkflowTool.ts` | 大 | Schema 定义 + 多步执行引擎 |
| 2 | `bundled/index.js` | 中 | 内置工作流定义（initBundledWorkflows） |
| 3 | `createWorkflowCommand.ts` | 中 | 从文件解析创建命令对象 |
| 4 | `LocalWorkflowTask.ts` | 大 | 步骤协调、kill/skip/retry |
| 5 | `WorkflowDetailDialog.ts` | 中 | 进度详情 UI |
| 6 | `WorkflowPermissionRequest.ts` | 小 | 权限对话框 |
| 7 | `constants.ts` | 小 | 工具名常量 |

## 四、关键设计决策

1. **基于文件的 DSL**：工作流定义为文件（YAML/JSON），版本控制友好
2. **多 Agent 步骤**：每个步骤是独立的 agent 任务，支持并行/串行
3. **内置工作流**：`bundled/` 目录提供开箱即用的常用工作流
4. **/workflows 命令**：统一的发现和触发入口

## 五、使用方式

```bash
# 启用 feature（需要补全后才能真正使用）
FEATURE_WORKFLOW_SCRIPTS=1 bun run dev
```

## 六、文件索引

| 文件 | 职责 |
|------|------|
| `src/tools/WorkflowTool/WorkflowTool.ts` | 工具定义（stub） |
| `src/tools/WorkflowTool/WorkflowPermissionRequest.ts` | 权限对话框（stub） |
| `src/tools/WorkflowTool/constants.ts` | 常量（stub） |
| `src/tools/WorkflowTool/createWorkflowCommand.ts` | 命令创建（stub） |
| `src/tasks/LocalWorkflowTask/LocalWorkflowTask.ts` | 任务协调（stub） |
| `src/components/tasks/WorkflowDetailDialog.ts` | 详情对话框（stub） |
| `src/tools.ts:127-132` | 工具注册 |
| `src/commands.ts:86-89` | 命令注册 |
