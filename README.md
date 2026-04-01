# Claude Token Tracker

实时追踪 Claude Code 的 Token 用量和 API 等价费用的桌面应用。

读取 `~/.claude/projects/` 下的 JSONL 会话记录，自动解析、去重、计算费用，提供可视化分析面板。

## 功能

**总览**
- 6 项统计卡片：请求数、Input/Output/Cache Tokens、等价 API 费用
- 会话卡片网格：每个会话的费用、时长、Token 消耗
- 5 小时窗口分析：燃烧速率（$/h）和剩余时间预估
- 会话/窗口视图一键切换

**对比**
- 日/周/月维度对比
- 各项指标变化百分比（涨跌标记）

**排名**
- 项目费用排名 + 会话费用排名
- 双栏布局，带进度条可视化

**会话**
- 按项目分组，展开查看 Token 明细
- 切换上下文：一键在终端恢复 Claude Code 会话（`claude --resume`）

**对话**
- 左侧会话列表支持搜索
- 右侧聊天气泡界面，显示用户/助手/工具调用

**设置**
- 预算告警：日/月预算、单次请求阈值
- 全局快捷键：显示/隐藏主窗口、切换悬浮窗
- 悬浮费用窗口：实时显示今日费用和速率

**其他**
- 暗色/亮色主题切换
- 系统托盘常驻，关闭窗口自动最小化
- JSONL 文件变化自动刷新
- CSV/JSON 数据导出
- 悬浮费用窗口（置顶、可拖拽）

## 安装

从 [Releases](https://github.com/backendzb/claude-token-tracker/releases) 下载最新安装包。

首次使用需安装 Hook 来自动记录用量：

```bash
node install.js
```

这会在 `~/.claude/settings.json` 中注册一个 Stop Hook，每次 Claude Code 会话结束时自动记录 Token 消耗。

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npx tauri dev

# 构建 Windows 安装包
npx tauri build
```

## 技术栈

- **桌面框架**：Tauri v2
- **后端**：Rust（JSONL 解析、费用计算、文件监听、系统托盘）
- **前端**：React + TypeScript + Vite
- **打包**：NSIS (Windows)
- **设计**：Inter 字体、深海军蓝配色

## 费用计算

支持 13 个 Claude 模型的分层定价：

- 200K Token 阈值分段计费
- Cache 写入/读取独立费率
- Fast 模式倍率（Opus 6x）
- 优先使用 API 返回的 `costUSD`，无则本地计算

## 项目结构

```
src/                         React 前端
  api/                       Tauri invoke 封装 + TypeScript 类型
  components/
    layout/                  Sidebar 侧边栏、PageHeader 标题栏
    overview/                总览：StatsGrid、BucketCards
    compare/                 对比页
    ranking/                 排名页
    sessions/                会话页
    chat/                    对话页
    settings/                设置页
    float/                   悬浮费用窗口
  styles/                    主题 CSS 变量（dark/light）

src-tauri/                   Rust 后端
  src/
    commands/                Tauri commands（usage、settings、conversation、system）
    data/                    数据层（loader、pricing、models）
  tauri.conf.json            窗口、打包、插件配置

track-usage.js               CLI Hook（Node.js，记录 Token 用量）
install.js                   Hook 安装脚本
```

## 许可

ISC
