import { untrack } from 'svelte';
import { routeItemDrop } from '#documents/actor/routeItemDrop.js';
import type { SvelteApplicationRenderContext } from '#lib/SvelteApplicationMixin.svelte.js';
import {
	openNpcFeaturesCollapsed,
	openNpcSheetsNarrow,
} from '../../../settings/actorSheetSettings.js';
import { ActorSheetApplication } from '../shared/ActorSheetApplication.svelte.ts';
import { isCardOpen, setCardsStartOpen } from '../shared/sheetUiState.ts';
import MonsterSheetComponent from './MonsterSheet.svelte';
import { createMonsterSource, type MonsterDocument } from './monsterAdapter.ts';
import type { MonsterPerform } from './monsterIntent.ts';
import { createMonsterPerform } from './monsterPerform.ts';
import type { MonsterSource } from './monsterSource.ts';

type ActorSheet = foundry.applications.sheets.ActorSheetV2;

/** The width of a new NPC sheet with "Open NPC sheets narrow" on: the narrow form. */
const NARROW_WIDTH = 390;

/** The NPC sheet, for `npc`, `soloMonster` and `minion`. */
export default class MonsterSheet extends ActorSheetApplication<
	MonsterDocument,
	MonsterSource,
	MonsterPerform
> {
	constructor(
		actor: { document: MonsterDocument },
		options = {} as SvelteApplicationRenderContext,
	) {
		const narrow = openNpcSheetsNarrow()
			? foundry.utils.mergeObject(options, { position: { width: NARROW_WIDTH } })
			: options;
		super(actor, narrow, MonsterSheetComponent, 'abilities');
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-actor-sheet', 'nimble-actor-sheet--monster'],
		window: {
			icon: 'fa-solid fa-ghost',
			resizable: true,
		},
		position: { width: 660, height: 650 },
	};

	/** Each open reads "Collapse NPC features", because Foundry keeps one sheet for each actor. */
	protected override async _onFirstRender(
		context: Parameters<ActorSheet['_onFirstRender']>[0],
		options: Parameters<ActorSheet['_onFirstRender']>[1],
	): Promise<void> {
		setCardsStartOpen(this.ui, !openNpcFeaturesCollapsed());
		await super._onFirstRender(context, options);
	}

	protected override createProps() {
		return {
			source: createMonsterSource(this.sheetActor, {
				enrichedNotes: () => this.enrichedNotes,
				enrichedDescriptions: () => this.descriptions.enriched,
			}),
			perform: createMonsterPerform(this.sheetActor),
		};
	}

	protected override notesOf(): string {
		return String((this.sheetActor.reactive.system as { description?: string }).description ?? '');
	}

	/** Each open card waits for its enriched text. */
	protected override watch(): void {
		const actor = this.sheetActor;
		$effect(() => {
			const wanted = actor.reactive.items
				.filter((item) => item.type === 'monsterFeature' && isCardOpen(this.ui, item.id ?? ''))
				.map(
					(item) =>
						[
							item.id ?? '',
							String((item.system as { description?: string }).description ?? ''),
						] as const,
				)
				.filter(([, raw]) => raw);
			untrack(() => this.descriptions.want(wanted));
		});
	}

	/** Creates the dropped item, then shows its card and flashes it. */
	protected override async dropItem(data: Record<string, unknown>): Promise<void> {
		const outcome = await routeItemDrop({
			actor: this.sheetActor as unknown as Actor.Implementation,
			sheet: this as unknown as foundry.applications.sheets.ActorSheetV2.Any,
			data,
		});
		// only an ability has a card; other items land on the monster without one
		const show = (rowId: string | null | undefined) => {
			if (rowId && this.sheetActor.items.get(rowId)?.type === 'monsterFeature') {
				this.reveal({ tab: 'abilities', rowId, flash: true });
			}
		};
		switch (outcome.kind) {
			case 'refused':
				return;
			case 'sort':
				show(outcome.itemId);
				return;
			case 'created':
				show(outcome.documents[0]?.id);
				return;
			case 'stacked':
				show(outcome.itemIds[0]);
				return;
			default: {
				const unknown: never = outcome;
				throw new Error(`No drop for ${JSON.stringify(unknown)}`);
			}
		}
	}
}
