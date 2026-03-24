export type SystemChatMessageTypes = Exclude<foundry.documents.BaseChatMessage.SubType, 'base'>;

import { createSubscriber } from 'svelte/reactivity';
import type { DamageOutcomeNode, EffectNode } from '#types/effectTree.js';
import { getRelevantNodes } from '#view/dataPreparationHelpers/effectTree/getRelevantNodes.ts';
import type { DamageRoll } from '../dice/DamageRoll.js';

/** Types for activation cards that have targets and effects */
type ActivationCardTypes = 'feature' | 'minionGroupAttack' | 'object' | 'reaction' | 'spell';

/** Record of applied healing for undo functionality */
export interface AppliedHealingRecord {
	effectId: string;
	healingType: string;
	amount: number;
	targets: Array<{
		uuid: string;
		tokenName: string;
		previousHp: number;
		previousTempHp: number;
		newHp: number;
		newTempHp: number;
	}>;
	appliedAt: number;
}

/** System data for activation cards */
interface ActivationCardSystemData {
	targets: string[];
	isCritical: boolean;
	isMiss: boolean;
	activation?: {
		effects: unknown[];
		[key: string]: unknown;
	};
	appliedHealing?: Record<string, AppliedHealingRecord>;
	[key: string]: unknown;
}

type DamageApplyOutcome = DamageOutcomeNode['outcome'] | 'noDamage';

type DamageApplyOptions = {
	ignoreArmor?: boolean;
	outcome?: DamageApplyOutcome;
	roll?: DamageRoll.SerializedData | null;
	rolls?: Array<DamageRoll.SerializedData | null | undefined>;
	isCritical?: boolean;
};

function getActorArmorType(actor: Actor.Implementation): 'none' | 'medium' | 'heavy' {
	const armor = foundry.utils.getProperty(actor, 'system.attributes.armor');
	if (armor === 'medium' || armor === 'heavy') return armor;
	return 'none';
}

function getDamageRollTotal(serializedRoll: DamageRoll.SerializedData): number {
	const total = Number(serializedRoll.total ?? 0);
	if (!Number.isFinite(total) || total <= 0) return 0;
	return Math.floor(total);
}

function getSerializedDamageRolls(
	options: DamageApplyOptions | undefined,
): DamageRoll.SerializedData[] {
	const serializedRolls =
		options?.rolls?.filter((roll): roll is DamageRoll.SerializedData => roll != null) ?? [];
	if (options?.roll) serializedRolls.push(options.roll);
	return serializedRolls;
}

function getDiceDamageTotal(serializedRoll: DamageRoll.SerializedData): number | null {
	let diceDamage = 0;
	let hasDiceTerm = false;

	if (!Array.isArray(serializedRoll.terms)) return null;

	for (const term of serializedRoll.terms) {
		if (term instanceof foundry.dice.terms.Die) {
			hasDiceTerm = true;
			for (const result of term.results) {
				if (result.active === false || result.discarded === true) continue;
				diceDamage += result.result;
			}
			continue;
		}

		const serializedTerm = term as { faces?: unknown; results?: unknown };
		const faces = Number(serializedTerm.faces);
		if (!Number.isFinite(faces) || faces <= 0) continue;

		hasDiceTerm = true;

		if (!Array.isArray(serializedTerm.results)) continue;
		for (const result of serializedTerm.results) {
			const serializedResult = result as {
				result?: unknown;
				active?: unknown;
				discarded?: unknown;
			};
			if (serializedResult.active === false || serializedResult.discarded === true) continue;

			const resultValue = Number(serializedResult.result);
			if (!Number.isFinite(resultValue)) continue;
			diceDamage += resultValue;
		}
	}

	if (!hasDiceTerm) return null;

	const excludedPrimaryDieValue = Number(serializedRoll.excludedPrimaryDieValue ?? 0);
	if (Number.isFinite(excludedPrimaryDieValue) && excludedPrimaryDieValue > 0) {
		diceDamage -= excludedPrimaryDieValue;
	}

	return Math.max(0, Math.floor(diceDamage));
}

function resolveArmorAdjustedDamage(params: {
	actor: Actor.Implementation;
	damage: number;
	options?: DamageApplyOptions;
}): number {
	const armorType = getActorArmorType(params.actor);
	if (armorType === 'none') return params.damage;

	const damageOptions = params.options;
	if (damageOptions?.ignoreArmor === true) return params.damage;
	const serializedRolls = getSerializedDamageRolls(damageOptions);
	const applyOutcomeHalfDamage = damageOptions?.outcome === 'halfDamage';
	const applyHeavyArmor = armorType === 'heavy';

	if (serializedRolls.length < 1) {
		if (damageOptions?.isCritical === true) {
			if (applyOutcomeHalfDamage) return Math.ceil(params.damage * 0.5);
			return params.damage;
		}

		// Without roll metadata, the incoming value already includes outcome scaling.
		// In this fallback, only apply armor reduction.
		if (applyHeavyArmor) return Math.ceil(params.damage * 0.5);
		return params.damage;
	}

	let totalAdjustedDamage = 0;
	for (const serializedRoll of serializedRolls) {
		const rollTotal = getDamageRollTotal(serializedRoll);
		const isCritical = serializedRoll.isCritical === true;

		if (isCritical) {
			const critAdjustedDamage = applyOutcomeHalfDamage ? Math.ceil(rollTotal * 0.5) : rollTotal;
			totalAdjustedDamage += critAdjustedDamage;
			continue;
		}

		const diceDamage = getDiceDamageTotal(serializedRoll) ?? rollTotal;
		let adjustedDamage = diceDamage;
		if (applyOutcomeHalfDamage) adjustedDamage = Math.ceil(adjustedDamage * 0.5);
		if (applyHeavyArmor) adjustedDamage = Math.ceil(adjustedDamage * 0.5);
		totalAdjustedDamage += adjustedDamage;
	}

	return Math.max(0, Math.floor(totalAdjustedDamage));
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

	isMinionGroupAttackCard(): boolean {
		if (this.type === 'minionGroupAttack') return true;
		const messageType = this.type as string;
		if (messageType !== 'base') return false;

		const nimbleChatCardType = (
			this as unknown as {
				flags?: {
					nimble?: { chatCardType?: string };
				};
			}
		).flags?.nimble?.chatCardType;
		return nimbleChatCardType === 'minionGroupAttack';
	}

	/** Check if this chat message is an activation card type (feature, object, or spell) */
	isActivationCard(): this is NimbleChatMessage & { system: ActivationCardSystemData } {
		return (
			(this.activationCardTypes as string[]).includes(this.type) || this.isMinionGroupAttackCard()
		);
	}

	/** ------------------------------------------------------ */
	/**                       Getters                          */
	/** ------------------------------------------------------ */
	get activationCardTypes(): ActivationCardTypes[] {
		return ['feature', 'minionGroupAttack', 'object', 'reaction', 'spell'];
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

		const effects = ((systemData.activation?.effects as EffectNode[] | undefined) ??
			[]) as EffectNode[];
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

	async applyDamage(value: number, options?: DamageApplyOptions): Promise<void> {
		if (!this.isActivationCard()) return;
		if (!game.user?.isGM) return;

		if (options?.outcome === 'noDamage') {
			ui.notifications?.info(game.i18n.localize('NIMBLE.chat.noDamageToApply'));
			return;
		}

		const damage = Math.floor(Math.abs(Number(value)));
		if (!Number.isFinite(damage) || damage <= 0) return;

		const systemData = this.system as ActivationCardSystemData;
		const targets = systemData.targets || [];

		if (!targets.length) {
			ui.notifications?.warn(game.i18n.localize('NIMBLE.chat.noTargetsSelected'));
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

			const adjustedDamage = resolveArmorAdjustedDamage({ actor, damage, options });
			if (!Number.isFinite(adjustedDamage) || adjustedDamage <= 0) continue;

			const currentTemp = typeof hpData?.temp === 'number' ? hpData.temp : 0;
			const absorbedByTemp = Math.min(currentTemp, adjustedDamage);
			const nextTemp = currentTemp - absorbedByTemp;
			const remainingDamage = adjustedDamage - absorbedByTemp;
			const nextHp = Math.max(currentHp - remainingDamage, 0);

			const updates: Record<string, unknown> = {};
			if (nextTemp !== currentTemp) updates['system.attributes.hp.temp'] = nextTemp;
			if (nextHp !== currentHp) updates['system.attributes.hp.value'] = nextHp;

			if (Object.keys(updates).length > 0) {
				await actor.update(updates as Actor.UpdateData);
			}
		}
	}

	async applyHealing(value: number, healingType?: string, effectId?: string): Promise<void> {
		if (!this.isActivationCard()) return;

		const healing = Math.floor(Math.abs(Number(value)));
		if (!Number.isFinite(healing) || healing <= 0) return;

		const systemData = this.system as ActivationCardSystemData;
		const targets = systemData.targets || [];

		if (!targets.length) {
			ui.notifications?.warn(game.i18n.localize('NIMBLE.chat.noTargetsSelected'));
			return;
		}

		// Check if already applied for this effect
		if (effectId && this.isHealingApplied(effectId)) {
			ui.notifications?.warn(game.i18n.localize('NIMBLE.chat.healingAlreadyApplied'));
			return;
		}

		const healingRecord: AppliedHealingRecord = {
			effectId: effectId || `healing-${Date.now()}`,
			healingType: healingType || 'healing',
			amount: healing,
			targets: [],
			appliedAt: Date.now(),
		};

		for (const uuid of targets) {
			const tokenDocument = fromUuidSync(uuid) as TokenDocument | null;
			const actor = tokenDocument?.actor as
				| (Actor.Implementation & {
						applyHealing?: (healing: number, healingType?: string) => Promise<void>;
				  })
				| null;
			if (!actor) continue;

			// Get current HP values before healing
			const hpData = foundry.utils.getProperty(actor, 'system.attributes.hp') as
				| { value?: number; temp?: number; max?: number }
				| undefined;
			const previousHp = typeof hpData?.value === 'number' ? hpData.value : 0;
			const previousTempHp = typeof hpData?.temp === 'number' ? hpData.temp : 0;

			if (actor.applyHealing) {
				await actor.applyHealing(healing, healingType);
			}

			// Get new HP values after healing
			const newHpData = foundry.utils.getProperty(actor, 'system.attributes.hp') as
				| { value?: number; temp?: number }
				| undefined;
			const newHp = typeof newHpData?.value === 'number' ? newHpData.value : previousHp;
			const newTempHp = typeof newHpData?.temp === 'number' ? newHpData.temp : previousTempHp;

			healingRecord.targets.push({
				uuid,
				tokenName: tokenDocument?.name || 'Unknown',
				previousHp,
				previousTempHp,
				newHp,
				newTempHp,
			});
		}

		// Store the healing record on the message
		if (effectId) {
			const appliedHealing = { ...(systemData.appliedHealing || {}) };
			appliedHealing[effectId] = healingRecord;

			await this.update({
				'system.appliedHealing': appliedHealing,
			} as Record<string, unknown>);
		}
	}

	/**
	 * Reverts previously applied healing by restoring HP to the snapshot taken at apply time.
	 * Note: This is snapshot-based - if something else modified HP between apply and undo,
	 * those changes will be silently overwritten when reverting to the previous values.
	 */
	async undoHealing(effectId: string): Promise<void> {
		if (!this.isActivationCard()) return;

		const systemData = this.system as ActivationCardSystemData;
		const healingRecord = systemData.appliedHealing?.[effectId];

		if (!healingRecord) {
			ui.notifications?.warn(game.i18n.localize('NIMBLE.chat.noHealingRecord'));
			return;
		}

		// Revert HP for each target
		for (const targetRecord of healingRecord.targets) {
			const tokenDocument = fromUuidSync(targetRecord.uuid) as TokenDocument | null;
			const actor = tokenDocument?.actor as Actor.Implementation | null;
			if (!actor) continue;

			const updates: Record<string, unknown> = {};

			if (healingRecord.healingType === 'tempHealing') {
				// Revert temp HP
				updates['system.attributes.hp.temp'] = targetRecord.previousTempHp;
			} else {
				// Revert regular HP
				updates['system.attributes.hp.value'] = targetRecord.previousHp;
			}

			if (Object.keys(updates).length > 0) {
				await actor.update(updates as Actor.UpdateData);
			}
		}

		// Remove the healing record from the message using Foundry's delete syntax
		await this.update({
			[`system.appliedHealing.-=${effectId}`]: null,
		} as Record<string, unknown>);

		ui.notifications?.info(game.i18n.localize('NIMBLE.chat.healingUndone'));
	}

	isHealingApplied(effectId: string): boolean {
		if (!this.isActivationCard()) return false;
		const systemData = this.system as ActivationCardSystemData;
		return !!systemData.appliedHealing?.[effectId];
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
