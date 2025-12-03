import type { DeepPartial } from 'fvtt-types/utils';
import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import ItemActivationConfigDialogComponent from '../../view/dialogs/ItemActivationConfigDialog.svelte';

const { ApplicationV2 } = foundry.applications.api;

/** Render context for item activation config dialog */
interface ItemActivationConfigRenderContext
	extends foundry.applications.api.ApplicationV2.RenderContext {
	actor: Actor;
	item: Item;
	dialog: ItemActivationConfigDialog;
	[key: string]: unknown;
}

/** Results from item activation config submission */
interface ItemActivationConfigResults {
	rollMode?: number;
	rollFormula?: string;
	primaryDieValue?: number;
	[key: string]: unknown;
}

export default class ItemActivationConfigDialog extends SvelteApplicationMixin(ApplicationV2) {
	declare promise: Promise<ItemActivationConfigResults | null>;

	declare resolve: (value: ItemActivationConfigResults | null) => void;

	protected root = ItemActivationConfigDialogComponent;

	data: Record<string, unknown>;

	actor: Actor;

	item: Item;

	constructor(
		actor: Actor,
		item: Item,
		title: string,
		data: Record<string, unknown> = {},
		options = {} as SvelteApplicationRenderContext,
	) {
		super(
			foundry.utils.mergeObject(options, {
				document: actor,
				window: {
					title,
				},
			}) as Record<string, unknown>,
		);

		this.actor = actor;
		this.item = item;
		this.data = data;

		this.promise = new Promise((resolve) => {
			this.resolve = resolve;
		});
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet'],
		window: {
			icon: 'fa-solid fa-dice-d20',
		},
		position: {
			width: 576,
			height: 'auto' as const,
		},
		actions: {},
	};

	protected override async _prepareContext(
		_options: DeepPartial<foundry.applications.api.ApplicationV2.RenderOptions> & {
			isFirstRender: boolean;
		},
	): Promise<ItemActivationConfigRenderContext> {
		return {
			actor: this.actor,
			item: this.item,
			dialog: this,
			...this.data,
		};
	}

	async submitConfig(results: ItemActivationConfigResults): Promise<this> {
		this.#resolvePromise(results);
		return super.close();
	}

	override async close(
		options?: DeepPartial<foundry.applications.api.ApplicationV2.ClosingOptions>,
	): Promise<this> {
		this.#resolvePromise(null);
		return super.close(options);
	}

	#resolvePromise(data: ItemActivationConfigResults | null): void {
		if (this.resolve) {
			this.resolve(data);
		}
	}
}
