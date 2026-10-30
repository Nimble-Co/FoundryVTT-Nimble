import { untrack } from 'svelte';
import type { NimbleCharacter } from '#documents/actor/character.js';
import { routeItemDrop } from '#documents/actor/routeItemDrop.js';
import type { SvelteApplicationRenderContext } from '#lib/SvelteApplicationMixin.svelte.js';
import {
	getInitiativeCombatManaRules,
	primeActorCombatManaSourceRules,
} from '#utils/actor/combatManaRules.js';
import type { MissingLevelSelection } from '#utils/classProgression/findMissingLevelSelections.ts';
import { ActorSheetApplication } from '../shared/ActorSheetApplication.svelte.ts';
import HeroSheetComponent from './HeroSheet.svelte';
import { createHeroSource } from './heroAdapter.ts';
import { dropAction, tabOfItemType } from './heroDrop.ts';
import type { HeroPerform } from './heroIntent.ts';
import { createHeroPerform } from './heroPerform.ts';
import { rawDescriptionOf } from './heroRows.ts';
import type { HeroSource } from './heroSource.ts';

/** What the level choice audit depends on: the class, its level, and the feature sources. */
function levelAuditKey(actor: NimbleCharacter): string {
	const items = [...actor.reactive.items] as unknown as {
		type: string;
		identifier?: string;
		system: { classLevel?: number };
		_stats?: { compendiumSource?: string | null };
	}[];
	const characterClass = items.find((item) => item.type === 'class');
	if (!characterClass) return '';
	const sources = items
		.filter((item) => item.type === 'feature')
		.map((item) => item._stats?.compendiumSource ?? '')
		.sort()
		.join(',');
	return `${characterClass.identifier}:${characterClass.system.classLevel}:${sources}`;
}

/** The new character sheet. It is a second choice in the sheet selector until the switch. */
export default class HeroSheet extends ActorSheetApplication<
	NimbleCharacter,
	HeroSource,
	HeroPerform
> {
	#missingLevelSelections: number[] = $state([]);

	#combatManaPrimed = $state(0);

	constructor(
		actor: { document: NimbleCharacter },
		options = {} as SvelteApplicationRenderContext,
	) {
		super(actor, options, HeroSheetComponent, 'core');
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-actor-sheet', 'nimble-actor-sheet--hero'],
		window: {
			icon: 'fa-solid fa-user',
			resizable: true,
		},
		position: { width: 720, height: 850 },
	};

	protected override createProps() {
		const actor = this.sheetActor;
		return {
			source: createHeroSource(actor, {
				missingLevelSelections: () => this.#missingLevelSelections,
				enrichedNotes: () => this.enrichedNotes,
				enrichedDescriptions: () => this.descriptions.enriched,
				manaFromInitiative: () => {
					// read only to recompute when the combat mana rules are primed
					void this.#combatManaPrimed;
					return getInitiativeCombatManaRules(actor as unknown as Actor).length > 0;
				},
			}),
			perform: createHeroPerform(actor, {
				dropItem: (data, containerId) => this.#dropItemInto(data, containerId),
			}),
		};
	}

	protected override notesOf(): string {
		return String(
			(this.sheetActor.reactive.system as { details?: { notes?: string } }).details?.notes ?? '',
		);
	}

	protected override watch(): void {
		const actor = this.sheetActor;
		void primeActorCombatManaSourceRules(actor as unknown as Actor).then(() => {
			this.#combatManaPrimed += 1;
		});
		let lastKey: string | null = null;
		$effect(() => {
			const key = levelAuditKey(actor);
			if (key === lastKey) return;
			lastKey = key;
			untrack(() => this.#audit(key));
		});
		$effect(() => {
			const open = new Set(this.ui.openRows);
			const wanted = actor.reactive.items
				.filter((item) => open.has(item.id ?? ''))
				.map((item) => [item.id ?? '', rawDescriptionOf(item)] as const)
				.filter(([, raw]) => raw);
			untrack(() => this.descriptions.want(wanted));
		});
	}

	/** Item drops on any tab go through the shared drop route. */
	protected override dropItem(data: Record<string, unknown>): Promise<void> {
		return this.#dropItemInto(data, null);
	}

	/** Places the drop, then shows the row on its tab and flashes it. */
	async #dropItemInto(data: Record<string, unknown>, containerId: string | null): Promise<void> {
		const actor = this.sheetActor;
		const carried = actor.items.map((item) => ({
			id: item.id ?? '',
			uuid: item.uuid,
			type: item.type,
			containerId: String((item.system as { containerId?: string }).containerId ?? ''),
		}));
		const action = dropAction(carried, data, containerId);
		const show = (type: unknown, rowId: string | undefined) => {
			if (rowId) this.reveal({ tab: tabOfItemType(type), rowId, flash: true });
		};
		switch (action.kind) {
			case 'none':
				return;
			case 'reveal':
				show(action.itemType, action.itemId);
				return;
			case 'store':
				if (await actor.storeItemInContainer(action.itemId, action.containerId)) {
					show('object', action.itemId);
				}
				return;
			case 'takeOut':
				await actor.removeItemFromContainer(action.itemId);
				show('object', action.itemId);
				return;
			case 'create': {
				const outcome = await routeItemDrop({
					actor: actor as unknown as Actor.Implementation,
					sheet: this as unknown as foundry.applications.sheets.ActorSheetV2.Any,
					data,
					containerId: action.containerId || undefined,
				});
				if (outcome.kind === 'sort') show(outcome.itemData.type, outcome.itemId);
				else if (outcome.kind === 'created') {
					show(outcome.documents[0]?.type, outcome.documents[0]?.id ?? undefined);
				} else if (outcome.kind === 'stacked') show(outcome.itemType, outcome.itemIds[0]);
				return;
			}
			default: {
				const unknown: never = action;
				throw new Error(`No drop for ${JSON.stringify(unknown)}`);
			}
		}
	}

	#audit(key: string): void {
		if (!key) {
			this.#missingLevelSelections = [];
			return;
		}
		void this.sheetActor
			.getMissingLevelSelections()
			.then((gaps: MissingLevelSelection[]) => {
				this.#missingLevelSelections = gaps.map((gap) => gap.level);
			})
			.catch((error: unknown) => {
				console.warn('Nimble | Failed to audit level selections:', error);
			});
	}
}
