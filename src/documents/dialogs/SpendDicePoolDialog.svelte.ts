import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import SpendDicePoolDialogComponent from '../../view/dialogs/SpendDicePoolDialog.svelte';

const { ApplicationV2 } = foundry.applications.api;

export interface SpendDicePoolDialogResult {
	spentFaces: number[];
	presetItemId: string | null;
	presetRuleId: string | null;
	effectTotal: number | null;
}

export default class SpendDicePoolDialog extends SvelteApplicationMixin(ApplicationV2) {
	declare promise: Promise<SpendDicePoolDialogResult | null>;

	declare resolve: (value: SpendDicePoolDialogResult | null) => void;

	protected root;

	actor: Actor;

	poolId: string;

	constructor(
		actor: Actor,
		poolId: string,
		options: Partial<SvelteApplicationRenderContext> = {} as SvelteApplicationRenderContext,
	) {
		super(
			foundry.utils.mergeObject(options, {
				document: actor,
				window: {
					title: actor.name ?? 'Spend Dice',
				},
			}),
		);

		this.root = SpendDicePoolDialogComponent;
		this.actor = actor;
		this.poolId = poolId;

		this.promise = new Promise((resolve) => {
			this.resolve = resolve;
		});
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet'],
		window: {
			icon: 'fa-solid fa-dice',
		},
		position: {
			width: 420,
			height: 'auto' as const,
		},
		actions: {},
	};

	protected override async _prepareContext(
		_options: Parameters<foundry.applications.api.ApplicationV2['_prepareContext']>[0],
	): ReturnType<foundry.applications.api.ApplicationV2['_prepareContext']> {
		return {
			actor: this.actor,
			poolId: this.poolId,
			dialog: this,
		} as object as ReturnType<
			foundry.applications.api.ApplicationV2['_prepareContext']
		> extends Promise<infer T>
			? T
			: never;
	}

	async submitSpend(result: SpendDicePoolDialogResult) {
		this.#resolvePromise(result);
		return super.close();
	}

	override async close(options?: Parameters<foundry.applications.api.ApplicationV2['close']>[0]) {
		this.#resolvePromise(null);
		return super.close(options);
	}

	#resolvePromise(data: SpendDicePoolDialogResult | null) {
		if (this.resolve) {
			this.resolve(data);
		}
	}
}
