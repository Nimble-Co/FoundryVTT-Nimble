export type SystemChatMessageTypes = Exclude<foundry.documents.BaseChatMessage.SubType, 'base'>;

import { createSubscriber } from 'svelte/reactivity';
import type { DamageOutcomeNode, EffectNode } from '#types/effectTree.js';
import localize from '#utils/localize.ts';
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

type HpMutableActor = Actor.Implementation &
	Pick<NimbleBaseActorInterface, 'applyDamage' | 'applyHealing' | 'setCurrentHP' | 'setTempHP'>;

type DamageApplyOutcome = DamageOutcomeNode['outcome'] | 'noDamage';

type DamageApplyOptions = {
	ignoreArmor?: boolean;
	outcome?: DamageApplyOutcome;
	roll?: DamageRoll.SerializedData | null;
	rolls?: Array<DamageRoll.SerializedData | null | undefined>;
	isCritical?: boolean;
};

interface DamageApplicationTarget {
	actor: HpMutableActor;
	adjustedDamage: number;
}

interface DamageApplicationPlan {
	hasTargets: boolean;
	applicableTargets: DamageApplicationTarget[];
	zeroDamageTargetNames: string[];
}

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

function getNegativeModifierTotal(serializedRoll: DamageRoll.SerializedData): number {
	if (!Array.isArray(serializedRoll.terms)) return 0;

	let negativeModifierTotal = 0;
	let pendingOperator: '+' | '-' = '+';

	for (const term of serializedRoll.terms) {
		const serializedTerm = term as { operator?: unknown; number?: unknown; faces?: unknown };

		if (serializedTerm.operator === '+' || serializedTerm.operator === '-') {
			pendingOperator = serializedTerm.operator;
			continue;
		}

		const faces = Number(serializedTerm.faces);
		if (Number.isFinite(faces) && faces > 0) {
			pendingOperator = '+';
			continue;
		}

		const numericValue = Number(serializedTerm.number);
		if (!Number.isFinite(numericValue)) {
			pendingOperator = '+';
			continue;
		}

		let signedModifier = numericValue;
		if (pendingOperator === '-') signedModifier = -signedModifier;
		if (signedModifier < 0) negativeModifierTotal += signedModifier;
		pendingOperator = '+';
	}

	return Math.floor(negativeModifierTotal);
}

function calculateArmorAdjustedDamage(params: {
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
		const negativeModifierTotal = getNegativeModifierTotal(serializedRoll);
		let adjustedDamage = diceDamage;
		if (applyOutcomeHalfDamage) adjustedDamage = Math.ceil(adjustedDamage * 0.5);
		if (applyHeavyArmor) adjustedDamage = Math.ceil(adjustedDamage * 0.5);
		adjustedDamage += negativeModifierTotal;
		totalAdjustedDamage += adjustedDamage;
	}

	return Math.max(0, Math.floor(totalAdjustedDamage));
}

function buildDamageApplicationPlan(params: {
	targets: string[];
	damage: number;
	options?: DamageApplyOptions;
}): DamageApplicationPlan {
	const applicableTargets: DamageApplicationTarget[] = [];
	const zeroDamageTargetNames = new Set<string>();

	for (const uuid of params.targets) {
		const tokenDocument = fromUuidSync(uuid) as TokenDocument | null;
		const actor = tokenDocument?.actor as HpMutableActor | null;
		if (!actor) continue;
		const adjustedDamage = calculateArmorAdjustedDamage({
			actor,
			damage: params.damage,
			options: params.options,
		});

		if (!Number.isFinite(adjustedDamage) || adjustedDamage <= 0) {
			zeroDamageTargetNames.add(
				tokenDocument?.name || actor.name || localize('NIMBLE.ui.heroicActions.unknown'),
			);
			continue;
		}

		applicableTargets.push({
			actor,
			adjustedDamage,
		});
	}

	return {
		hasTargets: params.targets.length > 0,
		applicableTargets,
		zeroDamageTargetNames: [...zeroDamageTargetNames],
	};
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
		return this.type === 'minionGroupAttack';
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

		// Let rules on the speaker actor contribute nodes to the card. Each rule
		// decides independently what (if anything) to surface — chat card rendering
		// stays rule-type-agnostic.
		const ruleNodes = this.#collectRuleActivationCardNodes({
			isCritical: systemData.isCritical,
			isMiss: systemData.isMiss,
		});
		if (ruleNodes.length > 0) {
			nodes.push(ruleNodes);
		}

		return nodes;
	}

	#collectRuleActivationCardNodes(context: { isCritical: boolean; isMiss: boolean }): EffectNode[] {
		const actorId = this.speaker?.actor;
		const actor = actorId ? game.actors?.get(actorId) : null;
		const rules = (
			actor as unknown as {
				rules?: Array<{ getActivationCardNodes?: (ctx: typeof context) => EffectNode[] }>;
			} | null
		)?.rules;
		if (!rules || rules.length === 0) return [];

		const contributed: EffectNode[] = [];
		for (const rule of rules) {
			contributed.push(...(rule.getActivationCardNodes?.(context) ?? []));
		}
		return contributed;
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
			ui.notifications?.info(localize('NIMBLE.chat.noDamageToApply'));
			return;
		}

		const damage = Math.floor(Number(value));
		if (!Number.isFinite(damage) || damage <= 0) {
			ui.notifications?.info(localize('NIMBLE.chat.noDamageToApply'));
			return;
		}

		const systemData = this.system as ActivationCardSystemData;
		const targets = systemData.targets || [];
		const damageApplicationPlan = buildDamageApplicationPlan({ targets, damage, options });
		if (!damageApplicationPlan.hasTargets) {
			ui.notifications?.warn(localize('NIMBLE.chat.noTargetsSelected'));
			return;
		}

		if (damageApplicationPlan.applicableTargets.length < 1) {
			ui.notifications?.info(localize('NIMBLE.chat.noDamageToApply'));
			return;
		}

		const sourceActorId = this.speaker?.actor;
		const sourceActor = sourceActorId ? (game.actors?.get(sourceActorId) ?? null) : null;
		const sourceItemId = (this.flags as Record<string, { itemId?: string } | undefined>)?.nimble
			?.itemId;
		const sourceItem = sourceItemId ? (sourceActor?.items?.get(sourceItemId) ?? null) : null;

		for (const target of damageApplicationPlan.applicableTargets) {
			await target.actor.applyDamage(target.adjustedDamage);
			// @ts-expect-error - nimble.damageApplied is a custom Nimble hook consumed by ruleEventDispatch
			Hooks.callAll('nimble.damageApplied', {
				sourceItem,
				sourceActor,
				targetActor: target.actor,
				card: this,
				isCritical: systemData.isCritical,
				isMiss: systemData.isMiss,
			});
		}

		for (const tokenName of damageApplicationPlan.zeroDamageTargetNames) {
			ui.notifications?.info(
				localize('NIMBLE.chat.targetSkippedZeroDamage', {
					tokenName,
				}),
			);
		}
	}

	canApplyDamage(value: number, options?: DamageApplyOptions): boolean {
		if (!this.isActivationCard()) return false;
		if (options?.outcome === 'noDamage') return false;

		const damage = Math.floor(Number(value));
		if (!Number.isFinite(damage) || damage <= 0) return false;

		const targets = (this.system as ActivationCardSystemData).targets || [];
		const damageApplicationPlan = buildDamageApplicationPlan({ targets, damage, options });
		if (!damageApplicationPlan.hasTargets) return true;
		return damageApplicationPlan.applicableTargets.length > 0;
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
			const actor = tokenDocument?.actor as HpMutableActor | null;
			if (!actor) continue;

			// Get current HP values before healing
			const hpData = foundry.utils.getProperty(actor, 'system.attributes.hp') as
				| { value?: number; temp?: number; max?: number }
				| undefined;
			const previousHp = typeof hpData?.value === 'number' ? hpData.value : 0;
			const previousTempHp = typeof hpData?.temp === 'number' ? hpData.temp : 0;

			await actor.applyHealing(healing, healingType);

			// Get new HP values after healing
			const newHpData = foundry.utils.getProperty(actor, 'system.attributes.hp') as
				| { value?: number; temp?: number }
				| undefined;
			const newHp = typeof newHpData?.value === 'number' ? newHpData.value : previousHp;
			const newTempHp = typeof newHpData?.temp === 'number' ? newHpData.temp : previousTempHp;

			healingRecord.targets.push({
				uuid,
				tokenName: tokenDocument?.name || localize('NIMBLE.ui.heroicActions.unknown'),
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
			const actor = tokenDocument?.actor as HpMutableActor | null;
			if (!actor) continue;

			if (healingRecord.healingType === 'tempHealing') {
				await actor.setTempHP(targetRecord.previousTempHp);
			} else {
				await actor.setCurrentHP(targetRecord.previousHp);
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
