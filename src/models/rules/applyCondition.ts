import type { ConditionNode, EffectNode } from '#types/effectTree.js';
import applyConditionToActor, { type ConditionTargetActor } from '#utils/applyConditionToActor.js';
import {
	type ActivationCardContext,
	type ActorHealthContext,
	type InitiativeRolledContext,
	type ItemUsedContext,
	NimbleBaseRule,
	type RestContext,
	type SaveResolvedContext,
	type TurnContext,
} from './base.js';

const ATTACK_OUTCOME_TRIGGERS = ['onHit', 'onCrit', 'onMiss'] as const;
const SELF_TRIGGERS = [
	'onTurnStart',
	'onTurnEnd',
	'onKill',
	'onWound',
	'onSaveFail',
	'onRest',
	'onInitiative',
] as const;

const TRIGGER_CHOICES = [...ATTACK_OUTCOME_TRIGGERS, ...SELF_TRIGGERS] as const;

type ApplyConditionTrigger = (typeof TRIGGER_CHOICES)[number];

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
			choices: TRIGGER_CHOICES as unknown as string[],
		}),
		duration: new fields.SchemaField(
			{
				rounds: new fields.NumberField({ required: false, nullable: true, initial: null }),
				turns: new fields.NumberField({ required: false, nullable: true, initial: null }),
				seconds: new fields.NumberField({ required: false, nullable: true, initial: null }),
			},
			{
				required: true,
				nullable: false,
				// Self-target triggers fire on the rule owner; duration is the actor's,
				// not an applied effect — hide the field rather than mislead authors.
				showWhen: (data: Record<string, unknown>) => {
					const trigger = data.trigger as ApplyConditionTrigger | undefined;
					return trigger !== 'onTurnStart' && trigger !== 'onTurnEnd' && trigger !== 'onRest';
				},
			} as unknown as never,
		),
	};
}

declare namespace ApplyConditionRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class ApplyConditionRule extends NimbleBaseRule<ApplyConditionRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.applyCondition.description';

	declare condition: string;
	declare trigger: ApplyConditionTrigger;
	declare duration: { rounds: number | null; turns: number | null; seconds: number | null };

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
				['duration', '{ rounds?, turns?, seconds? } | null'],
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
		if (!this.condition) return [];
		const node: ConditionNode = {
			id: `apply-condition-${this.id}`,
			type: 'condition',
			condition: this.condition,
			parentContext: null,
			parentNode: null,
		};
		return [node];
	}

	override async onTurnStart(context: TurnContext): Promise<void> {
		if (this.trigger !== 'onTurnStart') return;
		if (context.actor !== this.item.actor) return;
		await this.#applyConditionToSelf();
	}

	override async onTurnEnd(context: TurnContext): Promise<void> {
		if (this.trigger !== 'onTurnEnd') return;
		if (context.actor !== this.item.actor) return;
		await this.#applyConditionToSelf();
	}

	override async onActorKilled(context: ActorHealthContext): Promise<void> {
		if (this.trigger !== 'onKill') return;
		if (context.actor !== this.item.actor) return;
		await this.#applyConditionToSelf();
	}

	override async onActorWounded(context: ActorHealthContext): Promise<void> {
		if (this.trigger !== 'onWound') return;
		if (context.actor !== this.item.actor) return;
		await this.#applyConditionToSelf();
	}

	override async onSaveResolved(context: SaveResolvedContext): Promise<void> {
		if (this.trigger !== 'onSaveFail') return;
		if (context.actor !== this.item.actor) return;
		if (context.outcome !== 'fail') return;
		await this.#applyConditionToSelf();
	}

	override async onRest(context: RestContext): Promise<void> {
		if (this.trigger !== 'onRest') return;
		if (context.actor !== this.item.actor) return;
		await this.#applyConditionToSelf();
	}

	override async onInitiativeRolled(context: InitiativeRolledContext): Promise<void> {
		if (this.trigger !== 'onInitiative') return;
		if (context.actor !== this.item.actor) return;
		await this.#applyConditionToSelf();
	}

	#shouldFireOnItemUsed(context: ItemUsedContext): boolean {
		if (!this.test()) return false;
		if (context.sourceActor !== this.item.actor) return false;
		return this.#matchesAttackContext(context);
	}

	#matchesAttackContext(context: { isCritical: boolean; isMiss: boolean }): boolean {
		if (this.trigger === 'onHit') return !context.isCritical && !context.isMiss;
		if (this.trigger === 'onCrit') return context.isCritical;
		if (this.trigger === 'onMiss') return context.isMiss;
		return false;
	}

	#isAttackTrigger(): boolean {
		return this.trigger === 'onHit' || this.trigger === 'onCrit' || this.trigger === 'onMiss';
	}

	async #applyConditionToSelf(): Promise<void> {
		if (!this.test()) return;
		const selfActor = this.item.actor as unknown as ConditionTargetActor | null;
		if (!selfActor) return;
		await this.#applyConditionTo(selfActor);
	}

	async #applyConditionTo(target: ConditionTargetActor): Promise<void> {
		if (!this.condition) return;

		await applyConditionToActor(target, this.condition, {
			sourceItem: this.item as unknown as { uuid?: string },
			sourceActor: this.item.actor as unknown as { uuid?: string } | null,
			duration: this.duration,
			rule: this,
		});
	}
}

export { ApplyConditionRule, type ApplyConditionTrigger, TRIGGER_CHOICES };
