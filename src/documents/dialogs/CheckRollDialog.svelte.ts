import type { DeepPartial } from 'fvtt-types/utils';
import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import CheckRollDialogComponent from '../../view/dialogs/CheckRollDialog.svelte';

const { ApplicationV2 } = foundry.applications.api;

/** Render context for check roll dialog */
interface CheckRollDialogRenderContext
	extends foundry.applications.api.ApplicationV2.RenderContext {
	actor: Actor;
	dialog: CheckRollDialog;
	[key: string]: unknown;
}

/** Results from check roll submission */
interface CheckRollResults {
	rollMode: string;
	rollFormula: string;
	[key: string]: unknown;
}

export default class CheckRollDialog extends SvelteApplicationMixin(ApplicationV2) {
	declare promise: Promise<CheckRollResults | null>;

	declare resolve: (value: CheckRollResults | null) => void;

	protected root = CheckRollDialogComponent;

	data: Record<string, unknown>;

	actor: Actor;

	constructor(
		actor: Actor,
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
		_options: DeepPartial<foundry.applications.api.ApplicationV2.RenderOptions> & {
			isFirstRender: boolean;
		},
	): Promise<CheckRollDialogRenderContext> {
		return {
			actor: this.actor,
			dialog: this,
			...this.data,
		};
	}

	async submitRoll(results: CheckRollResults): Promise<this> {
		this.#resolvePromise(results);
		return super.close();
	}

	override async close(
		options?: DeepPartial<foundry.applications.api.ApplicationV2.ClosingOptions>,
	): Promise<this> {
		this.#resolvePromise(null);
		return super.close(options);
	}

	#resolvePromise(data: CheckRollResults | null): void {
		if (this.resolve) {
			this.resolve(data);
		}
	}
}
