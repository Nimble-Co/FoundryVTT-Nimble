import { AbilityBonusRule } from '../models/rules/abilityBonus';
import { ArmorClassRule } from '../models/rules/armorClass';
import { ItemGrantRule } from '../models/rules/grantItem';
import { GrantProficiencyRule } from '../models/rules/grantProficiencies';
import { InitiativeBonusRule } from '../models/rules/initiativeBonus';
import { MaxHitDiceRule } from '../models/rules/maxHitDice';
import { MaxHpBonusRule } from '../models/rules/maxHpBonus';
import { MaxWoundsRule } from '../models/rules/maxWounds';
import { NoteRule } from '../models/rules/note';
import { SkillBonusRule } from '../models/rules/skillBonus';

export default function registerRulesConfig() {
	const ruleTypes = {
		abilityBonus: 'NIMBLE.ruleTypes.abilityBonus',
		armorClass: 'NIMBLE.ruleTypes.armorClass',
		grantItem: 'NIMBLE.ruleTypes.grantItem',
		grantProficiency: 'NIMBLE.ruleTypes.grantProficiency',
		initiativeBonus: 'NIMBLE.ruleTypes.initiativeBonus',
		maxHitDice: 'NIMBLE.ruleTypes.maxHitDice',
		maxHpBonus: 'NIMBLE.ruleTypes.maxHpBonus',
		maxWounds: 'NIMBLE.ruleTypes.maxWounds',
		note: 'NIMBLE.ruleTypes.note',
		skillBonus: 'NIMBLE.ruleTypes.skillBonus',
	};

	const ruleDataModels = {
		abilityBonus: AbilityBonusRule,
		armorClass: ArmorClassRule,
		grantItem: ItemGrantRule,
		grantProficiency: GrantProficiencyRule,
		initiativeBonus: InitiativeBonusRule,
		maxHitDice: MaxHitDiceRule,
		maxHpBonus: MaxHpBonusRule,
		maxWounds: MaxWoundsRule,
		note: NoteRule,
		skillBonus: SkillBonusRule,
	} as const;

	return { ruleDataModels, ruleTypes };
}
