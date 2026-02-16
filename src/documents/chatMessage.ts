export type SystemChatMessageTypes = Exclude<foundry.documents.BaseChatMessage.SubType, 'base'>;

import { createSubscriber } from 'svelte/reactivity';
import type { EffectNode } from '#types/effectTree.js';
import { getRelevantNodes } from '#view/dataPreparationHelpers/effectTree/getRelevantNodes.ts';

/** Types for activation cards that have targets and effects */
type ActivationCardTypes = 'feature' | 'object' | 'spell';

/** System data for activation cards */
interface ActivationCardSystemData {
	targets: string[];
	isCritical: boolean;
	isMiss: boolean;
	activation: {
		effects: unknown[];
		[key: string]: unknown;
	};
	[key: string]: unknown;
}

class NimbleChatMessage extends ChatMessage {
	declare type: SystemChatMessageTypes;

	#subscribe: ReturnType<typeof createSubscriber>;

	constructor(data: ChatMessage.CreateData, context?: ChatMessage.ConstructionContext) {
		super(data, context);

		this.#subscribe = createSubscriber((update) => {
			const updateActorHook = Hooks.on('updateActor', (triggeringDocument, _change, options) => {
				if ((options as { diff?: boolean }).diff === false) return;

				let requiresUpdate = false;

				if (this.isActivationCard()) {
					const actorWithTokens = triggeringDocument as {
						getDependentTokens?(): { uuid: string }[];
					};
					const dependentTokens = actorWithTokens.getDependentTokens?.() ?? [];
					const systemData = this.system as ActivationCardSystemData;

					for (const token of dependentTokens) {
						if (systemData.targets?.includes(token.uuid)) requiresUpdate = true;
					}
				}

				if (requiresUpdate) update();
			});

			const updateChatMessageHook = Hooks.on(
				'updateChatMessage',
				(triggeringDocument, _change, options) => {
					if ((options as { diff?: boolean }).diff === false) return;
					if (triggeringDocument._id === this.id) update();
				},
			);

			const updateUserHook = Hooks.on('updateUser', (triggeringDocument, _change, options) => {
				if ((options as { diff?: boolean }).diff === false) return;
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
	isType<TypeName extends SystemChatMessageTypes>(type: TypeName): boolean {
		return type === this.type;
	}

	/** Check if this chat message is an activation card type (feature, object, or spell) */
	isActivationCard(): this is NimbleChatMessage & { system: ActivationCardSystemData } {
		return (this.activationCardTypes as string[]).includes(this.type);
	}

	/** ------------------------------------------------------ */
	/**                       Getters                          */
	/** ------------------------------------------------------ */
	get activationCardTypes(): ActivationCardTypes[] {
		return ['feature', 'object', 'spell'];
	}

	get reactive() {
		this.#subscribe();

		return this;
	}

	get effectNodes(): EffectNode[][] {
		if (!this.isActivationCard()) return [];

		const contexts: string[] = [];
		const systemData = this.system as ActivationCardSystemData;

		if (systemData.isCritical) contexts.push('criticalHit', 'hit');
		else if (systemData.isMiss) contexts.push('miss');
		else contexts.push('hit');

		const effects = (systemData.activation.effects || []) as EffectNode[];
		const nodes = getRelevantNodes(effects, contexts, {
			includeBaseDamageNodes: systemData.isMiss,
		});

		// Add a "MISS" text hint at the start if the attack missed and there isn't one already
		if (systemData.isMiss) {
			const hasMissHint = nodes.some((group) =>
				group.some(
					(node) =>
						node.type === 'note' && (node as { text?: string }).text?.toUpperCase() === 'MISS',
				),
			);

			if (!hasMissHint) {
				const missHintNode: EffectNode = {
					id: 'miss-hint',
					type: 'note',
					noteType: 'warning',
					text: 'MISS',
					parentContext: 'miss',
					parentNode: null,
				};
				// Insert as the first group
				nodes.unshift([missHintNode]);
			}
		}

		return nodes;
	}

	/** ------------------------------------------------------ */
	/**                     Data Prep                          */
	/** ------------------------------------------------------ */
	override prepareDerivedData() {
		super.prepareDerivedData();
	}

	async addSelectedTokensAsTargets(): Promise<ChatMessage | undefined> {
		if (!this.isActivationCard()) {
			ui.notifications?.warn('Cannot open a target management window for this message type.');
			return;
		}

		const selectedTokens = canvas.tokens?.controlled ?? [];

		if (!selectedTokens.length) {
			ui.notifications?.error('No tokens selected');
			return;
		}

		return this.#addTargets(selectedTokens);
	}

	async addTargetedTokensAsTargets(): Promise<ChatMessage | undefined> {
		if (!this.isActivationCard()) {
			ui.notifications?.warn('Cannot open a target management window for this message type.');
			return;
		}

		const targetedTokens = Array.from(game.user?.targets ?? []);

		if (!targetedTokens.length) {
			ui.notifications?.error('No tokens targeted');
			return;
		}

		return this.#addTargets(targetedTokens);
	}

	async #addTargets(newTargets: Token[]): Promise<ChatMessage | undefined> {
		if (!this.isActivationCard()) return;

		const systemData = this.system as ActivationCardSystemData;
		const existingTargets = systemData.targets || [];
		const targets = new Set([
			...existingTargets,
			...newTargets.map((token) => token.document.uuid),
		]);

		return this.update({
			system: { targets: [...targets] },
		} as Record<string, unknown>) as Promise<ChatMessage | undefined>;
	}

	async applyDamage(value: number, options?: Record<string, unknown>): Promise<void> {
		if (!this.isActivationCard()) return;

		if (options?.outcome === 'noDamage') {
			ui.notifications?.info('No damage to apply.');
			return;
		}

		const damage = Math.floor(Math.abs(Number(value)));
		if (!Number.isFinite(damage) || damage <= 0) return;

		const systemData = this.system as ActivationCardSystemData;
		const targets = systemData.targets || [];

		if (!targets.length) {
			ui.notifications?.warn('No targets selected');
			return;
		}

		for (const uuid of targets) {
			const tokenDocument = fromUuidSync(uuid) as TokenDocument | null;
			const actor = tokenDocument?.actor as Actor.Implementation | null;
			if (!actor) continue;

			const hpData = foundry.utils.getProperty(actor, 'system.attributes.hp') as
				| {
						value?: number;
						temp?: number;
				  }
				| undefined;
			const currentHp = hpData?.value;
			if (typeof currentHp !== 'number' || Number.isNaN(currentHp)) continue;

			const currentTemp = typeof hpData?.temp === 'number' ? hpData.temp : 0;
			const absorbedByTemp = Math.min(currentTemp, damage);
			const nextTemp = currentTemp - absorbedByTemp;
			const remainingDamage = damage - absorbedByTemp;
			const nextHp = Math.max(currentHp - remainingDamage, 0);

			const updates: Record<string, unknown> = {};
			if (nextTemp !== currentTemp) updates['system.attributes.hp.temp'] = nextTemp;
			if (nextHp !== currentHp) updates['system.attributes.hp.value'] = nextHp;

			if (Object.keys(updates).length > 0) {
				await actor.update(updates as Actor.UpdateData);
			}
		}
	}

	async removeTarget(targetId: string): Promise<ChatMessage | undefined> {
		if (!this.isActivationCard()) {
			ui.notifications?.warn('Cannot open a target management window for this message type.');
			return;
		}

		const systemData = this.system as ActivationCardSystemData;
		const existingTargets = systemData.targets || [];
		const targets = existingTargets.filter((id) => id !== targetId);

		return this.update({
			system: { targets },
		} as Record<string, unknown>) as Promise<ChatMessage | undefined>;
	}
}

export { NimbleChatMessage };
