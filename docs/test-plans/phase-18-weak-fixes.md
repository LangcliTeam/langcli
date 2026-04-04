# Phase 18 — WEAK 修复 + ACCEPTABLE 加固

> 创建日期：2026-04-02
> 预计：+30 tests / 4 files (修改现有)
> 目标：修复所有 WEAK 评分测试文件，消除系统性问题

---

## 18.1 `src/utils/__tests__/format.test.ts` — 断言精确化（+5 tests）

**问题**: `formatNumber`/`formatTokens`/`formatRelativeTime` 使用 `toContain`
**修复**: 改为 `toBe` 精确匹配

```diff
- expect(formatNumber(1500000)).toContain("1.5")
+ expect(formatNumber(1500000)).toBe("1.5m")
```

新增测试：

| 测试用例 | 验证点 |
|---------|--------|
| formatNumber — 0 | `"0"` |
| formatNumber — billions | `"1.5b"` |
| formatTokens — thousands | 精确匹配 |
| formatRelativeTime — hours ago | 精确匹配 |
| formatRelativeTime — days ago | 精确匹配 |

---

## 18.2 `src/utils/__tests__/envValidation.test.ts` — Bug 确认（+3 tests）

**问题**: `value=1, lowerBound=100` 返回 `status: "valid"` — 函数名暗示有下界检查
**计划**: 先读取源码确认 `defaultValue` 和 `lowerBound` 的语义关系，然后：
- 如果是源码 bug → 在测试中注释标记，不修改源码
- 如果是设计意图 → 更新测试描述明确语义

新增测试：

| 测试用例 | 验证点 |
|---------|--------|
| parseFloat truncation | `"50.9"` → 50 |
| whitespace handling | `" 500 "` → 500 |
| very large number | overflow 处理 |

---

## 18.3 `src/utils/permissions/__tests__/PermissionMode.test.ts` — false 路径（+8 tests）

**问题**: `isExternalPermissionMode` false 路径从未执行
**修复**: 覆盖所有 5 种 mode 的 true/false 期望

| 测试用例 | 验证点 |
|---------|--------|
| isExternalPermissionMode — plan | false |
| isExternalPermissionMode — auto | false |
| isExternalPermissionMode — default | false |
| permissionModeFromString — all modes | 5 种 mode 全覆盖 |
| permissionModeFromString — invalid | 默认值 |
| permissionModeFromString — case insensitive | 大小写 |
| isPermissionMode — valid strings | true |
| isPermissionMode — invalid strings | false |

---

## 18.4 `src/tools/shared/__tests__/gitOperationTracking.test.ts` — mock analytics（+4 tests）

**问题**: 未 mock analytics 依赖，测试产生副作用
**修复**: 添加 `mock.module("src/services/analytics/...", ...)`

新增测试：

| 测试用例 | 验证点 |
|---------|--------|
| parseGitCommitId — all GH PR actions | 补齐 6 个 action |
| detectGitOperation — no analytics call | mock 验证 |
| detectGitCommitId — various formats | SHA/短 SHA/HEAD |
| git operation tracking — edge cases | 空输入、畸形输入 |

---

## 排除清单

以下模块 **不纳入测试**，原因合理：

| 模块 | 行数 | 排除原因 |
|------|------|---------|
| `query.ts` | 1732 | 核心循环，40+ 依赖，需完整集成环境 |
| `QueryEngine.ts` | 1320 | 编排器，30+ 依赖 |
| `utils/hooks.ts` | 5121 | 51 exports，spawn 子进程 |
| `utils/config.ts` | 1817 | 文件系统 + lockfile + 全局状态 |
| `utils/auth.ts` | 2002 | 多 provider 认证，平台特定 |
| `utils/fileHistory.ts` | 1115 | 重 I/O 文件备份 |
| `utils/sessionRestore.ts` | 551 | 恢复状态涉及多个子系统 |
| `utils/ripgrep.ts` | 679 | spawn 子进程 |
| `utils/yaml.ts` | 15 | 两行 wrapper |
| `utils/lockfile.ts` | 43 | trivial wrapper |
| `screens/` / `components/` | — | Ink 渲染测试环境 |
| `bridge/` / `remote/` / `ssh/` | — | 网络层 |
| `daemon/` / `server/` | — | 进程管理 |

---

## 预期成果

| 指标 | Phase 16 后 | Phase 17 后 | Phase 18 后 |
|------|-----------|-----------|-----------|
| 测试数 | ~1417 | ~1567 | ~1597 |
| 文件数 | 76 | 87 | 91 |
| WEAK 文件 | 6 | 4 | **0** |
