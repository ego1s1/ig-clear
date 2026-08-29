;(async function () {

  // ============================
  // CONFIGURATION
  // ============================
  const BATCH_SIZE = 5;                // comments per batch
  const COOLDOWN_EVERY = 10;           // batches before cooldown
  const COOLDOWN_MS = 120000;          // 2 minutes
  const MIN_DELAY = 3000;              // min random delay
  const MAX_DELAY = 8000;              // max random delay

  // ============================
  // HELPERS
  // ============================
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const jitter = () => MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);

  const click = async el => {
    if (!el) return false;
    el.scrollIntoView({ block: "center" });
    await sleep(120);
    el.click();
    return true;
  };

  const getButtons = () =>
    [...document.querySelectorAll("button, div[role='button'], span")]
      .filter(el => !!el.offsetParent);

  const findText = text =>
    getButtons().find(el => (el.innerText || el.textContent || "").trim() === text);

  const waitForText = async (text, seconds = 20) => {
    for (let i = 0; i < seconds * 2; i++) {
      const el = findText(text);
      if (el) return el;
      await sleep(500);
    }
    return null;
  };

  const dismissErrorPopup = async () => {
    const okBtn = findText("OK");
    if (okBtn) {
      console.log("Error popup detected — dismissing.");
      await click(okBtn);
      await sleep(2000);
      return true;
    }
    return false;
  };

  // ============================
  // MAIN LOOP
  // ============================
  let batchCount = 0;

  for (let round = 1; round <= 999; round++) {
    console.log("Round", round);

    // Auto-dismiss error popup if present
    await dismissErrorPopup();

    // Find Select button
    const selectBtn = await waitForText("Select", 25);
    if (!selectBtn) {
      console.log("No Select button found — stopping.");
      break;
    }

    await click(selectBtn);
    await sleep(1000);

    // ============================
    // DELAY PATCH: Wait for checkboxes to render
    // ============================
    let boxes = [...document.querySelectorAll('[aria-label="Toggle checkbox"]')];
    for (let i = 0; i < 15 && !boxes.length; i++) {
      console.log(`Waiting for checkbox render (${i + 1}/15)...`);
      await sleep(1000);
      boxes = [...document.querySelectorAll('[aria-label="Toggle checkbox"]')];
    }

    // ============================
    // RETRY LOGIC IF STILL NO CHECKBOXES
    // ============================
    if (!boxes.length) {
      console.log("No checkboxes found — retrying Select.");
      const selectBtnRetry = await waitForText("Select", 25);
      if (selectBtnRetry) {
        await click(selectBtnRetry);
        await sleep(1000);

        // Wait again after retry
        boxes = [...document.querySelectorAll('[aria-label="Toggle checkbox"]')];
        for (let i = 0; i < 15 && !boxes.length; i++) {
          console.log(`Retry render wait (${i + 1}/15)...`);
          await sleep(1000);
          boxes = [...document.querySelectorAll('[aria-label="Toggle checkbox"]')];
        }

        if (boxes.length) {
          console.log("Recovered selection mode — resuming.");
          // IMPORTANT: Do NOT continue — fall through and use boxes
        }
      }

      if (!boxes.length) {
        console.log("No Select button found — stopping.");
        break;
      }
    }

    // ============================
    // SELECT CHECKBOXES
    // ============================
    const amount = Math.min(BATCH_SIZE, boxes.length);
    console.log("Selecting", amount, "comments");

    for (let i = 0; i < amount; i++) {
      await click(boxes[i]);
      await sleep(80);
    }

    await sleep(800);

    // Delete button
    let deletes = getButtons().filter(el =>
      (el.innerText || el.textContent || "").trim() === "Delete"
    );

    if (!deletes.length) {
      console.log("No Delete button found — stopping.");
      break;
    }

    await click(deletes[deletes.length - 1]);
    console.log("Clicked Delete");

    await sleep(2500);

    // Confirm Delete
    deletes = getButtons().filter(el =>
      (el.innerText || el.textContent || "").trim() === "Delete"
    );

    if (!deletes.length) {
      console.log("No confirm Delete button — stopping.");
      break;
    }

    await click(deletes[deletes.length - 1]);
    console.log("Batch deleted");

    batchCount++;

    // Cooldown cycle
    if (batchCount % COOLDOWN_EVERY === 0) {
      console.log(`Cooldown triggered — waiting ${COOLDOWN_MS / 1000} seconds`);
      await sleep(COOLDOWN_MS);
    } else {
      const delay = jitter();
      console.log(`Random delay: ${Math.round(delay)}ms`);
      await sleep(delay);
    }
  }

  console.log("Finished");

})();

