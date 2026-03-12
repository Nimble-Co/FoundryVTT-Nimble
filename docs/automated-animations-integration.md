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
| `menu` | string | Autorec category AA uses to group the entry | `"melee"`, `"range"`, `"ontoken"` |
| `metaData.name` | string | Item name AA matches against (case-insensitive) | `"Shortsword"` |
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

| Field | Type | Purpose | Example |
|---|---|---|---|
| `enable` | boolean | Whether to run the macro | `true` |
| `name` | string | Name of the macro in Foundry's macro directory | `"Apply Burning"` |
| `args` | string | Arguments passed to the macro | `""` |
| `playWhen` | string | When to fire: `"0"` = always, `"1"` = on hit | `"0"` |

---

## How Item Names Are Matched

- AA normalizes item names before comparing: it strips leading/trailing whitespace and compares case-insensitively.
- `metaData.name` must exactly match the item's name in Foundry (after normalization).
- Priority order when multiple sources could trigger: **ammo flags → item flags → autorec entry → no animation**.
- If no autorec entry matches, AA silently skips the animation (no error).

---

## Adding a New Entry

1. **Find the JB2A animation key** — see [Finding Valid JB2A Keys](#finding-valid-jb2a-keys) below.
2. **Open the JSON file** at `public/module-compat/automated-animations-nimble.json`.
3. **Copy an existing entry** that uses the same `menu` category as your new item (e.g., copy a melee entry for a new melee weapon).
4. **Edit the copy**:
   - Set `metaData.name` to the exact item name as it appears in Foundry (e.g., `"Handaxe"`).
   - Set `primary.video.dbSection`, `menuType`, `animation`, `variant`, and `color` to the values you found in step 1.
   - Clear or adjust `secondary`, `source`, `target` if the new item doesn't need those effects.
5. **Save the file** and re-import it into AA following the steps in [How to Install / Import](#how-to-install--import).
6. **Test** by having a character use the item in a scene — the animation should fire.

### Example: adding "Handaxe"

```json
{
  "menu": "melee",
  "metaData": { "name": "Handaxe" },
  "primary": {
    "video": {
      "dbSection": "melee",
      "menuType": "weapon",
      "animation": "handaxe",
      "variant": "01",
      "color": "white"
    }
  }
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
