# Claude Token Tracker v2

Claude Code Token 用量追踪桌面应用 — **Tauri v2 + React + TypeScript** 重构版

## 特性

- 📊 统计卡片：请求数、Input/Output/Cache Tokens、等价 API 费用
- ⏱ 5 小时窗口分析：燃烧速率和费用预估
- 📈 日费用趋势 + Token 分布图表
- 🔍 请求明细表格（分页 + 展开查看完整内容）
- ⚖️ 对比分析：日/周/月对比
- 🏆 排名：按项目和会话维度
- 💬 对话历史查看器
- ⚙️ 预算告警、全局快捷键、悬浮费用窗口
- 🌗 暗色/亮色主题切换
- 📦 安装包约 5MB（对比 Electron 版 83MB）
- 💾 内存占用约 30MB（对比 Electron 版 200MB+）

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Tauri v2 |
| 后端 | Rust |
| 前端 | React + TypeScript + Vite |
| 打包 | NSIS (Windows) |

## 开发

```bash
# 安装依赖
npm install

# 开发模式（自动启动 Vite + Rust）
npx tauri dev

# 构建安装包
npx tauri build
```

## 安装 Hook

```bash
node install.js
```

将 `track-usage.js` 注册为 Claude Code 的 Stop Hook，自动记录每次会话的 Token 用量。

## 设计

UI 基于 `new-theme.pen` 设计稿，采用深海军蓝配色：

- Dark: `#1a1a2e` 背景 / `#1e1e38` 卡片 / `#6366f1` 主色调
- Light: `#f0f0f5` 背景 / `#ffffff` 卡片
- 字体: Inter
- 卡片圆角: 14px

## 项目结构

```
├── src/                    # React 前端
│   ├── api/                # Tauri invoke 封装
│   ├── components/         # React 组件
│   │   ├── layout/         # TitleBar, TabNav
│   │   └── overview/       # 总览页组件
│   └── styles/             # 主题 CSS
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── commands/       # Tauri commands
│   │   └── data/           # 数据层 (loader, pricing, models)
│   ├── Cargo.toml
│   └── tauri.conf.json
├── track-usage.js          # CLI Hook (Node.js)
├── install.js              # Hook 安装脚本
└── icon.ico
```

## 迁移状态

- [x] 项目脚手架 (Tauri + React + Vite)
- [x] Rust 数据层 (pricing, loader, buckets, sessions)
- [x] React 基础 (TitleBar, TabNav, 主题系统)
- [x] Overview 页 (StatsGrid, BucketCards)
- [ ] 剩余 Tauri commands (16/21)
- [ ] 系统功能 (托盘、快捷键、文件监听、通知、更新、悬浮窗)
- [ ] 剩余页面 (对比、排名、会话、对话、设置)
- [ ] 打包与测试
