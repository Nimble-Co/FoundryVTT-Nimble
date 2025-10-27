import getDeterministicBonus from '../../dice/getDeterministicBonus.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		value: new fields.StringField({ required: true, nullable: false, initial: '' }),
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
			...super.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['value', 'string'],
				['perLevel', 'boolean'],
			]),
		);
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	override async preCreate(args): Promise<void> {
		if (this.invalid) return;

		const { actor } = this;
		if (!actor) return;

		// Update actor max hp
		const formula = this.perLevel ? `${this.value} * @level` : this.value;

		const addedHp = getDeterministicBonus(formula, actor.getRollData());
		if (!addedHp) return;

		const { max } = actor.system.attributes.hp;
		actor.update({ 'system.attributes.hp.max': max + addedHp });
	}

	override async preUpdate(changes: Record<string, unknown>) {
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

		const { max } = actor.system.attributes.hp;
		actor.update({ 'system.attributes.hp.max': max + addedHp });
	}

	override afterDelete() {
		if (this.invalid) return;

		const { actor, item } = this;
		if (!actor || !item) return;

		const formula = this.perLevel ? `${this.value} * @level` : this.value;

		const addedHp = getDeterministicBonus(formula, actor.getRollData());
		if (!addedHp) return;

		const { max } = actor.system.attributes.hp;
		actor.update({ 'system.attributes.hp.max': Math.max(max - addedHp, 0) });
	}
}

export { MaxHpBonusRule };
