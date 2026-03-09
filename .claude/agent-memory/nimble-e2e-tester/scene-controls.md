# Scene Controls — NCSW Toggle

## DOM Selectors
- Crosshairs toggle button: `[data-tool="nimble-ncsw-toggle"]`
- Eye/panel-toggle button (removed): `[data-tool="nimble-ncsw-panel-toggle"]` — should NOT exist
- NCSW panel element: `.nimble-minion-group-attack-panel`

## Button States
- Active (panel visible): `aria-pressed="true"`, title = "Hide NCSW"
- Inactive (panel hidden): `aria-pressed="false"`, title = "Hide NCSW"
- Icon class: `fa-solid fa-crosshairs`

## Panel State Check
```js
const panel = document.querySelector('.nimble-minion-group-attack-panel');
window.getComputedStyle(panel).display // "flex" = visible, "none" = hidden
panel.hidden // true/false
```

## Visibility Rules
- Toggle only appears when GM is logged in AND NCSW combat is active:
  `game.user?.isGM && (combat.active || combat.started)`
- Close button inside panel only appears when `!isNcswCombatStateEnabled()` (outside active NCSW combat)

## Token Controls Tool Order (v13 Lodge scene)
1. Select Tokens
2. Select Targets
3. Measure Distance
4. Unconstrained Movement
5. Hide NCSW (nimble-ncsw-toggle) ← inserted after Unconstrained Movement
6. Dice Tray
7. Disable Bloodsplat Tokens
8. Nimble Selector

## Known Deprecation Warning (not a Nimble bug)
- `SceneControlTool#onClick is deprecated in favor of SceneControlTool#onChange` — fires on
  crosshairs click. This is a FoundryVTT v13 API change; the Nimble hook uses `onClick` for
  backward compat. Remove from signal-to-noise when evaluating errors.
