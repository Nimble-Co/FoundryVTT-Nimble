import { untrack } from 'svelte';
import type { NimbleCharacter } from '#documents/actor/character.js';
import { routeItemDrop } from '#documents/actor/routeItemDrop.js';
import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import {
	getInitiativeCombatManaRules,
	primeActorCombatManaSourceRules,
} from '#utils/actor/combatManaRules.js';
import type { MissingLevelSelection } from '#utils/classProgression/findMissingLevelSelections.ts';
import { droppedItemData } from '../shared/drag.ts';
import {
	createSheetUiState,
	type RevealRequest,
	revealIn,
	type SheetUiState,
} from '../shared/sheetUiState.ts';
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
export default class HeroSheet extends SvelteApplicationMixin(
	foundry.applications.sheets.ActorSheetV2,
) {
	protected root;

	#actor: NimbleCharacter;

	#ui: SheetUiState = $state(createSheetUiState('core'));

	#missingLevelSelections: number[] = $state([]);

	#combatManaPrimed = $state(0);

	#enrichedNotes = $state('');

	#enrichedDescriptions: Record<string, string> = $state({});

	/** by item id, the raw description that `#enrichedDescriptions` holds or waits for */
	#descriptionSources = new Map<string, string>();

	#stopEffects: (() => void) | null = null;

	#props: { source: () => HeroSource; ui: SheetUiState; perform: HeroPerform } | null = null;

	constructor(
		actor: { document: NimbleCharacter },
		options = {} as SvelteApplicationRenderContext,
	) {
		super(
			foundry.utils.mergeObject(options, {
				document: actor.document,
			}) as object as ConstructorParameters<typeof foundry.applications.sheets.ActorSheetV2>[0],
		);
		this.root = HeroSheetComponent;
		const resolved = actor.document.isToken
			? ((actor.document.parent as TokenDocument | undefined)?.actor as NimbleCharacter | undefined)
			: actor.document;
		this.#actor = resolved ?? actor.document;
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-actor-sheet', 'nimble-actor-sheet--hero'],
		window: {
			icon: 'fa-solid fa-user',
			resizable: true,
		},
		position: { width: 720, height: 850 },
	};

	override get actor(): Actor {
		return this.#actor as unknown as Actor;
	}

	/** The only entry for outside code: go to a tab, open a choice step, flash a row. */
	reveal(request: RevealRequest): void {
		revealIn(this.#ui, request);
		if (!this.rendered) void this.render({ force: true });
		else this.bringToFront();
	}

	/** Item drops on any tab go through the shared drop route; a drop of anything else is the core one. */
	protected override async _onDrop(event: DragEvent): Promise<void> {
		const data = droppedItemData(event.dataTransfer);
		if (!data) {
			await super._onDrop(event);
			return;
		}
		await this.#dropItem(data, null);
	}

	/** Places the drop, then shows the row on its tab and flashes it. */
	async #dropItem(data: Record<string, unknown>, containerId: string | null): Promise<void> {
		const actor = this.#actor;
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

	protected override async _prepareContext(
		options: Parameters<foundry.applications.sheets.ActorSheetV2['_prepareContext']>[0],
	): ReturnType<foundry.applications.sheets.ActorSheetV2['_prepareContext']> {
		const context = await super._prepareContext(options);
		const actor = this.#actor;
		this.#props ??= {
			source: createHeroSource(actor, {
				missingLevelSelections: () => this.#missingLevelSelections,
				enrichedNotes: () => this.#enrichedNotes,
				enrichedDescriptions: () => this.#enrichedDescriptions,
				manaFromInitiative: () => {
					// read only to recompute when the combat mana rules are primed
					void this.#combatManaPrimed;
					return getInitiativeCombatManaRules(actor as unknown as Actor).length > 0;
				},
			}),
			ui: this.#ui,
			perform: createHeroPerform(actor, {
				dropItem: (data, containerId) => this.#dropItem(data, containerId),
			}),
		};
		return { ...context, ...this.#props } as object as Awaited<
			ReturnType<foundry.applications.sheets.ActorSheetV2['_prepareContext']>
		>;
	}

	protected override async _onFirstRender(
		context: Parameters<foundry.applications.sheets.ActorSheetV2['_onFirstRender']>[0],
		options: Parameters<foundry.applications.sheets.ActorSheetV2['_onFirstRender']>[1],
	): Promise<void> {
		await super._onFirstRender(context, options);
		const actor = this.#actor;
		void primeActorCombatManaSourceRules(actor as unknown as Actor).then(() => {
			this.#combatManaPrimed += 1;
		});

		let lastKey: string | null = null;
		this.#stopEffects = $effect.root(() => {
			$effect(() => {
				const key = levelAuditKey(actor);
				if (key === lastKey) return;
				lastKey = key;
				untrack(() => this.#audit(key));
			});
			$effect(() => {
				const notes = String(
					(actor.reactive.system as { details?: { notes?: string } }).details?.notes ?? '',
				);
				untrack(() => this.#enrichNotes(notes));
			});
			$effect(() => {
				const open = new Set(this.#ui.openRows);
				const wanted = actor.reactive.items
					.filter((item) => open.has(item.id ?? ''))
					.map((item) => [item.id ?? '', rawDescriptionOf(item)] as const)
					.filter(([, raw]) => raw);
				untrack(() => this.#enrichDescriptions(wanted));
			});
		});
	}

	protected override _onClose(
		options: Parameters<foundry.applications.sheets.ActorSheetV2['_onClose']>[0],
	): void {
		super._onClose(options);
		this.#stopEffects?.();
		this.#stopEffects = null;
	}

	#enrichNotes(notes: string): void {
		const actor = this.#actor;
		void foundry.applications.ux.TextEditor.implementation
			.enrichHTML(notes, {
				secrets: actor.isOwner,
				rollData: actor.getRollData(),
				relativeTo: actor as unknown as foundry.abstract.Document.Any,
			})
			.then((html: string) => {
				this.#enrichedNotes = html;
			});
	}

	/** Only open rows show the text, so only they wait for the async enrichment. */
	#enrichDescriptions(wanted: (readonly [string, string])[]): void {
		for (const [id, raw] of wanted) {
			if (this.#descriptionSources.get(id) === raw) continue;
			this.#descriptionSources.set(id, raw);
			if (id in this.#enrichedDescriptions) {
				const { [id]: _stale, ...rest } = this.#enrichedDescriptions;
				this.#enrichedDescriptions = rest;
			}
			const item = this.#actor.items.get(id);
			void foundry.applications.ux.TextEditor.implementation
				.enrichHTML(raw, {
					secrets: this.#actor.isOwner,
					rollData: item?.getRollData() ?? this.#actor.getRollData(),
					relativeTo: (item ?? this.#actor) as unknown as foundry.abstract.Document.Any,
				})
				.then((html: string) => {
					if (this.#descriptionSources.get(id) !== raw) return;
					this.#enrichedDescriptions = { ...this.#enrichedDescriptions, [id]: html };
				});
		}
	}

	#audit(key: string): void {
		if (!key) {
			this.#missingLevelSelections = [];
			return;
		}
		void this.#actor
			.getMissingLevelSelections()
			.then((gaps: MissingLevelSelection[]) => {
				this.#missingLevelSelections = gaps.map((gap) => gap.level);
			})
			.catch((error: unknown) => {
				console.warn('Nimble | Failed to audit level selections:', error);
			});
	}
}
