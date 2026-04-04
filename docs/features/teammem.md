# TEAMMEM — 团队共享记忆

> Feature Flag: `FEATURE_TEAMMEM=1`
> 实现状态：完整可用（需要 Anthropic OAuth + GitHub remote）
> 引用数：51

## 一、功能概述

TEAMMEM 实现基于 GitHub 仓库的团队共享记忆系统。`memory/team/` 目录中的文件双向同步到 Anthropic 服务器，团队所有认证成员可共享项目知识。

### 核心特性

- **增量同步**：只上传内容哈希变化的文件（delta upload）
- **冲突解决**：基于 ETag 的乐观锁 + 412 冲突重试
- **密钥扫描**：上传前检测并跳过包含密钥的文件（PSR M22174）
- **路径穿越防护**：所有写入路径验证在 `memory/team/` 边界内
- **分批上传**：自动拆分超过 200KB 的 PUT 请求避免网关拒绝

## 二、用户交互

### 同步行为

| 事件 | 行为 |
|------|------|
| 项目启动 | 自动 pull 团队记忆到 `memory/team/` |
| 本地文件编辑 | watcher 检测变更，自动 push |
| 服务端更新 | 下次 pull 时覆盖本地（server-wins） |
| 密钥检测 | 跳过该文件，记录警告，不阻止其他文件同步 |

### API 端点

```
GET  /api/claude_code/team_memory?repo={owner/repo}             → 完整数据 + entryChecksums
GET  /api/claude_code/team_memory?repo={owner/repo}&view=hashes → 仅 checksums（冲突解决用）
PUT  /api/claude_code/team_memory?repo={owner/repo}             → 上传 entries（upsert 语义）
```

## 三、实现架构

### 3.1 同步状态

```ts
type SyncState = {
  lastKnownChecksum: string | null    // ETag 条件请求
  serverChecksums: Map<string, string> // sha256:<hex> 逐文件哈希
  serverMaxEntries: number | null      // 从 413 学习的服务端容量
}
```

### 3.2 Pull 流程（Server → Local）

文件：`src/services/teamMemorySync/index.ts:770-867`

```
pullTeamMemory(state)
      │
      ▼
检查 OAuth + GitHub remote
      │
      ▼
fetchTeamMemory(state, repo, etag)
  ├── 304 Not Modified → 返回（无变化）
  ├── 404 → 返回（服务端无数据）
  └── 200 → 解析 TeamMemoryData
      │
      ▼
刷新 serverChecksums（per-key hashes）
      │
      ▼
writeRemoteEntriesToLocal(entries)
  ├── 路径穿越验证（validateTeamMemKey）
  ├── 文件大小检查（> 250KB 跳过）
  ├── 内容比较（相同则跳过写入）
  └── 并行写入（Promise.all）
```

### 3.3 Push 流程（Local → Server）

文件：`src/services/teamMemorySync/index.ts:889-1146`

```
pushTeamMemory(state)
      │
      ▼
readLocalTeamMemory(maxEntries)
  ├── 递归扫描 memory/team/ 目录
  ├── 跳过超大文件（> 250KB）
  ├── 密钥扫描（scanForSecrets，gitleaks 规则）
  └── 按 serverMaxEntries 截断（如果已知）
      │
      ▼
计算 delta = 本地文件 - serverChecksums
  （只包含哈希不同的文件）
      │
      ▼
batchDeltaByBytes(delta)
  （拆分为 ≤200KB 的批次）
      │
      ▼
逐批 uploadTeamMemory(state, repo, batch, etag)
  ├── 200 成功 → 更新 serverChecksums
  ├── 412 冲突 → fetchTeamMemoryHashes() 刷新 checksums
  │              → 重试 delta 计算（最多 2 次）
  └── 413 超容量 → 学习 serverMaxEntries
```

### 3.4 密钥扫描

文件：`src/services/teamMemorySync/secretScanner.ts`

使用 gitleaks 规则模式扫描文件内容。检测到密钥时：
- 跳过该文件（不上传）
- 记录 `tengu_team_mem_secret_skipped` 事件（仅记录规则 ID，不记录值）
- 不阻止其他文件同步

### 3.5 文件监视

文件：`src/services/teamMemorySync/watcher.ts`

监视 `memory/team/` 目录变更，触发自动 push。抑制由 pull 写入引起的假变更。

### 3.6 路径安全

文件：`src/memdir/teamMemPaths.ts`

- `validateTeamMemKey(relPath)` — 验证相对路径不超出 `memory/team/` 边界
- `getTeamMemPath()` — 返回 team memory 根目录路径

## 四、关键设计决策

1. **Server-wins on pull, Local-wins on push**：pull 时服务端内容覆盖本地；push 时本地编辑覆盖服务端。本地用户正在编辑，不应被静默丢弃
2. **Delta upload**：只上传哈希变化的条目，节省带宽。首次 push 为全量，后续增量
3. **分批 PUT**：单次 PUT ≤200KB，避免 API 网关（~256-512KB）拒绝。每批独立 upsert，部分失败不影响已提交批次
4. **密钥扫描在上传前**：PSR M22174 要求密钥永不离开本机。扫描在 `readLocalTeamMemory` 中执行，密钥文件不进入上传集
5. **ETag 乐观锁**：push 使用 `If-Match` header。412 时 probe `?view=hashes`（只获取 checksums，不下载内容），刷新后重试
6. **服务端容量动态学习**：不假设客户端容量上限，从 413 的 `extra_details.max_entries` 学习

## 五、使用方式

```bash
# 启用 feature
FEATURE_TEAMMEM=1 bun run dev

# 前提条件：
# 1. 已通过 Anthropic OAuth 登录
# 2. 项目有 GitHub remote（git remote -v 显示 origin）
# 3. memory/team/ 目录自动创建
```

## 六、外部依赖

| 依赖 | 说明 |
|------|------|
| Anthropic OAuth | first-party 认证 |
| GitHub Remote | `getGithubRepo()` 获取 `owner/repo` 作为同步 scope |
| Team Memory API | `/api/claude_code/team_memory` 端点 |

## 七、文件索引

| 文件 | 行数 | 职责 |
|------|------|------|
| `src/services/teamMemorySync/index.ts` | 1257 | 核心同步逻辑（pull/push/sync） |
| `src/services/teamMemorySync/watcher.ts` | — | 文件监视 + 自动同步触发 |
| `src/services/teamMemorySync/secretScanner.ts` | — | gitleaks 密钥扫描 |
| `src/services/teamMemorySync/types.ts` | — | Zod schema + 类型定义 |
| `src/services/teamMemorySync/teamMemSecretGuard.ts` | — | 密钥防护辅助 |
| `src/memdir/teamMemPaths.ts` | — | 路径验证 + 目录管理 |
