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

/** Class item system data */
interface ClassItemSystem {
	classLevel: number;
}

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 0,
			label: 'Bonus',
			hint: 'Bonus HP added to maximum.',
		}),
		perLevel: new fields.BooleanField({
			required: true,
			nullable: false,
			initial: false,
			label: 'Multiply by character level',
			hint: 'When on, the bonus is applied per level (e.g. +2 per level → +20 at level 10).',
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
	static override description = 'NIMBLE.ruleDescriptions.maxHpBonus';

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

	async preUpdate(changes: Record<string, unknown>): Promise<void> {
		if (this.invalid) return;

		const { actor, item } = this;
		if (!actor || !item) return;
		if (item.type !== 'class') return;

		if (!this.perLevel) return;

		// Return if update doesn't pertain to level
		const keys = Object.keys(foundry.utils.flattenObject(changes));
		const itemSystem = item.system as unknown as ClassItemSystem;
		if (
			!keys.includes('system.classLevel') ||
			changes['system.classLevel'] === itemSystem.classLevel
		)
			return;

		const formula = this.value;
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

export { MaxHpBonusRule };
