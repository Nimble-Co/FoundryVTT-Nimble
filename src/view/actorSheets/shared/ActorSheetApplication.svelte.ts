import type { Component } from 'svelte';
import { untrack } from 'svelte';
import type { NimbleBaseActor } from '#documents/actor/base.svelte.js';
import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import { droppedItemData } from './drag.ts';
import {
	createSheetUiState,
	type RevealRequest,
	revealIn,
	type SheetUiState,
} from './sheetUiState.ts';
import {
	createDescriptionEnricher,
	createNotesEnricher,
	type EnrichActor,
} from './textEnricher.svelte.ts';

/** What the root component of a new sheet takes. */
export interface SheetRootProps<Source, Perform> {
	source: () => Source;
	ui: SheetUiState;
	perform: Perform;
}

type ActorSheet = foundry.applications.sheets.ActorSheetV2;

/**
 * The Application of a new actor sheet: the actor of a token, the UI state, `reveal()`, the Item drop,
 * the enriched notes and descriptions, and the effects that stop on close.
 */
export abstract class ActorSheetApplication<
	Document extends NimbleBaseActor,
	Source,
	Perform,
> extends SvelteApplicationMixin(foundry.applications.sheets.ActorSheetV2) {
	protected root;

	protected readonly sheetActor: Document;

	protected readonly ui: SheetUiState = $state(createSheetUiState(''));

	readonly #notes: ReturnType<typeof createNotesEnricher>;

	protected get enrichedNotes(): string {
		return this.#notes.html;
	}

	protected readonly descriptions: ReturnType<typeof createDescriptionEnricher>;

	#stopEffects: (() => void) | null = null;

	#props: SheetRootProps<Source, Perform> | null = null;

	constructor(
		actor: { document: Document },
		options: SvelteApplicationRenderContext,
		root: Component<SheetRootProps<Source, Perform>>,
		firstTab: string,
	) {
		super(
			foundry.utils.mergeObject(options, {
				document: actor.document,
			}) as object as ConstructorParameters<typeof foundry.applications.sheets.ActorSheetV2>[0],
		);
		this.root = root as unknown as Component<Record<string, never>>;
		this.ui.tab = firstTab;
		const resolved = actor.document.isToken
			? ((actor.document.parent as TokenDocument | undefined)?.actor as Document | undefined)
			: actor.document;
		this.sheetActor = resolved ?? actor.document;
		this.descriptions = createDescriptionEnricher(this.sheetActor as unknown as EnrichActor);
		this.#notes = createNotesEnricher(this.sheetActor as unknown as EnrichActor);
	}

	override get actor(): Actor {
		return this.sheetActor as unknown as Actor;
	}

	/** The only entry for outside code: go to a tab, open a choice step, flash a row. */
	reveal(request: RevealRequest): void {
		revealIn(this.ui, request);
		if (!this.rendered) void this.render({ force: true });
		else this.bringToFront();
	}

	/** The source and the dispatcher of the root component. Called once, at the first render. */
	protected abstract createProps(): Omit<SheetRootProps<Source, Perform>, 'ui'>;

	/** An Item drop on the sheet. A drop of anything else is the core one. */
	protected abstract dropItem(data: Record<string, unknown>): Promise<void>;

	/** The raw notes of the actor, read in an effect, so a change enriches them again. */
	protected abstract notesOf(): string;

	/** The effects of the sheet, made in the root that stops on close. */
	protected abstract watch(): void;

	protected override async _onDrop(event: DragEvent): Promise<void> {
		const data = droppedItemData(event.dataTransfer);
		if (!data) {
			await super._onDrop(event);
			return;
		}
		await this.dropItem(data);
	}

	protected override async _prepareContext(
		options: Parameters<ActorSheet['_prepareContext']>[0],
	): ReturnType<ActorSheet['_prepareContext']> {
		const context = await super._prepareContext(options);
		this.#props ??= { ...this.createProps(), ui: this.ui };
		return { ...context, ...this.#props } as object as Awaited<
			ReturnType<ActorSheet['_prepareContext']>
		>;
	}

	protected override async _onFirstRender(
		context: Parameters<ActorSheet['_onFirstRender']>[0],
		options: Parameters<ActorSheet['_onFirstRender']>[1],
	): Promise<void> {
		await super._onFirstRender(context, options);
		this.#stopEffects = $effect.root(() => {
			$effect(() => {
				const notes = this.notesOf();
				untrack(() => this.#notes.want(notes));
			});
			this.watch();
		});
	}

	protected override _onClose(options: Parameters<ActorSheet['_onClose']>[0]): void {
		super._onClose(options);
		this.#stopEffects?.();
		this.#stopEffects = null;
	}
}
