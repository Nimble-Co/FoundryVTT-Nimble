# Known Reliable Playwright Selectors for Nimble UI

## FoundryVTT Loading

| Element | Selector | Notes |
|---------|----------|-------|
| Loading overlay | `#loading` | Wait for `state: 'hidden'` before interacting |
| Sidebar | `#sidebar` | Available after loading completes |
| Canvas | `#board` | Available after scene load |

## Character Sheet

| Element | Selector | Notes |
|---------|----------|-------|
| Sheet window | `.app.actor-sheet` | Top-level sheet container |
| Sheet tabs (nav) | `.tabs .item[data-tab]` | Use `data-tab` attribute to target specific tab |
| Active tab content | `.tab.active` | Currently visible tab pane |

## Dialogs

| Element | Selector | Notes |
|---------|----------|-------|
| Confirmation dialog | `.dialog` | Generic FoundryVTT dialog |
| Confirm button | `.dialog-button.yes, .dialog-button.ok` | Varies by dialog type |
| Cancel button | `.dialog-button.no, .dialog-button.cancel` | Varies by dialog type |

## Roll Chat Cards

| Element | Selector | Notes |
|---------|----------|-------|
| Chat log | `#chat-log` | Container for all chat messages |
| Latest message | `#chat-log .chat-message:last-child` | Most recent roll result |
| Roll total | `.dice-total` | Final roll number |

## Nimble-Specific

| Element | Selector | Notes |
|---------|----------|-------|
| Boon list | `[data-testid="boon-list"]` | Prefer data-testid when available |
| Attack button | `[data-testid="atk-button"]` | Prefer data-testid when available |

> **Note:** Update this file as you discover new reliable selectors. Prefer `data-testid` attributes; document when CSS selectors are the only option and why they are stable.
