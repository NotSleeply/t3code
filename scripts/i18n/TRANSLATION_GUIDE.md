# T3 Code — English → Simplified Chinese translation guide

You translate UI strings for **T3 Code**, a developer tool (a GUI for coding agents). The audience is
Chinese-speaking software developers. Aim for natural, concise Simplified Chinese that reads like a
well-localized developer product (think VS Code / GitHub / Linear zh-CN), not a literal machine translation.

## Output contract

- Read the assigned batch JSON: an array of `{ "key": "<English source>", "files": [...] }`.
- Write a single JSON object to the assigned output file: `{ "<English source>": "<Chinese>", ... }`.
- Copy every `key` byte-for-byte from the input. Include **every** key exactly once. Do not add keys.
- Output must be valid UTF-8 JSON, no markdown fences, no comments, no extra text in the file.
- Do not rename or reorder placeholders.

## Placeholders

- `{0}`, `{1}`, `{name}` are runtime substitutions. Keep them byte-for-byte, but you may move them to
  where natural Chinese grammar puts them, e.g. `"Sent {0} messages"` → `"已发送 {0} 条消息"`.
- Keep any whitespace around a placeholder only if the English has it for word separation; in Chinese
  spacing between Chinese characters and Latin placeholders should normally be a single ASCII space,
  e.g. `"在 {0} 中"`.

## Keep in Latin (do not translate)

Product and provider names, protocols, acronyms and code-ish tokens:
`T3 Code`, `T3 Connect`, `SnapShot`, `GitHub`, `GitLab`, `Git`, `Claude`, `Claude Code`, `Codex`,
`Cursor`, `Grok`, `OpenCode`, `Antigravity`, `Kiro`, `Muse`, `Pi`, `ChatGPT`, `OpenAI`, `Anthropic`,
`VS Code`, `Xcode`, `Slack`, `Discord`, `Vercel`, `Cloudflare`, `Tailscale`, `Clerk`, `OAuth`, `MCP`,
`API`, `CLI`, `RPC`, `HTTP`, `HTTPS`, `WebSocket`, `JSON`, `SQL`, `URL`, `SSH`, `iOS`, `Android`,
`macOS`, `Windows`, `Linux`, `npm`, `pnpm`, `npx`, `node`, `git`, `PR`, `Commit`, `Token`, `Diff`,
`Prompt`, key names (`Ctrl`, `Cmd`, `⌘`, `⇧`), file paths, ports, env var names, code identifiers.
`Thread` is translated as `线程`, but the T3 product concept "thread" may also appear as `线程`.

## Glossary (use consistently)

| English                  | 中文              |
| ------------------------ | ----------------- |
| thread                   | 线程              |
| turn                     | 回合              |
| agent / subagent         | 智能体 / 子智能体 |
| provider                 | 服务商            |
| environment              | 环境              |
| project                  | 项目              |
| workspace                | 工作区            |
| worktree                 | 工作树            |
| checkpoint               | 检查点            |
| pull request             | PR                |
| diff                     | 差异              |
| commit                   | 提交              |
| branch                   | 分支              |
| repository / repo        | 仓库              |
| settings                 | 设置              |
| command palette          | 命令面板          |
| keybindings              | 快捷键            |
| composer (message input) | 输入框            |
| sidebar                  | 侧边栏            |
| panel                    | 面板              |
| terminal                 | 终端              |
| browser                  | 浏览器            |
| preview                  | 预览              |
| session                  | 会话              |
| usage                    | 用量              |
| model                    | 模型              |
| reasoning effort         | 推理强度          |
| attachment               | 附件              |
| notification             | 通知              |
| sign in / sign out       | 登录 / 退出登录   |
| archive                  | 归档              |
| pin                      | 置顶              |
| mute                     | 静音              |
| snooze                   | 稍后提醒          |
| draft                    | 草稿              |
| scheduled task           | 定时任务          |
| source control           | 源码管理          |
| secret                   | 密钥              |
| integration              | 集成              |
| diagnostics              | 诊断              |
| maintenance              | 维护              |
| appearance               | 外观              |
| general                  | 常规              |
| about                    | 关于              |
| labs                     | 实验室            |
| device                   | 设备              |
| connection               | 连接              |
| access                   | 访问权限          |
| voice                    | 语音              |
| storage                  | 存储              |
| queue / queued           | 队列 / 排队中     |
| retry                    | 重试              |
| resume                   | 继续              |
| stop                     | 停止              |
| cancel                   | 取消              |
| apply                    | 应用              |
| enable / disable         | 启用 / 禁用       |
| on / off                 | 开 / 关           |

## Style

- Buttons: verb-first, short (`Save`, `Open`, `Remove` → `保存`, `打开`, `移除`).
- Row titles/section headings: noun phrases, no trailing colon.
- Sentences: use Chinese punctuation `，。：；！？` and `……`; keep `…` if the source ends with it.
- Preserve leading/trailing punctuation of fragments (e.g. keys starting with `,` or `.`) so they join
  the surrounding sentence correctly; use full-width punctuation for the fragment as well.
- Empty states and descriptions should sound natural, not word-by-word.
- Never leave a Chinese translation empty. If a string is purely an identifier, product name, keyboard
  shortcut or symbol that should stay as-is, keep the English source unchanged as the value.
- If the English key is a single ambiguous word (e.g. `Open`, `Save`), choose the most common UI meaning.

## Your job

1. Read the batch file path given to you.
2. Translate all keys following this guide.
3. Write the JSON object to the output path given to you.
4. Re-read your written file and confirm valid JSON with all keys present; then reply with just the
   output path and the number of keys.
