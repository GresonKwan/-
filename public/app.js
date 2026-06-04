const stepDefinitions = [
  {
    id: 1,
    title: "共同观察与问题界定",
    short: "观察问题",
    questions: [
      "①怎样提出一个好的科学问题？一个好的科学问题包含哪些要素？",
      "②请你以“探究滑动摩擦力的影响因素”物理科学实验为例，提出一个好的科学问题供我们参考一下。"
    ]
  },
  {
    id: 2,
    title: "提出并确认假设",
    short: "提出假设",
    questions: [
      "①怎样提出一个好的实验假设？一个好的实验假设需要符合哪些准则条件？",
      "②请你以“探究滑动摩擦力的影响因素”物理科学实验为例，提出一个好的实验假设供我们参考一下。"
    ]
  },
  {
    id: 3,
    title: "协作设计实验",
    short: "设计实验",
    questions: [
      "①在设计实验方案时，为什么需要固定一些变量保持不变呢？原因是什么？",
      "②假如我的实验方案是“探究接触面粗糙程度对滑动摩擦力大小的影响”，请你告诉我哪些变量需要固定不变、哪些变量需要改变，并解释原因，供我参考一下。"
    ]
  },
  {
    id: 4,
    title: "协作采集证据",
    short: "采集证据",
    questions: [
      "①在“探究凸透镜的成像规律”实验中，请你解释什么是“实像”、什么是“虚像”？如何判断成像是实像还是虚像？",
      "②在“探究凸透镜的成像规律”实验中，为什么当物体正好位于凸透镜焦点处时，不成像呢？请你解释原因。"
    ]
  },
  {
    id: 5,
    title: "协作评估证据",
    short: "评估证据",
    questions: [
      "①在“探究凸透镜的成像规律”实验中，我将得出的实验结论与刚开始做的实验假设进行对比，发现两者存在不一致的情况，这种情况是否说明我的实验是失败的呢？",
      "②为什么实验结论与实验假设可能会存在不一致呢？有哪些可能的原因导致这种情况？"
    ]
  }
];

const state = {
  activeStep: null,
  participantContext: {
    groupId: "",
    displayNames: [],
    knowledgeProfile: "unspecified"
  },
  messages: []
};

const elements = {
  labFrame: document.querySelector("#labFrame"),
  labLoading: document.querySelector("#labLoading"),
  openLabLink: document.querySelector("#openLabLink"),
  currentStepStatus: document.querySelector("#currentStepStatus"),
  participantForm: document.querySelector("#participantForm"),
  participantSummary: document.querySelector("#participantSummary"),
  toggleParticipant: document.querySelector("#toggleParticipant"),
  stepsGrid: document.querySelector("#stepsGrid"),
  messages: document.querySelector("#messages"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  clearChat: document.querySelector("#clearChat")
};

function addMessage(role, content) {
  const message = {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString()
  };
  state.messages.push(message);
  renderMessages();
}

function renderMessages() {
  elements.messages.replaceChildren();
  for (const message of state.messages) {
    const item = document.createElement("div");
    item.className = `message ${message.role}`;
    renderMessageContent(item, message.content);
    elements.messages.appendChild(item);
  }
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function renderMessageContent(container, content) {
  const lines = String(content || "").replace(/\r\n?/g, "\n").split("\n");
  lines.forEach((line, index) => {
    if (index > 0) container.appendChild(document.createElement("br"));
    appendInlineMarkdown(container, normalizeMarkdownLine(line));
  });
}

function normalizeMarkdownLine(line) {
  return line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\s*[-*+]\s+/, "• ")
    .replace(/^\s*\d+\.\s+/, (match) => match.trim() + " ");
}

function appendInlineMarkdown(container, text) {
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|__([^_\s，。！？；：,.!?;:、（）()“”"']{1,16})___|_{3,}|__([^_]+?)__/g;
  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > lastIndex) {
      container.appendChild(document.createTextNode(stripLooseMarkdown(text.slice(lastIndex, match.index))));
    }
    if (match[1]) {
      const element = document.createElement("code");
      element.textContent = stripLooseMarkdown(match[1]);
      container.appendChild(element);
    } else if (match[2] || match[4]) {
      const element = document.createElement("strong");
      element.textContent = stripLooseMarkdown(match[2] || match[4]);
      container.appendChild(element);
    } else if (match[3]) {
      container.appendChild(createFillBlank(match[0], match[3]));
    } else {
      container.appendChild(createFillBlank(match[0]));
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    container.appendChild(document.createTextNode(stripLooseMarkdown(text.slice(lastIndex))));
  }
}

function createFillBlank(rawToken, label = "") {
  const blank = document.createElement("span");
  blank.className = `fill-blank${label ? " is-labeled" : " is-empty"}`;
  blank.setAttribute("aria-label", label ? `填空：${label}` : "填空");
  const width = label ? Math.max(72, label.length * 18) : Math.max(44, Math.min(96, rawToken.length * 8));
  blank.style.setProperty("--blank-width", `${width}px`);
  blank.textContent = label;
  return blank;
}

function stripLooseMarkdown(text) {
  return text
    .replace(/\*\*\*/g, "")
    .replace(/\*\*/g, "")
    .replace(/(^|[^*])\*(?!\*)/g, "$1");
}

function renderSteps() {
  elements.stepsGrid.replaceChildren();
  for (const step of stepDefinitions) {
    const item = document.createElement("div");
    item.className = "step-item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "step-button";
    button.dataset.stepId = String(step.id);
    button.setAttribute("aria-pressed", state.activeStep === step.id ? "true" : "false");
    button.setAttribute("aria-haspopup", "menu");
    if (state.activeStep === step.id) button.classList.add("is-active");
    const title = document.createElement("span");
    title.className = "step-title";
    title.textContent = `${step.id}. ${step.title}`;
    const desc = document.createElement("span");
    desc.className = "step-desc";
    desc.textContent = step.short;
    button.append(title, desc);

    const menu = document.createElement("div");
    menu.className = "step-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", `${step.title}提示词`);

    step.questions.forEach((question, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "prompt-option";
      option.setAttribute("role", "menuitem");
      option.dataset.stepId = String(step.id);
      option.dataset.promptIndex = String(index + 1);
      option.textContent = `提示词 ${index + 1}：${question.replace(/^①|^②/, "")}`;
      option.addEventListener("click", () => handleStepPromptClick(step, question, index));
      menu.appendChild(option);
    });

    item.append(button, menu);
    elements.stepsGrid.appendChild(item);
  }
}

function getParticipantContextFromForm() {
  const formData = new FormData(elements.participantForm);
  const memberNames = [formData.get("memberOne"), formData.get("memberTwo")]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return {
    className: String(formData.get("className") || "").trim(),
    groupId: String(formData.get("groupId") || "").trim(),
    displayNames: memberNames,
    knowledgeProfile: String(formData.get("knowledgeProfile") || "unspecified")
  };
}

function summarizeParticipant(context) {
  const names = context.displayNames.length ? context.displayNames.join("、") : "未填写成员";
  const className = context.className ? `（${context.className}）` : "";
  return `${context.groupId || "未命名小组"}${className}：${names}`;
}

async function loadConfig() {
  const response = await fetch("/api/config", { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("配置加载失败");
  return response.json();
}

async function sendToAgent({ studentMessage, activeStep, triggeredTemplateId, reportedObservation }) {
  const chatHistory = buildAgentHistory(studentMessage);
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json"
    },
    body: JSON.stringify({
      sessionId: getSessionId(),
      activeStep,
      studentMessage,
      history: chatHistory,
      triggeredTemplateId,
      participantContext: state.participantContext,
      reportedObservation: reportedObservation ? { text: reportedObservation, recordedByStudent: true } : undefined
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || "Agent 请求失败");
  }
  return payload;
}

function buildAgentHistory(currentMessage) {
  const history = state.messages
    .filter((message) => message.role === "user" || message.role === "agent")
    .map((message) => ({
      role: message.role === "agent" ? "assistant" : "user",
      content: message.content
    }));
  const last = history.at(-1);
  if (last?.role === "user" && last.content === currentMessage) {
    history.pop();
  }
  return history.slice(-8);
}

function getSessionId() {
  const key = "lens-inquiry-session-id";
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
}

async function handleStepPromptClick(step, question, promptIndex) {
  state.activeStep = step.id;
  elements.currentStepStatus.textContent = `第 ${step.id} 步：${step.title}｜提示词 ${promptIndex + 1}`;
  renderSteps();

  const questionText = `【${step.title}｜提示词 ${promptIndex + 1}】\n${question}`;
  addMessage("user", questionText);
  addMessage("system", "小科正在根据所选提示词生成 3～4 句话的引导...");

  try {
    const payload = await sendToAgent({
      studentMessage: questionText,
      activeStep: step.id,
      triggeredTemplateId: `step-${step.id}-prompt-${promptIndex + 1}`,
      reportedObservation: ""
    });
    state.messages.pop();
    addAgentResponse(payload);
  } catch (error) {
    state.messages.pop();
    addMessage("system", `发送失败：${error instanceof Error ? error.message : "未知错误"}。请稍后重试。`);
  }
}

function setupParticipantForm() {
  elements.participantForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const context = getParticipantContextFromForm();
    if (!context.groupId || context.displayNames.length === 0) {
      addMessage("system", "请至少填写小组编号和成员 1，再保存试验者信息。");
      return;
    }

    state.participantContext = context;
    elements.participantSummary.hidden = false;
    elements.participantSummary.textContent = `已保存：${summarizeParticipant(context)}`;
    addMessage("agent", `小科已记录 ${summarizeParticipant(context)}。接下来请先观察左侧 NOBOOK 实验，或点击一个探究步骤开始。`);
  });

  elements.toggleParticipant.addEventListener("click", () => {
    const isCollapsed = elements.participantForm.classList.toggle("is-collapsed");
    elements.toggleParticipant.textContent = isCollapsed ? "展开" : "收起";
  });
}

function setupChat() {
  elements.chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = elements.chatInput.value.trim();
    if (!text) return;

    elements.chatInput.value = "";
    addMessage("user", text);
    addMessage("system", "小科正在思考...");

    try {
      const payload = await sendToAgent({
        studentMessage: text,
        activeStep: state.activeStep,
        reportedObservation: text
      });
      state.messages.pop();
      addAgentResponse(payload);
    } catch (error) {
      state.messages.pop();
      addMessage("system", `发送失败：${error instanceof Error ? error.message : "未知错误"}。你的输入已保留在上方记录中。`);
    }
  });

  elements.chatInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      elements.chatForm.requestSubmit();
    }
  });

  elements.clearChat.addEventListener("click", () => {
    const confirmed = window.confirm("确认清空当前聊天记录吗？");
    if (!confirmed) return;
    state.messages = [];
    addWelcomeMessage();
  });
}

function addAgentResponse(payload) {
  if (payload.notice?.message) {
    addMessage("system", payload.notice.message);
  }
  addMessage("agent", payload.content || "小科暂时没有生成有效回复，请再描述一次你们的观察。");
}

function addWelcomeMessage() {
  addMessage(
    "agent",
    "你好，我是小科，是你们的科学探究智能学伴。左侧是 NOBOOK 凸透镜实验，我不能自动读取其中的数据，所以请把你们观察到的现象或测量记录告诉我。你们可以点击五个步骤按钮，也可以直接向我提问。"
  );
}

async function setupLabFrame() {
  try {
    const config = await loadConfig();
    elements.labFrame.src = config.labUrl;
    elements.openLabLink.href = config.labUrl;
    elements.labFrame.addEventListener("load", () => {
      elements.labLoading.classList.add("is-hidden");
    });
    window.setTimeout(() => {
      if (!elements.labLoading.classList.contains("is-hidden")) {
        elements.labLoading.textContent = "NOBOOK 页面加载较慢。如长时间无响应，请使用右上角“新页面打开”。";
      }
    }, 8000);
  } catch {
    elements.labLoading.textContent = "配置加载失败，请检查服务端环境变量或刷新页面。";
  }
}

async function init() {
  renderSteps();
  setupParticipantForm();
  setupChat();
  addWelcomeMessage();
  await setupLabFrame();
}

void init();
