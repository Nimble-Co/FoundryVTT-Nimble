import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import CheckRollDialogComponent from '../../view/dialogs/CheckRollDialog.svelte';

const { ApplicationV2 } = foundry.applications.api;

export default class CheckRollDialog extends SvelteApplicationMixin(ApplicationV2) {
	declare promise: Promise<any>;

	declare resolve: any;

	protected root;

	data: any;

	actor: Actor;

	constructor(actor, title, data = {}, options = {} as SvelteApplicationRenderContext) {
		super(
			foundry.utils.mergeObject(options, {
				document: actor,
				window: {
					title,
				},
			}),
		);

		this.root = CheckRollDialogComponent;
		this.actor = actor;
		this.data = data;

		this.promise = new Promise((resolve) => {
			this.resolve = resolve;
		});
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet'],
		window: {
			icon: 'fa-solid fa-dice-d20',
			resizable: true,
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
			dialog: this,
			...this.data,
		} as object as ReturnType<
			foundry.applications.api.ApplicationV2['_prepareContext']
		> extends Promise<infer T>
			? T
			: never;
	}

	async submitRoll(results: Record<string, unknown>) {
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
