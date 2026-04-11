import type { ConditionNode, EffectNode } from '#types/effectTree.js';
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
		condition: new fields.StringField({ required: true, nullable: false, initial: '' }),
		trigger: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'onCrit',
			choices: TRIGGER_CHOICES as unknown as string[],
		}),
		duration: new fields.SchemaField({
			rounds: new fields.NumberField({ required: false, nullable: true, initial: null }),
			turns: new fields.NumberField({ required: false, nullable: true, initial: null }),
			seconds: new fields.NumberField({ required: false, nullable: true, initial: null }),
		}),
	};
}

declare namespace ApplyConditionRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

interface ActiveEffectLike {
	update(data: Record<string, unknown>): Promise<unknown>;
}

interface ActorWithStatusEffect {
	statuses?: Set<string>;
	toggleStatusEffect(
		statusId: string,
		options?: { active?: boolean; overlay?: boolean },
	): Promise<ActiveEffectLike | boolean | undefined>;
}

class ApplyConditionRule extends NimbleBaseRule<ApplyConditionRule.Schema> {
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
		const targetActor = context.targetActor as unknown as ActorWithStatusEffect | null;
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
		const selfActor = this.item.actor as unknown as ActorWithStatusEffect | null;
		if (!selfActor) return;
		await this.#applyConditionTo(selfActor);
	}

	async #applyConditionTo(target: ActorWithStatusEffect): Promise<void> {
		if (!this.condition) return;
		// Short-circuit if the target already has the condition. Mirrors the pattern in
		// src/view/chat/components/ConditionNode.svelte — Foundry's toggleStatusEffect
		// dedupe only works for status effects with a static _id, which Nimble only
		// assigns to conditions with linked statuses (see ConditionManager.ts).
		if (target.statuses?.has(this.condition)) return;
		const result = await target.toggleStatusEffect(this.condition, { active: true });
		await this.#maybePatchDuration(result);
	}

	async #maybePatchDuration(result: ActiveEffectLike | boolean | undefined): Promise<void> {
		const durationUpdate: Record<string, number | null> = {};
		if (this.duration.rounds !== null) durationUpdate.rounds = this.duration.rounds;
		if (this.duration.turns !== null) durationUpdate.turns = this.duration.turns;
		if (this.duration.seconds !== null) durationUpdate.seconds = this.duration.seconds;
		if (Object.keys(durationUpdate).length === 0) return;

		// Foundry's toggleStatusEffect returns:
		//   ActiveEffect — newly created effect (patch its duration)
		//   true        — effect already existed (nothing to patch)
		//   false / undefined — no-op
		if (!result || typeof result !== 'object') return;
		await result.update({ duration: durationUpdate });
	}
}

export { ApplyConditionRule, type ApplyConditionTrigger, TRIGGER_CHOICES };
