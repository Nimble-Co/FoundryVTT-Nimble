import { untrack } from 'svelte';
import { routeItemDrop } from '#documents/actor/routeItemDrop.js';
import type { SvelteApplicationRenderContext } from '#lib/SvelteApplicationMixin.svelte.js';
import { openNpcSheetsNarrow } from '../../../settings/actorSheetSettings.js';
import { ActorSheetApplication } from '../shared/ActorSheetApplication.svelte.ts';
import MonsterSheetComponent from './MonsterSheet.svelte';
import { createMonsterSource, type MonsterDocument } from './monsterAdapter.ts';
import type { MonsterPerform } from './monsterIntent.ts';
import { createMonsterPerform } from './monsterPerform.ts';
import type { MonsterSource } from './monsterSource.ts';

/** The width of a new NPC sheet with "Open NPC sheets narrow" on: the narrow form. */
const NARROW_WIDTH = 390;

/** The new NPC sheet, for `npc`, `soloMonster` and `minion`. A second choice in the sheet selector until the switch. */
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

	/** The text of a card starts open, so each ability waits for its enriched text unless it is closed. */
	protected override watch(): void {
		const actor = this.sheetActor;
		$effect(() => {
			const closed = new Set(this.ui.closedRows);
			const wanted = actor.reactive.items
				.filter((item) => item.type === 'monsterFeature' && !closed.has(item.id ?? ''))
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
