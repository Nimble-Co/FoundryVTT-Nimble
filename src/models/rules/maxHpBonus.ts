import getDeterministicBonus from '../../dice/getDeterministicBonus.js';
import { NimbleBaseRule } from './base.js';

/** Actor system data with HP attributes */
interface ActorSystemWithHp {
	attributes: {
		hp: {
			bonus: number;
		};
	};
}

/** The parts of an actor the helper below reads, kept structural so this module never imports a document class. */
interface ActorWithRuleItems {
	items?: Iterable<{ rules?: Map<string, unknown> }>;
}

/** The fields the helper below reads off a rule. */
interface MaxHpBonusLike {
	type?: string;
	perLevel?: boolean;
	value?: number;
	invalid?: boolean;
}

/**
 * Max HP every `maxHpBonus` rule on the actor contributes for a single class level.
 *
 * A `perLevel` rule folds `value * level` into the actor's stored
 * `attributes.hp.bonus` when its item is added and takes the same amount back
 * out when the item is deleted. Nothing re-derives that figure in between, so a
 * class level change has to move it by this much per level gained or lost.
 * Counts rules exactly as `preCreate` and `afterDelete` do — disabled ones in,
 * invalid ones out — so the stored total stays symmetric with what they wrote.
 */
function getMaxHpBonusPerLevel(actor: ActorWithRuleItems): number {
	let perLevel = 0;

	for (const item of actor.items ?? []) {
		for (const rule of (item.rules?.values() ?? []) as Iterable<MaxHpBonusLike>) {
			if (rule.type !== 'maxHpBonus') continue;
			if (!rule.perLevel || rule.invalid) continue;

			perLevel += rule.value ?? 0;
		}
	}

	return perLevel;
}

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			label: 'NIMBLE.rules.maxHpBonus.value.label',
			hint: 'NIMBLE.rules.maxHpBonus.value.hint',
		}),
		perLevel: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'NIMBLE.rules.maxHpBonus.perLevel.label',
			hint: 'NIMBLE.rules.maxHpBonus.perLevel.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'maxHpBonus' }),
	};
}

declare namespace MaxHpBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class MaxHpBonusRule extends NimbleBaseRule<MaxHpBonusRule.Schema> {
	// `perLevel: true` re-interprets `value` as "per level" and multiplies by
	// the actor's level on apply. The i18n description should call this out.
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.maxHpBonus.description';

	declare value: number;
	declare perLevel: boolean;

	static override defineSchema(): MaxHpBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['value', 'number'],
				['perLevel', 'boolean'],
			]),
		);
	}

	override async preCreate(): Promise<void> {
		if (this.invalid) return;

		const { actor } = this;
		if (!actor) return;

		// Update actor bonus hp
		const formula = this.perLevel ? `${this.value} * @level` : this.value;

		const addedHp = getDeterministicBonus(formula, actor.getRollData());
		if (addedHp === null) return;

		const actorSystem = actor.system as unknown as ActorSystemWithHp;
		const { bonus } = actorSystem.attributes.hp;
		await actor.update({ system: { attributes: { hp: { bonus: bonus + addedHp } } } } as Record<
			string,
			unknown
		>);
	}

	async afterDelete(): Promise<void> {
		if (this.invalid) return;

		const { actor, item } = this;
		if (!actor || !item) return;

		const formula = this.perLevel ? `${this.value} * @level` : this.value;

		const addedHp = getDeterministicBonus(formula, actor.getRollData());
		if (addedHp === null) return;

		const actorSystem = actor.system as unknown as ActorSystemWithHp;
		const { bonus } = actorSystem.attributes.hp;
		await actor.update({ system: { attributes: { hp: { bonus: bonus - addedHp } } } } as Record<
			string,
			unknown
		>);
	}
}

export { getMaxHpBonusPerLevel, MaxHpBonusRule };
