import { SYSTEM_ID } from '#system';
import type { ApplyEffectNode, EffectNode } from '#types/effectTree.js';
import applyConditionToActor, {
	type ConditionTargetActor,
} from '#utils/actor/applyConditionToActor.js';
import { applyEffectToActor, payloadFromEffect } from '#utils/actor/applyEffectToActor.js';
import { isEnemyAttacker } from '#utils/actor/isEnemyAttacker.js';
import { itemEffectOf } from '#utils/actor/itemEffectOf.js';
import { isActiveGM } from '#utils/isActiveGM.js';
import { firesCritTriggers } from '#utils/reroll/firesCritTriggers.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import { choiceLabels } from './_rollUseRule.js';
import { attackOutcomeMatches, isAttackOutcomeTrigger, RULE_TRIGGERS } from './_triggers.js';
import { withWidget } from './_widgetOption.js';
import {
	type ActivationCardContext,
	type ActorDyingContext,
	type ActorHealthContext,
	type InitiativeRolledContext,
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

interface ConditionOwner {
	effects?: Iterable<OwnedConditionEffect>;
	deleteEmbeddedDocuments(type: 'ActiveEffect', ids: string[]): Promise<unknown>;
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
			]),
		);
	}

	override async onItemUsed(context: ItemUsedContext): Promise<void> {
		if (!this.#shouldFireOnItemUsed(context)) return;
		const targetActor = context.targetActor as unknown as ConditionTargetActor | null;
		if (!targetActor) return;
		await this.#applyConditionTo(targetActor);
	}

	override getActivationCardNodes(context: ActivationCardContext): EffectNode[] {
		if (!this.#isAttackTrigger()) return [];
		if (!this.#matchesAttackContext(context)) return [];
		const effect = this.#itemEffect();
		if (!effect && !this.condition) return [];
		const node: ApplyEffectNode = {
			id: `apply-condition-${this.id}`,
			type: 'applyEffect',
			effectId: effect ? this.effectId : null,
			effectItemUuid: effect ? (this.item?.uuid ?? null) : null,
			condition: this.condition || null,
			recipient: 'targets',
			parentContext: null,
			parentNode: null,
		};
		return [node];
	}

	override async onAttackReceived(context: ItemUsedContext): Promise<void> {
		if (this.trigger !== 'onCritReceived') return;
		if (context.targetActor !== this.actor) return;
		if (!firesCritTriggers(context)) return;
		if (!isEnemyAttacker(context.sourceActor, this.actor, context.card)) return;
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
			await this.#applyConditionToSelf({ [SAVE_FAIL_SOURCE_FLAG]: source });
			return;
		}
		await this.#removeConditionFromSaveCard(context.messageId);
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
		return this.#matchesAttackContext(context);
	}

	#matchesAttackContext(context: { isCritical: boolean; isMiss: boolean }): boolean {
		return attackOutcomeMatches(this.trigger, context);
	}

	#isAttackTrigger(): boolean {
		return isAttackOutcomeTrigger(this.trigger);
	}

	async #applyConditionToSelf(systemFlags?: Record<string, unknown>): Promise<void> {
		if (!this.test()) return;
		const selfActor = this.actor as unknown as ConditionTargetActor | null;
		if (!selfActor) return;
		await this.#applyConditionTo(selfActor, systemFlags);
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
		if (ids.length > 0) await owner.deleteEmbeddedDocuments('ActiveEffect', ids);
	}

	#itemEffect(): ItemEffect | null {
		return itemEffectOf(this.item as unknown as EffectItem | null, this.effectId);
	}

	async #applyConditionTo(
		target: ConditionTargetActor,
		systemFlags?: Record<string, unknown>,
	): Promise<void> {
		const effect = this.#itemEffect();
		if (effect) {
			await this.#applyEffectCopyTo(target, effect, systemFlags);
			return;
		}
		if (!this.condition) return;

		await applyConditionToActor(target, this.condition, {
			sourceItem: (this.item ?? this.parentDocument) as unknown as { uuid?: string },
			sourceActor: this.actor as unknown as { uuid?: string } | null,
			rule: this,
			systemFlags: systemFlags ?? null,
		});
	}

	async #applyEffectCopyTo(
		target: ConditionTargetActor,
		effect: ItemEffect,
		systemFlags?: Record<string, unknown>,
	): Promise<void> {
		const user = this.actor as unknown as EffectSourceUser | null;
		const payload = payloadFromEffect(effect, { itemUuid: this.item?.uuid ?? null, user });
		if (systemFlags) {
			const flags = (payload.data.flags ?? {}) as Record<string, Record<string, unknown>>;
			payload.data.flags = {
				...flags,
				[SYSTEM_ID]: { ...(flags[SYSTEM_ID] ?? {}), ...systemFlags },
			};
		}
		await applyEffectToActor(target as unknown as EffectTarget, payload);
	}
}

export { ApplyConditionRule, type ApplyConditionTrigger, TRIGGER_CHOICES };
