(function () {
  const browserAPI = typeof browser !== "undefined" ? browser : chrome;

  if (window.__BATCH_DELETE_INJECTED) {
    return;
  }
  window.__BATCH_DELETE_INJECTED = true;

  let isExecuting = false;
  let shouldStop = false;

  function log(msg) {
    console.log("[Batch Script]", msg);
    try {
      browserAPI.runtime.sendMessage({
        type: "LOG",
        message: msg,
        timestamp: new Date().toLocaleTimeString()
      }).catch(() => {});
    } catch (e) {
      // Ignore if receiver disconnected
    }
  }

  function notifyStatus(running) {
    isExecuting = running;
    try {
      browserAPI.runtime.sendMessage({
        type: "STATUS_UPDATE",
        isRunning: isExecuting
      }).catch(() => {});
    } catch (e) {}
  }

  // Interruptible sleep helper
  const sleep = async (ms) => {
    const step = 100;
    let elapsed = 0;
    while (elapsed < ms) {
      if (shouldStop) break;
      const chunk = Math.min(step, ms - elapsed);
      await new Promise(r => setTimeout(r, chunk));
      elapsed += chunk;
    }
  };

  browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "START") {
      if (isExecuting) {
        log("Script is already running.");
        sendResponse({ status: "already_running" });
        return true;
      }
      shouldStop = false;
      runScript(request.config);
      sendResponse({ status: "started" });
      return true;
    } else if (request.type === "STOP") {
      if (isExecuting) {
        shouldStop = true;
        log("Stop signal received. Interrupting execution...");
        sendResponse({ status: "stopping" });
      } else {
        sendResponse({ status: "not_running" });
      }
      return true;
    } else if (request.type === "GET_STATUS") {
      sendResponse({ isRunning: isExecuting });
      return true;
    }
  });

  async function runScript(config) {
    // Parameters passed from extension popup
    const BATCH_SIZE = Number(config.BATCH_SIZE) || 5;
    const COOLDOWN_EVERY = Number(config.COOLDOWN_EVERY) || 10;
    const COOLDOWN_MS = Number(config.COOLDOWN_MS) || 120000;
    const MIN_DELAY = Number(config.MIN_DELAY) || 3000;
    const MAX_DELAY = Number(config.MAX_DELAY) || 8000;

    const jitter = () => MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);

    const click = async (el) => {
      if (!el || shouldStop) return false;
      el.scrollIntoView({ block: "center" });
      await sleep(120);
      if (shouldStop) return false;
      el.click();
      return true;
    };

    const getButtons = () =>
      [...document.querySelectorAll("button, div[role='button'], span")]
        .filter(el => !!el.offsetParent);

    const findText = (text) =>
      getButtons().find(el => (el.innerText || el.textContent || "").trim() === text);

    const waitForText = async (text, seconds = 20) => {
      for (let i = 0; i < seconds * 2; i++) {
        if (shouldStop) return null;
        const el = findText(text);
        if (el) return el;
        await sleep(500);
      }
      return null;
    };

    const dismissErrorPopup = async () => {
      const okBtn = findText("OK");
      if (okBtn) {
        log("Error popup detected — dismissing.");
        await click(okBtn);
        await sleep(2000);
        return true;
      }
      return false;
    };

    notifyStatus(true);
    log(`Script started with params: BATCH_SIZE=${BATCH_SIZE}, COOLDOWN_EVERY=${COOLDOWN_EVERY}, COOLDOWN_MS=${COOLDOWN_MS}ms, DELAY=${MIN_DELAY}-${MAX_DELAY}ms`);

    let batchCount = 0;

    try {
      for (let round = 1; round <= 999; round++) {
        if (shouldStop) {
          log("Script execution stopped by user.");
          break;
        }

        log(`Round ${round}`);

        // Auto-dismiss error popup if present
        await dismissErrorPopup();
        if (shouldStop) break;

        // Find Select button
        const selectBtn = await waitForText("Select", 25);
        if (!selectBtn) {
          log("No Select button found — stopping.");
          break;
        }

        await click(selectBtn);
        await sleep(1000);
        if (shouldStop) break;

        // Wait for checkboxes to render
        let boxes = [...document.querySelectorAll('[aria-label="Toggle checkbox"]')];
        for (let i = 0; i < 15 && !boxes.length; i++) {
          if (shouldStop) break;
          log(`Waiting for checkbox render (${i + 1}/15)...`);
          await sleep(1000);
          boxes = [...document.querySelectorAll('[aria-label="Toggle checkbox"]')];
        }

        if (shouldStop) break;

        // Retry logic if still no checkboxes
        if (!boxes.length) {
          log("No checkboxes found — retrying Select.");
          const selectBtnRetry = await waitForText("Select", 25);
          if (selectBtnRetry) {
            await click(selectBtnRetry);
            await sleep(1000);
            if (shouldStop) break;

            boxes = [...document.querySelectorAll('[aria-label="Toggle checkbox"]')];
            for (let i = 0; i < 15 && !boxes.length; i++) {
              if (shouldStop) break;
              log(`Retry render wait (${i + 1}/15)...`);
              await sleep(1000);
              boxes = [...document.querySelectorAll('[aria-label="Toggle checkbox"]')];
            }

            if (boxes.length) {
              log("Recovered selection mode — resuming.");
            }
          }

          if (!boxes.length) {
            log("No Select button found — stopping.");
            break;
          }
        }

        if (shouldStop) break;

        // Select checkboxes
        const amount = Math.min(BATCH_SIZE, boxes.length);
        log(`Selecting ${amount} comments`);

        for (let i = 0; i < amount; i++) {
          if (shouldStop) break;
          await click(boxes[i]);
          await sleep(80);
        }

        if (shouldStop) break;

        await sleep(800);
        if (shouldStop) break;

        // Delete button
        let deletes = getButtons().filter(el =>
          (el.innerText || el.textContent || "").trim() === "Delete"
        );

        if (!deletes.length) {
          log("No Delete button found — stopping.");
          break;
        }

        await click(deletes[deletes.length - 1]);
        log("Clicked Delete");

        await sleep(2500);
        if (shouldStop) break;

        // Confirm Delete
        deletes = getButtons().filter(el =>
          (el.innerText || el.textContent || "").trim() === "Delete"
        );

        if (!deletes.length) {
          log("No confirm Delete button — stopping.");
          break;
        }

        await click(deletes[deletes.length - 1]);
        log("Batch deleted");

        batchCount++;

        if (shouldStop) break;

        // Cooldown cycle
        if (batchCount % COOLDOWN_EVERY === 0) {
          log(`Cooldown triggered — waiting ${COOLDOWN_MS / 1000} seconds`);
          await sleep(COOLDOWN_MS);
        } else {
          const delay = jitter();
          log(`Random delay: ${Math.round(delay)}ms`);
          await sleep(delay);
        }
      }
    } catch (err) {
      log(`Error encountered: ${err.message}`);
    } finally {
      notifyStatus(false);
      log("Finished");
    }
  }
})();
