import type { DeepPartial } from '@league-of-foundry-developers/foundry-vtt-types/src/types/utils.d.mts';
import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte';

const { ApplicationV2 } = foundry.applications.api;

export default class GenericDialog extends SvelteApplicationMixin(ApplicationV2) {
	documentData: any;

	promise: Promise<any>;

	resolve: any;

	data: any;

	protected root;

	constructor(
		title,
		component,
		data: Record<string, any> = {},
		options = {} as SvelteApplicationRenderContext,
	) {
		super(
			foundry.utils.mergeObject(options, {
				position: {
					width: options.width ?? 288,
				},
				window: {
					icon: options.icon ?? 'fa-solid fa-note',
					title,
				},
			}),
		);

		this.root = component;
		this.data = data;

		this.promise = new Promise((resolve) => {
			this.resolve = resolve;
		});
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet'],
		window: {
			resizable: true,
		},
		position: {
			height: 'auto',
		},
		actions: {},
	};

	protected override async _prepareContext() {
		return {
			dialog: this,
			...this.data,
		};
	}

	protected override close(
		options?: foundry.applications.api.ApplicationV2.ClosingOptions,
	): Promise<void>;
	protected override close(options?: DeepPartial<ApplicationV2.ClosingOptions>): Promise<this>;
	protected override close(_options?: unknown): Promise<void> | Promise<this> | void {
		this.#resolvePromise(null);
		super.close();
	}

	/**
	 * Resolves the dialog's promise and closes it.
	 */
	submit(results: Record<string, any>) {
		this.#resolvePromise(results);
		return super.close();
	}

	#resolvePromise(data: Record<string, any> | null) {
		if (this.resolve) this.resolve(data);
	}
}
