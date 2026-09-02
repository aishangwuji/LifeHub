# AGENTS.md

本项目（DSH-Plus）专门为 deepseek-harness 构建插件，以第三方开发者身份开发。构建的插件包放于 `Lifehub/` 目录，作为独立、可安装、可发布的 npm 插件包存在。

## 工作区布局

| 路径 | 角色 |
|---|---|
| `deepseek-harness/` | 上游官方仓库克隆（独立 git，`origin=deepseek-ai/deepseek-harness`）。**只读参照**：它是插件契约的权威来源（文档 / 代码 / 示例）。改动它 = 脱离第三方开发者身份，且会被上游更新冲掉；除非任务明确要求，禁止修改其中任何文件。需要跟随上游时用 `git -C deepseek-harness pull`，由它自己的仓库管理版本。 |
| `Lifehub/` | 本项目插件包目录。每个子目录是一个自包含 npm 插件包，可独立构建、打包、安装进 dsh profile。 |
| `AGENTS.md` | 本文件：工作区唯一的工程指令源，随插件开发持续更新。 |

## 插件形态：组合包（bundle）

dsh 是「全插件」Harness，第三方插件以**组合包**形式交付：一个 npm 包，`package.json` 声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`，由 `cordis.patch.yml`（patch 条目 YAML 数组）向 profile 插入或覆盖插件行，插件代码按包名被引用。

安装与验证（源码工作区内命令前缀 `pnpm`）：

```sh
dsh plugin --profile demo add ./Lifehub/<plugin>   # 转发给 pnpm；声明 dsh.bundle 才激活层
dsh --profile demo --dump-config                   # 确认新层出现后再启动
dsh --profile demo
```

- 只有声明 `dsh.bundle` 的包会被追加进 `dsh.profile.bundles`；普通依赖打印警告不激活。
- 从 git 安装：作者必须提供自包含的 `prepare` 构建脚本；用户需在 profile 的 `pnpm-workspace.yaml` `allowBuilds` 中显式授权该包。npm 发布或 `pnpm pack` 的 tarball 免构建授权。
- 层顺序：profile bundles 列表 → profile 自身 `cordis.patch.yml` → home 级 patch → `--patch` overlay；后应用者按行胜出，patch 覆盖整行 `config`（需重述全部键）。

**开发前必读**（以 `deepseek-harness/` 内文档为唯一契约源）：
[`docs/user/develop/basic/publish.zh.md`](deepseek-harness/docs/user/develop/basic/publish.zh.md)（打包与安装）、[`config.zh.md`](deepseek-harness/docs/user/develop/basic/config.zh.md)（插件配置）；底层规则见[`AGENTS.md`](deepseek-harness/AGENTS.md)、[`docs/architecture.md`](deepseek-harness/docs/architecture.md)、[`docs/cordis-primer.md`](deepseek-harness/docs/cordis-primer.md)、[`packages/AGENTS.md`](deepseek-harness/packages/AGENTS.md)、[`docs/cookbook/adding-a-tool.md`](deepseek-harness/docs/cookbook/adding-a-tool.md)。

## 开发约定

- `Lifehub/` 每个包是 ESM npm 包（`"type": "module"`）。插件代码按上游规则编写：服务包 default export 服务类；函数插件 named export `name / inject / Config / apply` 且无 default export；所有贡献走 `ctx.effect() / ctx.on()`，`register()` 返回 disposer；可选服务用 `ctx.get(name)`，不依赖 `ctx.<name>` 属性代理。
- 部署可变项 = 校验过的 `Config` 字段（`cordis.patch.yml` 可覆盖），禁止硬编码可调优值；跨边界不透明 id 用 `Branded` 而非裸 `string`；外部输入在边界处校验，不许「先放行后兜底」。
- Tool 插件用 `defineTool({ name, description, parameters, output, execute })`：`parameters` 自动校验，`execute` 返回单一 canonical JSON；长任务用 `ctx.jobs.start()`。
- 涉及 Host / Client / Remote 缝的插件必须打通全套接线（Service Definition → Host Provider → API Remotes 装配 → Bundle roster → package.json 依赖闭环 → Client 类型依赖），缺任一环会在不同阶段静默或报错失败（症状：`ctx.remote.xxx` 为 undefined、设置页/面板不显示、Loader 找不到插件、`inject` 静默失败等）。详见上游 `packages/AGENTS.md` 与本文件「插件形态」链接的教程。
- 文案：面向用户的 UI 文案遵循上游 i18n 约定（路由到 typed 字典）；代码注释中文或英文均可，与所在包内既有风格保持一致。
- 产品可见的插件必须至少有一个**真实组合测试**：经 Loader 用 `cordis.yml` 起应用，断言模型可见 / 落盘 / 用户可见输出；手拼 `ctx.plugin(...)` 的套件不视为充分。
- 复用上游 / 既有技术栈组件库，不因单点功能顺手引新库；每引入一个新依赖要能指出至少一个具体使用场景。
- 只修改本业务内的文件；不删除原有内容；尽量不改配置文件（确需修改则向用户强提醒改动点与影响范围）。
- 代码落地后及时更新本文件（新增 Lifehub 包时增补其包说明与接线要点）。

## 工作区纪律

- 根仓库（本仓库）不跟踪 `deepseek-harness/`（见根目录 `.gitignore`）——上游克隆由其自己的 git 管理，避免重复入库、保持两侧可独立演化。
- 不使用 gitnexus 工具。
- 密钥 / 凭证（如 `DEEPSEEK_API_KEY`）不写入代码、日志与提交历史；`.env` 类文件不入库。
- 破坏性 / 不可逆操作（数据库结构变更、批量删改、强推远端、git 历史改写等）只向用户提供命令，由用户亲自执行，并说明作用与是否可逆。
- 提交粒度：一个提交对应一个可独立 revert 的逻辑单元；提交前自检敏感信息与生成产物。
- 前后端 / 插件实现一律以「生产级、可交付」为标准，禁止堆砌演示性代码：每个新增抽象或配置项都应有已知的具体来源（另一个使用场景 / 需求 / 已存在的调用点）。