/**
 * Nimble custom Die modifier handlers.
 *
 * Foundry's bare `kh` / `kl` modifiers do not specify which die to drop on
 * ties at the keep cutoff. Nimble requires that the LEFTMOST tied die is
 * dropped (lowest-index loses ties). This module registers two custom Die
 * modifiers — `khn` (keep highest, Nimble) and `kln` (keep lowest, Nimble) —
 * that enforce this rule.
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

type DieResult = {
	result: number;
	active?: boolean;
	discarded?: boolean;
	exploded?: boolean;
};

interface DieLike {
	results: DieResult[];
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

/**
 * Register `khn` and `kln` as custom Die modifiers on Foundry's Die class.
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
	const Die = foundry?.dice?.terms?.Die as DieConstructor | undefined;
	if (!Die) return;

	if (!Die.MODIFIERS) {
		(Die as { MODIFIERS: Record<string, string> }).MODIFIERS = {} as Record<string, string>;
	}

	if (!('khn' in Die.MODIFIERS)) {
		Die.MODIFIERS.khn = 'keepNimbleHighest';
	}
	if (!('kln' in Die.MODIFIERS)) {
		Die.MODIFIERS.kln = 'keepNimbleLowest';
	}

	if (typeof Die.prototype.keepNimbleHighest !== 'function') {
		Die.prototype.keepNimbleHighest = khn;
	}
	if (typeof Die.prototype.keepNimbleLowest !== 'function') {
		Die.prototype.keepNimbleLowest = kln;
	}
}
