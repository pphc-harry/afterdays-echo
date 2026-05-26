const STORAGE_KEY = "afterdays-echo-capsules-v1";
const DAY_MS = 24 * 60 * 60 * 1000;

const state = {
  capsules: loadCapsules(),
  selectedId: null,
  selectedDays: 30,
  detailOpen: false,
};

const views = {
  today: document.querySelector("#todayView"),
  create: document.querySelector("#createView"),
  timeline: document.querySelector("#timelineView"),
};

const tabs = document.querySelectorAll(".tab");
const capsuleList = document.querySelector("#capsuleList");
const capsuleCount = document.querySelector("#capsuleCount");
const timelineList = document.querySelector("#timelineList");
const emptyDetail = document.querySelector("#emptyDetail");
const detailCard = document.querySelector("#detailCard");
const detailStatus = document.querySelector("#detailStatus");
const sealedState = document.querySelector("#sealedState");
const unlockState = document.querySelector("#unlockState");
const sealedTitle = document.querySelector("#sealedTitle");
const sealedDates = document.querySelector("#sealedDates");
const sealedCountdown = document.querySelector("#sealedCountdown");
const unlockTitle = document.querySelector("#unlockTitle");
const unlockMeta = document.querySelector("#unlockMeta");
const unlockMessage = document.querySelector("#unlockMessage");
const sourceAgeLabel = document.querySelector("#sourceAgeLabel");
const attachmentBadges = document.querySelector("#attachmentBadges");
const chatMessages = document.querySelector("#chatMessages");
const chatForm = document.querySelector("#chatForm");
const chatInput = document.querySelector("#chatInput");
const replyInput = document.querySelector("#replyInput");
const saveReplyButton = document.querySelector("#saveReplyButton");
const deleteCapsuleButton = document.querySelector("#deleteCapsuleButton");
const capsuleForm = document.querySelector("#capsuleForm");
const selectedDaysLabel = document.querySelector("#selectedDaysLabel");
const dayChips = document.querySelectorAll(".day-chip");
const customDaysInput = document.querySelector("#customDaysInput");
const titleInput = document.querySelector("#titleInput");
const moodInput = document.querySelector("#moodInput");
const messageInput = document.querySelector("#messageInput");
const messageMeta = document.querySelector("#messageMeta");
const promptInput = document.querySelector("#promptInput");
const resetDemoButton = document.querySelector("#resetDemoButton");
const toast = document.querySelector("#toast");

if (!state.capsules.length) {
  state.capsules = createDemoCapsules();
  saveCapsules();
}

state.selectedId = getDefaultSelection();
bindEvents();
registerServiceWorker();
render();

function bindEvents() {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view));
  });

  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => {
      state.detailOpen = false;
      switchView(button.dataset.viewTarget);
      render();
    });
  });

  dayChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      state.selectedDays = Number(chip.dataset.days);
      customDaysInput.value = "";
      updateDayChips();
    });
  });

  customDaysInput.addEventListener("input", () => {
    const value = Number(customDaysInput.value);
    if (value > 0) {
      state.selectedDays = Math.min(value, 3650);
      updateDayChips();
    }
  });

  messageInput.addEventListener("input", () => {
    messageMeta.textContent = `${messageInput.value.length} / 1200`;
  });

  document.querySelectorAll("[data-attachment]").forEach((button) => {
    button.addEventListener("click", () => {
      button.classList.toggle("selected");
      const label = button.dataset.attachment === "voice" ? "語音備忘" : "此刻照片";
      button.textContent = button.classList.contains("selected") ? `✓ ${label}` : `＋ ${label}`;
    });
  });

  capsuleForm.addEventListener("submit", (event) => {
    event.preventDefault();
    createCapsule();
  });

  chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    sendChatMessage();
  });

  saveReplyButton.addEventListener("click", saveReply);
  deleteCapsuleButton.addEventListener("click", deleteSelectedCapsule);

  resetDemoButton.addEventListener("click", () => {
    state.capsules = createDemoCapsules();
    state.selectedId = getDefaultSelection();
    saveCapsules();
    render();
    showToast("示範資料已重置");
  });
}

function switchView(viewName) {
  Object.entries(views).forEach(([name, view]) => {
    view.classList.toggle("active", name === viewName);
  });

  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.view === viewName);
  });
}

function createCapsule() {
  const title = titleInput.value.trim();
  const message = messageInput.value.trim();
  const days = Math.max(1, Math.min(Number(state.selectedDays) || 30, 3650));

  if (!title || !message) {
    showToast("標題和留言都要留下來");
    return;
  }

  const now = new Date();
  const unlocksAt = new Date(now.getTime() + days * DAY_MS);
  const attachments = [...document.querySelectorAll("[data-attachment].selected")].map((button) => button.dataset.attachment);

  const capsule = {
    id: createId(),
    title,
    days,
    createdAt: now.toISOString(),
    unlocksAt: unlocksAt.toISOString(),
    mood: moodInput.value,
    message,
    toneHint: promptInput.value.trim(),
    attachments,
    chat: [],
    reply: "",
  };

  state.capsules.unshift(capsule);
  state.selectedId = capsule.id;
  saveCapsules();
  capsuleForm.reset();
  resetAttachmentButtons();
  state.selectedDays = 30;
  updateDayChips();
  messageMeta.textContent = "0 / 1200";
  render();
  switchView("today");
  showToast(`${days} days 後的你會收到這段回聲`);
}

function render() {
  updateDayChips();
  renderCapsuleList();
  renderTimeline();
  renderDetail();
}

function renderCapsuleList() {
  const sorted = [...state.capsules].sort((a, b) => new Date(a.unlocksAt) - new Date(b.unlocksAt));
  capsuleCount.textContent = String(sorted.length);

  if (!sorted.length) {
    capsuleList.innerHTML = `<div class="empty-list">還沒有膠囊。先封存一句今天的聲音。</div>`;
    return;
  }

  capsuleList.innerHTML = sorted.map((capsule) => {
    const unlocked = isUnlocked(capsule);
    const daysLeft = getDaysLeft(capsule);
    const selected = capsule.id === state.selectedId ? "selected" : "";
    const status = unlocked ? "已到期" : `${daysLeft} days left`;
    const dateCopy = `${formatDate(capsule.createdAt)} → ${formatDate(capsule.unlocksAt)}`;

    return `
      <button class="capsule-card ${selected}" type="button" data-id="${capsule.id}">
        <span class="pulse-dot ${unlocked ? "ready" : ""}"></span>
        <span class="capsule-main">
          <strong>${escapeHtml(capsule.title)}</strong>
          <small>${dateCopy}</small>
        </span>
        <span class="capsule-status">${status}</span>
      </button>
    `;
  }).join("");

  capsuleList.querySelectorAll(".capsule-card").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedId = card.dataset.id;
      state.detailOpen = true;
      render();
    });
  });
}

function renderTimeline() {
  const sorted = [...state.capsules].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!sorted.length) {
    timelineList.innerHTML = `<div class="empty-list">時間線還是空的。</div>`;
    return;
  }

  timelineList.innerHTML = sorted.map((capsule) => {
    const unlocked = isUnlocked(capsule);
    const reply = capsule.reply ? escapeHtml(capsule.reply) : "現在的我還未回應。";
    const chatCount = capsule.chat.filter((item) => item.role === "past").length;

    return `
      <article class="timeline-item">
        <span class="timeline-line"></span>
        <div>
          <p class="timeline-date">${formatDate(capsule.createdAt)}</p>
          <h3>${escapeHtml(capsule.title)}</h3>
          <p>${unlocked ? `已解鎖，和過去的我對話 ${chatCount} 次。` : `封存中，${getDaysLeft(capsule)} days 後解鎖。`}</p>
          <blockquote>${unlocked ? reply : "正文仍在封存。"}</blockquote>
        </div>
      </article>
    `;
  }).join("");
}

function renderDetail() {
  const capsule = getSelectedCapsule();
  document.body.classList.toggle("detail-open", Boolean(capsule && state.detailOpen));
  emptyDetail.classList.toggle("hidden", Boolean(capsule));
  detailCard.classList.toggle("hidden", !capsule);

  if (!capsule) {
    return;
  }

  const unlocked = isUnlocked(capsule);
  detailStatus.textContent = unlocked ? "Unlocked" : "Sealed";
  detailStatus.classList.toggle("ready", unlocked);
  sealedState.classList.toggle("hidden", unlocked);
  unlockState.classList.toggle("hidden", !unlocked);

  if (unlocked) {
    renderUnlockedDetail(capsule);
  } else {
    renderSealedDetail(capsule);
  }
}

function renderSealedDetail(capsule) {
  sealedTitle.textContent = capsule.title;
  sealedDates.textContent = `${formatDate(capsule.createdAt)} 封存 · ${formatDate(capsule.unlocksAt)} 解鎖`;
  sealedCountdown.textContent = String(getDaysLeft(capsule));
}

function renderUnlockedDetail(capsule) {
  unlockTitle.textContent = capsule.title;
  unlockMeta.textContent = `${formatDate(capsule.createdAt)} 的你 · 心情：${capsule.mood}`;
  unlockMessage.textContent = capsule.message;
  sourceAgeLabel.textContent = String(getSourceAge(capsule));
  replyInput.value = capsule.reply || "";

  attachmentBadges.innerHTML = capsule.attachments.length
    ? capsule.attachments.map((item) => `<span>${item === "voice" ? "語音備忘" : "此刻照片"}</span>`).join("")
    : `<span>無附件</span>`;

  const chat = capsule.chat.length ? capsule.chat : [{
    role: "past",
    text: createPastMeReply(capsule, "打開這段留言的人，是現在的我。"),
  }];

  if (!capsule.chat.length) {
    capsule.chat = chat;
    saveCapsules();
  }

  chatMessages.innerHTML = chat.map((message) => `
    <div class="chat-message ${message.role}">
      <span>${message.role === "past" ? "過去的我" : "現在的我"}</span>
      <p>${escapeHtml(message.text)}</p>
    </div>
  `).join("");
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChatMessage() {
  const capsule = getSelectedCapsule();
  const text = chatInput.value.trim();

  if (!capsule || !isUnlocked(capsule) || !text) {
    return;
  }

  if (capsule.chat.filter((item) => item.role === "user").length >= 5) {
    showToast("這個膠囊的對話已完成，讓回聲停在這裡");
    return;
  }

  capsule.chat.push({ role: "user", text });
  chatInput.value = "";
  chatInput.disabled = true;
  capsule.chat.push({ role: "past", text: "我正在從那一天的文字裡找回自己的語氣..." });
  saveCapsules();
  render();

  const pendingIndex = capsule.chat.length - 1;

  try {
    capsule.chat[pendingIndex].text = await requestPastMeReply(capsule, text);
  } catch {
    capsule.chat[pendingIndex].text = createPastMeReply(capsule, text);
    showToast("AI backend 未連線，暫用本地回聲");
  } finally {
    chatInput.disabled = false;
    saveCapsules();
    render();
    chatInput.focus();
  }
}

async function requestPastMeReply(capsule, userText) {
  const response = await fetch("./api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      capsule: {
        title: capsule.title,
        createdAt: capsule.createdAt,
        unlocksAt: capsule.unlocksAt,
        days: capsule.days,
        mood: capsule.mood,
        toneHint: capsule.toneHint,
        message: capsule.message,
      },
      userText,
      chatHistory: capsule.chat.filter((item) => item.text && !item.text.includes("正在從那一天")),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.text) {
    throw new Error(data.error || "AI request failed");
  }

  return data.text;
}

function createPastMeReply(capsule, userText) {
  const crisisPattern = /自殺|不想活|傷害自己|suicide|kill myself|self harm|醫療|法律|犯法/i;
  if (crisisPattern.test(`${capsule.message} ${userText}`)) {
    return "我不能把這件事只當成角色扮演。請先找身邊可信任的人、當地緊急服務，或專業支援一起面對。這比任何回聲都重要。";
  }

  const fragments = capsule.message
    .split(/[。！？!?，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const anchor = fragments[0] || "我記得那天的自己其實很想被好好聽見";
  const hint = capsule.toneHint ? `我當時給自己的語氣線索是：「${capsule.toneHint}」。` : "我只能根據那天留下的文字回答你。";
  const questionEcho = userText.endsWith("？") || userText.endsWith("?") ? "你問的這句，我那時可能也沒有答案。" : "看到你這樣說，我會先停一下。";

  return `${questionEcho} ${hint} 如果只從那天的我出發，我最想留下的是：「${anchor}」。我不知道後來發生了什麼，但我希望你讀到這裡時，能比那天更靠近自己一點。`;
}

function saveReply() {
  const capsule = getSelectedCapsule();
  if (!capsule || !isUnlocked(capsule)) {
    return;
  }

  capsule.reply = replyInput.value.trim();
  saveCapsules();
  renderTimeline();
  showToast("現在的回應已保存");
}

function deleteSelectedCapsule() {
  const capsule = getSelectedCapsule();
  if (!capsule) {
    return;
  }

  const confirmed = window.confirm("刪除後，原留言、對話和回應都會消失。確定刪除？");
  if (!confirmed) {
    return;
  }

  state.capsules = state.capsules.filter((item) => item.id !== capsule.id);
  state.selectedId = getDefaultSelection();
  saveCapsules();
  render();
  showToast("膠囊已刪除");
}

function updateDayChips() {
  selectedDaysLabel.textContent = String(state.selectedDays);
  dayChips.forEach((chip) => {
    chip.classList.toggle("active", Number(chip.dataset.days) === Number(state.selectedDays) && !customDaysInput.value);
  });
}

function resetAttachmentButtons() {
  document.querySelectorAll("[data-attachment]").forEach((button) => {
    button.classList.remove("selected");
    button.textContent = button.dataset.attachment === "voice" ? "＋ 語音備忘" : "＋ 此刻照片";
  });
}

function isUnlocked(capsule) {
  return new Date(capsule.unlocksAt).getTime() <= Date.now();
}

function getDaysLeft(capsule) {
  const diff = new Date(capsule.unlocksAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / DAY_MS));
}

function getSourceAge(capsule) {
  const diff = Date.now() - new Date(capsule.createdAt).getTime();
  return Math.max(1, Math.floor(diff / DAY_MS));
}

function getSelectedCapsule() {
  return state.capsules.find((capsule) => capsule.id === state.selectedId) || null;
}

function getDefaultSelection() {
  const unlocked = state.capsules.find((capsule) => isUnlocked(capsule));
  return unlocked?.id || state.capsules[0]?.id || null;
}

function saveCapsules() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.capsules));
}

function loadCapsules() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function createDemoCapsules() {
  const now = Date.now();
  return [
    {
      id: "demo-unlocked",
      title: "如果那時的焦慮還在",
      days: 30,
      createdAt: new Date(now - 33 * DAY_MS).toISOString(),
      unlocksAt: new Date(now - 3 * DAY_MS).toISOString(),
      mood: "混亂",
      message: "今天我一直在想，會不會其實我不是不夠努力，只是太久沒有真正休息。30 days 後的我，如果你看到這裡，請告訴我，我們有沒有對自己好一點。",
      toneHint: "像凌晨三點的我，誠實，但溫柔。",
      attachments: ["voice"],
      chat: [],
      reply: "",
    },
    {
      id: "demo-sealed",
      title: "給下一個安靜的週日",
      days: 7,
      createdAt: new Date(now).toISOString(),
      unlocksAt: new Date(now + 7 * DAY_MS).toISOString(),
      mood: "期待",
      message: "這段內容在到期前不應該被看見。",
      toneHint: "",
      attachments: ["photo"],
      chat: [],
      reply: "",
    },
  ];
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `capsule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-Hant", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2400);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      showToast("離線模式暫時未啟用");
    });
  });
}
