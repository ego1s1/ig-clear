document.addEventListener("DOMContentLoaded", async () => {
  const browserAPI = typeof browser !== "undefined" ? browser : chrome;

  // DOM Elements
  const batchSizeInput = document.getElementById("batch-size");
  const cooldownEveryInput = document.getElementById("cooldown-every");
  const cooldownMsInput = document.getElementById("cooldown-ms");
  const minDelayInput = document.getElementById("min-delay");
  const maxDelayInput = document.getElementById("max-delay");

  const startBtn = document.getElementById("start-btn");
  const stopBtn = document.getElementById("stop-btn");
  const clearLogsBtn = document.getElementById("clear-logs-btn");

  const statusBadge = document.getElementById("status-badge");
  const statusText = document.getElementById("status-text");
  const logContainer = document.getElementById("log-container");

  // Default configuration values
  const DEFAULTS = {
    BATCH_SIZE: 5,
    COOLDOWN_EVERY: 10,
    COOLDOWN_MS: 120000,
    MIN_DELAY: 3000,
    MAX_DELAY: 8000
  };

  // Load saved config from storage
  async function loadConfig() {
    try {
      const saved = await browserAPI.storage.local.get("scriptConfig");
      const config = saved.scriptConfig || DEFAULTS;
      batchSizeInput.value = config.BATCH_SIZE ?? DEFAULTS.BATCH_SIZE;
      cooldownEveryInput.value = config.COOLDOWN_EVERY ?? DEFAULTS.COOLDOWN_EVERY;
      cooldownMsInput.value = config.COOLDOWN_MS ?? DEFAULTS.COOLDOWN_MS;
      minDelayInput.value = config.MIN_DELAY ?? DEFAULTS.MIN_DELAY;
      maxDelayInput.value = config.MAX_DELAY ?? DEFAULTS.MAX_DELAY;
    } catch (e) {
      console.error("Failed to load config from storage:", e);
    }
  }

  // Get current form values as config object
  function getConfig() {
    return {
      BATCH_SIZE: parseInt(batchSizeInput.value, 10) || DEFAULTS.BATCH_SIZE,
      COOLDOWN_EVERY: parseInt(cooldownEveryInput.value, 10) || DEFAULTS.COOLDOWN_EVERY,
      COOLDOWN_MS: parseInt(cooldownMsInput.value, 10) || DEFAULTS.COOLDOWN_MS,
      MIN_DELAY: parseInt(minDelayInput.value, 10) || DEFAULTS.MIN_DELAY,
      MAX_DELAY: parseInt(maxDelayInput.value, 10) || DEFAULTS.MAX_DELAY
    };
  }

  // Save config to storage on input change
  function setupConfigAutoSave() {
    const inputs = [batchSizeInput, cooldownEveryInput, cooldownMsInput, minDelayInput, maxDelayInput];
    inputs.forEach(input => {
      input.addEventListener("change", () => {
        const config = getConfig();
        browserAPI.storage.local.set({ scriptConfig: config });
      });
    });
  }

  // Update UI Status Badge & Button states
  function setRunningState(isRunning) {
    if (isRunning) {
      statusBadge.className = "badge running";
      statusText.textContent = "RUNNING";
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } else {
      statusBadge.className = "badge idle";
      statusText.textContent = "IDLE";
      startBtn.disabled = false;
      stopBtn.disabled = true;
    }
  }

  // Render logs
  function renderLogs(logs) {
    if (!logs || logs.length === 0) {
      logContainer.innerHTML = '<div class="empty-log">[system] Ready.</div>';
      return;
    }

    logContainer.innerHTML = "";
    logs.forEach(log => appendLogUI(log));
    scrollToBottom();
  }

  function appendLogUI(log) {
    const emptyMsg = logContainer.querySelector(".empty-log");
    if (emptyMsg) {
      emptyMsg.remove();
    }

    const div = document.createElement("div");
    div.className = "log-line";

    const timeSpan = document.createElement("span");
    timeSpan.className = "log-time";
    timeSpan.textContent = `[${log.timestamp}]`;

    const textSpan = document.createElement("span");
    textSpan.className = "log-text";

    const txt = log.text || "";
    if (txt.includes("Finished") || txt.includes("started") || txt.includes("Batch deleted")) {
      textSpan.classList.add("highlight");
    } else if (txt.includes("Error") || txt.includes("No Select") || txt.includes("No Delete")) {
      textSpan.classList.add("error");
    } else if (txt.includes("Waiting") || txt.includes("Cooldown") || txt.includes("retrying")) {
      textSpan.classList.add("warning");
    }

    textSpan.textContent = txt;

    div.appendChild(timeSpan);
    div.appendChild(textSpan);
    logContainer.appendChild(div);
  }

  function scrollToBottom() {
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  // Sync state from background on popup load
  async function syncState() {
    try {
      const response = await browserAPI.runtime.sendMessage({ type: "GET_STATE" });
      if (response) {
        setRunningState(response.isRunning);
        renderLogs(response.logs);
      }
    } catch (e) {
      console.error("Failed to sync state from background:", e);
    }
  }

  // Helper to send message to active tab, injecting content script if needed
  async function sendMessageToActiveTab(message) {
    const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error("No active tab found");
    }
    const tabId = tabs[0].id;

    try {
      return await browserAPI.tabs.sendMessage(tabId, message);
    } catch (err) {
      // Content script might not be injected yet into current tab. Inject and retry.
      await browserAPI.scripting.executeScript({
        target: { tabId: tabId },
        files: ["content.js"]
      });
      // Short delay after injection
      await new Promise(r => setTimeout(r, 200));
      return await browserAPI.tabs.sendMessage(tabId, message);
    }
  }

  // Button Listeners
  startBtn.addEventListener("click", async () => {
    const config = getConfig();
    await browserAPI.storage.local.set({ scriptConfig: config });

    setRunningState(true);

    try {
      await sendMessageToActiveTab({ type: "START", config: config });
    } catch (err) {
      console.error("Failed to start script on active tab:", err);
      setRunningState(false);
      appendLogUI({
        timestamp: new Date().toLocaleTimeString(),
        text: `Error: Connection failed. Refresh page and try again.`
      });
    }
  });

  stopBtn.addEventListener("click", async () => {
    stopBtn.disabled = true;
    try {
      await sendMessageToActiveTab({ type: "STOP" });
    } catch (err) {
      console.error("Failed to stop script on active tab:", err);
    }
  });

  clearLogsBtn.addEventListener("click", async () => {
    logContainer.innerHTML = '<div class="empty-log">[system] Ready.</div>';
    try {
      await browserAPI.runtime.sendMessage({ type: "CLEAR_LOGS" });
    } catch (e) {}
  });

  // Listen for real-time log updates and status changes from background
  browserAPI.runtime.onMessage.addListener((message) => {
    if (message.type === "NEW_LOG" && message.log) {
      appendLogUI(message.log);
      scrollToBottom();
    } else if (message.type === "STATUS_CHANGED") {
      setRunningState(message.isRunning);
    }
  });

  // Initialize popup
  await loadConfig();
  setupConfigAutoSave();
  await syncState();
});
