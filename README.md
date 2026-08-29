# Batch Comment Remover — Firefox Extension

A lightweight, secure Firefox WebExtension (Manifest V3) built with a flat TokyoNight terminal aesthetic.

## Features
- **Configurable Parameters**: Set `BATCH_SIZE`, `COOLDOWN_EVERY`, `COOLDOWN_MS`, `MIN_DELAY`, and `MAX_DELAY`.
- **Least Privilege Architecture**: Uses `activeTab` permission on demand; no persistent host permissions.
- **Terminal UI**: Flat, dark-mode TokyoNight aesthetic with live execution logs.
- **Auto-Save**: Form inputs persist via `browser.storage.local`.

## Local Installation (Development)
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `manifest.json` in this directory.

## Build for Production / Firefox Add-on Store
To create a `.zip` submission package for Mozilla Add-on Developer Hub:
```bash
zip -r batch-comment-remover.zip manifest.json popup.html popup.css popup.js background.js content.js icons/
```
