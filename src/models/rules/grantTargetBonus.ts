import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		grantIdentifier: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: 'NIMBLE.rules.grantTargetBonus.grantIdentifier.label',
			hint: 'NIMBLE.rules.grantTargetBonus.grantIdentifier.hint',
		}),
		count: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 1,
			min: 1,
			integer: true,
			label: 'NIMBLE.rules.grantTargetBonus.count.label',
			hint: 'NIMBLE.rules.grantTargetBonus.count.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'grantTargetBonus' }),
	};
}

declare namespace GrantTargetBonusRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * The Grant Activation rules of the named item reach more targeted creatures. Only a rule
 * with a target count is raised; one with no limit stays so.
 */
class GrantTargetBonusRule extends NimbleBaseRule<GrantTargetBonusRule.Schema> {
	static override worksOnEffects = false;

	static override group = 'resource';
	static override description = 'NIMBLE.rules.grantTargetBonus.description';
	static override icon = 'fa-solid fa-user-plus';

	declare grantIdentifier: string;
	declare count: number;

	static override defineSchema(): GrantTargetBonusRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['grantIdentifier', 'string'],
				['count', 'number'],
			]),
		);
	}

	/** How many more targets the rules of the item with this identifier reach. */
	bonusFor(identifier: string | null | undefined): number {
		if (!this.isOnActor || !this.test()) return 0;
		const wanted = this.grantIdentifier?.trim();
		if (!wanted || wanted !== identifier) return 0;
		return Math.max(1, Math.trunc(Number(this.count) || 1));
	}
}

export { GrantTargetBonusRule };
