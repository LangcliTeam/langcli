# Phase 16 — 零依赖纯函数测试

> 创建日期：2026-04-02
> 预计：+120 tests / 8 files
> 目标：覆盖所有零外部依赖的纯函数/类模块

所有模块均为纯函数或零外部依赖类，mock 成本为零，ROI 最高。

---

## 16.1 `src/utils/__tests__/stream.test.ts`（~15 tests）

**目标模块**: `src/utils/stream.ts`（76 行）
**导出**: `Stream<T>` class — 手动异步队列，实现 `AsyncIterator<T>`

| 测试用例 | 验证点 |
|---------|--------|
| enqueue then read | 单条消息正确传递 |
| enqueue multiple then drain | 多条消息顺序消费 |
| done resolves pending readers | `done()` 后迭代结束 |
| done with no pending readers | 无等待时安全关闭 |
| error rejects pending readers | `error(e)` 传播异常 |
| error after done | 后续操作安全处理 |
| single-iteration guard | `return()` 后不可再迭代 |
| empty stream done immediately | 无数据时 done 返回 `{ done: true }` |
| concurrent enqueue | 多次 enqueue 不丢失 |
| backpressure | reader 慢于 writer 时不丢数据 |

---

## 16.2 `src/utils/__tests__/abortController.test.ts`（~12 tests）

**目标模块**: `src/utils/abortController.ts`（99 行）
**导出**: `createAbortController()`, `createChildAbortController()`

| 测试用例 | 验证点 |
|---------|--------|
| parent abort propagates to child | `parent.abort()` → child aborted |
| child abort does NOT propagate to parent | `child.abort()` → parent still active |
| already-aborted parent → child immediately aborted | 创建时即继承 abort 状态 |
| child listener cleanup after parent abort | WeakRef 回收后无泄漏 |
| multiple children of same parent | 独立 abort 传播 |
| child abort then parent abort | 顺序无关 |
| signal.maxListeners raised | MaxListenersExceededWarning 不触发 |

---

## 16.3 `src/utils/__tests__/bufferedWriter.test.ts`（~14 tests）

**目标模块**: `src/utils/bufferedWriter.ts`（100 行）
**导出**: `createBufferedWriter()`

| 测试用例 | 验证点 |
|---------|--------|
| single write buffered | write → buffer 累积 |
| flush on size threshold | 超过 maxSize 时自动 flush |
| flush on timer | 定时器触发 flush |
| immediate mode | `{ immediate: true }` 跳过缓冲 |
| overflow coalescing | overflow 内容合并到下次 flush |
| empty buffer flush | 无数据时 flush 无副作用 |
| close flushes remaining | close 触发最终 flush |
| multiple writes before flush | 批量写入合并 |
| flush callback receives concatenated data | writeFn 参数正确 |

**Mock**: 注入 `writeFn` 回调，可选 fake timers

---

## 16.4 `src/utils/__tests__/gitDiff.test.ts`（~20 tests）

**目标模块**: `src/utils/gitDiff.ts`（532 行）
**可测函数**: `parseGitNumstat()`, `parseGitDiff()`, `parseShortstat()`

| 测试用例 | 验证点 |
|---------|--------|
| parseGitNumstat — single file | `1\t2\tpath` → { added: 1, deleted: 2, file: "path" } |
| parseGitNumstat — binary file | `-\t-\timage.png` → binary flag |
| parseGitNumstat — rename | `{ old => new }` 格式解析 |
| parseGitNumstat — empty diff | 空字符串 → [] |
| parseGitNumstat — multiple files | 多行正确分割 |
| parseGitDiff — added lines | `+` 开头行计数 |
| parseGitDiff — deleted lines | `-` 开头行计数 |
| parseGitDiff — hunk header | `@@ -a,b +c,d @@` 解析 |
| parseGitDiff — new file mode | `new file mode 100644` 检测 |
| parseGitDiff — deleted file mode | `deleted file mode` 检测 |
| parseGitDiff — binary diff | Binary files differ 处理 |
| parseShortstat — all components | `1 file changed, 5 insertions(+), 3 deletions(-)` |
| parseShortstat — insertions only | 无 deletions |
| parseShortstat — deletions only | 无 insertions |
| parseShortstat — files only | 仅 file changed |
| parseShortstat — empty | 空字符串 → 默认值 |
| parseShortstat — rename | `1 file changed, ...` 重命名 |

**Mock**: 无需 mock — 全部是纯字符串解析

---

## 16.5 `src/__tests__/history.test.ts`（~18 tests）

**目标模块**: `src/history.ts`（464 行）
**可测函数**: `parseReferences()`, `expandPastedTextRefs()`, `formatPastedTextRef()`, `formatImageRef()`, `getPastedTextRefNumLines()`

| 测试用例 | 验证点 |
|---------|--------|
| parseReferences — text ref | `#1` → [{ type: "text", ref: 1 }] |
| parseReferences — image ref | `@1` → [{ type: "image", ref: 1 }] |
| parseReferences — multiple refs | `#1 #2 @3` → 3 refs |
| parseReferences — no refs | `"hello"` → [] |
| parseReferences — duplicate refs | `#1 #1` → 去重或保留 |
| parseReferences — zero ref | `#0` → 边界 |
| parseReferences — large ref | `#999` → 正常 |
| formatPastedTextRef — basic | 输出格式验证 |
| formatPastedTextRef — multiline | 多行内容格式 |
| getPastedTextRefNumLines — 1 line | 返回 1 |
| getPastedTextRefNumLines — multiple lines | 换行计数 |
| expandPastedTextRefs — single ref | 替换单个引用 |
| expandPastedTextRefs — multiple refs | 替换多个引用 |
| expandPastedTextRefs — no refs | 原样返回 |
| expandPastedTextRefs — mixed content | 文本 + 引用混合 |
| formatImageRef — basic | 输出格式 |

**Mock**: `mock.module("src/bootstrap/state.ts", ...)` 解锁模块

---

## 16.6 `src/utils/__tests__/sliceAnsi.test.ts`（~16 tests）

**目标模块**: `src/utils/sliceAnsi.ts`（91 行）
**导出**: `sliceAnsi()` — ANSI 感知的字符串切片

| 测试用例 | 验证点 |
|---------|--------|
| plain text slice | `"hello".slice(1,3)` 等价 |
| preserve ANSI codes | `\x1b[31mhello\x1b[0m` 切片后保留颜色 |
| close opened styles | 切片点在 ANSI 样式中间时正确关闭 |
| hyperlink handling | OSC 8 超链接不被切断 |
| combining marks (diacritics) | `é` = `e\u0301` 不被切开 |
| Devanagari matras | 零宽字符不被切断 |
| full-width characters | CJK 字符宽度 = 2 |
| empty slice | 返回空字符串 |
| full slice | 返回完整字符串 |
| boundary at ANSI code | 边界恰好在 escape 序列上 |
| nested ANSI styles | 多层嵌套时正确处理 |
| slice start > end | 空结果 |

**Mock**: `mock.module("@alcalzone/ansi-tokenize", ...)`, `mock.module("ink/stringWidth", ...)`

---

## 16.7 `src/utils/__tests__/treeify.test.ts`（~15 tests）

**目标模块**: `src/utils/treeify.ts`（170 行）
**导出**: `treeify()` — 递归树渲染

| 测试用例 | 验证点 |
|---------|--------|
| simple flat tree | `{ a: {}, b: {} }` → 2 行 |
| nested tree | `{ a: { b: { c: {} } } }` → 3 行缩进 |
| array values | `[1, 2, 3]` 渲染为列表 |
| circular reference | 不无限递归 |
| empty object | `{}` 处理 |
| single key | 布局适配 |
| branch vs last-branch character | ├─ vs └─ |
| custom prefix | options 前缀传递 |
| deep nesting | 5+ 层缩进正确 |
| mixed object/array | 混合结构 |

**Mock**: `mock.module("figures", ...)`, color 模块 mock

---

## 16.8 `src/utils/__tests__/words.test.ts`（~10 tests）

**目标模块**: `src/utils/words.ts`（800 行，大部分是词表数据）
**导出**: `generateWordSlug()`, `generateShortWordSlug()`

| 测试用例 | 验证点 |
|---------|--------|
| generateWordSlug format | `adjective-verb-noun` 三段式 |
| generateShortWordSlug format | `adjective-noun` 两段式 |
| all parts non-empty | 无空段 |
| hyphen separator | `-` 分隔 |
| all parts from word lists | 成分来自预定义词表 |
| multiple calls uniqueness | 连续调用不总是相同 |
| no consecutive hyphens | 无 `--` |
| lowercase only | 全小写 |

**Mock**: `mock.module("crypto", ...)` 控制 `randomBytes` 实现确定性测试
