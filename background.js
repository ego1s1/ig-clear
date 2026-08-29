// Background script for state and log management
const browserAPI = typeof browser !== "undefined" ? browser : chrome;

const logs = [];
let isScriptRunning = false;

browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "LOG") {
    const logEntry = {
      timestamp: message.timestamp || new Date().toLocaleTimeString(),
      text: message.message
    };
    logs.push(logEntry);

    // Keep up to 200 logs
    if (logs.length > 200) {
      logs.shift();
    }

    // Notify active popup UI if open
    browserAPI.runtime.sendMessage({
      type: "NEW_LOG",
      log: logEntry
    }).catch(() => {
      // Popup might be closed, which is fine
    });
  } else if (message.type === "STATUS_UPDATE") {
    isScriptRunning = message.isRunning;
    browserAPI.runtime.sendMessage({
      type: "STATUS_CHANGED",
      isRunning: isScriptRunning
    }).catch(() => {});
  } else if (message.type === "GET_STATE") {
    sendResponse({
      logs: logs,
      isRunning: isScriptRunning
    });
    return true;
  } else if (message.type === "CLEAR_LOGS") {
    logs.length = 0;
    sendResponse({ success: true });
    return true;
  }
});
