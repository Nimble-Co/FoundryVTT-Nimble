import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import type { PoolSpendSelection } from '#utils/incomingAttackReactions.js';
import PoolSpendOfferDialogComponent from '../../view/dialogs/PoolSpendOfferDialog.svelte';

const { ApplicationV2 } = foundry.applications.api;

/**
 * Dice picker for a chat-card spend offer (e.g. Berserker's Death Blow). The
 * sheet's own pool panel covers the sheet-driven flow; this is its card-driven
 * counterpart, scoped to a single consumer and a single pool.
 */
export default class PoolSpendOfferDialog extends SvelteApplicationMixin(ApplicationV2) {
	declare promise: Promise<PoolSpendSelection | null>;

	declare resolve: (result: PoolSpendSelection | null) => void;

	protected root;

	actor: Actor;

	poolId: string;

	ruleId: string;

	constructor(
		actor: Actor,
		poolId: string,
		ruleId: string,
		title: string,
		options = {} as SvelteApplicationRenderContext,
	) {
		super(
			foundry.utils.mergeObject(options, {
				document: actor,
				window: { title },
			}),
		);

		this.root = PoolSpendOfferDialogComponent;
		this.actor = actor;
		this.poolId = poolId;
		this.ruleId = ruleId;

		this.promise = new Promise((resolve) => {
			this.resolve = resolve;
		});
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet'],
		window: {
			icon: 'fa-solid fa-dice-d6',
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
			ruleId: this.ruleId,
			dialog: this,
		} as object as ReturnType<
			foundry.applications.api.ApplicationV2['_prepareContext']
		> extends Promise<infer T>
			? T
			: never;
	}

	async submitSpend(result: PoolSpendSelection) {
		this.#resolvePromise(result);
		return super.close();
	}

	override async close(options?: Parameters<foundry.applications.api.ApplicationV2['close']>[0]) {
		this.#resolvePromise(null);
		return super.close(options);
	}

	#resolvePromise(result: PoolSpendSelection | null) {
		if (this.resolve) this.resolve(result);
	}
}
