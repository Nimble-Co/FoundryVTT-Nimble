/**
 * Nimble custom Die modifier handlers.
 *
 * Foundry's bare `kh` / `kl` modifiers do not specify which die to drop on
 * ties at the keep cutoff. Nimble requires that the LEFTMOST tied die is
 * dropped (lowest-index loses ties). This module registers two custom Die
 * modifiers — `khn` (keep highest, Nimble) and `kln` (keep lowest, Nimble) —
 * that enforce this rule.
 *
 * Additionally, Nimble defines four die-level modifiers that express crit
 * capability and explosion style per-die:
 *   - `c`  — crit-capable, standard explosion (adds Foundry's `x` modifier)
 *   - `cv` — crit-capable, vicious explosion (manual post-roll)
 *   - `v`  — vicious explosion without crit capability (no effect, warning)
 *   - `n`  — neutral die (no crit, no miss detection)
 *
 * These modifiers attach metadata to the Die instance via a Symbol-keyed
 * property (`NIMBLE_MODS`), which DamageRoll reads during outcome finalization
 * to perform per-die crit/miss dispatch.
 *
 * Registration uses Foundry v13's `Die.MODIFIERS` static map plus a method
 * attached to `Die.prototype`. The handler signature matches Foundry's other
 * keep/drop handlers: `(modifier: string) => boolean | void`, called with
 * `this` bound to the Die instance. The handler mutates each entry of
 * `this.results[]`, setting `discarded` and `active` flags.
 *
 * The modifier syntax accepts an optional integer count:
 *   - `khn`    → keep 1 highest
 *   - `khn2`   → keep 2 highest
 *   - `kln`    → keep 1 lowest
 *   - `kln3`   → keep 3 lowest
 */

// ─── Die Modifier Metadata ──────────────────────────────────────────

/**
 * Symbol key for per-die Nimble metadata. Prevents collision with Foundry
 * properties on Die instances.
 */
export const NIMBLE_MODS = Symbol('nimbleMods');

/**
 * Per-die metadata attached by Nimble modifier handlers (c, cv, v, n).
 * Read by DamageRoll during outcome finalization to determine crit/miss
 * behavior for each die independently.
 */
export interface NimbleDieMetadata {
	canCrit: boolean;
	explosionStyle: 'none' | 'standard' | 'vicious';
}

/**
 * Read the Nimble modifier metadata from a Die instance.
 * Returns `undefined` if no Nimble modifier handler has run on this die.
 *
 * Accepts any object — the Symbol key lookup is safe on objects without it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getNimbleMods(die: any): NimbleDieMetadata | undefined {
	return die[NIMBLE_MODS] as NimbleDieMetadata | undefined;
}

// ─── Internal Types ─────────────────────────────────────────────────

type DieResult = {
	result: number;
	active?: boolean;
	discarded?: boolean;
	exploded?: boolean;
};

interface DieLike {
	results: DieResult[];
	modifiers?: string[];
}

function parseCount(modifier: string, prefix: 'khn' | 'kln'): number {
	const tail = modifier.slice(prefix.length);
	const n = parseInt(tail, 10);
	return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * Apply a stable-sort-based keep operation to the results array.
 *
 * `keepHighest=true` keeps the N highest values; `false` keeps the N lowest.
 * Ties at the cutoff are broken by ORIGINAL INDEX — leftmost (lowest index)
 * tied dice are dropped first. This is the Nimble rule.
 *
 * Implementation: build an `[index, result]` pair list, stably sort by value
 * (preserving original index order on equal values), then take the first N
 * for keeping. Because the sort is stable on equal values, equal-valued dice
 * are visited in original index order, so when we keep "the best N",
 * tied-best dice with the LOWEST indices end up earlier in the kept slice;
 * but we want the OPPOSITE (drop leftmost). To achieve drop-leftmost-on-tie,
 * we sort by value primary and by index DESCENDING as the tiebreaker, so
 * higher-index ties win the keep slot.
 */
function applyKeep(results: DieResult[], keepCount: number, keepHighest: boolean): void {
	if (!Array.isArray(results) || results.length === 0) return;
	const n = Math.max(0, Math.min(keepCount, results.length));

	const indexed = results.map((r, i) => ({ r, i }));
	indexed.sort((a, b) => {
		if (a.r.result !== b.r.result) {
			return keepHighest ? b.r.result - a.r.result : a.r.result - b.r.result;
		}
		// Tie: prefer higher index in the kept slice → leftmost gets dropped.
		return b.i - a.i;
	});

	const keepSet = new Set(indexed.slice(0, n).map((x) => x.i));
	for (let i = 0; i < results.length; i++) {
		const r = results[i];
		if (keepSet.has(i)) {
			r.active = true;
			r.discarded = false;
		} else {
			r.active = false;
			r.discarded = true;
		}
	}
}

/**
 * Foundry Die modifier handler: keep N highest with leftmost-on-tie discard.
 * Bound to a Die instance via `this`.
 */
export function khn(this: DieLike, modifier: string): boolean {
	const count = parseCount(modifier, 'khn');
	applyKeep(this.results, count, true);
	return true;
}

/**
 * Foundry Die modifier handler: keep N lowest with leftmost-on-tie discard.
 * Bound to a Die instance via `this`.
 */
export function kln(this: DieLike, modifier: string): boolean {
	const count = parseCount(modifier, 'kln');
	applyKeep(this.results, count, false);
	return true;
}

// ─── Nimble Die Modifier Handlers (c, cv, v, n) ────────────────────

/**
 * Foundry Die modifier handler: `c` — crit-capable with standard explosion.
 *
 * Attaches metadata `{ canCrit: true, explosionStyle: 'standard' }` and
 * ensures Foundry's native `x` modifier is present for explosion chaining.
 *
 * @example `1d8c` — primary die can crit with standard explosion.
 */
export function nimbleCrit(this: DieLike, _modifier: string): boolean {
	(this as unknown as Record<symbol, unknown>)[NIMBLE_MODS] = {
		canCrit: true,
		explosionStyle: 'standard',
	} satisfies NimbleDieMetadata;
	if (this.modifiers && !this.modifiers.includes('x')) {
		this.modifiers.push('x');
	}
	return true;
}

/**
 * Foundry Die modifier handler: `cv` — crit-capable with vicious explosion.
 *
 * Attaches metadata `{ canCrit: true, explosionStyle: 'vicious' }`. Does NOT
 * add Foundry's `x` modifier — vicious explosion is handled manually by
 * DamageRoll after evaluation to avoid Dice So Nice preempting the chain.
 *
 * @example `4d4cv` — Dravok crossbow, each d4 can crit independently.
 */
export function nimbleCritVicious(this: DieLike, _modifier: string): boolean {
	(this as unknown as Record<symbol, unknown>)[NIMBLE_MODS] = {
		canCrit: true,
		explosionStyle: 'vicious',
	} satisfies NimbleDieMetadata;
	return true;
}

let _vWarned = false;

/**
 * Foundry Die modifier handler: `v` — vicious explosion without crit.
 *
 * Attaches metadata `{ canCrit: false, explosionStyle: 'vicious' }`. This
 * modifier has no runtime effect without `c`; a one-time console warning is
 * emitted to aid debugging.
 *
 * @example `1d8v` — legal to parse, but no effect at evaluation time.
 */
export function nimbleVicious(this: DieLike, _modifier: string): boolean {
	(this as unknown as Record<symbol, unknown>)[NIMBLE_MODS] = {
		canCrit: false,
		explosionStyle: 'vicious',
	} satisfies NimbleDieMetadata;
	if (!_vWarned) {
		console.warn("Die modifier 'v' without 'c' has no effect");
		_vWarned = true;
	}
	return true;
}

/** Reset the `v` warning flag (for tests). */
export function _resetVWarned(): void {
	_vWarned = false;
}

/**
 * Foundry Die modifier handler: `n` — neutral die.
 *
 * Attaches metadata `{ canCrit: false, explosionStyle: 'none' }`. This die is
 * skipped for both crit and miss detection in DamageRoll's modifier-mode.
 *
 * @example `2d6n` — d66 roll, dice are neutral.
 */
export function nimbleNeutral(this: DieLike, _modifier: string): boolean {
	(this as unknown as Record<symbol, unknown>)[NIMBLE_MODS] = {
		canCrit: false,
		explosionStyle: 'none',
	} satisfies NimbleDieMetadata;
	return true;
}

// ─── Registration ───────────────────────────────────────────────────

/**
 * Register all Nimble custom Die modifiers on Foundry's Die class.
 *
 * Registered modifiers:
 *   - `khn` / `kln` — keep highest/lowest with leftmost-on-tie discard
 *   - `cv` — crit-capable, vicious explosion
 *   - `c`  — crit-capable, standard explosion
 *   - `v`  — vicious (standalone, no crit)
 *   - `n`  — neutral (skip crit/miss detection)
 *
 * **Ordering:** `cv` is registered BEFORE `c` so that Foundry's regex-based
 * modifier matcher matches the longer prefix first, preventing `cv` from
 * being split into `c` + `v`.
 *
 * Foundry v13 maps modifier-name keys to method-name strings on
 * `Die.MODIFIERS`. The actual handler function lives on `Die.prototype` under
 * that method name. We attach our handlers to the prototype and add the keys
 * so Foundry's regex-based modifier matcher recognises them.
 *
 * Safe to call multiple times; subsequent calls are no-ops.
 */
export function registerNimbleDieModifiers(): void {
	type DieConstructor = (new (
		...args: unknown[]
	) => unknown) & {
		MODIFIERS: Record<string, string>;
		prototype: Record<string, unknown>;
	};
	const Die = foundry?.dice?.terms?.Die as unknown as DieConstructor | undefined;
	if (!Die) return;

	if (!Die.MODIFIERS) {
		(Die as { MODIFIERS: Record<string, string> }).MODIFIERS = {} as Record<string, string>;
	}

	// Keep modifiers
	if (!('khn' in Die.MODIFIERS)) {
		Die.MODIFIERS.khn = 'keepNimbleHighest';
	}
	if (!('kln' in Die.MODIFIERS)) {
		Die.MODIFIERS.kln = 'keepNimbleLowest';
	}

	// Nimble die-level modifiers — cv before c for greedy prefix matching
	if (!('cv' in Die.MODIFIERS)) {
		Die.MODIFIERS.cv = 'nimbleCritVicious';
	}
	if (!('c' in Die.MODIFIERS)) {
		Die.MODIFIERS.c = 'nimbleCrit';
	}
	if (!('v' in Die.MODIFIERS)) {
		Die.MODIFIERS.v = 'nimbleVicious';
	}
	if (!('n' in Die.MODIFIERS)) {
		Die.MODIFIERS.n = 'nimbleNeutral';
	}

	// Prototype method attachment — keep modifiers
	if (typeof Die.prototype.keepNimbleHighest !== 'function') {
		Die.prototype.keepNimbleHighest = khn;
	}
	if (typeof Die.prototype.keepNimbleLowest !== 'function') {
		Die.prototype.keepNimbleLowest = kln;
	}

	// Prototype method attachment — die-level modifiers
	if (typeof Die.prototype.nimbleCritVicious !== 'function') {
		Die.prototype.nimbleCritVicious = nimbleCritVicious;
	}
	if (typeof Die.prototype.nimbleCrit !== 'function') {
		Die.prototype.nimbleCrit = nimbleCrit;
	}
	if (typeof Die.prototype.nimbleVicious !== 'function') {
		Die.prototype.nimbleVicious = nimbleVicious;
	}
	if (typeof Die.prototype.nimbleNeutral !== 'function') {
		Die.prototype.nimbleNeutral = nimbleNeutral;
	}
}
