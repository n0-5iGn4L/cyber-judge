# 赛博判官

面向热点社会事件与公共议题的研究型 skill。详尽收集各方论点和证据，讲清起因经过，逐项判断支持度，使用选定的 DS 庭审模板输出可离线阅读的 HTML。

## 使用

将整个 `cyber-judge` 文件夹复制到支持 SKILL.md 的工具的技能目录。Codex 常用位置为用户目录下 `.codex/skills/cyber-judge`。本包只整理交付，未替你安装。

示例请求：“用赛博判官详尽调研某热点，覆盖各方实质争论点、证据和最新回应，生成完整 HTML 报告。”

研究需要可用的联网搜索／原文读取工具；可以使用环境中已有的平台技能，也可用其他可用工具。不绑定特定付费接口或个人凭据。HTML 构建需要 Node.js 18+，无第三方 npm 依赖。

## 工作方式

对象与时间定位 → 广泛发现争论点 → 各方证据追溯 → 反证与后续回应核验 → 覆盖检查 → 判断与写作 → DS 模板渲染。事件争议与公共议题共用证据基础，分别处理事实责任、政策效果与价值取舍。

争论点和来源数量由实际调查决定，示例不是数量上限。研究记录保存检索过程、争论点清单与证据台账；HTML 面向读者直接讲清事情和判断。

## 包内结构

- `cyber-judge/SKILL.md`：技能入口。
- `cyber-judge/references/`：调研、两条分支、写作、数据与 HTML 规范。
- `cyber-judge/assets/report-template/`：DS 视觉模板。
- `cyber-judge/scripts/`：独立构建、渲染与数据校验。
- `examples/reports.example.json`：明确标记的模拟数据，仅演示格式，不能作为现实证据。
- `examples/event-demo.html`、`examples/public-demo.html`：用同一模板生成的格式示例。
- `tests/`：渲染与 CLI 回归检查，`node --test tests/report.test.mjs`。
- `VALIDATION.md`：本版实际检查与覆盖范围。

模板命令：

```bash
node cyber-judge/scripts/build.mjs --input examples/reports.example.json --check
node cyber-judge/scripts/build.mjs --input examples/reports.example.json --out /path/to/reports
```

详细字段见 `cyber-judge/references/report-data.md`。无需运行构建也能双击阅读 HTML 成品。

## 版本与许可

版本 1.0.0。采用用户选定的 DS 模板，补齐任意争论点数量、公共议题标签、独立输入输出和校验。未把其他候选模板、设计过程截图、个人路径或采集账号资料混入发布包。

本项目原创代码、技能说明与模拟示例使用 MIT 许可，见 LICENSE。真实报告所引用的第三方材料不因此取得再授权，见 THIRD_PARTY_NOTICES.md。仓库发布由用户决定，本次仅交付本地文件。
