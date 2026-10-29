import { untrack } from 'svelte';
import { routeItemDrop } from '#documents/actor/routeItemDrop.js';
import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import { droppedItemData } from '../shared/drag.ts';
import {
	createSheetUiState,
	type RevealRequest,
	revealIn,
	type SheetUiState,
} from '../shared/sheetUiState.ts';
import {
	createDescriptionEnricher,
	type EnrichActor,
	enrichText,
} from '../shared/textEnricher.svelte.ts';
import MonsterSheetComponent from './MonsterSheet.svelte';
import { createMonsterSource, type MonsterDocument } from './monsterAdapter.ts';
import type { MonsterPerform } from './monsterIntent.ts';
import { createMonsterPerform } from './monsterPerform.ts';
import type { MonsterSource } from './monsterSource.ts';

/** The new NPC sheet, for `npc`, `soloMonster` and `minion`. Not in the sheet selector yet. */
export default class MonsterSheet extends SvelteApplicationMixin(
	foundry.applications.sheets.ActorSheetV2,
) {
	protected root;

	#actor: MonsterDocument;

	#ui: SheetUiState = $state(createSheetUiState('abilities'));

	#enrichedNotes = $state('');

	#descriptions: ReturnType<typeof createDescriptionEnricher>;

	#stopEffects: (() => void) | null = null;

	#props: { source: () => MonsterSource; ui: SheetUiState; perform: MonsterPerform } | null = null;

	constructor(
		actor: { document: MonsterDocument },
		options = {} as SvelteApplicationRenderContext,
	) {
		super(
			foundry.utils.mergeObject(options, {
				document: actor.document,
			}) as object as ConstructorParameters<typeof foundry.applications.sheets.ActorSheetV2>[0],
		);
		this.root = MonsterSheetComponent;
		const resolved = actor.document.isToken
			? ((actor.document.parent as TokenDocument | undefined)?.actor as MonsterDocument | undefined)
			: actor.document;
		this.#actor = resolved ?? actor.document;
		this.#descriptions = createDescriptionEnricher(this.#actor as unknown as EnrichActor);
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-actor-sheet', 'nimble-actor-sheet--monster'],
		window: {
			icon: 'fa-solid fa-ghost',
			resizable: true,
		},
		position: { width: 660, height: 650 },
	};

	override get actor(): Actor {
		return this.#actor as unknown as Actor;
	}

	/** The only entry for outside code: go to a tab, flash a row. */
	reveal(request: RevealRequest): void {
		revealIn(this.#ui, request);
		if (!this.rendered) void this.render({ force: true });
		else this.bringToFront();
	}

	/** An Item drop goes through the shared drop route; a drop of anything else is the core one. */
	protected override async _onDrop(event: DragEvent): Promise<void> {
		const data = droppedItemData(event.dataTransfer);
		if (!data) {
			await super._onDrop(event);
			return;
		}
		await this.#dropItem(data);
	}

	/** Creates the dropped item, then shows its card and flashes it. */
	async #dropItem(data: Record<string, unknown>): Promise<void> {
		const outcome = await routeItemDrop({
			actor: this.#actor as unknown as Actor.Implementation,
			sheet: this as unknown as foundry.applications.sheets.ActorSheetV2.Any,
			data,
		});
		const show = (rowId: string | null | undefined) => {
			if (rowId) this.reveal({ tab: 'abilities', rowId, flash: true });
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

	protected override async _prepareContext(
		options: Parameters<foundry.applications.sheets.ActorSheetV2['_prepareContext']>[0],
	): ReturnType<foundry.applications.sheets.ActorSheetV2['_prepareContext']> {
		const context = await super._prepareContext(options);
		this.#props ??= {
			source: createMonsterSource(this.#actor, {
				enrichedNotes: () => this.#enrichedNotes,
				enrichedDescriptions: () => this.#descriptions.enriched,
			}),
			ui: this.#ui,
			perform: createMonsterPerform(this.#actor, {
				dropItem: (data) => this.#dropItem(data),
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
		this.#stopEffects = $effect.root(() => {
			$effect(() => {
				const notes = String((actor.reactive.system as { description?: string }).description ?? '');
				untrack(() => this.#enrichNotes(notes));
			});
			// the text of a card starts open, so each ability waits for its enriched text unless it is closed
			$effect(() => {
				const closed = new Set(this.#ui.closedRows);
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
				untrack(() => this.#descriptions.want(wanted));
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
		void enrichText(notes, this.#actor as unknown as EnrichActor).then((html) => {
			this.#enrichedNotes = html;
		});
	}
}
