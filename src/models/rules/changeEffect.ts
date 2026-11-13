import { LASTS_UNTIL_EVENTS, type LastsUntilEvent } from '../activeEffect/nimbleEffectChoices.js';
import { choiceLabels } from './_rollUseRule.js';
import { NimbleBaseRule } from './base.js';

const WORDS = 'NIMBLE.rules.changeEffect';

// "Another effect ends" needs the other effect's name, which an added moment does not have.
const ADDABLE_EVENTS = LASTS_UNTIL_EVENTS.filter((event) => event !== 'effectEnds');

function momentsField(field: 'removeMoments' | 'addMoments') {
	const { fields } = foundry.data;
	const events = field === 'addMoments' ? ADDABLE_EVENTS : LASTS_UNTIL_EVENTS;
	return new fields.ArrayField(
		new fields.StringField({
			required: true,
			nullable: false,
			initial: 'zeroHp',
			choices: choiceLabels('changeEffect', 'moments', events),
		}),
		{
			required: true,
			nullable: false,
			label: `${WORDS}.${field}.label`,
			hint: `${WORDS}.${field}.hint`,
		},
	);
}

function schema() {
	const { fields } = foundry.data;

	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'changeEffect' }),
		itemIdentifier: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: `${WORDS}.itemIdentifier.label`,
			hint: `${WORDS}.itemIdentifier.hint`,
		}),
		removeMoments: momentsField('removeMoments'),
		addMoments: momentsField('addMoments'),
	};
}

declare namespace ChangeEffectRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Changes the Lasts Until of each effect that the named item gives to this rule's actor, when
 * the effect is made. `src/hooks/changeEffectOnCreate.ts` applies it; effects already on the
 * actor stay as they are.
 */
class ChangeEffectRule extends NimbleBaseRule<ChangeEffectRule.Schema> {
	static override worksOnEffects = false;

	static override group = 'conditions';
	static override description = `${WORDS}.description`;
	static override icon = 'fa-solid fa-hourglass-half';

	declare itemIdentifier: string;
	declare removeMoments: LastsUntilEvent[];
	declare addMoments: LastsUntilEvent[];

	static override defineSchema(): ChangeEffectRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		const join = (events: readonly string[]) =>
			events
				.map((event) => `'${event}'`)
				.join(' <span class="nimble-type-summary__operator">|</span> ');
		return super.tooltipInfo(
			new Map([
				['itemIdentifier', 'string'],
				['removeMoments', join(LASTS_UNTIL_EVENTS)],
				['addMoments', join(ADDABLE_EVENTS)],
			]),
		);
	}

	/** It is on its actor, enabled, its predicate passes, and it names the item with this identifier. */
	changesEffectsOf(identifier: string): boolean {
		const own = this.itemIdentifier.trim();
		if (!own || own !== identifier) return false;
		return this.isOnActor && this.test();
	}
}

export { ChangeEffectRule };
