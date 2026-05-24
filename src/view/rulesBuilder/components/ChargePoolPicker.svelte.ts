import { createSubscriber } from 'svelte/reactivity';
import { getPools } from '#utils/chargePool/chargePoolSync.js';
import type { ChargePoolState } from '#utils/chargePool/types.js';

const POOL_HOOK_NAMES = [
	'nimble.chargePool.changed',
	'nimble.chargePool.recovered',
	'updateItem',
	'updateActor',
] as const;

function registerPoolHooks(listener: () => void): () => void {
	const hooksApi = Hooks as unknown as {
		on: (hook: string, listener: () => void) => number;
		off: (hook: string, id: number) => void;
	};

	const hookIds = POOL_HOOK_NAMES.map((hookName) => ({
		hookName,
		hookId: hooksApi.on(hookName, listener),
	}));

	return () => {
		for (const { hookName, hookId } of hookIds) {
			hooksApi.off(hookName, hookId);
		}
	};
}

export type ChargePoolOption = { identifier: string; label: string };

function resolveActor(document: unknown): Actor | null {
	if (!document || typeof document !== 'object') return null;
	const maybeActor = document as { documentName?: string; parent?: unknown };
	if (maybeActor.documentName === 'Actor') return document as Actor;
	if (maybeActor.documentName === 'Item') {
		const parent = (document as { parent?: unknown }).parent;
		if (parent && typeof parent === 'object') {
			const parentDoc = parent as { documentName?: string };
			if (parentDoc.documentName === 'Actor') return parent as Actor;
		}
		return null;
	}
	if (maybeActor.parent && typeof maybeActor.parent === 'object') {
		const parent = maybeActor.parent as { documentName?: string };
		if (parent.documentName === 'Actor') return maybeActor.parent as Actor;
	}
	return null;
}

function dedupeAndSort(pools: ChargePoolState[]): ChargePoolOption[] {
	const seen = new Set<string>();
	const options: ChargePoolOption[] = [];
	for (const pool of pools) {
		if (seen.has(pool.identifier)) continue;
		seen.add(pool.identifier);
		options.push({ identifier: pool.identifier, label: pool.label });
	}
	options.sort((a, b) => a.label.localeCompare(b.label));
	return options;
}

export function createChargePoolPickerState(getDocument: () => unknown) {
	const subscribePoolState = createSubscriber(registerPoolHooks);

	const options = $derived.by((): ChargePoolOption[] => {
		subscribePoolState();
		const actor = resolveActor(getDocument());
		if (!actor) return [];
		return dedupeAndSort(getPools(actor));
	});

	return {
		get options() {
			return options;
		},
	};
}
