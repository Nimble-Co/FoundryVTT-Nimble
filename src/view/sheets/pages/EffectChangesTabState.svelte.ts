import type { NimbleActiveEffect } from '#documents/activeEffect/activeEffect.js';
import type { EffectChange } from '#types/components/EffectSheet.d.ts';
import localize from '#utils/localize.js';

export const CHANGES_WORDS = 'NIMBLE.effectSheet.changes';

interface ChangeTypeConfig {
	label: string;
	defaultPriority?: number;
}

export function shownValue(value: unknown): string {
	if (value === null || value === undefined) return '';
	return typeof value === 'string' ? value : JSON.stringify(value);
}

/** As core's window: a value that reads as JSON is stored as that value. */
export function parsedValue(text: string): unknown {
	if (!text) return text;
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

export function createEffectChangesTabState(getEffect: () => NimbleActiveEffect) {
	const changes = $derived(
		(getEffect().reactive.system as unknown as { changes?: EffectChange[] }).changes ?? [],
	);

	const changeTypes = $derived.by(() => {
		const types = (
			CONFIG.ActiveEffect.documentClass as unknown as {
				CHANGE_TYPES?: Record<string, ChangeTypeConfig>;
			}
		).CHANGE_TYPES;
		return Object.entries(types ?? {})
			.map(([type, { label, defaultPriority }]) => ({
				type,
				label: localize(label),
				defaultPriority,
			}))
			.sort((a, b) => a.label.localeCompare(b.label));
	});

	function save(next: EffectChange[]) {
		return getEffect().update({ 'system.changes': next } as never);
	}

	function change(index: number, patch: Partial<EffectChange>) {
		return save(changes.map((each, at) => (at === index ? { ...each, ...patch } : each)));
	}

	function add() {
		return save([
			...changes,
			{ key: '', type: 'add', value: '', phase: 'initial', priority: null },
		]);
	}

	function remove(index: number) {
		return save(changes.filter((_, at) => at !== index));
	}

	function priorityHint(type: string): string {
		return changeTypes.find((each) => each.type === type)?.defaultPriority?.toString() ?? '';
	}

	return {
		get changes() {
			return changes;
		},
		get changeTypes() {
			return changeTypes;
		},
		change,
		add,
		remove,
		priorityHint,
	};
}
