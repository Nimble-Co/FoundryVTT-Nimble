import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import SpellUpcastDialogComponent from '../../view/dialogs/SpellUpcastDialog.svelte';

const { ApplicationV2 } = foundry.applications.api;

export default class SpellUpcastDialog extends SvelteApplicationMixin(ApplicationV2) {
	declare promise: Promise<any>;

	declare resolve: any;

	protected root;

	data: any;

	actor: Actor;

	item: any;

	spell: any;

	constructor(actor, item, title, data = {}, options = {} as SvelteApplicationRenderContext) {
		super(
			foundry.utils.mergeObject(options, {
				document: actor,
				window: {
					title,
				},
			}),
		);

		this.root = SpellUpcastDialogComponent;
		this.actor = actor;
		this.item = item;
		this.spell = item.system;
		this.data = data;

		this.promise = new Promise((resolve) => {
			this.resolve = resolve;
		});
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet'],
		window: {
			icon: 'fa-solid fa-wand-magic-sparkles',
		},
		position: {
			width: 576,
			height: 'auto' as const,
		},
		actions: {},
	};

	protected override async _prepareContext(
		_options: Parameters<foundry.applications.api.ApplicationV2['_prepareContext']>[0],
	): ReturnType<foundry.applications.api.ApplicationV2['_prepareContext']> {
		return {
			actor: this.actor,
			item: this.item,
			spell: this.spell,
			dialog: this,
			...this.data,
		} as object as ReturnType<
			foundry.applications.api.ApplicationV2['_prepareContext']
		> extends Promise<infer T>
			? T
			: never;
	}

	async submitActivation(results: Record<string, unknown>) {
		console.log('[SpellUpcastDialog] submitActivation called', results);
		this.#resolvePromise(results);
		return super.close();
	}

	override async close(options?: Parameters<foundry.applications.api.ApplicationV2['close']>[0]) {
		this.#resolvePromise(null);
		return super.close(options);
	}

	#resolvePromise(data) {
		if (this.resolve) {
			this.resolve(data);
		}
	}
}
