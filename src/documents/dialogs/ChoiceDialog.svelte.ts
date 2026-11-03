import type * as svelte from 'svelte';
import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';

const { ApplicationV2 } = foundry.applications.api;

interface ChoiceDialogOptions {
	/** Any component: the mixin mounts it with the render context as its props */
	component: svelte.Component<never>;
	/** Font Awesome class of the window icon */
	icon: string;
	title: string;
	/** Props for the component, next to `actor` and `dialog` */
	data?: object;
}

/** A roll window where the player makes a choice. It resolves with the choice, or null when closed. */
export default class ChoiceDialog<T> extends SvelteApplicationMixin(ApplicationV2) {
	declare promise: Promise<T | null>;

	declare resolve: (result: T | null) => void;

	protected root: svelte.Component<Record<string, never>>;

	actor: object;

	data: object;

	constructor(actor: object, { component, icon, title, data = {} }: ChoiceDialogOptions) {
		super(
			foundry.utils.mergeObject({} as SvelteApplicationRenderContext, {
				document: actor,
				window: { title, icon },
			}),
		);
		this.root = component as svelte.Component<Record<string, never>>;
		this.actor = actor;
		this.data = data;
		this.promise = new Promise((resolve) => {
			this.resolve = resolve;
		});
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-roll-window'],
		position: { width: 360, height: 'auto' as const },
		actions: {},
	};

	protected override async _prepareContext(): Promise<foundry.applications.api.ApplicationV2.RenderContext> {
		return {
			actor: this.actor,
			dialog: this,
			...this.data,
		} as foundry.applications.api.ApplicationV2.RenderContext;
	}

	async submitActivation(results: T) {
		this.resolve?.(results);
		return super.close();
	}

	override async close(options?: Parameters<foundry.applications.api.ApplicationV2['close']>[0]) {
		this.resolve?.(null);
		return super.close(options);
	}
}
