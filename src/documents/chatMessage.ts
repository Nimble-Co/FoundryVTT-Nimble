export type SystemChatMessageTypes = Exclude<foundry.documents.BaseChatMessage.TypeNames, 'base'>;

import { createSubscriber } from 'svelte/reactivity';
import type { EffectNode } from '#types/effectTree.js';
import { getRelevantNodes } from '#view/dataPreparationHelpers/effectTree/getRelevantNodes.ts';

interface NimbleChatMessage<
	ChatMessageType extends SystemChatMessageTypes = SystemChatMessageTypes,
> {
	type: ChatMessageType;
	system: DataModelConfig['ChatMessage'][ChatMessageType];
}

class NimbleChatMessage extends ChatMessage {
	#dialogs;

	#subscribe;

	constructor(data, context) {
		super(data, context);

		this.#dialogs = [];

		this.#subscribe = createSubscriber((update) => {
			const updateActorHook = Hooks.on('updateActor', (triggeringDocument, _, { diff }) => {
				if (diff === false) return;

				let requiresUpdate = false;

				if (this.isType('feature') || this.isType('object') || this.isType('spell')) {
					const dependentTokens = triggeringDocument?.getDependentTokens() ?? [];

					for (const token of dependentTokens) {
						if (this.system.targets?.includes(token?.uuid)) requiresUpdate = true;
					}
				}

				if (requiresUpdate) update();
			});

			const updateChatMessageHook = Hooks.on(
				'updateChatMessage',
				(triggeringDocument, _, { diff }) => {
					if (diff === false) return;
					if (triggeringDocument._id === this.id) update();
				},
			);

			const updateUserHook = Hooks.on('updateUser', (triggeringDocument, _, { diff }) => {
				if (diff === false) return;
				if (triggeringDocument._id === this.author.id) update();
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
	isType<TypeName extends SystemChatMessageTypes>(
		type: TypeName,
	): this is NimbleChatMessage<TypeName> {
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
		if (!this.isType('feature') && !this.isType('object') && !this.isType('spell')) return [];

		const contexts: string[] = [];

		if (this.system.isCritical) contexts.push('criticalHit', 'hit');
		else if (this.system.isMiss) contexts.push('miss');
		else contexts.push('hit');

		const effects = this.system.activation.effects || [];
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

	async #addTargets(newTargets) {
		const existingTargets = this.system.targets || [];
		const targets = new Set([
			...existingTargets,
			...newTargets.map((token) => token.document.uuid),
		]);

		return this.update({ 'system.targets': [...targets] });
	}

	async applyDamage(value, options) {
		const targets = this.system.targets || [];

		targets.forEach((uuid) => {
			const token = fromUuidSync(uuid);
			if (!token) return;

			const actor = token.actor;
			if (!actor) return;

			console.log(actor);
			console.log(value);
			// actor.applyDamage(value, options);
		});
	}

	async removeTarget(targetId) {
		if (!this.activationCardTypes.includes(this.type)) {
			ui.notifications.warn('Cannot open a target management window for this message type.');
			return;
		}

		const existingTargets = this.system.targets || [];
		const targets = existingTargets.filter((id) => id !== targetId);

		this.update({ 'system.targets': targets });
	}
}

export { NimbleChatMessage };
