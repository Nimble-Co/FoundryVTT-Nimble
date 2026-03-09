---
name: nimble-playwright-patterns
description: "Invoke when writing or reviewing Playwright tests. Loads best practices, FoundryVTT-specific timing patterns, the standard reporting format template, and project test conventions."
---

## Playwright Best Practices

- Always `await` interactions: `page.click()`, `page.fill()`, `page.waitForSelector()`, etc.
- Use `expect(page).toHaveURL(...)` and `expect(locator).toBeVisible()` assertions.
- Add `page.waitForLoadState('networkidle')` after navigation when FoundryVTT is initializing.
- Capture a screenshot on test failure: `await page.screenshot({ path: 'failure.png' })`.
- For FoundryVTT specifically: wait for the `#loading` overlay to disappear before interacting with the canvas or sheets (see `scripts/wait-for-foundry.js`).
- Use `page.evaluate()` to call FoundryVTT client-side APIs directly when setting up test state (e.g., opening an actor sheet programmatically).
- Prefer `data-testid` selectors; fall back to semantic selectors (role, label, text). Avoid brittle CSS selectors (see `references/foundry-selectors.md` for known reliable selectors).
- Run with `--headed` when debugging visually; `--headless` for CI-style runs.

## Reporting Format

For each test run, report:
```
## Test Run Summary
- Target: [local | remote URL]
- Tests run: N
- Passed: N
- Failed: N

### Failures
#### [Test Name]
- Steps to reproduce: ...
- Expected: ...
- Actual: ...
- Console errors: ...
- Screenshot: [path if captured]

### Recommendations
...
```

## Project Test Conventions

- The system is TypeScript + Svelte 5 + Vite. Sheets are `ApplicationV2` subclasses rendered via Svelte components in `src/view/sheets/`.
- UI localization uses `localize()` — button labels in tests should use localized strings or `data-testid` attributes.
- Import aliases: `#view/*`, `#documents/*`, `#utils/*` etc.
- Run `pnpm check` if you need to verify the build is clean before testing.
- Use `page.on('console', ...)` and `page.on('pageerror', ...)` listeners to capture browser console errors and uncaught exceptions — always report these.
