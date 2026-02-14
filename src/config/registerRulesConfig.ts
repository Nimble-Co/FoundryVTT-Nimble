import { AbilityBonusRule } from '../models/rules/abilityBonus.js';
import { ArmorClassRule } from '../models/rules/armorClass.js';
import { CombatManaRule } from '../models/rules/combatMana.js';
import { ItemGrantRule } from '../models/rules/grantItem.js';
import { GrantProficiencyRule } from '../models/rules/grantProficiencies.ts';
import { HitDiceAdvantageRule } from '../models/rules/hitDiceAdvantage.js';
import { IncrementHitDiceRule } from '../models/rules/incrementHitDice.js';
import { InitiativeBonusRule } from '../models/rules/initiativeBonus.js';
import { InitiativeRollModeRule } from '../models/rules/initiativeRollMode.js';
import { MaxHitDiceRule } from '../models/rules/maxHitDice.js';
import { MaxHpBonusRule } from '../models/rules/maxHpBonus.js';
import { MaximizeHitDiceRule } from '../models/rules/maximizeHitDice.js';
import { MaxWoundsRule } from '../models/rules/maxWounds.js';
import { NoteRule } from '../models/rules/note.js';
import { SavingThrowBonusRule } from '../models/rules/savingThrowBonus.js';
import { SavingThrowRollModeRule } from '../models/rules/savingThrowRollMode.js';
import { SkillBonusRule } from '../models/rules/skillBonus.js';
import { SpeedBonusRule } from '../models/rules/speedBonus.js';

export default function registerRulesConfig() {
	const ruleTypes = {
		abilityBonus: 'NIMBLE.ruleTypes.abilityBonus',
		armorClass: 'NIMBLE.ruleTypes.armorClass',
		combatMana: 'NIMBLE.ruleTypes.combatMana',
		grantItem: 'NIMBLE.ruleTypes.grantItem',
		grantProficiency: 'NIMBLE.ruleTypes.grantProficiency',
		hitDiceAdvantage: 'NIMBLE.ruleTypes.hitDiceAdvantage',
		incrementHitDice: 'NIMBLE.ruleTypes.incrementHitDice',
		initiativeBonus: 'NIMBLE.ruleTypes.initiativeBonus',
		initiativeRollMode: 'NIMBLE.ruleTypes.initiativeRollMode',
		maxHitDice: 'NIMBLE.ruleTypes.maxHitDice',
		maxHpBonus: 'NIMBLE.ruleTypes.maxHpBonus',
		maximizeHitDice: 'NIMBLE.ruleTypes.maximizeHitDice',
		maxWounds: 'NIMBLE.ruleTypes.maxWounds',
		note: 'NIMBLE.ruleTypes.note',
		savingThrowBonus: 'NIMBLE.ruleTypes.savingThrowBonus',
		savingThrowRollMode: 'NIMBLE.ruleTypes.savingThrowRollMode',
		skillBonus: 'NIMBLE.ruleTypes.skillBonus',
		speedBonus: 'NIMBLE.ruleTypes.speedBonus',
	};

	const ruleDataModels = {
		abilityBonus: AbilityBonusRule,
		armorClass: ArmorClassRule,
		combatMana: CombatManaRule,
		grantItem: ItemGrantRule,
		grantProficiency: GrantProficiencyRule,
		hitDiceAdvantage: HitDiceAdvantageRule,
		incrementHitDice: IncrementHitDiceRule,
		initiativeBonus: InitiativeBonusRule,
		initiativeRollMode: InitiativeRollModeRule,
		maxHitDice: MaxHitDiceRule,
		maxHpBonus: MaxHpBonusRule,
		maximizeHitDice: MaximizeHitDiceRule,
		maxWounds: MaxWoundsRule,
		note: NoteRule,
		savingThrowBonus: SavingThrowBonusRule,
		savingThrowRollMode: SavingThrowRollModeRule,
		skillBonus: SkillBonusRule,
		speedBonus: SpeedBonusRule,
	} as const;

	return { ruleDataModels, ruleTypes };
}
