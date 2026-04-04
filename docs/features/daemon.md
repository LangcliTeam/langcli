# DAEMON — 后台守护进程

> Feature Flag: `FEATURE_DAEMON=1`
> 实现状态：主进程和 worker 注册为 Stub，CLI 路由完整
> 引用数：3

## 一、功能概述

DAEMON 将 Claude Code 变为后台守护进程。主进程（supervisor）管理多个 worker 进程的生命周期，通过 Unix 域套接字进行 IPC。适用于持续运行的后台服务场景（如配合 BRIDGE_MODE 提供远程控制服务）。

## 二、实现架构

### 2.1 模块状态

| 模块 | 文件 | 状态 |
|------|------|------|
| 守护主进程 | `src/daemon/main.ts` | **Stub** — `daemonMain: () => Promise.resolve()` |
| Worker 注册 | `src/daemon/workerRegistry.ts` | **Stub** — `runDaemonWorker: () => Promise.resolve()` |
| CLI 路由 | `src/entrypoints/cli.tsx` | **布线** — `--daemon-worker` 和 `daemon` 子命令 |
| 命令注册 | `src/commands.ts` | **布线** — DAEMON + BRIDGE_MODE 门控 |

### 2.2 CLI 入口

```
# 启动守护进程
claude daemon

# 以 worker 身份启动
claude --daemon-worker=<kind>
```

### 2.3 预期架构

```
Supervisor (daemonMain)
      │
      ├── Worker 1: assistant-mode
      │   └── 接收和处理 assistant 会话
      │
      ├── Worker 2: bridge-sync
      │   └── bridge 消息同步
      │
      └── Worker 3: proactive
          └── 主动任务执行
      │
      ▼
IPC via Unix Domain Sockets
  - 生命周期管理（启动、停止、重启）
  - 工作分发
  - 状态报告
```

### 2.4 与 BRIDGE_MODE 的关系

DAEMON 和 BRIDGE_MODE 常组合使用：

```ts
// src/commands.ts
if (feature('DAEMON') && feature('BRIDGE_MODE')) {
  // 加载 remoteControlServer 命令
}
```

双重门控：两个 feature 都需要开启才能使用远程控制服务器。

## 三、需要补全的内容

| 模块 | 工作量 | 说明 |
|------|--------|------|
| `daemon/main.ts` | 大 | Supervisor 主进程：启动 worker、生命周期管理、IPC |
| `daemon/workerRegistry.ts` | 中 | Worker 类型分发（assistant/bridge-sync/proactive） |
| Worker 实现 | 大 | 各类型 worker 的具体实现 |
| IPC 协议 | 中 | Supervisor-Worker 通信层 |

## 四、关键设计决策

1. **多进程架构**：一个 supervisor + 多个 worker，进程隔离
2. **Unix 域套接字 IPC**：本地进程间通信，低延迟
3. **与 BRIDGE_MODE 强绑定**：守护进程最常见的用途是提供远程控制服务
4. **CLI 子命令路由**：`daemon` 子命令和 `--daemon-worker` 参数在 `cli.tsx` 中路由

## 五、使用方式

```bash
# 启用守护进程模式
FEATURE_DAEMON=1 FEATURE_BRIDGE_MODE=1 bun run dev

# 启动守护进程
claude daemon

# 以特定 worker 启动
claude --daemon-worker=assistant
```

## 六、文件索引

| 文件 | 职责 |
|------|------|
| `src/daemon/main.ts` | Supervisor 主进程（stub） |
| `src/daemon/workerRegistry.ts` | Worker 注册（stub） |
| `src/entrypoints/cli.tsx:95,149` | CLI 路由 |
| `src/commands.ts:77` | 命令注册（双重门控） |
