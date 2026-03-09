# FoundryVTT Initialization & Login

## Login
- Join page: http://localhost:30000/join — world is "Midgard"
- Gamemaster user ID: `ZMf5oAvCQaqwHcKE` (select[name="userid"])
- The Gamemaster option is disabled if already connected elsewhere; force-enable via:
  ```js
  const opt = document.querySelector('select[name="userid"] option[value="ZMf5oAvCQaqwHcKE"]');
  opt.disabled = false;
  document.querySelector('select[name="userid"]').value = opt.value;
  ```
- Then click "Join Game Session" button.

## Initialization Wait
- After login, FoundryVTT loads asynchronously. Wait ~5 seconds with:
  ```js
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 5000)));
  ```
- Watch for `[LOG] Foundry VTT | Viewing Scene ...` in console — indicates canvas ready.
- Watch for `[LOG] Nimble | No migration needed` — indicates system fully ready.

## Known Pre-Existing State
- Active combat (Round 1) in Lodge scene with "New Character" and "Cultist" tokens.
- NCSW group attack panel is displayed by default when combat is active.
