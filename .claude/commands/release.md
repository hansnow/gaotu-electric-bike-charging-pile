---
description: 自动化版本发布流程，包括版本号升级、CHANGELOG 更新、Git 提交和推送
---

# 版本发布命令

执行以下步骤来发布一个新版本：

## 任务要求

用户将提供一个版本号（例如：`1.3.0`），你需要完成以下任务：

### 1. 验证版本号格式

- 检查版本号是否符合语义化版本规范（Semantic Versioning）
- 格式应为：`MAJOR.MINOR.PATCH`（例如：1.3.0）
- 如果格式不正确，提醒用户并终止流程

### 2. 更新版本号

- 更新 `package.json` 中的 `version` 字段为指定版本号
- 更新 `public/index.html` 中的前端版本号显示（搜索 `<div class="version">` 并更新为 `v{version}`）

### 3. 编写 CHANGELOG

- 在 `CHANGELOG.md` 顶部添加新版本的变更记录
- 日期使用当天日期（格式：`YYYY-MM-DD`）
- 查看最近的 git log 和代码变更，总结主要改动
- 遵循 [Keep a Changelog](https://keepachangelog.com/) 格式
- 包含以下章节（如适用）：
  - **Added**: 新增功能
  - **Changed**: 功能变更
  - **Fixed**: Bug 修复
  - **Removed**: 移除的功能
  - **Documentation**: 文档更新
  - **Technical Details**: 技术细节（修改的文件列表）
- 在底部添加版本比较链接

### 4. 创建 Git Commit

- 使用 `git add` 添加所有相关修改
- 创建 commit，message 格式：
  ```
  chore: 发布版本 {version}

  {简要的变更说明，2-3 行}

  🤖 Generated with [{当前 Coding Agent 名称}]({当前 Coding Agent URL})

  Co-Authored-By: {当前 Coding Agent 名称} <{当前 Coding Agent 邮箱}>
  ```
  
  **注意**：请根据实际使用的 Coding Agent 替换上述占位符：
  - `{当前 Coding Agent 名称}`：当前使用的 AI 助手名称（如 "Claude Code"、"Cursor Composer" 等）
  - `{当前 Coding Agent URL}`：对应的官网链接
  - `{当前 Coding Agent 邮箱}`：对应的邮箱地址

### 5. 创建 Git Tag

- 创建带注释的 tag：`v{version}`
- Tag message：`chore: 发布版本 {version}`

### 6. 推送到远程仓库

- 执行 `git push` 推送 commit
- 执行 `git push --tags` 推送 tag
- 确认推送成功

## 执行流程

1. 使用 TodoWrite 工具创建任务列表跟踪进度
2. 逐步完成每个任务，标记完成状态
3. 如果任何步骤失败，立即停止并报告错误
4. 全部完成后，输出版本发布摘要

## 输出格式

完成后，输出类似以下格式的摘要：

```
✅ 版本 {version} 发布成功！

完成的任务：
- ✅ 版本号已更新到 {version}
- ✅ CHANGELOG 已更新
- ✅ Git commit 已创建：{commit_hash}
- ✅ Git tag 已创建：v{version}
- ✅ 已推送到远程仓库

📦 版本发布内容：
{主要变更摘要}

🔗 相关链接：
- Commit: {commit_hash}
- Tag: v{version}
- 比较链接: https://github.com/hansnow/gaotu-electric-bike-charging-pile/compare/v{previous_version}...v{version}
```

## 注意事项

- 确保当前工作目录是项目根目录
- 确保没有未提交的重要更改会被意外包含
- 推送前再次确认版本号和 CHANGELOG 内容正确
- 遵循 CLAUDE.md 中的规范：使用中文生成 git commit message
