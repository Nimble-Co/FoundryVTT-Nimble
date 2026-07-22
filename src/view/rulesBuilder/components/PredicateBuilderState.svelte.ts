import { untrack } from 'svelte';
import localize from '#utils/localize.js';
import { Predicate, type RawPredicate } from '../../../etc/Predicate.js';

import {
	emptyRow,
	type Operator,
	type RowState,
	rowsFromValue,
	rowsToValue,
} from './predicateBuilderRows.js';
import { getCompendiumKeys } from './predicateKeyCache.svelte.js';

export function operatorLabel(op: Operator): string {
	return localize(`NIMBLE.rulesBuilder.predicateOperators.${op}`);
}

export function operatorHint(op: Operator): string {
	return localize(`NIMBLE.rulesBuilder.predicateOperatorHints.${op}`);
}

export function createPredicateBuilderState(
	getValue: () => RawPredicate,
	getOnChange: () => (next: RawPredicate) => void,
	getPreviewDomain: () => Set<string> | undefined,
	getAppliesEarly: () => boolean | undefined = () => false,
) {
	let rows = $state<RowState[]>(untrack(() => rowsFromValue(getValue())));
	let lastSerializedValue = $state('');

	function setupSyncEffect(): void {
		$effect(() => {
			const value = getValue();
			const next = JSON.stringify(value ?? {});
			if (next !== lastSerializedValue) {
				rows = rowsFromValue(value);
				lastSerializedValue = next;
			}
		});
	}

	function emit() {
		const next = rowsToValue(rows);
		lastSerializedValue = JSON.stringify(next);
		getOnChange()(next);
	}

	function addRow() {
		rows = [...rows, emptyRow()];
	}

	function deleteRow(index: number) {
		rows = rows.filter((_, i) => i !== index);
		emit();
	}

	function updateRow(index: number, patch: Partial<RowState>) {
		rows = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
	}

	function updateOperator(index: number, operator: Operator) {
		updateRow(index, { operator });
		emit();
	}

	function updateArrayValue(rowIndex: number, arrayIndex: number, value: string) {
		const row = rows[rowIndex];
		const nextArray = row.valueArray.map((v, i) => (i === arrayIndex ? value : v));
		updateRow(rowIndex, { valueArray: nextArray });
	}

	function addArrayValue(rowIndex: number) {
		const row = rows[rowIndex];
		updateRow(rowIndex, { valueArray: [...row.valueArray, ''] });
	}

	function removeArrayValue(rowIndex: number, arrayIndex: number) {
		const row = rows[rowIndex];
		updateRow(rowIndex, { valueArray: row.valueArray.filter((_, i) => i !== arrayIndex) });
		emit();
	}

	const suggestionKeys = $derived.by(() => {
		const keys = new Set<string>(getCompendiumKeys());
		const collect = (tags: Set<string> | undefined) => {
			if (!tags) return;
			for (const entry of tags) {
				const k = entry.split(':', 1)[0];
				if (k) keys.add(k);
			}
		};

		const worldActors = game.actors as Iterable<{ tags?: Set<string> }> | undefined;
		if (worldActors) for (const a of worldActors) collect(a.tags);
		collect(getPreviewDomain());

		return [...keys].sort();
	});

	// Unique `<datalist>` id so multiple builders on the same page don't collide.
	const datalistId = `nimble-predicate-keys-${Math.random().toString(36).slice(2)}`;

	// Late tags never match for rules applying in prePrepareData — surface the
	// authoring mistake instead of a false "matches" preview.
	const lateKeyWarning = $derived.by(() => {
		if (!getAppliesEarly()) return null;

		const lateKeys = (CONFIG.NIMBLE as { LATE_PREDICATE_KEYS?: readonly string[] })
			.LATE_PREDICATE_KEYS;
		if (!lateKeys?.length) return null;

		const referenced = Predicate.extractReferencedKeys(rowsToValue(rows));
		const hits = lateKeys.filter((key) => referenced.has(key));
		return hits.length ? hits : null;
	});

	const preview = $derived.by(() => {
		const previewDomain = getPreviewDomain();
		if (!previewDomain) return null;
		const raw = rowsToValue(rows);
		try {
			const predicate = new Predicate(raw);
			if (!predicate.size)
				return { matches: true, reason: localize('NIMBLE.rulesBuilder.predicatePreviewAlways') };
			if (!predicate.isValid)
				return {
					matches: false,
					reason: localize('NIMBLE.rulesBuilder.predicatePreviewIncomplete'),
				};
			return { matches: predicate.test(previewDomain), reason: null as string | null };
		} catch (err) {
			return {
				matches: false,
				reason:
					err instanceof Error
						? err.message
						: localize('NIMBLE.rulesBuilder.predicatePreviewError'),
			};
		}
	});

	return {
		get rows() {
			return rows;
		},
		get suggestionKeys() {
			return suggestionKeys;
		},
		get preview() {
			return preview;
		},
		get lateKeyWarning() {
			return lateKeyWarning;
		},
		datalistId,
		setupSyncEffect,
		emit,
		addRow,
		deleteRow,
		updateRow,
		updateOperator,
		updateArrayValue,
		addArrayValue,
		removeArrayValue,
	};
}

// Re-export so the .svelte consumer only needs a single import for state +
// shared types in template-side code.
export type { Operator, RowState } from './predicateBuilderRows.js';
export { OPERATORS } from './predicateBuilderRows.js';
