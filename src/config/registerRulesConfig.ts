import { AbilityBonusRule } from '../models/rules/abilityBonus.js';
import { ArmorClassRule } from '../models/rules/armorClass.js';
import { ItemGrantRule } from '../models/rules/grantItem.js';
import { GrantProficiencyRule } from '../models/rules/grantProficiencies.ts';
import { InitiativeBonusRule } from '../models/rules/initiativeBonus.js';
import { MaxHitDiceRule } from '../models/rules/maxHitDice.js';
import { MaxHpBonusRule } from '../models/rules/maxHpBonus.js';
import { MaxWoundsRule } from '../models/rules/maxWounds.js';
import { NoteRule } from '../models/rules/note.js';
import { SkillBonusRule } from '../models/rules/skillBonus.js';

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
