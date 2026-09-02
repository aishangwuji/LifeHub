# AGENTS.md

本项目（LifeCordisHub-dsh）专门为 deepseek-harness 构建插件，以第三方开发者身份开发。构建的插件包放于 `LifeCordisHub-dsh/` 目录，作为独立、可安装、可发布的 npm 插件包存在。

## 工作区布局

| 路径 | 角色 |
|---|---|
| `deepseek-harness/` | 上游官方仓库克隆（独立 git，`origin=deepseek-ai/deepseek-harness`）。**只读参照**：它是插件契约的权威来源（文档 / 代码 / 示例 / SKILL）。改动它 = 脱离第三方开发者身份，且会被上游更新冲掉；除非任务明确要求，禁止修改其中任何文件。需要跟随上游时用 `git -C deepseek-harness pull`，由它自己的仓库管理版本。 |
| `Lifehub/` | 本项目插件包目录。每个子目录是一个自包含 npm 插件包，可独立构建、打包、安装进 dsh profile。 |
| `AGENTS.md` | 本文件：工作区唯一的工程指令源，随插件开发持续更新。 |

## 插件形态：组合包（bundle）

dsh 是「全插件」Harness，第三方插件以**组合包**形式交付：一个 npm 包，`package.json` 声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`，由 `cordis.patch.yml`（patch 条目 YAML 数组）向 profile 插入或覆盖插件行，插件代码按包名被引用。

安装与验证（源码工作区内命令前缀 `pnpm`）：

```sh
dsh plugin --profile demo add ./Lifehub/<plugin>   # 转发给 pnpm；声明 dsh.bundle 才激活层
dsh --profile demo --dump-config                   # 确认新层出现后再启动
dsh --profile demo                                 # 开启真实 session 验证组合产物
```

- 只有声明 `dsh.bundle` 的包会被追加进 `dsh.profile.bundles`；普通依赖打印警告不激活。
- 从 git 安装：作者必须提供自包含的 `prepare` 构建脚本；用户需在 profile 的 `pnpm-workspace.yaml` `allowBuilds` 中显式授权该包。npm 发布或 `pnpm pack` 的 tarball 免构建授权。
- 层顺序：profile bundles 列表 → profile 自身 `cordis.patch.yml` → home 级 patch → `--patch` overlay；后应用者按行胜出，patch 覆盖整行 `config`（需重述全部键）。

## 契约源（开发前必读，以 `deepseek-harness/` 内文档为唯一权威）

- 教程：[`docs/user/develop/basic/publish.zh.md`](deepseek-harness/docs/user/develop/basic/publish.zh.md)（打包与安装）、[`config.zh.md`](deepseek-harness/docs/user/develop/basic/config.zh.md)（插件配置）。
- 底层规则：根 [`AGENTS.md`](deepseek-harness/AGENTS.md)、[`docs/architecture.md`](deepseek-harness/docs/architecture.md)、[`docs/cordis-primer.md`](deepseek-harness/docs/cordis-primer.md)、[`packages/AGENTS.md`](deepseek-harness/packages/AGENTS.md)、[`docs/cookbook/adding-a-tool.md`](deepseek-harness/docs/cookbook/adding-a-tool.md)。
- **插件开发规范（本工作区开发约定的 home，两条官方 SKILL）**：
  - [`cordis-plugin-development/SKILL.md`](deepseek-harness/packages/preset/agent-presets/presets/cordis/skills/cordis-plugin-development/SKILL.md) —— 插件开发全流程：平台选择、真实接口查询、执行环境、副作用生命周期、Slot/Event/Tool 注册、Host↔Client 通信、版本与失败排查。
  - [`editing-cordis-compositions/SKILL.md`](deepseek-harness/packages/preset/agent-presets/presets/cordis/skills/editing-cordis-compositions/SKILL.md) —— 组合编排：plane 归属、preset 创作、isolate realm、mount 校验。

## 开发约定

### 动手前：先查真实接口，再写代码

- 禁止凭服务名 / 事件名 / 示例 / README 推断完整 API。开发前用 `cordis_inspect_list` / `cordis_inspect_query` 读取当前注册的 Provider 方法签名、Event mode、Slot protocol、Theme token、Tool schema，代码只使用查证过的接口。工作区无运行实例时，以 `deepseek-harness/docs/subsystems/` 与 `deepseek-harness/packages/**/README.md` 的声明为准，仍禁止臆测。
- 能力归属哪个平台先决定：文件 / 命令 / 进程 / 网络 / 动态 Tool / 会话与宿主生命周期 → **Host**；主题 / 页面布局 / 会话快照 / 设置页 / 侧边栏 / 覆盖层 / Tool 卡片 → **Client**。数据在谁那里就靠近谁，不跨层重复取；Slot props 已有数据就不要再用 Host RPC 取一次。

### 执行环境

- `Lifehub/` 每个包是 ESM npm 包（`"type": "module"`）。dsh 运行实例内动态注入的 Host / Client 代码是**返回 Cordis Plugin 的纯 JS 函数体**（无 `import` / `require` / TS / decorator / JSX，Client 用 `React.createElement`）；Lifehub 包属于静态发布包，源码可正常用 TS 与 import，但运行时约束不变：未确认可用的全局对象（`window` / `document` / `process` / `Buffer` / `fetch` / 原生定时器）不得假设存在。
- 读服务默认 `ctx.get(name)` 并判空处理；`inject` 只声明硬依赖；未声明就访问 `ctx.<name>` 会被 Guard 拒绝（报 `service "x" is not declared`）。不要为了省一个判空而滥用 `inject`。
- 插件导出形态：服务包 default export 服务类；函数插件 named export `name / inject / Config / apply` 且**无 default export**，混用会被 Loader 丢弃 `inject`。

### 副作用与生命周期

- 所有贡献必须可清除：监听用 `ctx.on()`，外部订阅用 `ctx.effect(() => ...)` 且返回 disposer，Cordis 各 API 返回的 disposer 一律保留；`apply()` 外 / 模块作用域禁止产生进程级或页面级副作用。`register()` 返回 disposer；可选服务用 `ctx.get(name)`。
- 定时器是名为 `timer` 的 Service（不是 Builtin）：`inject: ['timer']` 后使用 `ctx.timeout` / `ctx.interval`，禁止 `setTimeout` 等全局定时器。
- 事件监听前确认 `mode`；Waterfall 事件监听器必须调用并返回 `next()`，否则中断链路。

### Client UI（涉 UI 时）

- 先 `Slots.listSubTree` 选目标，再查精确 Slot 协议后写注册；尊重 `single / list / keyed / chain` 协议与 owner props，不猜 `id` / `key` / selector / props。
- 选最窄且够用的入口：单个偏好用 `settings.general.item`，完整设置区用 `settings.section`；小侧栏操作用 `sidebar.footer.action` 等追加式内层 Slot，**不要整区替换** `root` / `sidebar` / `conversation` / `details` 等产品 UI 区域（替换会带掉它声明的后代 Slot）。
- 样式：组件自己的样式用 `styles.insert(css)`，颜色优先主题 CSS 变量；改全局主题先 `Theme.listTokens` 查询、light/dark 两套值都要提供；不操作 `document.body` / `window` / 硬编码产品 DOM 选择器。
- 面向用户的文案遵循上游 i18n 约定（路由到 typed 字典），不硬编码 UI 文案。

### 跨端通信与动态 Tool

- Host↔Client 私有调用：Host `harness.handle(method, handler)`，Client `host.call(method, args)`。参数与返回值必须是无损 JSON（标量 / 数组 / 普通对象），**禁止跨端传函数 / React 元素 / 类实例 / Service / Session 等运行期对象**；包内私有通信不走 `ctx.remote` 与公共 Remote Service。
- 动态 Tool 用 `defineTool({ name, description, parameters, output, execute })`：`parameters` 自动校验，`execute` 只拥有业务结果，render/presentation 只产出模型与原生 UI 可见内容；参数与返回须 JSON 兼容；注册必须挂在当前 Plugin Fiber 上，stop / update 后自动清理。长任务用 `ctx.jobs.start()`。
- 内部活数据（Service 实例 / Event payload / Slot props / Session / Conversation 快照 / Tool 状态）：禁止整体 `JSON.stringify` / `structuredClone` / 递归枚举 / 整段展示，只取当前功能需要的叶子字段，转出标量后再构造自有 JSON。

### 组合编排（插件行的落点）

- 一切能力 = `cordis.yml` 里的一行；改能力 = 改行。改组合必须遵守 plane 归属：宿主组合持注册表（tools / systemPrompt / agents / agent-loop / sessions）与跨会话、沙箱审批、模型路由、子代理注册；agent preset 只贡献单个会话内的行。**服务有未知消费者在 agent plane 之外就不能放进 preset**（`subagents` 是标准反例）。
- 发布服务的行不能裸放 preset：必须把 provider 与其全部消费者包进带 `isolate` realm（`true`）的 group，否则第二个会话挂载冲突；消费者留在 realm 外会解析到宿主注册表而毫无贡献。
- preset 校验用 mount（`standingKeyFor(id)`，能抓包解析失败 / 配置非法 / 行未激活 / 服务发布进 root realm 四类问题），**不把 `list().broken` 当校验**；`cordis_inspect` 只反映当次会话组合，不预示新 preset 的效果。
- 永不改发货 preset（`standard` / `ptc` / `minimal` / `cordis`），要改就复制副本改；`agent-loop`、注册表、会话持久化、沙箱 / 审批 / 权限行禁止移入 preset。产品子代理 provider（codex / claude-code）是独立 Profile Bundle（`dsh plugin add @deepseek-ai/dsh-subagent-*`），不进 preset。
- `Lifehub/` 包内涉及 Host / Client / Remote 缝的插件必须打通全套接线（Service Definition → Host Provider → API Remotes 装配 → Bundle roster → package.json 依赖闭环 → Client 类型依赖）。症状对照：`ctx.remote.xxx` 为 undefined → 缺 bundle 行；设置页 / 面板不显示 → 缺 client 类型依赖；Loader 找不到插件 → 缺 package.json 依赖；`inject` 静默失败 → 缺 remote 服务声明。详见 `packages/AGENTS.md` 与上述 SKILL。

### 运行期动态插件：版本语义与失败排查

- Plugin = 稳定实例（`pluginId`）；Package = 不可变版本（`packageId`）；每次激活有独立 `pluginRunId`。`currentPackageId` 是最近成功版本（不表示正在运行），`nextPackageId` 是待批 / 激活中 / 最近失败目标：换版本用 `update`，回滚用 `run current`；审批被拒**不自动重试**，失败包不覆盖、在其下新定义 Package 再跑。
- 常见失败先查这几处：`service "x" is not declared` → 未声明 `inject` 或应改 `ctx.get`；Client 解析失败 → 用了 JSX / TS / import / 不可用全局；Slot 注册失败 → 未查询活子树 / 协议不满足；`host.call` 失败 → handler 名 / JSON 参数 / handler 内真实服务依赖；update 失败 → 修 `nextPackageId` 后 update，或 `run currentPackageId` 回滚。
- 产品可见的插件必须至少有一个**真实组合测试**：经 Loader 用 `cordis.yml` 起应用，断言模型可见 / 落盘 / 用户可见输出；手拼 `ctx.plugin(...)` 的套件不视为充分。

## 工程纪律

- 部署可变项 = 校验过的 `Config` 字段（`cordis.patch.yml` 可覆盖），禁止硬编码可调优值；跨边界不透明 id 用 `Branded` 而非裸 `string`；外部输入在边界处校验，不许「先放行后兜底」，校验失败就地拒绝。
- 复用上游 / 既有技术栈组件库，不因单点功能顺手引新库；每个新抽象或配置项要有已知的具体来源（另一使用场景 / 需求 / 已存在调用点），禁止投机性设计与演示性堆砌。
- 只修改本业务内的文件；不删除原有内容；尽量不改配置文件（确需修改则向用户强提醒改动点与影响范围）。
- 代码落地后及时更新本文件（新增 Lifehub 包时增补其包说明与接线要点）。

## 工作区纪律

- 根仓库（本仓库）不跟踪 `deepseek-harness/`（见根目录 `.gitignore`）——上游克隆由其自己的 git 管理，避免重复入库、保持两侧可独立演化。
- 不使用 gitnexus 工具。
- 密钥 / 凭证（如 `DEEPSEEK_API_KEY`）不写入代码、日志与提交历史；`.env` 类文件不入库。
- 破坏性 / 不可逆操作（数据库结构变更、批量删改、强推远端、git 历史改写等）只向用户提供命令，由用户亲自执行，并说明作用与是否可逆。
- 提交粒度：一个提交对应一个可独立 revert 的逻辑单元；提交前自检敏感信息与生成产物。