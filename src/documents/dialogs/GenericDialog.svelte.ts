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
	/** Unique ID for singleton behavior - only one dialog with this ID can be open at a time */
	uniqueId?: string;
}

export default class GenericDialog extends SvelteApplicationMixin(ApplicationV2) {
	/** Registry of open singleton dialogs by uniqueId */
	static #openDialogs: Map<string, GenericDialog> = new Map();

	documentData: Record<string, unknown> = {};

	promise: Promise<Record<string, unknown> | null>;

	resolve: ((value: Record<string, unknown> | null) => void) | null = null;

	data: Record<string, unknown>;

	override root: svelte.Component<Record<string, never>>;

	#uniqueId: string | null = null;

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
		this.#uniqueId = options.uniqueId ?? null;

		this.promise = new Promise((resolve) => {
			this.resolve = resolve;
		});
	}

	/**
	 * Get or create a singleton dialog. If a dialog with the given uniqueId already exists,
	 * it will be brought to focus and returned. Otherwise, a new dialog is created.
	 */
	static getOrCreate(
		title: string,
		component: svelte.Component<Record<string, never>>,
		data: Record<string, unknown> = {},
		options: GenericDialogOptions & { uniqueId: string },
	): GenericDialog {
		const existing = GenericDialog.#openDialogs.get(options.uniqueId);
		if (existing?.rendered) {
			existing.bringToFront();
			return existing;
		}

		const dialog = new GenericDialog(title, component, data, options);
		return dialog;
	}

	/**
	 * Check if a dialog with the given uniqueId is currently open.
	 */
	static isOpen(uniqueId: string): boolean {
		const dialog = GenericDialog.#openDialogs.get(uniqueId);
		return dialog?.rendered ?? false;
	}

	/**
	 * Close a dialog by its uniqueId if it exists and is open.
	 */
	static async closeById(uniqueId: string): Promise<void> {
		const dialog = GenericDialog.#openDialogs.get(uniqueId);
		if (dialog?.rendered) {
			await dialog.close();
		}
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

	override async render(
		options?: boolean | DeepPartial<foundry.applications.api.ApplicationV2.RenderOptions>,
		_options?: DeepPartial<foundry.applications.api.ApplicationV2.RenderOptions>,
	): Promise<this> {
		// Register singleton dialog before rendering
		if (this.#uniqueId) {
			GenericDialog.#openDialogs.set(this.#uniqueId, this);
		}
		return super.render(options as boolean, _options);
	}

	override close(
		options?: DeepPartial<foundry.applications.api.ApplicationV2.ClosingOptions>,
	): Promise<this> {
		// Unregister singleton dialog on close
		if (this.#uniqueId) {
			GenericDialog.#openDialogs.delete(this.#uniqueId);
		}
		this.#resolvePromise(null);
		return super.close(options);
	}

	/**
	 * Resolves the dialog's promise and closes it.
	 */
	override async submit(results?: Record<string, unknown>): Promise<void> {
		// Unregister singleton dialog on submit
		if (this.#uniqueId) {
			GenericDialog.#openDialogs.delete(this.#uniqueId);
		}
		this.#resolvePromise(results ?? null);
		await super.close();
	}

	#resolvePromise(data: Record<string, unknown> | null) {
		if (this.resolve) this.resolve(data);
	}
}
