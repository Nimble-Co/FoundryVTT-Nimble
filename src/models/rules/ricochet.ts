import { ruleSource } from '../../utils/actor/actorRules.js';
import { NimbleBaseRule } from './base.js';

const WEAPON_PROPERTIES = ['', 'light', 'load', 'thrown', 'twoHanded', 'vicious'] as const;

function schema() {
	const { fields } = foundry.data;

	return {
		weapon: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: 'NIMBLE.rules.ricochet.weapon.label',
			hint: 'NIMBLE.rules.ricochet.weapon.hint',
		}),
		weaponProperty: new fields.StringField({
			required: true,
			nullable: false,
			blank: true,
			initial: '',
			choices: () =>
				Object.fromEntries(
					WEAPON_PROPERTIES.map((property) => [
						property,
						property
							? (CONFIG.NIMBLE.weaponProperties as Record<string, string>)[property]
							: 'NIMBLE.rules.ricochet.weaponProperty.any',
					]),
				),
			label: 'NIMBLE.rules.ricochet.weaponProperty.label',
			hint: 'NIMBLE.rules.ricochet.weaponProperty.hint',
		}),
		reach: new fields.NumberField({
			required: true,
			nullable: false,
			initial: 2,
			min: 0,
			integer: true,
			label: 'NIMBLE.rules.ricochet.reach.label',
			hint: 'NIMBLE.rules.ricochet.reach.hint',
		}),
		type: new fields.StringField({ required: true, nullable: false, initial: 'ricochet' }),
	};
}

declare namespace RicochetRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/** The weapon of an attack, as a ricochet reads it. */
interface RicochetWeapon {
	name?: string | null;
	uuid?: string | null;
	system?: { weaponType?: string | null; properties?: { selected?: readonly string[] } } | null;
}

/** What a hit with a fitting weapon gives: half its damage to another creature within the reach. */
interface Ricochet {
	/** What the card line calls the rule: its label, or the name of its item. */
	source: string;
	/** The uuid of the rule's item or effect, so its name can open it. */
	sourceUuid?: string;
	/** The reach the other creature is within, shown as text. */
	reach: number;
	/** The weapon's name when only a throw ricochets: the card cannot tell a throw from a melee hit. */
	thrownWeapon?: string;
	weaponUuid?: string;
}

function words(text: string | null | undefined): string[] {
	return (text ?? '').toLowerCase().split(/[^a-z0-9]+/);
}

/** The weapon type is the word, or a word of the name is the word or its plural. */
function isNamed(weapon: RicochetWeapon, word: string): boolean {
	if (words(weapon.system?.weaponType).includes(word)) return true;
	return words(weapon.name).some((each) => each === word || each === `${word}s`);
}

/**
 * A hit with a fitting weapon ricochets to another creature: the card shows a line that
 * deals half of the attack's damage, rounded down, through that creature's armor.
 */
class RicochetRule extends NimbleBaseRule<RicochetRule.Schema> {
	static override group = 'bonuses';
	static override description = 'NIMBLE.rules.ricochet.description';
	static override icon = 'fa-solid fa-arrows-turn-right';

	declare weapon: string;
	declare weaponProperty: string;
	declare reach: number;

	static override defineSchema(): RicochetRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['weapon', 'string'],
				['weaponProperty', 'string'],
				['reach', 'number'],
			]),
		);
	}

	/** The ricochet of a hit with this weapon, or null. */
	ricochetFor(weapon: RicochetWeapon | null | undefined): Ricochet | null {
		if (!weapon || !this.isOnActor || !this.test()) return null;
		const word = this.weapon?.trim().toLowerCase() ?? '';
		if (word && !isNamed(weapon, word)) return null;
		const property = this.weaponProperty ?? '';
		if (property && !weapon.system?.properties?.selected?.includes(property)) return null;
		const source = ruleSource(this);
		return {
			source: source.name,
			...(source.uuid ? { sourceUuid: source.uuid } : {}),
			reach: Math.max(0, Math.trunc(Number(this.reach) || 0)),
			...(property === 'thrown'
				? {
						thrownWeapon: weapon.name || word,
						...(weapon.uuid ? { weaponUuid: weapon.uuid } : {}),
					}
				: {}),
		};
	}
}

export { type Ricochet, RicochetRule, type RicochetWeapon };
