# 凸透镜探究智能实验平台

面向初中学生的 Web 实验应用：左侧直接嵌入 NOBOOK 凸透镜实验网页，右侧提供试验者信息、五阶段探究引导与对话式科学助教。

当前阶段为产品定义与前端设计，尚未开始应用代码实现。

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

建议以 `React + TypeScript + Vite` 建立前端工程，先完成 NOBOOK iframe 加载验证与右侧静态界面，再接入 Agent 服务和会话记录。实现必须以 `docs/` 中的验收标准为准，并持续使用 Git 分支和小粒度提交管理变化。
