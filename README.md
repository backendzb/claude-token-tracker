# Claude Code Token Tracker

Claude Code 用量追踪桌面应用，实时监控 token 消耗和 API 等价费用。

## 功能

### 概览
- 统计卡片：请求数、Input/Output/Cache tokens、等价 API 费用
- 5 小时窗口分析：燃烧速率、费用预估
- 每日费用趋势图 + Token 分布环形图
- 请求明细表（分页，点击展开查看完整请求/回复内容）

### 对比
- 今天 vs 昨天 / 本周 vs 上周 / 本月 vs 上月
- 各项指标变化百分比

### 排行
- 按项目维度费用排名，带进度条可视化

### 会话
- 按项目分组，默认折叠，点击展开
- 切换上下文：一键在新终端恢复 Claude Code 会话（`claude --resume`）

### 对话记录
- 左侧会话列表，支持搜索
- 右侧聊天气泡界面，查看完整对话历史
- 显示工具调用标签（Read、Edit、Bash 等）

### 设置
- 费用预算告警（日/月预算、单次请求阈值）
- 全局快捷键（默认 Ctrl+Shift+T）
- 自动更新检查

### 其他
- 亮色 / 暗色主题切换
- 系统托盘常驻，实时显示当前窗口费用
- JSONL 文件变化实时监听自动刷新
- CSV / JSON 数据导出
- 窗口位置/大小记忆
- GitHub Releases 自动更新

## 安装

从 [Releases](https://github.com/backendzb/claude-token-tracker/releases) 下载最新安装包。

## 使用 Hook 记录用量

安装 hook 以在每次 Claude Code 会话结束时自动记录用量：

```bash
node install.js
```

这会在 `~/.claude/settings.json` 中添加一个 Stop hook。

## 开发

```bash
npm install
npm start        # 启动开发模式
npm run build    # 打包 Windows 安装包
```

## 发布新版本

```bash
# 1. 修改 package.json 版本号
# 2. 打包
npm run build
# 3. 提交并推送
git add -A && git commit -m "vX.Y.Z: 更新说明" && git push
# 4. 创建 Release
gh release create vX.Y.Z "dist/Claude Token Tracker Setup X.Y.Z.exe" "dist/Claude Token Tracker Setup X.Y.Z.exe.blockmap" "dist/latest.yml" --title "vX.Y.Z" --notes "更新说明"
```

## 技术栈

- Electron 35
- electron-updater（自动更新）
- 原生 HTML/CSS/JS（无框架依赖）
