import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
try {
  process.loadEnvFile(join(rootDir, ".env.local"));
} catch {
  // .env.local is optional and intentionally ignored by Git.
}
const publicDir = join(rootDir, "public");
const port = Number.parseInt(process.env.PORT || "4173", 10);
const deepSeekBaseUrl = "https://api.deepseek.com";
const deepSeekModel = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const deepSeekTimeoutMs = 12_000;
const deepSeekMaxAttempts = 2;

const defaultLabUrl =
  "https://wl.nobook.com/console/templates/resource/207_d2c4a829c23aa7471a0344a92e34cb74";

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"]
]);

const stepTitles = {
  1: "共同观察与问题界定",
  2: "提出并确认假设",
  3: "协作设计实验",
  4: "协作采集证据",
  5: "协作评估证据"
};

const promptReferenceAnswers = {
  1: {
    1: {
      "low-low":
        "一个好的科学问题要包含三个要素：研究的对象、改变的条件（自变量）、测量的结果（因变量）。你们可以试试这个句式：“在探究________实验中，如果改变______，那么______会怎样变化？”请你们按照这个句式把空白填上，就是一个很棒的科学问题。",
      mixed:
        "一个好的科学问题要包含三个要素：研究的对象、改变的条件（自变量）、测量的结果（因变量）。你们可以试试这个句式：“在探究________实验中，如果改变______，那么______会怎样变化？”请你们其中一个人先用这个句式给对方造句，另一个人认真听。听完后，另一个人也用这个句式提一个不同的问题。",
      "high-high":
        "一个好的科学问题要包含三个要素：研究的对象、改变的条件（自变量）、测量的结果（因变量）。一个好的科学问题需要具备明确具体、可探究性的特点。比如“不好的问题：为什么植物会生长？”太宽泛；“好的问题：光照时间对绿豆芽的生长高度有什么影响？”更具体且可探究。请你们反思一下，你们的科学问题是否符合这些要求。"
    },
    2: {
      "low-low":
        "例子：“在探究滑动摩擦力的影响因素实验中，如果改变接触面粗糙程度，那么滑动摩擦力大小会怎样变化？”你们可以试试这个句式：“在探究________实验中，如果改变______，那么______会怎样变化？”请你们按照这个句式把空白填上，就是一个很棒的科学问题。",
      mixed:
        "例子：“在探究滑动摩擦力的影响因素实验中，如果改变接触面粗糙程度，那么滑动摩擦力大小会怎样变化？”你们可以试试这个句式：“在探究________实验中，如果改变______，那么______会怎样变化？”请你们其中一个人先用这个句式给对方造句，另一个人认真听。听完后，另一个人也用这个句式提一个不同的问题。",
      "high-high":
        "例子：“在探究滑动摩擦力的影响因素实验中（研究的对象），如果改变接触面粗糙程度（自变量），那么滑动摩擦力大小（因变量）会怎样变化？”请你们仔细对照这个例子反思一下，你们的科学问题是否包含研究的对象、自变量、因变量这三个要素。"
    }
  },
  2: {
    1: {
      "low-low":
        "一个好的实验假设需要具备“可检验性”、“明确性”、“条件性”三个要求。“可检验性”是指实验假设必须为陈述句，不能为疑问句；“明确性”是指假设必须明确自变量和因变量的关系方向；“条件性”是指假设要说明成立的前提条件，而不是绝对化。你们可以试试这个句式：“在控制__________不变的条件下，如果__填自变量___越大/越小，那么__填因变量___越大/越小。”",
      mixed:
        "一个好的实验假设需要具备“可检验性”、“明确性”、“条件性”三个要求。“可检验性”是指实验假设必须为陈述句，不能为疑问句；“明确性”是指假设必须明确自变量和因变量的关系方向；“条件性”是指假设要说明成立的前提条件，而不是绝对化。你们可以试试这个句式：“在控制__________不变的条件下，如果__填自变量___越大/越小，那么__填因变量___越大/越小。”请你们其中一个人先造句，另一个人认真听后再提出一个不同的假设。",
      "high-high":
        "一个好的实验假设需要具备“可检验性”、“明确性”、“条件性”三个要求。“可检验性”是指实验假设必须为陈述句，不能为疑问句；“明确性”是指假设必须明确自变量和因变量的关系方向；“条件性”是指假设要说明成立的前提条件。比如“不好的假设：在任何条件下，植物都能生长”不够明确；“好的假设：在控制温度和水分合适的条件下，光照时间越长，绿豆芽的生长高度越高”更符合要求。请你们反思自己的实验假设是否满足这三个要求。"
    },
    2: {
      "low-low":
        "例子：“在控制压力不变的情况下，如果接触面粗糙程度越大，那么滑动摩擦力越大。”你们可以试试这个句式：“在控制__________不变的条件下，如果__填自变量___越大/越小，那么__填因变量___越大/越小。”请你们按照这个句式把空白填上，就是一个很棒的实验假设。",
      mixed:
        "例子：“在控制压力不变的情况下，如果接触面粗糙程度越大，那么滑动摩擦力越大。”你们可以试试这个句式：“在控制__________不变的条件下，如果__填自变量___越大/越小，那么__填因变量___越大/越小。”请你们其中一个人先用这个句式给对方造句，另一个人认真听。听完后，另一个人也用这个句式提一个不同的假设。",
      "high-high":
        "例子：“在控制压力不变的情况下，如果接触面粗糙程度越大，那么滑动摩擦力越大。”请你们仔细对照这个例子反思一下，你们的实验假设是否符合可检验性、明确性和条件性的要求。"
    }
  },
  3: {
    1: {
      "low-low":
        "固定其他变量保持不变，只让一个变量发生变化，这样才能确定到底是哪个变量引起了实验结果的变化。如果同时改变多个变量，你就无法判断结果的变化是谁造成的。你们可以想象炒菜时同时加了盐和酱油，菜变咸了，就不能判断到底是盐还是酱油造成的。所以实验中要固定其他条件，只让一个变量发生变化。",
      mixed:
        "固定其他变量保持不变，只让一个变量发生变化，这样才能确定到底是哪个变量引起了实验结果的变化。如果同时改变多个变量，你就无法判断结果的变化是谁造成的。请你们其中一个人向另一个人解释：炒菜时同时加了盐和酱油，菜变咸了，能知道是谁造成的吗？再说一说实验中应该怎么做才能判断原因。",
      "high-high":
        "固定其他变量保持不变，只让一个变量发生变化，这样才能确定到底是哪个变量引起了实验结果的变化。如果同时改变多个变量，你就无法判断结果的变化是谁造成的。你们可以进一步思考：既然能同时改变多个变量，为什么我们仍然要选择“一次只改变一个变量”的实验设计？如果一次性改变两个变量，实验会告诉我们什么新信息，又会丢失什么信息？"
    },
    2: {
      "low-low":
        "改变的变量是接触面粗糙程度，例如毛巾和木板。固定的变量包括压力大小、接触面积和拉动的速度。这样做是为了让滑动摩擦力的变化主要由接触面粗糙程度引起。",
      mixed:
        "改变的变量是接触面粗糙程度，例如毛巾和木板。固定的变量包括压力大小、接触面积和拉动的速度。请你们其中一个人向另一个人解释：如果不固定压力大小，同时改变接触面粗糙程度和压力大小，还能判断滑动摩擦力变化是谁造成的吗？",
      "high-high":
        "改变的变量是接触面粗糙程度，例如毛巾和木板。固定的变量包括压力大小、接触面积和拉动的速度。请你们两个人思考：如果不固定压力大小，同时改变接触面粗糙程度和压力大小，还能判断滑动摩擦力变化是谁造成的吗？"
    }
  },
  4: {
    1: {
      "low-low":
        "实像是光线实际会聚形成的，可以用光屏承接；虚像是光线反向延长线会聚形成的，不能用光屏承接。判断方法很简单：能在光屏上看到的是实像；光屏上看不到、但是由光线反向延长线会聚形成的是虚像。",
      mixed:
        "实像是光线实际会聚形成的，可以用光屏承接；虚像是光线反向延长线会聚形成的，不能用光屏承接。判断方法很简单：能在光屏上看到的是实像；光屏上看不到、但是由光线反向延长线会聚形成的是虚像。请你们其中一个人向另一个人再解释一遍如何判断实像和虚像。",
      "high-high":
        "实像是光线实际会聚形成的，可以用光屏承接；虚像是光线反向延长线会聚形成的，不能用光屏承接。判断方法很简单：能在光屏上看到的是实像；光屏上看不到、但是由光线反向延长线会聚形成的是虚像。请你们进一步思考：当u=f时，此时是成虚像还是不成像？"
    },
    2: {
      "low-low":
        "因为当物体在焦点上时，从物体发出的光线经过透镜后变成平行光。平行光不会会聚，也不会反向会聚，所以无法形成实像或虚像。",
      mixed:
        "因为当物体在焦点上时，从物体发出的光线经过透镜后变成平行光。平行光不会会聚，也不会反向会聚，所以无法形成实像或虚像。请一位同学描述当物体在焦点上时光线穿过凸透镜的路径，并用“平行光”这个词向另一位同学解释一遍为什么此时没有像。",
      "high-high":
        "因为当物体在焦点上时，从物体发出的光线经过透镜后变成平行光。平行光不会会聚，也不会反向会聚，所以无法形成实像或虚像。请你们共同描述当物体在焦点上时光线穿过凸透镜的路径，并用“平行光”这个词解释一遍为什么此时没有像。"
    }
  },
  5: {
    1: {
      "low-low":
        "不一致不代表失败。在科学实验中，结论与假设不同是非常常见的情况。它提醒我们需要回到证据中看一看，原来的猜测是否需要修改。",
      mixed:
        "不一致不代表失败。在科学实验中，结论与假设不同是非常常见的情况，它可能只是告诉你原来的猜测需要修正。重要的不是“猜对”，而是“从数据中学到什么规律”。请你们先说说，数据让你们修正了原来哪个想法。",
      "high-high":
        "不一致不代表失败。在科学实验中，结论与假设不同是非常常见的情况，它可能只是告诉你原来的猜测需要修正。重要的不是“猜对”，而是“从数据中学到什么规律”。请你们进一步思考：这些证据是否足够支持你们修改假设？"
    },
    2: {
      "low-low":
        "常见原因有三个：假设本身不准确、实验操作有误差（如测量不准）、实验次数太少。你们可以先检查假设本身是否写得规范，再检查数据记录有没有明显异常。最后也可以再改变物距和像距测量数据，看看结果是否一致。",
      mixed:
        "常见原因有三个：假设本身不准确、实验操作有误差（如测量不准）、实验次数太少。你们可以先检查假设本身是否写得规范，再检查数据记录有没有明显异常。请一位同学先找出一个原因并写在任务单上，再向另一位同学解释；另一位同学看看要不要补充一个原因。",
      "high-high":
        "常见原因有三个：假设本身不准确、实验操作有误差（如测量不准）、实验次数太少。在虚拟仿真实验中，操作误差几乎不存在，测量数据也比较精确。你们可以进一步思考：如果排除了操作误差，剩下的“假设本身不准确”和“实验次数太少”哪个更可能是真正原因？你们会如何设计一个诊断性实验来区分这两者？"
    }
  }
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(body);
}

async function readRequestBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 128_000) {
      throw new Error("Request body is too large.");
    }
  }
  return body ? JSON.parse(body) : {};
}

function normalizeKnowledgeProfile(profile) {
  if (profile === "low-low" || profile === "mixed" || profile === "high-high") {
    return profile;
  }
  return "unspecified";
}

function getProfileStrategy(profile) {
  switch (normalizeKnowledgeProfile(profile)) {
    case "low-low":
      return {
        label: "低-低组",
        role: "策略脚手架",
        focus: "我会先给你们一个清晰步骤，只提示下一步怎么观察和记录。"
      };
    case "mixed":
      return {
        label: "高-低混合组",
        role: "认知桥梁",
        focus: "请一位同学先解释判断理由，另一位同学用自己的话复述确认。"
      };
    case "high-high":
      return {
        label: "高-高组",
        role: "元认知挑战",
        focus: "我会追问证据边界，帮助你们检验判断是否足够可靠。"
      };
    default:
      return {
        label: "未配置组",
        role: "中性探究引导",
        focus: "请尽量用清楚的观察记录或数据支持你们的判断。"
      };
  }
}

function getPromptReference(payload) {
  const match = String(payload.triggeredTemplateId || "").match(/^step-(\d)-prompt-(\d)$/);
  if (!match) return null;

  const [, stepId, promptIndex] = match;
  const profile = normalizeKnowledgeProfile(payload.participantContext?.knowledgeProfile);
  const referenceProfile = profile === "unspecified" ? "low-low" : profile;
  const answer = promptReferenceAnswers[stepId]?.[promptIndex]?.[referenceProfile];
  if (!answer) return null;

  return {
    stepId,
    promptIndex,
    profile: referenceProfile,
    answer
  };
}

function limitReplySentences(text, maxSentences = 4) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const sentences = normalized.match(/[^。！？!?]+[。！？!?]?/g) || [normalized];
  if (sentences.length <= maxSentences) return normalized;
  return sentences.slice(0, maxSentences).join("").trim();
}

function buildSystemPrompt() {
  return [
    "你的名字是“小科”，是一名嵌入初中生协作科学推理过程的GAI聊天机器人智能学伴，当前活动是“探究凸透镜的成像规律”。",
    "目标是促进小组在共同观察与问题界定、提出与确认假设、协作设计实验、协作搜集证据、协作评估证据五个阶段中有效互动，并依据小组先验知识构成提供差异化认知支持。",
    "你需要区分学生困惑属于概念性知识、程序性知识或认识论知识：概念性问题给事实线索和类比，程序性问题给可执行步骤，认识论问题追问证据标准、可靠性和假设修正。",
    "低-低组采用策略脚手架，高-低混合组采用认知桥梁，高-高组采用元认知挑战；语言温和、鼓励、平等，符合七年级学生理解水平。",
    "回复必须限制在3到4句话，每次只聚焦一个核心问题，结构为：回应当前问题，给出一个提示或追问，提出一个可立即观察、记录、讨论或复述的任务。",
    "左侧NOBOOK实验是第三方嵌入页面，你不能自动读取其中的数据，只能引用学生明确报告的观察和数据。",
    "禁止直接给出本次凸透镜实验的最终结论、完整规律或替学生完成推理；如果学生索要答案，请改为提示观察维度、控制变量和证据记录方式。",
    "第1至第3步中的滑动摩擦力只作为科学方法示例，最后必须迁移回凸透镜实验；不得评价学生能力层级，不索取无关个人信息。",
    "如果用户消息来自某个预制问题，并提供了“目标回答样例”，你必须优先贴近该样例的句式、关键术语和协作动作，只允许做少量上下文改写。",
    "目标回答样例中的填空下划线、例子和协作指令默认保留，不要替学生把空白处填好，除非学生已经明确给出了自己的填空内容。"
  ].join("\n");
}

function classifyKnowledgeNeed(payload) {
  const text = `${payload.activeStep || ""} ${payload.studentMessage || ""}`;
  if (payload.activeStep === "3" || /变量|设计|步骤|方案|固定|改变|控制/.test(text)) {
    return "程序性知识：实验设计、变量控制或操作步骤";
  }
  if (payload.activeStep === "5" || /证据|结论|假设|可靠|失败|一致|误差/.test(text)) {
    return "认识论知识：证据标准、结论可靠性或假设修正";
  }
  if (/实像|虚像|焦点|焦距|成像|光屏|倒立|正立|放大|缩小/.test(text)) {
    return "概念性知识：科学事实、概念或原理线索";
  }
  return "综合探究支持：先判断学生需要概念、程序还是认识论帮助";
}

function buildDeepSeekUserPrompt(payload) {
  const activeStep = payload.activeStep ? String(payload.activeStep) : "未选择";
  const stepTitle = stepTitles[activeStep] || "自由探究";
  const profile = getProfileStrategy(payload.participantContext?.knowledgeProfile);
  const groupId = payload.participantContext?.groupId || "未填写小组";
  const names = Array.isArray(payload.participantContext?.displayNames)
    ? payload.participantContext.displayNames.join("、")
    : "";
  const observation = payload.reportedObservation?.text || "学生尚未报告明确观察。";
  const reference = getPromptReference(payload);

  const promptParts = [
    `当前步骤：${activeStep} ${stepTitle}`,
    `小组：${groupId}${names ? `；成员：${names}` : ""}`,
    `适应性反馈策略：${profile.label}；${profile.role}；${profile.focus}`,
    `核心知识类型判断：${classifyKnowledgeNeed(payload)}`,
    `学生报告的观察：${observation}`,
    `学生消息：${payload.studentMessage || ""}`
  ];

  if (reference) {
    promptParts.push(
      `目标回答样例（强参考，请尽量贴近）：${reference.answer}`,
      "预制问题生成要求：优先复用目标回答样例中的概念、句式和协作任务，控制在3到4句话；保留样例中的填空下划线，不要替学生完成填空；不要额外扩展成完整讲义。"
    );
  } else {
    promptParts.push(
      "生成要求：以“小科”的口吻回复，避免直接给出凸透镜成像的完整规律或最终结论，引导学生用自己的观察和同伴讨论继续推理。"
    );
  }

  return promptParts.join("\n");
}

function buildDeepSeekHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item?.role === "user" || item?.role === "assistant")
    .map((item) => ({
      role: item.role,
      content: String(item.content || "").slice(0, 800)
    }))
    .filter((item) => item.content.trim())
    .slice(-8);
}

function buildLocalAgentReply(payload) {
  const reference = getPromptReference(payload);
  if (reference) {
    return reference.answer;
  }

  const activeStep = payload.activeStep ? String(payload.activeStep) : "";
  const stepTitle = stepTitles[activeStep] || "自由探究";
  const observation = String(payload.reportedObservation?.text || "").trim();
  const message = String(payload.studentMessage || "").trim();
  const strategy = getProfileStrategy(payload.participantContext?.knowledgeProfile);

  if (observation && activeStep) {
    if (activeStep === "4") {
      return `我是小科，你们报告的“${observation}”可以先作为一条证据记录，但先别急着写成最终规律。采集证据时，可以先看光屏上是否能承接到清晰像，再记录物距、像距、大小和正倒。${strategy.focus} 请继续补充一次物距和像距，或让同伴复述你们这样判断的理由。`;
    }

    return `我是小科，我先把你们报告的观察“${observation}”当作讨论材料，而不是直接当作结论。它需要和当前阶段“${stepTitle}”对应起来，说明它正在支持哪个问题、假设或判断。${strategy.focus} 请补充一个更具体的数据、控制条件或判断依据。`;
  }

  if (activeStep === "1") {
    return `我是小科，这是第1步“${stepTitle}”：好的科学问题要能观察、能改变条件、能用证据回答。比如摩擦力实验可以围绕“改变什么、观察什么”来提问。${strategy.focus} 请你们回到左侧凸透镜实验，先提出一个关于物距、像的虚实、大小或正倒的可研究问题。`;
  }

  if (activeStep === "2") {
    return `我是小科，这是第2步“${stepTitle}”：好的假设要说清“改变什么”和“观察什么”，并且能被实验记录检验。摩擦力例子只是帮助你们理解假设格式，不代表当前实验结论。${strategy.focus} 请把你们关于凸透镜实验的想法写成“如果……那么……”的形式。`;
  }

  if (activeStep === "3") {
    return `我是小科，这是第3步“${stepTitle}”：固定一些变量，是为了让观察结果尽量只和你们研究的变量有关。摩擦力例子中若研究粗糙程度，就要尽量固定压力、接触面积和拉动方式。${strategy.focus} 在凸透镜实验中，请你们先说清“只改变什么、固定什么、记录什么”。`;
  }

  if (activeStep === "4") {
    return `我是小科，这是第4步“${stepTitle}”：关于实像和虚像，可以先抓住一个判断线索：能不能用光屏承接到清晰像。关于焦点位置，可以思考折射后的光有没有在光屏附近重新会聚。${strategy.focus} 请在左侧先记录一次物距、像距和你们看到的像，再讨论它属于哪类证据。`;
  }

  if (activeStep === "5") {
    return `我是小科，这是第5步“${stepTitle}”：结论和假设不一致，不等于实验失败，而是提醒你们回头检查证据和条件。可以从记录是否完整、变量是否控制住、观察是否重复一致三个方面想一想。${strategy.focus} 请用一句话说明你们的假设和证据哪里一致、哪里还需要再验证。`;
  }

  if (observation) {
    return `我是小科，我先按你们报告的观察来追问：${observation}。请注意，我不能自动读取左侧 NOBOOK 实验状态，只能依据你们输入的数据和现象帮助你们推理。${strategy.focus} 你们可以补充物距、像距、像的虚实、大小和正倒中的任意两项。`;
  }

  if (message.includes("实像") || message.includes("虚像")) {
    return `我是小科，判断实像和虚像时，可以先把“光屏上能不能承接到清晰像”作为一个观察线索。不要只凭印象下结论，还要把物距、像距和观察方式记录下来。${strategy.focus} 请你们在左侧验证一次，并把看到的证据发给我。`;
  }

  return `我是小科，我会用科学探究的方式帮助你们，而不是直接替你们写答案或最终结论。请先在左侧 NOBOOK 实验中完成一次操作，并告诉我你们改变了什么、观察到了什么。${strategy.focus} 你们也可以点击上方五个步骤按钮开始。`;
}

async function callExternalAgent(payload) {
  const endpoint = process.env.AGENT_API_URL;
  if (!endpoint) return null;

  const headers = {
    "content-type": "application/json"
  };
  if (process.env.AGENT_API_KEY) {
    headers.authorization = `Bearer ${process.env.AGENT_API_KEY}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`External agent responded with ${response.status}.`);
  }

  const data = await response.json();
  if (typeof data.content === "string") return data.content;
  if (typeof data.reply === "string") return data.reply;
  if (typeof data.message === "string") return data.message;
  throw new Error("External agent response did not include content, reply, or message.");
}

async function callDeepSeekAgent(payload) {
  if (!process.env.DEEPSEEK_API_KEY) return null;

  let lastError = null;
  for (let attempt = 1; attempt <= deepSeekMaxAttempts; attempt += 1) {
    try {
      return await requestDeepSeekAgent(payload);
    } catch (error) {
      lastError = error;
      console.error(
        `DeepSeek request failed on attempt ${attempt}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  throw lastError || new Error("DeepSeek request failed.");
}

async function requestDeepSeekAgent(payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deepSeekTimeoutMs);

  const response = await fetch(`${deepSeekBaseUrl}/chat/completions`, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: deepSeekModel,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        ...buildDeepSeekHistory(payload.history),
        { role: "user", content: buildDeepSeekUserPrompt(payload) }
      ],
      thinking: { type: "disabled" },
      stream: false,
      max_tokens: 360,
      temperature: 0.2
    })
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek responded with ${response.status}: ${errorText.slice(0, 180)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) {
    return content;
  }
  throw new Error("DeepSeek response did not include choices[0].message.content.");
}

function buildDegradedNotice(sourceName = "DeepSeek") {
  return {
    type: "network_degraded",
    message: `${sourceName} 连接不稳定，已自动切换为本地安全引导。你们可以继续完成实验记录，稍后再尝试联网回复。`
  };
}

async function handleApi(req, res) {
  if (req.method === "GET" && req.url === "/api/config") {
    sendJson(res, 200, {
      labUrl: process.env.PUBLIC_NOBOOK_LENS_RESOURCE_URL || defaultLabUrl
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/chat") {
    try {
      const payload = await readRequestBody(req);
      const promptReference = getPromptReference(payload);
      if (promptReference) {
        sendJson(res, 200, {
          content: limitReplySentences(promptReference.answer),
          source: "preset",
          degraded: false,
          notice: null
        });
        return;
      }

      let deepSeekReply = null;
      let degradedNotice = null;
      try {
        deepSeekReply = await callDeepSeekAgent(payload);
      } catch (error) {
        degradedNotice = buildDegradedNotice();
      }
      let externalReply = null;
      if (!deepSeekReply) {
        try {
          externalReply = await callExternalAgent(payload);
        } catch (error) {
          console.error("External agent request failed:", error instanceof Error ? error.message : error);
          degradedNotice ||= buildDegradedNotice("外部 Agent");
        }
      }
      const replyContent = deepSeekReply || externalReply || buildLocalAgentReply(payload);
      sendJson(res, 200, {
        content: limitReplySentences(replyContent),
        source: deepSeekReply ? "deepseek" : externalReply ? "external" : degradedNotice ? "fallback" : "local",
        degraded: Boolean(degradedNotice),
        notice: degradedNotice
      });
    } catch (error) {
      sendJson(res, 500, {
        error: "agent_request_failed",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
    return;
  }

  sendJson(res, 404, { error: "not_found" });
}

async function serveStatic(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const decodedPath = decodeURIComponent(url.pathname);
  const relativePath = decodedPath === "/" ? "/index.html" : decodedPath;
  const filePath = normalize(join(publicDir, relativePath));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    res.writeHead(200, {
      "content-type": mimeTypes.get(extname(filePath)) || "application/octet-stream",
      "cache-control": "no-cache"
    });
    res.end(file);
  } catch {
    const fallback = await readFile(join(publicDir, "index.html"));
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache"
    });
    res.end(fallback);
  }
}

const server = createServer((req, res) => {
  if ((req.url || "").startsWith("/api/")) {
    void handleApi(req, res);
    return;
  }
  void serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`Lens inquiry app listening on http://127.0.0.1:${port}`);
});
