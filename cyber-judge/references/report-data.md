# 报告数据与构建

需要 Node.js 18 或更新版本，不依赖 npm 包。以下路径以 skill 根目录为当前目录；实际调用时也可用绝对路径，从任何目录运行。

```bash
node scripts/build.mjs --input /path/to/reports.json --check
node scripts/build.mjs --input /path/to/reports.json --out /path/to/reports
```

`--input` 必填，UTF-8 JSON，顶层为非空数组；`--out` 在生成时必填。可用 `--slug identifier` 选择一期。默认拒绝覆盖已有报告；明确需要更新自己生成的文件时加 `--overwrite`。`--check` 只验证，不写文件。工具不默认读示例或覆盖 skill 资产。

## 字段

| 字段 | 要求 |
| --- | --- |
| schema_version | 固定为 `0.3`，保留 DS 内容接口 |
| slug | 小写字母开头，后接小写字母／数字／连字符，最长 64；不能是 Windows 保留文件名 |
| kind | `event` 或 `public-issue` |
| title | 完整标题 |
| title_subject / title_question | 首屏案由与大字追问，均为普通文本 |
| as_of | 真实有效的 `YYYY-MM-DD`，材料截至日 |
| headline / summary | 核心判断与事件摘要 |
| background / conclusion | 非空段落数组：`text`、`source_ids` |
| timeline | `date`、`title`、`text`、`source_ids` 数组；公共议题无必要时间线时可为空 |
| actors | `name`、`role` 数组，可为空；按实际角色，不强凑两方 |
| issues | 非空数组，数量不限，见下表 |
| open_questions | 字符串数组，可为空 |
| sources | 非空来源数组，见下文 |
| method_note | 实际采集范围、关键访问缺口与截止情况，不写固定免责套话 |

每个 issue：

| 字段 | 要求 |
| --- | --- |
| id | 字母开头，后接字母／数字／连字符／下划线，报告内唯一 |
| nav_label | 简短目录名，建议四至八个汉字，不能用它限制问题本身的深度 |
| question / verdict | 具体问题与明确判断 |
| claims | 非空数组：speaker、claim、support、reason、source_ids；各方主张数量不限 |
| reasoning | 非空段落数组：text、source_ids；展开证据比较和推理 |
| roast | 可省略或为空；有依据的短评，空值时不渲染栏目 |

`support` 允许：支持较强、支持有限、支持不足、有明确反证、暂无法判断、规范判断。具体含义见 writing.md。`source_ids` 必须是数组，元素引用本报告来源；事实主张必须提供出处。纯规范推理可用空数组，清楚写明“本报告意见”和评价原则，不伪造引用。校验会提醒缺少出处的非规范内容，由作者核对。

每个 source 包含非空 `id`、`title`、`date`、`url`、`kind`、`note`。id 使用字母开头的字母／数字／连字符／下划线，报告内唯一。URL 只允许 http/https；不含认证信息。date 可写明确的发布时间，无法取得时注明“发布时间未标明；访问于 YYYY-MM-DD”。note 写实际读取层次与片段位置，如“已读全文，第 3 节”“已看 05:15–06:05”“作者回复 rpid …”。不要把仅看过摘要写成已读全文。

所有文本均由渲染器转义；不要在 JSON 中手写 HTML、引用链接或脚本。标题中的数字、游戏台词和结论都不得由模板编造。

## 研究记录与报告数据

JSON 负责报告呈现，研究目录另保存 research.md 要求的检索记录、争论点清单和证据台账。不要把来源条数当成调查充分性。使用示例时替换全部模拟材料，不把 example.org 链接带入真实报告。
