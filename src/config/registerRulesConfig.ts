import { AbilityBonusRule } from '../models/rules/abilityBonus.js';
import { ApplyConditionRule } from '../models/rules/applyCondition.js';
import { ArmorClassRule } from '../models/rules/armorClass.js';
import { ChargeConsumerRule } from '../models/rules/chargeConsumer.js';
import { ChargePoolRule } from '../models/rules/chargePool.js';
import { CombatManaRule } from '../models/rules/combatMana.js';
import { ConditionImmunityRule } from '../models/rules/conditionImmunity.js';
import { DamageBonusRule } from '../models/rules/damageBonus.js';
import { DamageReductionRule } from '../models/rules/damageReduction.js';
import { DiceConsumerRule } from '../models/rules/diceConsumer.js';
import { DicePoolRule } from '../models/rules/dicePool.js';
import { DyingActionLimitRule } from '../models/rules/dyingActionLimit.js';
import { ItemGrantRule } from '../models/rules/grantItem.js';
import { GrantMovementRule } from '../models/rules/grantMovement.js';
import { GrantProficiencyRule } from '../models/rules/grantProficiencies.ts';
import { GrantSpellsRule } from '../models/rules/grantSpells.js';
import { HealingPotionBonusRule } from '../models/rules/healingPotionBonus.js';
import { HitDiceAdvantageRule } from '../models/rules/hitDiceAdvantage.js';
import { IncrementHitDiceRule } from '../models/rules/incrementHitDice.js';
import { InitiativeBonusRule } from '../models/rules/initiativeBonus.js';
import { InitiativeMessageRule } from '../models/rules/initiativeMessage.js';
import { InitiativeRollModeRule } from '../models/rules/initiativeRollMode.js';
import { MaxHitDiceRule } from '../models/rules/maxHitDice.js';
import { MaxHpBonusRule } from '../models/rules/maxHpBonus.js';
import { MaximizeHitDiceRule } from '../models/rules/maximizeHitDice.js';
import { MaxWoundsRule } from '../models/rules/maxWounds.js';
import { ModifyIncomingAttackRule } from '../models/rules/modifyIncomingAttack.js';
import { ModifyPoolRule } from '../models/rules/modifyPool.js';
import { ModifyToggleRule } from '../models/rules/modifyToggle.js';
import { NoteRule } from '../models/rules/note.js';
import { SavingThrowBonusRule } from '../models/rules/savingThrowBonus.js';
import { SavingThrowRollModeRule } from '../models/rules/savingThrowRollMode.js';
import { SkillBonusRule } from '../models/rules/skillBonus.js';
import { SkillRollModeRule } from '../models/rules/skillRollMode.js';
import { SpeedBonusRule } from '../models/rules/speedBonus.js';
import { ToggleEffectRule } from '../models/rules/toggleEffect.js';
import { UnarmedDamageRule } from '../models/rules/unarmedDamage.js';

export default function registerRulesConfig() {
	const ruleTypes = {
		abilityBonus: 'NIMBLE.ruleTypes.abilityBonus',
		applyCondition: 'NIMBLE.ruleTypes.applyCondition',
		armorClass: 'NIMBLE.ruleTypes.armorClass',
		chargeConsumer: 'NIMBLE.ruleTypes.chargeConsumer',
		chargePool: 'NIMBLE.ruleTypes.chargePool',
		combatMana: 'NIMBLE.ruleTypes.combatMana',
		conditionImmunity: 'NIMBLE.ruleTypes.conditionImmunity',
		damageBonus: 'NIMBLE.ruleTypes.damageBonus',
		damageReduction: 'NIMBLE.ruleTypes.damageReduction',
		dyingActionLimit: 'NIMBLE.ruleTypes.dyingActionLimit',
		grantMovement: 'NIMBLE.ruleTypes.grantMovement',
		diceConsumer: 'NIMBLE.ruleTypes.diceConsumer',
		dicePool: 'NIMBLE.ruleTypes.dicePool',
		grantItem: 'NIMBLE.ruleTypes.grantItem',
		grantProficiency: 'NIMBLE.ruleTypes.grantProficiency',
		grantSpells: 'NIMBLE.ruleTypes.grantSpells',
		healingPotionBonus: 'NIMBLE.ruleTypes.healingPotionBonus',
		hitDiceAdvantage: 'NIMBLE.ruleTypes.hitDiceAdvantage',
		incrementHitDice: 'NIMBLE.ruleTypes.incrementHitDice',
		initiativeBonus: 'NIMBLE.ruleTypes.initiativeBonus',
		initiativeMessage: 'NIMBLE.ruleTypes.initiativeMessage',
		initiativeRollMode: 'NIMBLE.ruleTypes.initiativeRollMode',
		maxHitDice: 'NIMBLE.ruleTypes.maxHitDice',
		maxHpBonus: 'NIMBLE.ruleTypes.maxHpBonus',
		maximizeHitDice: 'NIMBLE.ruleTypes.maximizeHitDice',
		maxWounds: 'NIMBLE.ruleTypes.maxWounds',
		modifyIncomingAttack: 'NIMBLE.ruleTypes.modifyIncomingAttack',
		modifyPool: 'NIMBLE.ruleTypes.modifyPool',
		modifyToggle: 'NIMBLE.ruleTypes.modifyToggle',
		note: 'NIMBLE.ruleTypes.note',
		savingThrowBonus: 'NIMBLE.ruleTypes.savingThrowBonus',
		savingThrowRollMode: 'NIMBLE.ruleTypes.savingThrowRollMode',
		skillBonus: 'NIMBLE.ruleTypes.skillBonus',
		skillRollMode: 'NIMBLE.ruleTypes.skillRollMode',
		speedBonus: 'NIMBLE.ruleTypes.speedBonus',
		toggleEffect: 'NIMBLE.ruleTypes.toggleEffect',
		unarmedDamage: 'NIMBLE.ruleTypes.unarmedDamage',
	};

	const ruleDataModels = {
		abilityBonus: AbilityBonusRule,
		applyCondition: ApplyConditionRule,
		armorClass: ArmorClassRule,
		chargeConsumer: ChargeConsumerRule,
		chargePool: ChargePoolRule,
		combatMana: CombatManaRule,
		conditionImmunity: ConditionImmunityRule,
		damageBonus: DamageBonusRule,
		damageReduction: DamageReductionRule,
		dyingActionLimit: DyingActionLimitRule,
		grantMovement: GrantMovementRule,
		diceConsumer: DiceConsumerRule,
		dicePool: DicePoolRule,
		grantItem: ItemGrantRule,
		grantProficiency: GrantProficiencyRule,
		grantSpells: GrantSpellsRule,
		healingPotionBonus: HealingPotionBonusRule,
		hitDiceAdvantage: HitDiceAdvantageRule,
		incrementHitDice: IncrementHitDiceRule,
		initiativeBonus: InitiativeBonusRule,
		initiativeMessage: InitiativeMessageRule,
		initiativeRollMode: InitiativeRollModeRule,
		maxHitDice: MaxHitDiceRule,
		maxHpBonus: MaxHpBonusRule,
		maximizeHitDice: MaximizeHitDiceRule,
		maxWounds: MaxWoundsRule,
		modifyIncomingAttack: ModifyIncomingAttackRule,
		modifyPool: ModifyPoolRule,
		modifyToggle: ModifyToggleRule,
		note: NoteRule,
		savingThrowBonus: SavingThrowBonusRule,
		savingThrowRollMode: SavingThrowRollModeRule,
		skillBonus: SkillBonusRule,
		skillRollMode: SkillRollModeRule,
		speedBonus: SpeedBonusRule,
		toggleEffect: ToggleEffectRule,
		unarmedDamage: UnarmedDamageRule,
	} as const;

	return { ruleDataModels, ruleTypes };
}
