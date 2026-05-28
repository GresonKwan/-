import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(rootDir, "public");
const port = Number.parseInt(process.env.PORT || "4173", 10);

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
        focus: "我会先给你们一个清晰步骤，降低理解负担。"
      };
    case "mixed":
      return {
        label: "高-低混合组",
        focus: "请一位同学先解释判断理由，另一位同学用自己的话复述确认。"
      };
    case "high-high":
      return {
        label: "高-高组",
        focus: "我会追问证据边界，帮助你们检验结论是否足够可靠。"
      };
    default:
      return {
        label: "未配置组",
        focus: "请尽量用清楚的观察记录或数据支持你们的判断。"
      };
  }
}

function limitReplySentences(text, maxSentences = 4) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const sentences = normalized.match(/[^。！？!?]+[。！？!?]?/g) || [normalized];
  if (sentences.length <= maxSentences) return normalized;
  return sentences.slice(0, maxSentences).join("").trim();
}

function buildLocalAgentReply(payload) {
  const activeStep = payload.activeStep ? String(payload.activeStep) : "";
  const stepTitle = stepTitles[activeStep] || "自由探究";
  const observation = String(payload.reportedObservation?.text || "").trim();
  const message = String(payload.studentMessage || "").trim();
  const strategy = getProfileStrategy(payload.participantContext?.knowledgeProfile);

  if (observation && activeStep) {
    if (activeStep === "4") {
      return `你们报告的现象是“${observation}”，这可以先作为采集证据的起点。若光屏上能承接到清晰像，就先判断为实像，再记录它的大小和正倒。${strategy.focus} 请继续补充物距和像距，或再改变一次物距比较结果。`;
    }

    return `我先按你们报告的观察来分析：“${observation}”。这条记录还需要和当前探究步骤“${stepTitle}”对应起来，说明它支持了哪个问题、假设或结论。${strategy.focus} 请补充一个更具体的数据或判断依据。`;
  }

  if (activeStep === "1") {
    return `这是第1步“${stepTitle}”：好的科学问题要能观察、能改变条件、能用证据回答。比如摩擦力实验可问“接触面粗糙程度会怎样影响滑动摩擦力大小？” ${strategy.focus} 请你们回到左侧凸透镜实验，提出一个关于物距、像的虚实、大小或正倒的科学问题。`;
  }

  if (activeStep === "2") {
    return `这是第2步“${stepTitle}”：好的假设要说清自变量、因变量和可检验的预测。比如“接触面越粗糙，滑动摩擦力越大”就是能被数据检验的假设。${strategy.focus} 请把你们关于凸透镜成像的假设写成“如果……那么……”的形式。`;
  }

  if (activeStep === "3") {
    return `这是第3步“${stepTitle}”：固定一些变量，是为了让结果主要由你们研究的那个变量引起。摩擦力例子中若研究粗糙程度，就要尽量固定压力、接触面积和拉动方式。${strategy.focus} 在凸透镜实验中，如果研究物距影响，请说明要改变什么、固定什么、记录什么。`;
  }

  if (activeStep === "4") {
    return `这是第4步“${stepTitle}”：能在光屏上承接到的是实像，不能在光屏上承接、只能通过透镜观察到的是虚像。物体在焦点处时，折射后的光近似平行，不会在有限位置会聚成清晰像。${strategy.focus} 请在左侧实验记录一次物距、像距和像的虚实、大小、正倒。`;
  }

  if (activeStep === "5") {
    return `这是第5步“${stepTitle}”：结论和假设不一致，不等于实验失败，而是说明证据正在帮助你们修正认识。可能原因包括记录不完整、变量没有控制好、观察条件变化，或原假设本身需要调整。${strategy.focus} 请用一句话说明你们的假设和证据哪里一致、哪里不一致。`;
  }

  if (observation) {
    return `我先按你们报告的观察来分析：${observation}。请注意，我不能自动读取左侧 NOBOOK 实验状态，只能依据你们输入的数据和现象推理。${strategy.focus} 你们可以补充物距、像距、像的虚实、大小和正倒中的任意两项。`;
  }

  if (message.includes("实像") || message.includes("虚像")) {
    return `实像通常能呈现在光屏上，虚像通常不能呈现在光屏上。判断时先看能否在光屏上得到清晰像，再观察像和物在透镜的同侧还是异侧。${strategy.focus} 请你们在左侧实验里验证一次，并把结果发给我。`;
  }

  return `我会用科学探究的方式帮助你们，而不是直接替你们写结论。请先在左侧 NOBOOK 实验中完成一次操作，并告诉我你们看到的像是实像还是虚像、正立还是倒立。${strategy.focus} 你也可以点击上方五个步骤按钮开始。`;
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
      const externalReply = await callExternalAgent(payload);
      sendJson(res, 200, {
        content: limitReplySentences(externalReply || buildLocalAgentReply(payload)),
        source: externalReply ? "external" : "local"
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
