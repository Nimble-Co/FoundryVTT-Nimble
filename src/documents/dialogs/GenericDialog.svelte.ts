import type { DeepPartial } from 'fvtt-types/utils';
import type { Component } from 'svelte';
import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';

const { ApplicationV2 } = foundry.applications.api;

interface GenericDialogOptions {
	icon?: string;
	width?: number;
}

export default class GenericDialog extends SvelteApplicationMixin(ApplicationV2) {
	documentData: Record<string, unknown> = {};

	promise: Promise<Record<string, unknown> | null>;

	resolve: ((value: Record<string, unknown> | null) => void) | null = null;

	data: Record<string, unknown>;

	protected root!: Component;

	constructor(
		title: string,
		component: Component,
		data: Record<string, unknown> = {},
		options: GenericDialogOptions = {},
	) {
		super();

		// Apply options to the instance
		Object.assign(this.options, {
			position: {
				width: options.width ?? 288,
			},
			window: {
				icon: options.icon ?? 'fa-solid fa-note',
				title,
			},
		});

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
			height: 'auto' as const,
		},
		actions: {},
	};

	protected override async _prepareContext(
		_options: DeepPartial<foundry.applications.api.ApplicationV2.RenderOptions> & {
			isFirstRender: boolean;
		},
	): Promise<foundry.applications.api.ApplicationV2.RenderContext & Record<string, unknown>> {
		return {
			dialog: this,
			...this.data,
		};
	}

	override async close(
		options?: DeepPartial<foundry.applications.api.ApplicationV2.ClosingOptions>,
	): Promise<this> {
		this.#resolvePromise(null);
		return super.close(options);
	}

	/**
	 * Resolves the dialog's promise and closes it.
	 */
	submitDialog(results: Record<string, unknown>): Promise<this> {
		this.#resolvePromise(results);
		return super.close();
	}

	#resolvePromise(data: Record<string, unknown> | null): void {
		if (this.resolve) this.resolve(data);
	}
}
