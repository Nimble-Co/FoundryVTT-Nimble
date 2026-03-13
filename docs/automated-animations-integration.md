# Automated Animations Integration

## Overview

`public/module-compat/automated-animations-nimble.json` is a custom autorec (automation record) database for the [Automated Animations](https://github.com/otigon/automated-jb2a-animations) (AA) module. It maps Nimble item and spell names to specific [JB2A](https://github.com/Jules-Bens-Aa/JB2A_DnD5e) animation keys, which AA resolves into [Sequencer](https://github.com/fantasycalendar/FoundryVTT-Sequencer) playback when a player uses that item in combat.

---

## How to Install / Import

1. In FoundryVTT, open **Game Settings → Module Settings → Automated Animations**.
2. Click **Custom Automations**.
3. Click **Import** and select `public/module-compat/automated-animations-nimble.json` (or download it from the running server at `/systems/nimble/module-compat/automated-animations-nimble.json`).
4. Confirm the import. All Nimble item entries will appear in the autorec list.

> **Note:** Importing does not overwrite entries with different names. Re-importing the same file is safe.

---

## Data Flow

```
Player uses an item (attack, spell, etc.)
  └─ FoundryVTT fires createChatMessage (or midi-qol workflow hooks)
       └─ AA's handleItem() queries the autorec database for a match on item name
            └─ Matched entry's primary.video fields (dbSection / menuType / animation / variant / color)
                 └─ AA's buildFile() resolves these to a Sequencer DB path
                      e.g. "autoanimations.melee.weapon.shortsword.01.white"
                 └─ Sequencer plays the animation at the token's location
                      └─ (Optional) secondary explosion, source/target token FX,
                         sound override, and macro also fire if configured
```

---

## JSON Schema Reference

Each entry in the JSON array represents one autorec rule. Top-level fields:

| Field | Type | Purpose | Example |
|---|---|---|---|
| `label` | string | Item name AA matches against (substring, after lowercasing + stripping spaces) | `"Shortsword"` |
| `menu` | string | Autorec category AA uses to group the entry | `"melee"`, `"range"`, `"ontoken"` |
| `metaData` | object | Ownership/provenance metadata — **not** used for matching | `{}` |
| `primary` | object | Main animation played on use | see sub-fields below |
| `secondary` | object | Impact / explosion FX (optional) | same video sub-fields |
| `source` | object | FX attached to the source token (optional) | on-attack glow, etc. |
| `target` | object | FX attached to the target token (optional) | on-hit glow, etc. |
| `soundOnly` | object | Audio-only variant (optional) | — |
| `macro` | object | Macro to fire alongside the animation (optional) | see sub-fields below |

### `primary.video` (and `secondary.video`) sub-fields

| Field | Type | Purpose | Example |
|---|---|---|---|
| `dbSection` | string | JB2A top-level DB key | `"melee"`, `"range"`, `"static"` |
| `menuType` | string | JB2A category | `"weapon"`, `"spell"` |
| `animation` | string | Specific animation name | `"shortsword"`, `"firebolt"` |
| `variant` | string | Style variant | `"01"`, `"regular"`, `"physical"` |
| `color` | string | Color or element | `"white"`, `"orange"`, `"random"` |

These four fields build the Sequencer path: `autoanimations.<dbSection>.<menuType>.<animation>.<variant>.<color>`.

### `macro` sub-fields

All entries in this file have `"macro": { "enable": false }`. The additional fields below are only required when `enable` is `true`.

| Field | Type | Purpose | Example |
|---|---|---|---|
| `enable` | boolean | Whether to run the macro | `true` |
| `name` | string | Name of the macro in Foundry's macro directory (required when enabled) | `"Apply Burning"` |
| `args` | string | Arguments passed to the macro | `""` |
| `playWhen` | string | When to fire: `"0"` = always, `"1"` = on hit | `"0"` |

---

## How Item Names Are Matched

- AA matches on the entry's **`label`** field, not `metaData.name`. `metaData` is used for ownership/provenance metadata only and is not part of the matching logic.
- AA normalizes both the item name and the label before comparing: it strips spaces and lowercases both strings (`rinseName()`), then checks whether the normalized item name **contains** the normalized label as a substring. For example, label `"Shortsword"` matches item name `"Shortsword Attack"`.
- Use `advanced: { "exactMatch": true }` on an entry to require a full string match instead of substring.
- Priority order when multiple sources could trigger: **ammo flags → item flags → autorec entry → no animation**.
- If no autorec entry matches, AA silently skips the animation (no error).

---

## Adding a New Entry

1. **Find the JB2A animation key** — see [Finding Valid JB2A Keys](#finding-valid-jb2a-keys) below.
2. **Open the JSON file** at `public/module-compat/automated-animations-nimble.json`.
3. **Copy an existing entry** that uses the same `menu` category as your new item (e.g., copy a melee entry for a new melee weapon).
4. **Edit the copy**:
   - Set `label` to the item name (or a distinctive substring of it) as it appears in Foundry (e.g., `"Handaxe"`).
   - Set `primary.video.dbSection`, `menuType`, `animation`, `variant`, and `color` to the values you found in step 1.
   - Clear or adjust `secondary`, `source`, `target` if the new item doesn't need those effects.
5. **Save the file** and re-import it into AA following the steps in [How to Install / Import](#how-to-install--import).
6. **Test** by having a character use the item in a scene — the animation should fire.

### Example: adding "Handaxe"

```json
{
  "id": "<uuid>",
  "label": "Hand Axe",
  "menu": "melee",
  "metaData": {},
  "primary": {
    "video": {
      "dbSection": "melee",
      "menuType": "weapon",
      "animation": "handaxe",
      "variant": "standard",
      "color": "white",
      "enableCustom": false,
      "customPath": ""
    },
    "sound": { "enable": false, "delay": 0, "startTime": 0, "volume": 0.75 },
    "options": {
      "contrast": 0, "delay": 0, "elevation": 1000, "isWait": false,
      "opacity": 1, "repeat": 1, "repeatDelay": 500, "saturate": 0,
      "size": 1, "tint": false, "tintColor": "#FFFFFF", "zIndex": 1
    }
  },
  "secondary": { "enable": false },
  "source": { "enable": false },
  "target": { "enable": false },
  "macro": { "enable": false },
  "soundOnly": { "sound": { "enable": false } }
}
```

---

## Finding Valid JB2A Keys

1. In FoundryVTT, open **Game Settings → Module Settings → Automated Animations**.
2. Click **Animation Configurator** (or open any item sheet and click the AA wand icon).
3. Browse the JB2A asset tree. The four-level path you see maps directly to:

   ```
   DB Section → Menu Type → Animation → Variant → Color
   ```

4. Note down all four values — these become `dbSection`, `menuType`, `animation`, `variant`, and `color` in your JSON entry.

> **Tip:** AA's built-in browser only shows animations available in your installed JB2A version. If a path exists in the JSON but isn't installed, Sequencer will fail silently.
