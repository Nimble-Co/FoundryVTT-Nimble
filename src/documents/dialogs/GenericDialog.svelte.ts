import type { DeepPartial } from 'fvtt-types/utils';
import type * as svelte from 'svelte';
import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';

const { ApplicationV2 } = foundry.applications.api;

/** Options for configuring GenericDialog appearance */
interface GenericDialogOptions {
	/** Icon class for the dialog window (e.g. 'fa-solid fa-wrench') */
	icon?: string;
	/** Width of the dialog in pixels */
	width?: number;
}

export default class GenericDialog extends SvelteApplicationMixin(ApplicationV2) {
	documentData: Record<string, unknown> = {};

	promise: Promise<Record<string, unknown> | null>;

	resolve: ((value: Record<string, unknown> | null) => void) | null = null;

	data: Record<string, unknown>;

	override root: svelte.Component<Record<string, never>>;

	constructor(
		title: string,
		component: svelte.Component<Record<string, never>>,
		data: Record<string, unknown> = {},
		options: GenericDialogOptions = {},
	) {
		const width = options.width ?? 288;
		super(
			foundry.utils.mergeObject(options as object, {
				position: {
					width,
					top: Math.round(window.innerHeight * 0.1),
					left: Math.round((window.innerWidth - width) / 2),
				},
				window: {
					icon: options.icon ?? 'fa-solid fa-note',
					title,
				},
			}) as DeepPartial<foundry.applications.api.ApplicationV2.Configuration>,
		);

		this.root = component;
		this.data = data;

		this.promise = new Promise((resolve) => {
			this.resolve = resolve;
		});
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet', 'nimble-dialog'],
		window: {
			resizable: true,
		},
		position: {
			height: 'auto' as const,
		},
		actions: {},
	};

	protected override async _prepareContext(
		_options: DeepPartial<foundry.applications.api.ApplicationV2.RenderOptions> & {
			isFirstRender: boolean;
		},
	): Promise<foundry.applications.api.ApplicationV2.RenderContext> {
		return {
			dialog: this,
			...this.data,
		} as foundry.applications.api.ApplicationV2.RenderContext;
	}

	override close(
		options?: DeepPartial<foundry.applications.api.ApplicationV2.ClosingOptions>,
	): Promise<this> {
		this.#resolvePromise(null);
		return super.close(options);
	}

	/**
	 * Resolves the dialog's promise and closes it.
	 */
	override async submit(results?: Record<string, unknown>): Promise<void> {
		this.#resolvePromise(results ?? null);
		await super.close();
	}

	#resolvePromise(data: Record<string, unknown> | null) {
		if (this.resolve) this.resolve(data);
	}
}
