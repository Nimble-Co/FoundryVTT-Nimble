import getDeterministicBonus from '../../dice/getDeterministicBonus';
import { NimbleBaseRule } from './base';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.NumberField({ required: true, nullable: false, initial: 0 }),
		perLevel: new fields.BooleanField({ required: true, nullable: false, initial: false }),
		type: new fields.StringField({ required: true, nullable: false, initial: 'maxHpBonus' }),
	};
}

declare namespace MaxHpBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

class MaxHpBonusRule extends NimbleBaseRule<MaxHpBonusRule.Schema> {
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

	async preCreate(): Promise<void> {
		if (this.invalid) return;

		const { actor } = this;
		if (!actor) return;

		// Update actor bonus hp
		const formula = this.perLevel ? `${this.value} * @level` : this.value;

		const addedHp = getDeterministicBonus(formula, actor.getRollData());
		if (!addedHp) return;

		const { bonus } = actor.system.attributes.hp;
		actor.update({ 'system.attributes.hp.bonus': bonus + addedHp });
	}

	async preUpdate(changes: Record<string, unknown>) {
		if (this.invalid) return;

		const { actor, item } = this;
		if (!actor || !item) return;
		if (!item.isType('class')) return;

		if (!this.perLevel) return;

		// Return if update doesn't pertain to level
		const keys = Object.keys(foundry.utils.flattenObject(changes));
		if (
			!keys.includes('system.classLevel') ||
			changes['system.classLevel'] === item.system.classLevel
		)
			return;

		const formula = this.value;
		const addedHp = getDeterministicBonus(formula, actor.getRollData());
		if (!addedHp) return;

		const { bonus } = actor.system.attributes.hp;
		actor.update({ 'system.attributes.hp.bonus': bonus + addedHp });
	}

	afterDelete() {
		if (this.invalid) return;

		const { actor, item } = this;
		if (!actor || !item) return;

		const formula = this.perLevel ? `${this.value} * @level` : this.value;

		const addedHp = getDeterministicBonus(formula, actor.getRollData());
		if (!addedHp) return;

		const { bonus } = actor.system.attributes.hp;
		actor.update({ 'system.attributes.hp.bonus': bonus - addedHp });
	}
}

export { MaxHpBonusRule };
