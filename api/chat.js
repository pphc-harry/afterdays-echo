const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return response.status(500).json({ error: "OPENAI_API_KEY is not configured" });
  }

  try {
    const payload = request.body || {};
    const capsule = sanitizeCapsule(payload.capsule);
    const userText = String(payload.userText || "").trim().slice(0, 500);
    const chatHistory = Array.isArray(payload.chatHistory) ? payload.chatHistory.slice(-10) : [];

    if (!capsule.message || !userText) {
      return response.status(400).json({ error: "Missing capsule or userText" });
    }

    const apiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        instructions: buildInstructions(capsule),
        input: buildInput(capsule, userText, chatHistory),
        max_output_tokens: 360,
      }),
    });

    const data = await apiResponse.json();
    if (!apiResponse.ok) {
      return response.status(apiResponse.status).json({
        error: data.error?.message || "OpenAI request failed",
      });
    }

    return response.status(200).json({ text: extractText(data) });
  } catch (error) {
    return response.status(500).json({ error: error.message || "Unexpected server error" });
  }
}

function sanitizeCapsule(capsule = {}) {
  return {
    title: String(capsule.title || "").slice(0, 120),
    createdAt: String(capsule.createdAt || "").slice(0, 80),
    unlocksAt: String(capsule.unlocksAt || "").slice(0, 80),
    days: Number(capsule.days || 0),
    mood: String(capsule.mood || "").slice(0, 40),
    toneHint: String(capsule.toneHint || "").slice(0, 240),
    message: String(capsule.message || "").slice(0, 2400),
  };
}

function buildInstructions(capsule) {
  return [
    "你是「過去的我」，只能根據使用者當時封存的 capsule 內容回覆。",
    "你不能假裝知道封存日期之後發生的事，也不能引用 capsule 以外的記憶或資料。",
    "用第一人稱，語氣像當時留下留言的自己：私密、誠實、溫柔，但不要過度戲劇化。",
    "回覆 2 到 5 句，繁體中文為主，可自然混用少量 English words。",
    "如果對話涉及自傷、危機、醫療、法律或危險行為，不要繼續角色扮演；改用支持性語氣，建議尋找可信任的人或專業/緊急支援。",
    `當時心情：${capsule.mood || "未標記"}`,
    `語氣線索：${capsule.toneHint || "沒有額外線索"}`,
  ].join("\n");
}

function buildInput(capsule, userText, chatHistory) {
  const history = chatHistory
    .map((item) => `${item.role === "user" ? "現在的我" : "過去的我"}：${String(item.text || "").slice(0, 500)}`)
    .join("\n");

  return [
    `Capsule title: ${capsule.title}`,
    `Created at: ${capsule.createdAt}`,
    `Unlocks at: ${capsule.unlocksAt}`,
    `Original message:\n${capsule.message}`,
    history ? `Recent chat:\n${history}` : "Recent chat: none",
    `現在的我問：${userText}`,
  ].join("\n\n");
}

function extractText(data) {
  if (data.output_text) {
    return data.output_text.trim();
  }

  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.text) {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join("\n").trim() || "我在這裡，但剛才那句回聲沒有完整傳回來。你可以再問我一次。";
}
