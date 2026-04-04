# Computer Use — macOS / Windows / Linux 跨平台实施计划

更新时间：2026-04-03
参考项目：`E:\源码\claude-code-source-main\claude-code-source-main`

## 1. 现状

参考项目的 Computer Use **仅支持 macOS**——从入口到底层全部写死 darwin。我们的项目在 Phase 1-3 中已经完成了：

- ✅ `@ant/computer-use-mcp` stub 替换为完整实现（12 文件）
- ✅ `@ant/computer-use-input` 拆为 dispatcher + backends（darwin + win32）
- ✅ `@ant/computer-use-swift` 拆为 dispatcher + backends（darwin + win32）
- ✅ `CHICAGO_MCP` 编译开关已开
- ❌ `src/` 层有 6 处 macOS 硬编码阻塞

## 2. 阻塞点全景

### 2.1 入口层

| # | 文件:行号 | 阻塞代码 | 影响 |
|---|----------|---------|------|
| 1 | `src/main.tsx:1605` | `getPlatform() === 'macos'` | 整个 CU 初始化被跳过 |

### 2.2 加载层

| # | 文件:行号 | 阻塞代码 | 影响 |
|---|----------|---------|------|
| 2 | `src/utils/computerUse/swiftLoader.ts:16` | `process.platform !== 'darwin'` → throw | 截图、应用管理全部不可用 |
| 3 | `src/utils/computerUse/executor.ts:263` | `process.platform !== 'darwin'` → throw | 整个 executor 工厂函数不可用 |

### 2.3 macOS 特有依赖

| # | 文件:行号 | 依赖 | macOS 实现 | 需要替代方案 |
|---|----------|------|-----------|------------|
| 4 | `executor.ts:70-88` | 剪贴板 | `pbcopy`/`pbpaste` | Win: PowerShell `Get/Set-Clipboard`；Linux: `xclip`/`wl-copy` |
| 5 | `drainRunLoop.ts:21` | CFRunLoop pump | `cu._drainMainRunLoop()` | 非 darwin：直接执行 fn()，不需要 pump |
| 6 | `escHotkey.ts:28` | ESC 热键 | CGEventTap | 非 darwin：返回 false（已有 Ctrl+C fallback） |
| 7 | `hostAdapter.ts:48-54` | 系统权限 | TCC accessibility + screenRecording | Win：直接 granted；Linux：检查 xdotool |
| 8 | `common.ts:56` | 平台标识 | `platform: 'darwin'` 硬编码 | 动态获取 |
| 9 | `executor.ts:180` | 粘贴快捷键 | `command+v` | Win/Linux：`ctrl+v` |

### 2.4 缺失的 Linux 后端

| 包 | macOS | Windows | Linux |
|---|-------|---------|-------|
| `computer-use-input/backends/` | ✅ darwin.ts | ✅ win32.ts | ❌ 需新建 linux.ts |
| `computer-use-swift/backends/` | ✅ darwin.ts | ✅ win32.ts | ❌ 需新建 linux.ts |

## 3. 每个平台的能力依赖

### 3.1 computer-use-input（键鼠）

| 功能 | macOS | Windows | Linux |
|------|-------|---------|-------|
| 鼠标移动 | CGEvent JXA | SetCursorPos P/Invoke | xdotool mousemove |
| 鼠标点击 | CGEvent JXA | SendInput P/Invoke | xdotool click |
| 鼠标滚轮 | CGEvent JXA | SendInput MOUSEEVENTF_WHEEL | xdotool scroll |
| 键盘按键 | System Events osascript | keybd_event P/Invoke | xdotool key |
| 组合键 | System Events osascript | keybd_event 组合 | xdotool key combo |
| 文本输入 | System Events keystroke | SendKeys.SendWait | xdotool type |
| 前台应用 | System Events osascript | GetForegroundWindow P/Invoke | xdotool getactivewindow + /proc |
| 工具依赖 | osascript（内置） | powershell（内置） | xdotool（需安装） |

### 3.2 computer-use-swift（截图 + 应用管理）

| 功能 | macOS | Windows | Linux |
|------|-------|---------|-------|
| 全屏截图 | screencapture | CopyFromScreen | gnome-screenshot / scrot / grim |
| 区域截图 | screencapture -R | CopyFromScreen(rect) | gnome-screenshot -a / scrot -a / grim -g |
| 显示器列表 | CGGetActiveDisplayList JXA | Screen.AllScreens | xrandr --query |
| 运行中应用 | System Events JXA | Get-Process | wmctrl -l / ps |
| 打开应用 | osascript activate | Start-Process | xdg-open / gtk-launch |
| 隐藏/显示 | System Events visibility | ShowWindow/SetForegroundWindow | wmctrl -c / xdotool |
| 工具依赖 | screencapture + osascript | powershell | xdotool + scrot/grim + wmctrl |

### 3.3 executor 层

| 功能 | macOS | Windows | Linux |
|------|-------|---------|-------|
| drainRunLoop | CFRunLoop pump | 不需要 | 不需要 |
| ESC 热键 | CGEventTap | 跳过（Ctrl+C fallback） | 跳过（Ctrl+C fallback） |
| 剪贴板读 | pbpaste | `powershell Get-Clipboard` | xclip -o / wl-paste |
| 剪贴板写 | pbcopy | `powershell Set-Clipboard` | xclip / wl-copy |
| 粘贴快捷键 | command+v | ctrl+v | ctrl+v |
| 终端检测 | __CFBundleIdentifier | WT_SESSION / TERM_PROGRAM | TERM_PROGRAM |
| 系统权限 | TCC check | 直接 granted | 检查 xdotool 安装 |

## 4. 执行步骤

### Phase 1：已完成 ✅

- [x] `@ant/computer-use-mcp` stub → 完整实现
- [x] `@ant/computer-use-input` dispatcher + darwin/win32 backends
- [x] `@ant/computer-use-swift` dispatcher + darwin/win32 backends
- [x] `CHICAGO_MCP` 编译开关

### Phase 2：移除 6 处 macOS 硬编码（解锁 macOS + Windows）

**改动原则：macOS 代码路径不变，只在每处 darwin 守卫后加 win32/linux 分支。**

| 步骤 | 文件 | 改动 |
|------|------|------|
| 2.1 | `src/main.tsx:1605` | `getPlatform() === 'macos'` → 去掉平台限制，或改为 `!== 'unknown'` |
| 2.2 | `src/utils/computerUse/swiftLoader.ts:16-18` | 移除 `process.platform !== 'darwin'` throw。`@ant/computer-use-swift/index.ts` 已有跨平台 dispatch |
| 2.3 | `src/utils/computerUse/executor.ts:263-267` | 移除 `process.platform !== 'darwin'` throw。改为检查 input/swift isSupported |
| 2.4 | `src/utils/computerUse/executor.ts:70-88` | 剪贴板函数按平台分发：darwin→pbcopy/pbpaste，win32→PowerShell Get/Set-Clipboard，linux→xclip |
| 2.5 | `src/utils/computerUse/executor.ts:180` | `typeViaClipboard` 中 `command+v` → 非 darwin 时用 `ctrl+v` |
| 2.6 | `src/utils/computerUse/executor.ts:273` | `const cu = requireComputerUseSwift()` → 改为 `new ComputerUseAPI()`（从 package 直接实例化，不走 swiftLoader throw） |
| 2.7 | `src/utils/computerUse/drainRunLoop.ts` | 开头加 `if (process.platform !== 'darwin') return fn()` |
| 2.8 | `src/utils/computerUse/escHotkey.ts` | `registerEscHotkey` 非 darwin 返回 false（已有 Ctrl+C fallback） |
| 2.9 | `src/utils/computerUse/hostAdapter.ts:48-54` | `ensureOsPermissions` 非 darwin 返回 `{ granted: true }` |
| 2.10 | `src/utils/computerUse/common.ts:56` | `platform: 'darwin'` → `platform: process.platform === 'win32' ? 'windows' : process.platform === 'linux' ? 'linux' : 'darwin'` |
| 2.11 | `src/utils/computerUse/common.ts:55` | `screenshotFiltering: 'native'` → 非 darwin 时 `'none'`（Windows/Linux 截图不支持 per-app 过滤） |
| 2.12 | `src/utils/computerUse/gates.ts:13` | `enabled: false` → `enabled: true`（无 GrowthBook 时默认可用） |
| 2.13 | `src/utils/computerUse/gates.ts:39-43` | `hasRequiredSubscription()` → 直接返回 `true` |

### Phase 3：新增 Linux 后端

| 步骤 | 文件 | 内容 |
|------|------|------|
| 3.1 | `packages/@ant/computer-use-input/src/backends/linux.ts` | xdotool 键鼠（mousemove/click/key/type/getactivewindow） |
| 3.2 | `packages/@ant/computer-use-swift/src/backends/linux.ts` | scrot/grim 截图 + xrandr 显示器 + wmctrl 窗口管理 |
| 3.3 | `packages/@ant/computer-use-input/src/index.ts` | dispatcher 加 `case 'linux'` |
| 3.4 | `packages/@ant/computer-use-swift/src/index.ts` | dispatcher 加 `case 'linux'` |

### Phase 4：验证

| 测试项 | macOS | Windows | Linux |
|--------|-------|---------|-------|
| build 成功 | ✅ | 验证 | 验证 |
| MCP 工具列表非空 | 验证 | 验证 | 验证 |
| 鼠标移动 | 验证 | ✅ 已通过 | 验证 |
| 截图 | 验证 | ✅ 已通过 | 验证 |
| 键盘输入 | 验证 | 验证 | 验证 |
| 前台窗口 | 验证 | ✅ 已通过 | 验证 |
| 剪贴板 | 验证 | 验证 | 验证 |

## 5. 文件改动总览

### 不动的文件（14 个）

`cleanup.ts`、`computerUseLock.ts`、`wrapper.tsx`、`toolRendering.tsx`、`mcpServer.ts`、`setup.ts`、`appNames.ts`、`inputLoader.ts`、`src/services/mcp/client.ts`、`@ant/computer-use-mcp/src/*`（Phase 1 已完成）、`backends/darwin.ts`（两个包都不动）

### 改 src/ 的文件（8 个）

| 文件 | 改动量 | 风险 |
|------|--------|------|
| `main.tsx` | 1 行 | 低 |
| `swiftLoader.ts` | 2 行 | 低 |
| `executor.ts` | ~40 行（剪贴板分发 + 平台守卫 + paste 快捷键） | **中** |
| `drainRunLoop.ts` | 1 行 | 低 |
| `escHotkey.ts` | 3 行 | 低 |
| `hostAdapter.ts` | 5 行 | 低 |
| `common.ts` | 3 行 | 低 |
| `gates.ts` | 3 行 | 低 |

### 新增文件（2 个）

| 文件 | 行数估算 |
|------|---------|
| `packages/@ant/computer-use-input/src/backends/linux.ts` | ~150 行 |
| `packages/@ant/computer-use-swift/src/backends/linux.ts` | ~200 行 |

## 6. Linux 依赖工具

| 工具 | 用途 | 安装命令（Ubuntu） |
|------|------|-------------------|
| `xdotool` | 键鼠模拟 + 窗口管理 | `sudo apt install xdotool` |
| `scrot` 或 `gnome-screenshot` | 截图 | `sudo apt install scrot` |
| `xrandr` | 显示器信息 | 通常已预装 |
| `xclip` | 剪贴板 | `sudo apt install xclip` |
| `wmctrl` | 窗口列表/切换 | `sudo apt install wmctrl` |

Wayland 环境需要替代工具：`ydotool`（替代 xdotool）、`grim`（替代 scrot）、`wl-clipboard`（替代 xclip）。初期可先只支持 X11，Wayland 标记为 todo。

## 7. 执行顺序建议

```
Phase 2（解锁 macOS + Windows）
  ├── 2.1-2.3  移除 3 处硬编码 throw/skip
  ├── 2.4-2.5  剪贴板 + 粘贴快捷键平台分发
  ├── 2.6      swiftLoader → 直接实例化
  ├── 2.7-2.9  drainRunLoop / escHotkey / permissions 平台分支
  ├── 2.10-2.11 common.ts 平台标识动态化
  ├── 2.12-2.13 gates.ts 默认值
  └── 验证 Windows

Phase 3（Linux 后端）
  ├── 3.1  input/backends/linux.ts
  ├── 3.2  swift/backends/linux.ts
  ├── 3.3-3.4  dispatcher 加 linux case
  └── 验证 Linux

Phase 4（集成验证 + PR）
```

每个 Phase 可独立验证、独立提交。Phase 2 完成后 macOS + Windows 可用，Phase 3 完成后三平台全部可用。
