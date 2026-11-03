import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import type { ControlChoice } from '#utils/demandControl/demandControl.js';
import DemandControlDialogComponent from '../../view/dialogs/DemandControlDialog.svelte';

const { ApplicationV2 } = foundry.applications.api;

export default class DemandControlDialog extends SvelteApplicationMixin(ApplicationV2) {
	declare promise: Promise<ControlChoice | null>;

	declare resolve: (result: ControlChoice | null) => void;

	protected root;

	actor: Actor;

	data: object;

	constructor(actor: Actor, title: string, data: object = {}) {
		super(
			foundry.utils.mergeObject({} as SvelteApplicationRenderContext, {
				document: actor,
				window: { title },
			}),
		);
		this.root = DemandControlDialogComponent;
		this.actor = actor;
		this.data = data;
		this.promise = new Promise((resolve) => {
			this.resolve = resolve;
		});
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-roll-window'],
		window: { icon: 'fa-solid fa-hand' },
		position: { width: 360, height: 'auto' as const },
		actions: {},
	};

	protected override async _prepareContext(): ReturnType<
		foundry.applications.api.ApplicationV2['_prepareContext']
	> {
		return { actor: this.actor, dialog: this, ...this.data } as never;
	}

	async submitActivation(results: ControlChoice) {
		this.resolve?.(results);
		return super.close();
	}

	override async close(options?: Parameters<foundry.applications.api.ApplicationV2['close']>[0]) {
		this.resolve?.(null);
		return super.close(options);
	}
}
