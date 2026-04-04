# EXPERIMENTAL_SKILL_SEARCH — 技能语义搜索

> Feature Flag: `FEATURE_EXPERIMENTAL_SKILL_SEARCH=1`
> 实现状态：全部 Stub（8 个文件），布线完整
> 引用数：21

## 一、功能概述

EXPERIMENTAL_SKILL_SEARCH 提供 DiscoverSkills 工具，根据当前任务语义搜索可用技能。目标是让模型在执行任务时自动发现和推荐相关的技能（包括本地和远程），无需用户手动查找。

## 二、实现架构

### 2.1 模块状态

| 模块 | 文件 | 状态 | 说明 |
|------|------|------|------|
| DiscoverSkillsTool | `src/tools/DiscoverSkillsTool/prompt.ts` | **Stub** | 空工具名 |
| 预取 | `src/services/skillSearch/prefetch.ts` | **Stub** | 3 个函数全部空操作 |
| 远程加载 | `src/services/skillSearch/remoteSkillLoader.ts` | **Stub** | 返回空结果 |
| 远程状态 | `src/services/skillSearch/remoteSkillState.ts` | **Stub** | 返回 null/undefined |
| 信号 | `src/services/skillSearch/signals.ts` | **Stub** | `DiscoverySignal = any` |
| 遥测 | `src/services/skillSearch/telemetry.ts` | **Stub** | 空操作日志 |
| 本地搜索 | `src/services/skillSearch/localSearch.ts` | **Stub** | 空操作缓存 |
| 功能检查 | `src/services/skillSearch/featureCheck.ts` | **Stub** | `isSkillSearchEnabled => false` |
| SkillTool 集成 | `src/tools/SkillTool/SkillTool.ts` | **布线** | 动态加载所有远程技能模块 |
| 提示集成 | `src/constants/prompts.ts` | **布线** | DiscoverSkills schema 注入 |

### 2.2 预期数据流

```
模型处理用户任务
      │
      ▼
DiscoverSkills 工具触发 [需要实现]
      │
      ├── 本地搜索：索引已安装技能元数据
      │   └── localSearch.ts → 技能名称/描述/关键字匹配
      │
      └── 远程搜索：查询技能市场/注册表
          └── remoteSkillLoader.ts → fetch + 解析
      │
      ▼
结果排序和过滤
      │
      ▼
返回推荐技能列表
      │
      ▼
模型使用 SkillTool 调用推荐技能
```

### 2.3 预取机制

`prefetch.ts` 预期在用户提交输入前分析消息内容，提前搜索相关技能：

- `startSkillDiscoveryPrefetch()` — 开始预取
- `collectSkillDiscoveryPrefetch()` — 收集预取结果
- `getTurnZeroSkillDiscovery()` — 获取 turn 0 的技能发现结果

## 三、需要补全的内容

| 优先级 | 模块 | 工作量 | 说明 |
|--------|------|--------|------|
| 1 | `DiscoverSkillsTool` | 大 | 语义搜索工具 schema + 执行 |
| 2 | `skillSearch/prefetch.ts` | 中 | 用户输入分析和预取逻辑 |
| 3 | `skillSearch/remoteSkillLoader.ts` | 大 | 远程市场/注册表获取 |
| 4 | `skillSearch/remoteSkillState.ts` | 小 | 已发现技能状态管理 |
| 5 | `skillSearch/localSearch.ts` | 中 | 本地索引构建/查询 |
| 6 | `skillSearch/featureCheck.ts` | 小 | GrowthBook/配置门控 |
| 7 | `skillSearch/signals.ts` | 小 | `DiscoverySignal` 类型定义 |

## 四、关键设计决策

1. **预取优化**：在用户提交前就开始搜索，减少首次响应延迟
2. **本地+远程双搜索**：本地索引快速匹配 + 远程市场深度搜索
3. **SkillTool 集成**：发现的技能通过 SkillTool 调用，不需要新的调用机制
4. **独立于 MCP_SKILLS**：MCP_SKILLS 从 MCP 服务器发现，EXPERIMENTAL_SKILL_SEARCH 从技能市场发现

## 五、使用方式

```bash
# 启用 feature（需要补全后才能真正使用）
FEATURE_EXPERIMENTAL_SKILL_SEARCH=1 bun run dev
```

## 六、文件索引

| 文件 | 职责 |
|------|------|
| `src/tools/DiscoverSkillsTool/prompt.ts` | 工具 schema（stub） |
| `src/services/skillSearch/prefetch.ts` | 预取逻辑（stub） |
| `src/services/skillSearch/remoteSkillLoader.ts` | 远程加载（stub） |
| `src/services/skillSearch/remoteSkillState.ts` | 远程状态（stub） |
| `src/services/skillSearch/signals.ts` | 信号类型（stub） |
| `src/services/skillSearch/telemetry.ts` | 遥测（stub） |
| `src/services/skillSearch/localSearch.ts` | 本地搜索（stub） |
| `src/services/skillSearch/featureCheck.ts` | 功能检查（stub） |
| `src/tools/SkillTool/SkillTool.ts` | SkillTool 集成点 |
| `src/constants/prompts.ts:95,335,778` | 提示增强 |
