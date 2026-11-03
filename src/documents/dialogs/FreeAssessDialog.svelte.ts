import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import type { AssessRequest } from '#utils/heroicActions/assess.js';
import FreeAssessDialogComponent from '../../view/dialogs/FreeAssessDialog.svelte';

const { ApplicationV2 } = foundry.applications.api;

type FreeAssessChoice = Omit<AssessRequest, 'free'>;

export default class FreeAssessDialog extends SvelteApplicationMixin(ApplicationV2) {
	declare promise: Promise<FreeAssessChoice | null>;

	declare resolve: (result: FreeAssessChoice | null) => void;

	protected root;

	data: object;

	constructor(actor: Actor, title: string, data: object = {}) {
		super(
			foundry.utils.mergeObject({} as SvelteApplicationRenderContext, {
				document: actor,
				window: { title },
			}),
		);
		this.root = FreeAssessDialogComponent;
		this.data = data;
		this.promise = new Promise((resolve) => {
			this.resolve = resolve;
		});
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-roll-window'],
		window: { icon: 'fa-solid fa-magnifying-glass' },
		position: { width: 360, height: 'auto' as const },
		actions: {},
	};

	protected override async _prepareContext(): ReturnType<
		foundry.applications.api.ApplicationV2['_prepareContext']
	> {
		return { dialog: this, ...this.data } as never;
	}

	async submitActivation(results: FreeAssessChoice) {
		this.resolve?.(results);
		return super.close();
	}

	override async close(options?: Parameters<foundry.applications.api.ApplicationV2['close']>[0]) {
		this.resolve?.(null);
		return super.close(options);
	}
}
