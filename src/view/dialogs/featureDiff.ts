/**
 * Compares copies of the same class feature that were found in more than one place, so the
 * duplicate-source picker can say what actually differs between them instead of making the
 * player read every description in full.
 */

import type { NimbleFeatureItem } from '#documents/item/feature.js';

/**
 * Fields worth comparing, in the order they should be reported. Each key is stable and is
 * localized by the caller (`NIMBLE.classFeatureSelection.diffField.<key>`) — this module
 * deliberately returns keys rather than prose so it stays free of localization concerns.
 *
 * `img` and the authoring-only bookkeeping fields (`group`, `class`, `gainedAtLevel*`) are
 * excluded: two copies of one feature always agree on where they slot into a class, and a
 * differing icon is not a reason to prefer one copy over another.
 */
const COMPARED_FIELDS: ReadonlyArray<{ key: string; path: string }> = [
	{ key: 'description', path: 'system.description' },
	{ key: 'actionCost', path: 'system.activation.cost' },
	{ key: 'duration', path: 'system.activation.duration' },
	{ key: 'targets', path: 'system.activation.targets' },
	{ key: 'template', path: 'system.activation.template' },
	{ key: 'effects', path: 'system.activation.effects' },
	{ key: 'rules', path: 'system.rules' },
	{ key: 'levelUpOptions', path: 'system.levelUpOptions' },
	{ key: 'choices', path: 'system.selectionCountByLevel' },
	{ key: 'macro', path: 'system.macro' },
];

/** Paths whose values are arrays of rule-like objects carrying a `type` discriminator. */
const RULE_BEARING_PATHS = ['system.activation.effects', 'system.rules'];

export interface FeatureComparison {
	/** True when every compared field matches — the copy is worth nothing to open. */
	isIdentical: boolean;
	/** Stable keys of the fields that differ, in {@link COMPARED_FIELDS} order. */
	changedFields: string[];
	/**
	 * `type` discriminators of the rules that were added, removed, or altered. Lets the caller
	 * say "healing" rather than the blunter "effects", when the rule types are recognisable.
	 */
	changedRuleTypes: string[];
}

function readPath(source: unknown, path: string): unknown {
	return path.split('.').reduce<unknown>((value, segment) => {
		if (value === null || typeof value !== 'object') return undefined;
		return (value as Record<string, unknown>)[segment];
	}, source);
}

/**
 * Deterministic serialization used for deep equality. Object keys are sorted so two copies
 * that differ only in property order still compare equal; array order is preserved, since
 * for rules and effects the order is meaningful.
 */
function stableStringify(value: unknown): string {
	if (value === null || value === undefined) return 'null';
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
	if (typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, v]) => v !== undefined)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
	}
	return JSON.stringify(value);
}

/** Collapses whitespace so descriptions differing only in formatting are treated as equal. */
function normalizeHtml(value: unknown): string {
	return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function valuesMatch(path: string, a: unknown, b: unknown): boolean {
	if (path === 'system.description') return normalizeHtml(a) === normalizeHtml(b);
	return stableStringify(a) === stableStringify(b);
}

/** Rule `type` values present on one side of a comparison but not the other, or altered. */
function collectChangedRuleTypes(baseline: unknown, candidate: unknown): string[] {
	const index = (value: unknown) => {
		const map = new Map<string, string[]>();
		if (!Array.isArray(value)) return map;
		for (const entry of value) {
			if (entry === null || typeof entry !== 'object') continue;
			const type = (entry as { type?: unknown }).type;
			if (typeof type !== 'string' || type === '') continue;
			const bucket = map.get(type) ?? [];
			bucket.push(stableStringify(entry));
			map.set(type, bucket);
		}
		return map;
	};

	const before = index(baseline);
	const after = index(candidate);
	const changed: string[] = [];

	for (const type of new Set([...before.keys(), ...after.keys()])) {
		const a = (before.get(type) ?? []).slice().sort();
		const b = (after.get(type) ?? []).slice().sort();
		if (a.join('|') !== b.join('|')) changed.push(type);
	}

	return changed.sort();
}

/**
 * Compares a candidate copy against a baseline copy of the same feature.
 *
 * The baseline is whichever copy the picker treats as the reference — normally the compendium
 * original, so a customized world copy reads as the thing that deviates.
 */
export function compareFeatures(
	baseline: NimbleFeatureItem,
	candidate: NimbleFeatureItem,
): FeatureComparison {
	const changedFields: string[] = [];
	const changedRuleTypes = new Set<string>();

	for (const { key, path } of COMPARED_FIELDS) {
		const a = readPath(baseline, path);
		const b = readPath(candidate, path);
		if (valuesMatch(path, a, b)) continue;

		changedFields.push(key);
		if (RULE_BEARING_PATHS.includes(path)) {
			for (const type of collectChangedRuleTypes(a, b)) changedRuleTypes.add(type);
		}
	}

	return {
		isIdentical: changedFields.length === 0,
		changedFields,
		changedRuleTypes: [...changedRuleTypes].sort(),
	};
}

export interface DescriptionSegment {
	text: string;
	/** True when this run of words is absent from, or altered relative to, the baseline. */
	changed: boolean;
}

const NAMED_ENTITIES: Record<string, string> = {
	nbsp: ' ',
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
};

/**
 * Decodes character references in one pass.
 *
 * Decoding entity by entity would decode its own output: `&amp;lt;` is the text "&lt;", but
 * resolving `&amp;` first turns it into `&lt;` for the next pass to resolve again.
 */
function decodeEntities(text: string): string {
	return text.replace(
		/&(#\d{1,7}|#[xX][\da-fA-F]{1,6}|[a-zA-Z]+);/g,
		(match, reference: string) => {
			if (reference.startsWith('#')) {
				const codePoint = Number.parseInt(
					reference.slice(reference[1] === 'x' || reference[1] === 'X' ? 2 : 1),
					reference[1] === 'x' || reference[1] === 'X' ? 16 : 10,
				);
				return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
			}

			return NAMED_ENTITIES[reference.toLowerCase()] ?? match;
		},
	);
}

/**
 * Reduces description markup to readable text.
 *
 * The diff highlights runs of *words*, and a word boundary is not a tag boundary — marking a
 * changed run inside raw HTML would split tags across the highlight and emit broken nesting.
 * Comparing plain text sidesteps that, and means the segments can be rendered as text rather
 * than trusted as markup, which matters when the copy came from a world item. Tags are stripped
 * before any character reference is decoded, so a decoded `<` can never be read back as markup.
 */
export function toPlainText(html: string): string {
	return decodeEntities(
		(html ?? '')
			.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
			.replace(/<br\s*\/?>|<\/(p|div|li|h[1-6])>/gi, ' ')
			.replace(/<[^>]*>/g, ''),
	)
		.replace(/\s+/g, ' ')
		.trim();
}

/** Splits into words while keeping the whitespace attached, so joining restores the original. */
function tokenize(text: string): string[] {
	return text.match(/\S+\s*/g) ?? [];
}

/**
 * Word-level diff of a candidate description against a baseline, for inline highlighting.
 *
 * Both sides are reduced to plain text first (see {@link toPlainText}). Returns the
 * *candidate's* words, each marked as unchanged or changed. Uses a longest-common-subsequence
 * table; descriptions are short enough that the quadratic cost is irrelevant, and bailing out
 * on very long text keeps a pathological item from stalling the dialog.
 */
export function diffDescription(baselineHtml: string, candidateHtml: string): DescriptionSegment[] {
	const before = tokenize(toPlainText(baselineHtml));
	const after = tokenize(toPlainText(candidateHtml));

	if (after.length === 0) return [];
	// Beyond this the table costs more than the highlight is worth; show it all as unchanged.
	if (before.length * after.length > 250_000) {
		return [{ text: after.join(''), changed: false }];
	}

	const norm = (t: string) => t.trim().toLowerCase();
	const lcs: number[][] = Array.from({ length: before.length + 1 }, () =>
		new Array<number>(after.length + 1).fill(0),
	);
	for (let i = before.length - 1; i >= 0; i--) {
		for (let j = after.length - 1; j >= 0; j--) {
			lcs[i][j] =
				norm(before[i]) === norm(after[j])
					? lcs[i + 1][j + 1] + 1
					: Math.max(lcs[i + 1][j], lcs[i][j + 1]);
		}
	}

	const segments: DescriptionSegment[] = [];
	const push = (text: string, changed: boolean) => {
		const last = segments[segments.length - 1];
		if (last && last.changed === changed) last.text += text;
		else segments.push({ text, changed });
	};

	let i = 0;
	let j = 0;
	while (j < after.length) {
		if (i < before.length && norm(before[i]) === norm(after[j])) {
			push(after[j], false);
			i++;
			j++;
		} else if (i < before.length && lcs[i + 1][j] >= lcs[i][j + 1]) {
			i++; // a baseline word was dropped; nothing to emit from the candidate
		} else {
			push(after[j], true);
			j++;
		}
	}

	return segments;
}
