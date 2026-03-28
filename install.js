#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const SETTINGS_FILE = path.join(os.homedir(), '.claude', 'settings.json');
const TRACK_SCRIPT = path.join(__dirname, 'track-usage.js').replace(/\\/g, '/');

function main() {
  console.log('Claude Code Token 用量追踪插件 - 安装\n');

  // 读取现有 settings
  let settings = {};
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      console.log('✓ 读取现有 settings.json');
    } catch (err) {
      console.error('✗ 解析 settings.json 失败:', err.message);
      console.log('  请手动备份并修复: ' + SETTINGS_FILE);
      process.exit(1);
    }
  }

  // 构造 hook 命令
  const hookCommand = `node "${TRACK_SCRIPT}"`;

  // 检查是否已安装
  if (settings.hooks && settings.hooks.Stop) {
    const stops = settings.hooks.Stop;
    for (const entry of stops) {
      if (entry.hooks) {
        for (const h of entry.hooks) {
          if (h.command && h.command.includes('track-usage.js')) {
            console.log('✓ Hook 已安装，无需重复操作');
            console.log('\n已安装的命令: ' + h.command);
            process.exit(0);
          }
        }
      }
    }
  }

  // 注入 hook
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.Stop) settings.hooks.Stop = [];

  settings.hooks.Stop.push({
    hooks: [
      {
        type: 'command',
        command: hookCommand,
        timeout: 5000,
      }
    ]
  });

  // 备份
  if (fs.existsSync(SETTINGS_FILE)) {
    const backup = SETTINGS_FILE + '.backup.' + Date.now();
    fs.copyFileSync(SETTINGS_FILE, backup);
    console.log('✓ 已备份原配置到: ' + path.basename(backup));
  }

  // 写入
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  console.log('✓ Hook 已写入 settings.json');

  // 创建日志目录
  const logsDir = path.join(os.homedir(), '.claude', 'usage-logs');
  fs.mkdirSync(path.join(logsDir, '.state'), { recursive: true });
  console.log('✓ 日志目录已创建: ' + logsDir);

  console.log('\n安装完成！');
  console.log('\n使用方法:');
  console.log('  - 正常使用 Claude Code，每次响应后会自动记录 token 用量');
  console.log('  - 查看用量: node ' + path.join(__dirname, 'view-usage.js').replace(/\\/g, '/'));
  console.log('  - 查看帮助: node view-usage.js --help');
}

main();
