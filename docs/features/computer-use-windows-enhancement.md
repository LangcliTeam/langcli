# Computer Use Windows 增强实施计划

更新时间：2026-04-03
依赖文档：`docs/features/windows-ai-desktop-control.md`、`docs/features/computer-use.md`

## 1. 目标

在已有的 PowerShell 子进程方案基础上，利用 Windows 原生 API 增强 Computer Use 的 Windows 实现，解决 3 个核心问题：

1. **窗口绑定截图**：当前 `CopyFromScreen` 只能全屏截图，无法对指定窗口截图（尤其是被遮挡/最小化窗口）
2. **UI 结构感知**：当前只能通过坐标点击，无法像 macOS Accessibility 那样理解 UI 元素树
3. **性能**：每次 PowerShell 启动约 273ms，剪贴板/窗口枚举等高频操作需要更快的方式

## 2. 已验证的 Windows API 能力

以下 API 全部通过 PowerShell P/Invoke 实测通过：

| 能力 | API | 验证结果 |
|------|-----|---------|
| 窗口绑定截图 | `PrintWindow(hwnd, hdc, PW_RENDERFULLCONTENT)` | ✅ VS Code 342KB, Chrome 273KB |
| 枚举窗口+HWND | `EnumWindows` + `GetWindowText` + `GetWindowThreadProcessId` | ✅ 38 个窗口，含 HWND/PID/标题 |
| UI 元素树 | `System.Windows.Automation.AutomationElement` | ✅ 记事本 39 个元素 |
| UI 写值 | `ValuePattern.SetValue()` | ✅ 成功写入记事本文本 |
| UI 点击 | `InvokePattern.Invoke()` | ✅ 按钮可程序化点击 |
| 坐标元素识别 | `AutomationElement.FromPoint(x, y)` | ✅ 返回元素类型+名称 |
| OCR | `Windows.Media.Ocr.OcrEngine` | ✅ 英语+中文引擎可用 |
| 全局热键 | `RegisterHotKey` | ✅ API 可调 |
| 剪贴板直接操作 | `System.Windows.Forms.Clipboard` | ✅ 读/写/图片检测 |
| Shell 启动 | `ShellExecute` | ✅ 打开文件/URL/应用 |

## 3. 架构设计

### 3.1 文件结构

在现有 `backends/win32.ts` 基础上新增 Windows 专属模块：

```
packages/@ant/computer-use-input/src/
├── backends/
│   ├── darwin.ts          ← 不动
│   ├── win32.ts           ← 增强：直接 Win32 API 替代部分 PowerShell
│   └── linux.ts           ← 不动

packages/@ant/computer-use-swift/src/
├── backends/
│   ├── darwin.ts          ← 不动
│   ├── win32.ts           ← 增强：PrintWindow 窗口截图 + EnumWindows
│   └── linux.ts           ← 不动

packages/@ant/computer-use-mcp/src/
│   └── tools.ts           ← 增加 Windows 专属工具定义（UI Automation、OCR）

src/utils/computerUse/
│   └── win32/              ← 新增目录：Windows 专属能力
│       ├── uiAutomation.ts  ← UI 元素树、点击、写值
│       ├── ocr.ts           ← 截图 + OCR 文字识别
│       ├── windowCapture.ts ← PrintWindow 窗口绑定截图
│       └── windowEnum.ts    ← EnumWindows 窗口枚举
```

### 3.2 分层

```
┌──────────────────────────────────────────────┐
│           Computer Use MCP Tools             │
│  screenshot / click / type / request_access  │
│  + Windows 专属: ui_tree / ocr / window_cap  │
├──────────────────────────────────────────────┤
│           src/utils/computerUse/             │
│  executor.ts → 按平台 dispatch               │
│  win32/ → Windows 专属能力模块               │
├──────────────────────────────────────────────┤
│     packages/@ant/computer-use-{input,swift}  │
│  backends/win32.ts → PowerShell + Win32 API  │
├──────────────────────────────────────────────┤
│           Windows Native API                 │
│  PrintWindow / EnumWindows / UI Automation   │
│  SendInput / Clipboard / OCR / ShellExecute  │
└──────────────────────────────────────────────┘
```

## 4. 实施计划

### Phase A：窗口绑定截图（解决核心问题）

**问题**：当前 `CopyFromScreen` 只能全屏截图，无法对指定窗口截图。
**方案**：用 `PrintWindow` + `FindWindow` 实现窗口级截图。

| 步骤 | 文件 | 改动 |
|------|------|------|
| A.1 | `src/utils/computerUse/win32/windowCapture.ts` | 新建：`captureWindow(title)` 用 PrintWindow 截取指定窗口 |
| A.2 | `src/utils/computerUse/win32/windowEnum.ts` | 新建：`listWindows()` 用 EnumWindows 返回 {hwnd, pid, title}[] |
| A.3 | `packages/@ant/computer-use-swift/src/backends/win32.ts` | `screenshot.captureExcluding` 增加按窗口截图能力 |
| A.4 | `packages/@ant/computer-use-swift/src/backends/win32.ts` | `apps.listRunning` 用 EnumWindows 替代 Get-Process（返回 HWND） |

**PowerShell 脚本核心**：

```powershell
# PrintWindow 截取指定窗口
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing @'
using System; using System.Runtime.InteropServices; using System.Drawing; using System.Drawing.Imaging;
public class WinCap {
    [DllImport("user32.dll", CharSet=CharSet.Unicode)]
    public static extern IntPtr FindWindow(string c, string t);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint f);
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int L, T, R, B; }
    // ... CaptureByTitle(string title) → base64
}
'@
```

**验证标准**：
- 能按窗口标题截图
- 被遮挡的窗口也能截图
- 返回 base64 + width + height

### Phase B：UI Automation（Windows 专属新能力）

**问题**：macOS 有 Accessibility API 可以读取/操作 UI 元素，Windows 当前只能坐标点击。
**方案**：用 `System.Windows.Automation` 实现 UI 树读取和元素操作。

| 步骤 | 文件 | 改动 |
|------|------|------|
| B.1 | `src/utils/computerUse/win32/uiAutomation.ts` | 新建：核心 UIA 操作封装 |
| B.2 | `packages/@ant/computer-use-mcp/src/tools.ts` | 增加 Windows 专属工具定义 |

**uiAutomation.ts 导出函数**：

```typescript
// 获取窗口的 UI 元素树
getUITree(windowTitle: string, depth: number): UIElement[]

// 按名称/类型/AutomationId 查找元素
findElement(windowTitle: string, query: {name?, controlType?, automationId?}): UIElement | null

// 点击元素（InvokePattern）
clickElement(windowTitle: string, automationId: string): boolean

// 设置元素值（ValuePattern）
setValue(windowTitle: string, automationId: string, value: string): boolean

// 获取坐标处的元素
elementAtPoint(x: number, y: number): UIElement | null
```

**UIElement 类型**：
```typescript
interface UIElement {
  name: string
  controlType: string    // Button, Edit, Text, List, etc.
  automationId: string
  boundingRect: { x: number, y: number, w: number, h: number }
  isEnabled: boolean
  value?: string         // ValuePattern 可用时
  children?: UIElement[]
}
```

**PowerShell 脚本核心**：
```powershell
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

# 读取 UI 树
$root = [AutomationElement]::RootElement
$window = $root.FindFirst([TreeScope]::Children, 
  [PropertyCondition]::new([AutomationElement]::NameProperty, $title))
$elements = $window.FindAll([TreeScope]::Descendants, [Condition]::TrueCondition)

# 写入文本
$element.GetCurrentPattern([ValuePattern]::Pattern).SetValue($text)

# 点击按钮
$element.GetCurrentPattern([InvokePattern]::Pattern).Invoke()
```

**验证标准**：
- 能读取记事本的 UI 树（按钮、文本框、菜单）
- 能向文本框写入内容
- 能点击按钮
- 能识别坐标处的元素

### Phase C：OCR 屏幕文字识别

**问题**：截图后 AI 只能看到图片，无法直接读取文字。
**方案**：用 `Windows.Media.Ocr` 对截图进行文字识别。

| 步骤 | 文件 | 改动 |
|------|------|------|
| C.1 | `src/utils/computerUse/win32/ocr.ts` | 新建：截图 + OCR 识别 |
| C.2 | `packages/@ant/computer-use-mcp/src/tools.ts` | 增加 `screen_ocr` 工具定义 |

**ocr.ts 导出函数**：
```typescript
// 对屏幕区域 OCR
ocrRegion(x: number, y: number, w: number, h: number, lang?: string): OcrResult

// 对指定窗口 OCR
ocrWindow(windowTitle: string, lang?: string): OcrResult

interface OcrResult {
  text: string
  lines: { text: string, bounds: {x,y,w,h} }[]
  language: string
}
```

**已确认可用语言**：英语 (en-US) + 中文 (zh-Hans-CN)

**验证标准**：
- 能识别屏幕区域中的英文和中文
- 返回文字内容 + 每行的位置信息

### Phase D：高频操作性能优化

**问题**：每次 PowerShell 启动 273ms，鼠标移动等高频操作太慢。
**方案**：用 .NET `System.Windows.Forms.Clipboard` 等直接 API 替代 PowerShell 子进程。

| 步骤 | 文件 | 改动 |
|------|------|------|
| D.1 | `src/utils/computerUse/executor.ts` | 剪贴板操作用直接 API 替代 PowerShell |
| D.2 | 考虑驻留 PowerShell 进程 | 通过 stdin/stdout 交互，摊平启动成本 |

**剪贴板直接 API**（不需要 PowerShell 子进程）：
```powershell
# 读：50ms → <1ms
[System.Windows.Forms.Clipboard]::GetText()

# 写：50ms → <1ms  
[System.Windows.Forms.Clipboard]::SetText($text)

# 图片检测
[System.Windows.Forms.Clipboard]::ContainsImage()
```

### Phase E：`request_access` Windows 适配

**问题**：`request_access` 依赖 macOS bundleId 识别应用，Windows 没有这个概念。
**方案**：在 Windows 上用 exe 路径 + 窗口标题替代 bundleId。

| 步骤 | 文件 | 改动 |
|------|------|------|
| E.1 | `packages/@ant/computer-use-mcp/src/toolCalls.ts` | `resolveRequestedApps` 在 Windows 上用 exe 路径匹配 |
| E.2 | `packages/@ant/computer-use-mcp/src/sentinelApps.ts` | 增加 Windows 危险应用列表（cmd.exe, powershell.exe 等） |
| E.3 | `packages/@ant/computer-use-mcp/src/deniedApps.ts` | 增加 Windows 浏览器/终端识别规则 |
| E.4 | `src/utils/computerUse/hostAdapter.ts` | `ensureOsPermissions` Windows 上检查 UAC 状态 |

**Windows 应用标识映射**：
```
macOS bundleId          →  Windows 等价
com.apple.Safari        →  C:\Program Files\...\msedge.exe（或窗口标题匹配）
com.google.Chrome       →  chrome.exe
com.apple.Terminal      →  WindowsTerminal.exe / cmd.exe
```

### Phase F：全局热键（ESC 拦截）

**问题**：当前非 darwin 直接跳过 ESC 热键，用 Ctrl+C 替代。
**方案**：用 `RegisterHotKey` 或 `SetWindowsHookEx(WH_KEYBOARD_LL)` 实现。

| 步骤 | 文件 | 改动 |
|------|------|------|
| F.1 | `src/utils/computerUse/escHotkey.ts` | Windows 分支：RegisterHotKey 注册 ESC |

**优先级低**——当前 Ctrl+C fallback 可用，ESC 热键是体验优化。

## 5. 执行优先级

```
Phase A: 窗口绑定截图          ← P0 核心需求，解决"操作其他界面"
Phase B: UI Automation         ← P0 核心能力，AI 理解 UI 结构
Phase C: OCR                   ← P1 增值能力，AI 读屏幕文字
Phase D: 性能优化              ← P1 体验优化，高频操作提速
Phase E: request_access 适配   ← P1 功能完整性，权限模型适配
Phase F: ESC 热键              ← P2 体验优化，可后做
```

## 6. 每个 Phase 的改动量估算

| Phase | 新增文件 | 修改文件 | 新增代码行 | 风险 |
|-------|---------|---------|-----------|------|
| A 窗口截图 | 2 | 1 | ~200 | 低 |
| B UI Automation | 1 | 1 | ~300 | 中 |
| C OCR | 1 | 1 | ~150 | 低 |
| D 性能优化 | 0 | 2 | ~50 | 低 |
| E request_access | 0 | 3 | ~100 | 中 |
| F ESC 热键 | 0 | 1 | ~50 | 低 |
| **总计** | **4** | **9** | **~850** | — |

## 7. 不动的文件

- `backends/darwin.ts`（两个包都不动）
- `backends/linux.ts`（两个包都不动）
- `src/utils/computerUse/` 中 macOS 相关代码路径不动
- `packages/@ant/computer-use-mcp/src/` 中已复制的参考项目代码不动（只追加 Windows 工具）

## 8. 与 macOS/Linux 方案的对比

| 能力 | macOS | Windows (增强后) | Linux |
|------|-------|-----------------|-------|
| 截图方式 | SCContentFilter (per-app) | **PrintWindow (per-window)** | scrot (全屏/区域) |
| UI 结构 | Accessibility API | **UI Automation** | 无 |
| OCR | 无内置 | **Windows.Media.Ocr** | 无内置 |
| 键鼠 | CGEvent + enigo | SendInput + keybd_event | xdotool |
| 窗口管理 | NSWorkspace | **EnumWindows + Win32** | wmctrl |
| 剪贴板 | pbcopy/pbpaste | **Clipboard 直接 API** | xclip |
| ESC 热键 | CGEventTap | RegisterHotKey | 无 |
| 应用标识 | bundleId | exe 路径 + 窗口标题 | /proc + wmctrl |

**Windows 增强后将在 UI Automation 和 OCR 方面超过 macOS 方案**——这两项 macOS 原始实现也没有（Anthropic 用的是截图 + Claude 视觉理解，没有结构化 UI 数据）。
