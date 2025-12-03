// SystemChatMessageTypes excludes 'base' from available types
export type SystemChatMessageTypes = 'feature' | 'object' | 'spell' | 'roll';

import type { EffectNode } from '#types/effectTree.js';

import { getRelevantNodes } from '#view/dataPreparationHelpers/effectTree/getRelevantNodes.ts';
import { createSubscriber } from 'svelte/reactivity';

// Interface for token document with actor
interface TokenWithActor {
	actor?: Actor | null;
}

// Interface for chat message system data
interface ChatMessageSystemData {
	targets?: string[];
	isCritical?: boolean;
	isMiss?: boolean;
	activation?: {
		effects?: unknown[];
	};
}

class NimbleChatMessage extends ChatMessage {
	#subscribe: () => void;

	// @ts-expect-error - Override system type
	declare system: ChatMessageSystemData;

	constructor(
		data?: ChatMessage.CreateData,
		context?: foundry.abstract.Document.ConstructionContext<ChatMessage.Parent>,
	) {
		super(data, context);

		this.#subscribe = createSubscriber((update) => {
			const updateActorHook = Hooks.on('updateActor', (triggeringDocument, _, options) => {
				const opts = options as { diff?: boolean };
				if (opts.diff === false) return;

				let requiresUpdate = false;

				if (
					this.isActivationType('feature') ||
					this.isActivationType('object') ||
					this.isActivationType('spell')
				) {
					const dependentTokens = triggeringDocument?.getDependentTokens() ?? [];

					for (const token of dependentTokens) {
						if (this.system.targets?.includes(token?.uuid)) requiresUpdate = true;
					}
				}

				if (requiresUpdate) update();
			});

			const updateChatMessageHook = Hooks.on(
				'updateChatMessage',
				(triggeringDocument, _, options) => {
					const opts = options as { diff?: boolean };
					if (opts.diff === false) return;
					if (triggeringDocument._id === this.id) update();
				},
			);

			const updateUserHook = Hooks.on('updateUser', (triggeringDocument, _, options) => {
				const opts = options as { diff?: boolean };
				if (opts.diff === false) return;
				if (triggeringDocument._id === this.author?.id) update();
			});

			return () => {
				Hooks.off('updateActor', updateActorHook);
				Hooks.off('updateChatMessage', updateChatMessageHook);
				Hooks.off('updateUser', updateUserHook);
			};
		});
	}

	/** ------------------------------------------------------ */
	/**                    Type Helpers                        */
	/** ------------------------------------------------------ */
	isActivationType(type: SystemChatMessageTypes): boolean {
		return type === (this.type as SystemChatMessageTypes);
	}

	/** ------------------------------------------------------ */
	/**                       Getters                          */
	/** ------------------------------------------------------ */
	get activationCardTypes() {
		return ['feature', 'object', 'spell'];
	}

	get reactive() {
		this.#subscribe();

		return this;
	}

	get effectNodes(): EffectNode[][] {
		if (
			!this.isActivationType('feature') &&
			!this.isActivationType('object') &&
			!this.isActivationType('spell')
		)
			return [];

		const contexts: string[] = [];

		if (this.system.isCritical) contexts.push('criticalHit', 'hit');
		else if (this.system.isMiss) contexts.push('miss');
		else contexts.push('hit');

		const effects = (this.system.activation?.effects || []) as EffectNode[];
		const nodes = getRelevantNodes(effects, contexts);
		return nodes;
	}

	/** ------------------------------------------------------ */
	/**                     Data Prep                          */
	/** ------------------------------------------------------ */
	override prepareDerivedData() {
		super.prepareDerivedData();
	}

	async addSelectedTokensAsTargets() {
		if (!this.activationCardTypes.includes(this.type)) {
			ui.notifications.warn('Cannot open a target management window for this message type.');
			return;
		}

		const selectedTokens = canvas.tokens?.controlled ?? [];

		if (!selectedTokens.length) {
			ui.notifications.error('No tokens selected');
			return;
		}

		return this.#addTargets(selectedTokens);
	}

	async addTargetedTokensAsTargets() {
		if (!this.activationCardTypes.includes(this.type)) {
			ui.notifications.warn('Cannot open a target management window for this message type.');
			return;
		}

		const targetedTokens = Array.from(game.user.targets) ?? [];

		if (!targetedTokens.length) {
			ui.notifications.error('No tokens targeted');
			return;
		}

		return this.#addTargets(targetedTokens);
	}

	async #addTargets(newTargets: Token[]): Promise<this | undefined> {
		const existingTargets = this.system.targets || [];
		const targets = new Set([
			...existingTargets,
			...newTargets.map((token) => token.document.uuid),
		]);

		return this.update({ 'system.targets': [...targets] } as Record<string, unknown>);
	}

	async applyDamage(value: number, _options?: Record<string, unknown>): Promise<void> {
		const targets = this.system.targets || [];

		targets.forEach((uuid) => {
			const token = fromUuidSync(
				uuid as `Scene.${string}.Token.${string}`,
			) as TokenWithActor | null;
			if (!token) return;

			const actor = token.actor;
			if (!actor) return;

			console.log(actor);
			console.log(value);
			// actor.applyDamage(value, options);
		});
	}

	async removeTarget(targetId: string): Promise<this | undefined> {
		if (!this.activationCardTypes.includes(this.type)) {
			ui.notifications.warn('Cannot open a target management window for this message type.');
			return;
		}

		const existingTargets = this.system.targets || [];
		const targets = existingTargets.filter((id) => id !== targetId);

		return this.update({ 'system.targets': targets } as Record<string, unknown>);
	}
}

export { NimbleChatMessage };
