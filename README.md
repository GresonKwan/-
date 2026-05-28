# 凸透镜探究智能实验平台

面向初中学生的 Web 实验应用：左侧直接嵌入 NOBOOK 凸透镜实验网页，右侧提供试验者信息、五阶段探究引导与对话式科学助教。

当前已包含一个轻量 Web 应用骨架：左侧嵌入 NOBOOK 实验，右侧提供试验者信息、五阶段按钮和对话式科学助教。

## 本地运行

```bash
npm run dev
```

默认访问地址：

- http://127.0.0.1:4173

运行检查：

```bash
npm run check
```

## 环境变量

参考 [.env.example](.env.example)。当前服务不依赖第三方包，因此不会自动读取本地 `.env` 文件；请通过 shell、部署平台或进程管理器注入环境变量。

- `PORT`：服务端口，默认 `4173`。
- `PUBLIC_NOBOOK_LENS_RESOURCE_URL`：公开的 NOBOOK iframe 地址，不是密钥。
- `AGENT_API_URL`：可选外部 Agent 服务端点，未配置时使用本地规则引导。
- `AGENT_API_KEY`：可选外部 Agent 密钥，只在 `server.mjs` 中读取，不下发浏览器。

## 设计交付物

- [产品需求文档](docs/PRD.md)：目标、范围、功能、验收、数据与迭代路线。
- [前端设计说明](docs/FRONTEND_DESIGN.md)：页面结构、组件、状态、交互、响应式与工程建议。
- [Agent 提示词规范](docs/AGENT_PROMPTS.md)：五个按钮的固定提示词、系统行为与回复约束。

## 输入材料与实验来源

右侧结构和整体布局参考用户提供的 HTML 文件：

- [/Users/gresonkwan/Downloads/deepseek_html_20260527_520198.html](/Users/gresonkwan/Downloads/deepseek_html_20260527_520198.html)

左侧实验不基于该 HTML 编写或拆分，直接嵌入 NOBOOK 第三方页面：

- 用户提供的资源入口：[NOBOOK 精品实验列表](https://wl.nobook.com/console/templates/resource)
- 已核验到的目标资源页：[探究凸透镜成像的规律](https://wl.nobook.com/console/templates/resource/207_d2c4a829c23aa7471a0344a92e34cb74)

资源入口是实验列表，具体资源页显示“探究凸透镜成像的规律”及“去做实验”入口。正式课堂页面应优先直接加载具体资源页，减少学生在资源列表中搜索的步骤。

## 已确定的产品方向

- 面向学生的文案使用“试验者/小组信息”，不沿用原型中的“教师填写小组信息”。
- 五个步骤按钮触发用户指定的提示词模板，其中第 1 至 3 步使用“滑动摩擦力”作为科学方法迁移示例，并引导学生回到凸透镜实验。
- Agent 由后端代理调用模型服务，前端不存放 API 密钥。
- NOBOOK 为跨域第三方页面；MVP 不假定可以自动读取其操作状态。Agent 根据学生在对话中报告的观察和数据进行引导。

## 后续实现建议

当前实现刻意保持零前端构建依赖，方便迁移到任意 Node 运行环境。后续如需接入真实模型，应先确认 `AGENT_API_URL` 的请求/响应协议，再替换或扩展 `server.mjs` 的外部 Agent 适配逻辑。
