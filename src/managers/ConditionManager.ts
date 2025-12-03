import type { NimbleBaseActor } from '../documents/actor/base.svelte.js';
import localize from '../utils/localize.js';

export interface Condition {
	_id?: string;
	id: string;
	name: string;
	img: string;
	aliases?: Set<string> | undefined;
	statuses?: string[] | undefined;
	stackable: boolean;
	enriched: string;
}

export class ConditionManager {
	#conditions: Map<string, Condition>;

	#ready: boolean;

	constructor() {
		this.#conditions = new Map();
		this.#ready = false;
	}

	initialize() {
		const conditions = Object.keys(CONFIG.NIMBLE.conditions);

		conditions.forEach(async (c) => {
			let _id: string | null = null;

			const id = c;
			const name = CONFIG.NIMBLE.conditions[id];
			const img = CONFIG.NIMBLE.conditionDefaultImages[id];
			const aliases: string[] = CONFIG.NIMBLE.conditionAliasedConditions[id] ?? [];
			const statuses: string[] = CONFIG.NIMBLE.conditionLinkedConditions[id] ?? [];
			const stackable = CONFIG.NIMBLE.conditionStackableConditions.has(id);

			const data = {
				id,
				name,
				img,
				stackable,
			} as Condition;

			if (aliases.length) data.aliases = new Set(aliases);

			if (statuses.length) {
				data.statuses = statuses;

				_id = String(id).padEnd(16, '0');
				data._id = _id;
			}

			// Add an enriched version of the condition to the data
			data.enriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
				`[[/condition condition=${id}]]`,
			);

			this.#conditions.set(id, data);
		});

		this.#ready = true;
	}

	configureStatusEffects() {
		if (!this.#ready) throw Error('Conditions are not ready yet.');

		const statusEffects = [...this.#conditions.values()];

		CONFIG.statusEffects = statusEffects.sort((a, b) => {
			const aid = a.name !== undefined ? localize(a.name) : a.id || a;
			const bid = b.name !== undefined ? localize(b.name) : b.id || b;

			// eslint-disable-next-line no-nested-ternary
			return aid > bid ? 1 : aid < bid ? -1 : 0;
		});
	}

	get(conditionId: string) {
		return this.#conditions.get(conditionId);
	}

	getMetadata(actor: NimbleBaseActor) {
		const { effects } = actor;

		const activeConditions = new Set<string>();
		const overlayConditions = new Set<string>();

		effects.forEach((effect) => {
			effect.statuses.forEach((statusId) => {
				const status = this.#conditions.get(statusId);
				if (!status) return;

				if (status._id) {
					if (status._id !== effect.id) return;
				} else if (effect.statuses.size !== 1) return;

				activeConditions.add(statusId);

				if (
					(effect as { getFlag: (scope: string, key: string) => boolean | undefined }).getFlag(
						'core',
						'overlay',
					)
				)
					overlayConditions.add(statusId);
			});
		});

		return {
			active: activeConditions,
			overlay: overlayConditions,
		};
	}

	getTagGroupData() {
		return [...this.#conditions.values()].map((condition) => {
			return { label: condition.name, value: condition.id };
		});
	}
}
