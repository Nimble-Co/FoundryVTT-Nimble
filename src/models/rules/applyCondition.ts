import { SYSTEM_ID } from '#system';
import type { ApplyEffectNode, EffectNode, WoundNode } from '#types/effectTree.js';
import applyConditionToActor, {
	type ConditionTargetActor,
} from '#utils/actor/applyConditionToActor.js';
import {
	type AppliedEffect,
	applyEffectToActor,
	payloadFromEffect,
} from '#utils/actor/applyEffectToActor.js';
import { UNDO_APPLICATION_OPTION } from '#utils/actor/effectStacks.js';
import {
	giveWounds,
	takeBackWounds,
	type WoundRecord,
	woundsGiven,
} from '#utils/actor/giveWounds.js';
import { isEnemyAttacker } from '#utils/actor/isEnemyAttacker.js';
import { itemEffectOf } from '#utils/actor/itemEffectOf.js';
import { recordAppliedEffects } from '#utils/chat/applyEffectFromCard.js';
import { giveWoundsOnCard } from '#utils/chat/woundFromCard.js';
import {
	ATTACK_SOURCES,
	type AttackSourceFilter,
	matchesAttackSource,
} from '#utils/damage/attackDelivery.js';
import { isActiveGM } from '#utils/isActiveGM.js';
import { firesCritTriggers } from '#utils/reroll/firesCritTriggers.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import { choiceLabels } from './_rollUseRule.js';
import {
	attackOutcomeMatches,
	isAttackOutcomeTrigger,
	picksSpellCast,
	RULE_TRIGGERS,
	spellCastMatches,
} from './_triggers.js';
import { withWidget } from './_widgetOption.js';
import {
	type ActivationCardContext,
	type ActorDyingContext,
	type ActorHealthContext,
	type InitiativeRolledContext,
	type ItemActivatedContext,
	type ItemUsedContext,
	NimbleBaseRule,
	type RestContext,
	type SaveResolvedContext,
	type TurnContext,
} from './base.js';

const TRIGGER_CHOICES = RULE_TRIGGERS;

type ApplyConditionTrigger = (typeof TRIGGER_CHOICES)[number];

/** Effect flag: the save card, and the item and condition of the rule that added this effect. */
const SAVE_FAIL_SOURCE_FLAG = 'saveFailSource';

/** Save card flag: the Wounds that each rule's fail gave, so a success takes back no more. */
const SAVE_FAIL_WOUNDS_FLAG = 'saveFailWounds';

// No rule id: a rule source without one gets a new random id each time it is built.
interface SaveFailSource {
	messageId: string;
	itemUuid: string;
	condition: string;
}

interface OwnedConditionEffect {
	id?: string | null;
	getFlag?(scope: string, key: string): unknown;
}

interface ItemEffect {
	transfer?: boolean;
	toObject(): Record<string, unknown>;
}

interface EffectItem {
	effects?: { get(id: string): ItemEffect | undefined | null } | null;
}

type EffectSourceUser = Parameters<typeof payloadFromEffect>[1]['user'];
type EffectTarget = Parameters<typeof applyEffectToActor>[0];
type WoundTarget = Parameters<typeof giveWounds>[0];
type WoundCard = Parameters<typeof giveWoundsOnCard>[0];

interface ConditionOwner {
	effects?: Iterable<OwnedConditionEffect>;
	deleteEmbeddedDocuments(type: 'ActiveEffect', ids: string[], options?: object): Promise<unknown>;
}

interface SaveCard {
	flags?: Record<string, unknown>;
	update(data: Record<string, unknown>): Promise<unknown>;
}

/** The triggers that come from an attack, whose source the rule can limit. */
function picksAttack(trigger: string): boolean {
	return isAttackOutcomeTrigger(trigger) || trigger === 'onCritReceived';
}

function schema() {
	const { fields } = foundry.data;

	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'applyCondition' }),
		condition: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: 'NIMBLE.rules.applyCondition.condition.label',
			hint: 'NIMBLE.rules.applyCondition.condition.hint',
			// The object form makes the select render "Soul Burned" instead of the raw
			// `soul_burned` id, matching conditionImmunity and markTarget.
			choices: () => CONFIG.NIMBLE.conditions,
		}),
		trigger: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'onCrit',
			label: 'NIMBLE.rules.applyCondition.trigger.label',
			hint: 'NIMBLE.rules.applyCondition.trigger.hint',
			// The same triggers, and words, as Use an item for free.
			choices: choiceLabels('useItemFree', 'triggers', TRIGGER_CHOICES),
		}),
		effectId: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				blank: true,
				initial: '',
				label: 'NIMBLE.rules.applyCondition.effectId.label',
				hint: 'NIMBLE.rules.applyCondition.effectId.hint',
				widget: 'itemEffectPicker',
				recipient: (data: Record<string, unknown>): 'self' | 'targets' =>
					isAttackOutcomeTrigger(String(data.trigger ?? 'onCrit')) ? 'targets' : 'self',
			}),
		),
		wounds: new fields.NumberField({
			required: true,
			nullable: false,
			integer: true,
			min: 0,
			initial: 0,
			label: 'NIMBLE.rules.applyCondition.wounds.label',
			hint: 'NIMBLE.rules.applyCondition.wounds.hint',
		}),
		attackSource: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: 'any',
				choices: choiceLabels('attackOutcome', 'attackSource', ATTACK_SOURCES),
				label: 'NIMBLE.rules.applyCondition.attackSource.label',
				hint: 'NIMBLE.rules.applyCondition.attackSource.hint',
				showWhen: (data: Record<string, unknown>) => picksAttack(String(data.trigger ?? 'onCrit')),
			}),
		),
		manaAtLeast: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				integer: true,
				min: 0,
				initial: 0,
				label: 'NIMBLE.rules.useItemFree.manaAtLeast.label',
				hint: 'NIMBLE.rules.useItemFree.manaAtLeast.hint',
				showWhen: picksSpellCast,
			}),
		),
	};
}

declare namespace ApplyConditionRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class ApplyConditionRule extends NimbleBaseRule<ApplyConditionRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.applyCondition.description';
	static override icon = 'fa-solid fa-bolt-lightning';
	// A success takes back the condition of a fail, also with Feature Effects off.
	static override alwaysDispatchedEvents: readonly (keyof NimbleBaseRule)[] = ['onSaveResolved'];

	declare condition: string;
	declare trigger: ApplyConditionTrigger;
	declare effectId: string;
	declare wounds: number;
	declare attackSource: AttackSourceFilter;

	declare manaAtLeast: number;

	static override defineSchema(): ApplyConditionRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['condition', 'string'],
				[
					'trigger',
					TRIGGER_CHOICES.map((t) => `'${t}'`).join(
						' <span class="nimble-type-summary__operator">|</span> ',
					),
				],
				['effectId', 'string'],
				['wounds', 'number'],
				['attackSource', 'string'],
				['manaAtLeast', 'number'],
			]),
		);
	}

	override async onItemUsed(context: ItemUsedContext): Promise<void> {
		if (!this.#shouldFireOnItemUsed(context)) return;
		const targetActor = context.targetActor as unknown as ConditionTargetActor | null;
		if (!targetActor) return;
		await this.#applyConditionTo(targetActor, undefined, context.card as unknown as WoundCard);
	}

	override getActivationCardNodes(context: ActivationCardContext): EffectNode[] {
		if (!this.#isAttackTrigger()) return [];
		if (!this.#matchesAttackContext(context)) return [];
		if (!this.#matchesSource(context.sourceItem)) return [];
		const effect = this.#itemEffect();
		const nodes: EffectNode[] = [];
		if (effect || this.condition) {
			const node: ApplyEffectNode = {
				id: this.#effectNodeId(),
				type: 'applyEffect',
				effectId: effect ? this.effectId : null,
				effectItemUuid: effect ? (this.item?.uuid ?? null) : null,
				condition: this.condition || null,
				recipient: 'targets',
				parentContext: null,
				parentNode: null,
			};
			nodes.push(node);
		}
		if (this.wounds > 0) {
			const node: WoundNode = {
				id: this.#woundNodeId(),
				type: 'wound',
				amount: this.wounds,
				recipient: 'targets',
				parentContext: null,
				parentNode: null,
			};
			nodes.push(node);
		}
		return nodes;
	}

	#woundNodeId(): string {
		return `wound-${this.id}`;
	}

	#effectNodeId(): string {
		return `apply-condition-${this.id}`;
	}

	override async onItemActivated(context: ItemActivatedContext): Promise<void> {
		if (this.trigger !== 'onSpellCast') return;
		if (context.sourceActor !== this.actor) return;
		if (!spellCastMatches(context.sourceItem, context.manaSpent, this.manaAtLeast)) return;
		await this.#applyConditionToSelf();
	}

	override async onAttackReceived(context: ItemUsedContext): Promise<void> {
		if (this.trigger !== 'onCritReceived') return;
		if (context.targetActor !== this.actor) return;
		if (!firesCritTriggers(context)) return;
		if (!isEnemyAttacker(context.sourceActor, this.actor, context.card)) return;
		if (!this.#matchesSource(context.sourceItem)) return;
		await this.#applyConditionToSelf();
	}

	// onActorDying reaches every client.
	override async onActorDying(context: ActorDyingContext): Promise<void> {
		if (this.trigger !== 'onDying') return;
		if (context.actor !== this.actor || !isActiveGM()) return;
		await this.#applyConditionToSelf();
	}

	override async onTurnStart(context: TurnContext): Promise<void> {
		if (this.trigger !== 'onTurnStart') return;
		if (context.actor !== this.actor) return;
		await this.#applyConditionToSelf();
	}

	override async onTurnEnd(context: TurnContext): Promise<void> {
		if (this.trigger !== 'onTurnEnd') return;
		if (context.actor !== this.actor) return;
		await this.#applyConditionToSelf();
	}

	override async onActorKilled(context: ActorHealthContext): Promise<void> {
		if (this.trigger !== 'onKill') return;
		if (context.actor !== this.actor) return;
		await this.#applyConditionToSelf();
	}

	override async onActorWounded(context: ActorHealthContext): Promise<void> {
		if (this.trigger !== 'onWound') return;
		if (context.actor !== this.actor) return;
		await this.#applyConditionToSelf();
	}

	override async onSaveResolved(context: SaveResolvedContext): Promise<void> {
		if (this.trigger !== 'onSaveFail') return;
		if (context.actor !== this.actor) return;
		if (context.outcome === 'fail') {
			if (!isRuleAutomationEnabled()) return;
			const source: SaveFailSource = {
				messageId: context.messageId,
				itemUuid: this.parentDocument.uuid ?? '',
				condition: this.condition,
			};
			const wounds = await this.#applyConditionToSelf(
				{ [SAVE_FAIL_SOURCE_FLAG]: source },
				context.messageId,
			);
			await this.#recordSaveFailWounds(context.messageId, woundsGiven(wounds));
			return;
		}
		await this.#removeConditionFromSaveCard(context.messageId);
		await this.#takeBackSaveFailWounds(context.messageId);
	}

	override async onRest(context: RestContext): Promise<void> {
		if (this.trigger !== 'onRest') return;
		if (context.actor !== this.actor) return;
		await this.#applyConditionToSelf();
	}

	override async onInitiativeRolled(context: InitiativeRolledContext): Promise<void> {
		if (this.trigger !== 'onInitiative') return;
		if (context.actor !== this.actor) return;
		await this.#applyConditionToSelf();
	}

	#shouldFireOnItemUsed(context: ItemUsedContext): boolean {
		if (!this.test()) return false;
		if (context.sourceActor !== this.actor) return false;
		if (!this.#matchesSource(context.sourceItem)) return false;
		return this.#matchesAttackContext(context);
	}

	#matchesSource(item: { type?: string } | null | undefined): boolean {
		return matchesAttackSource(this.attackSource ?? 'any', item);
	}

	#matchesAttackContext(context: { isCritical: boolean; isMiss: boolean }): boolean {
		return attackOutcomeMatches(this.trigger, context);
	}

	#isAttackTrigger(): boolean {
		return isAttackOutcomeTrigger(this.trigger);
	}

	async #applyConditionToSelf(
		systemFlags?: Record<string, unknown>,
		cardId?: string | null,
	): Promise<WoundRecord | null> {
		if (!this.test()) return null;
		const selfActor = this.actor as unknown as ConditionTargetActor | null;
		if (!selfActor) return null;
		return this.#applyConditionTo(selfActor, systemFlags, null, cardId);
	}

	/** The save card's key for this rule: its item and condition, as the rule id is not stable. */
	#saveFailWoundsPath(): string {
		const key = `${this.parentDocument.uuid ?? ''}_${this.condition || 'none'}`.replaceAll(
			'.',
			'_',
		);
		return `flags.${SYSTEM_ID}.${SAVE_FAIL_WOUNDS_FLAG}.${key}`;
	}

	#saveCard(messageId: string): SaveCard | null {
		return (game.messages?.get(messageId) as unknown as SaveCard | undefined) ?? null;
	}

	async #recordSaveFailWounds(messageId: string, given: number): Promise<void> {
		const card = given > 0 ? this.#saveCard(messageId) : null;
		if (!card) return;
		const path = this.#saveFailWoundsPath();
		const before = Number(foundry.utils.getProperty(card, path)) || 0;
		await card.update({ [path]: before + given });
	}

	async #takeBackSaveFailWounds(messageId: string): Promise<void> {
		const card = this.#saveCard(messageId);
		const path = this.#saveFailWoundsPath();
		const given = Number(card ? foundry.utils.getProperty(card, path) : 0) || 0;
		if (!card || !(given > 0)) return;
		await card.update({ [path]: 0 });
		await takeBackWounds(this.actor as unknown as WoundTarget, given);
	}

	// No predicate test: this takes back an effect of a result that no longer stands.
	async #removeConditionFromSaveCard(messageId: string): Promise<void> {
		const owner = this.actor as unknown as ConditionOwner | null;
		if (!owner) return;

		const ids: string[] = [];
		for (const effect of owner.effects ?? []) {
			const source = effect.getFlag?.(SYSTEM_ID, SAVE_FAIL_SOURCE_FLAG) as
				| SaveFailSource
				| undefined;
			if (
				effect.id &&
				source?.messageId === messageId &&
				source.itemUuid === this.parentDocument.uuid &&
				source.condition === this.condition
			) {
				ids.push(effect.id);
			}
		}
		if (ids.length > 0) {
			await owner.deleteEmbeddedDocuments('ActiveEffect', ids, { [UNDO_APPLICATION_OPTION]: true });
		}
	}

	#itemEffect(): ItemEffect | null {
		return itemEffectOf(this.item as unknown as EffectItem | null, this.effectId);
	}

	/**
	 * The condition or the effect, then the Wounds. With a card, the card records the Wounds and
	 * who took the effect, as its Apply Effect step for this rule does.
	 * The lines of the effect go on `card`, else on the card named by `cardId`.
	 */
	async #applyConditionTo(
		target: ConditionTargetActor,
		systemFlags?: Record<string, unknown>,
		card?: WoundCard | null,
		cardId?: string | null,
	): Promise<WoundRecord | null> {
		const effect = this.#itemEffect();
		let applied: AppliedEffect | null = null;
		if (effect) {
			applied = await this.#applyEffectCopyTo(
				target,
				effect,
				systemFlags,
				card?.id ?? cardId ?? null,
			);
		} else if (this.condition) {
			const created = await applyConditionToActor(target, this.condition, {
				sourceItem: (this.item ?? this.parentDocument) as unknown as { uuid?: string },
				sourceActor: this.actor as unknown as { uuid?: string } | null,
				rule: this,
				systemFlags: systemFlags ?? null,
			});
			const effectUuid = (created as { uuid?: string | null } | null)?.uuid;
			if (effectUuid) {
				const name = (target as { name?: string | null }).name ?? '';
				applied = { effectUuid, actorName: name };
			}
		}
		const wounds = await this.#giveWoundsTo(target as unknown as WoundTarget, card ?? null);
		if (card && applied) await recordAppliedEffects(card, this.#effectNodeId(), [applied]);
		return wounds;
	}

	async #giveWoundsTo(target: WoundTarget, card: WoundCard | null): Promise<WoundRecord | null> {
		if (!(this.wounds > 0)) return null;
		if (!card) return giveWounds(target, this.wounds);
		await giveWoundsOnCard(card, this.#woundNodeId(), [target], this.wounds);
		return null;
	}

	async #applyEffectCopyTo(
		target: ConditionTargetActor,
		effect: ItemEffect,
		systemFlags: Record<string, unknown> | undefined,
		cardId: string | null,
	): Promise<AppliedEffect | null> {
		const user = this.actor as unknown as EffectSourceUser | null;
		const payload = payloadFromEffect(effect, { itemUuid: this.item?.uuid ?? null, user, cardId });
		if (systemFlags) {
			const flags = (payload.data.flags ?? {}) as Record<string, Record<string, unknown>>;
			payload.data.flags = {
				...flags,
				[SYSTEM_ID]: { ...(flags[SYSTEM_ID] ?? {}), ...systemFlags },
			};
		}
		return applyEffectToActor(target as unknown as EffectTarget, payload);
	}
}

export { ApplyConditionRule, type ApplyConditionTrigger, TRIGGER_CHOICES };
