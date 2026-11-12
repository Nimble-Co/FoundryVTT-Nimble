import { AbilityBonusRule } from '../models/rules/abilityBonus.js';
import { ActionCostRule } from '../models/rules/actionCost.js';
import { ActionDeltaRule } from '../models/rules/actionDelta.js';
import { ApplyConditionRule } from '../models/rules/applyCondition.js';
import { ArmorClassRule } from '../models/rules/armorClass.js';
import { AttackOutcomeRule } from '../models/rules/attackOutcome.js';
import { AuraReachRule } from '../models/rules/auraReach.js';
import { ChangeDieRule } from '../models/rules/changeDie.js';
import { ChangeEffectRule } from '../models/rules/changeEffect.js';
import { ChangeResultRule } from '../models/rules/changeResult.js';
import { ChargeConsumerRule } from '../models/rules/chargeConsumer.js';
import { ChargePoolRule } from '../models/rules/chargePool.js';
import { CombatManaRule } from '../models/rules/combatMana.js';
import { ConcentrationTrackRule } from '../models/rules/concentrationTrack.js';
import { ConditionalBonusRule } from '../models/rules/conditionalBonus.js';
import { ConditionImmunityRule } from '../models/rules/conditionImmunity.js';
import { CountAsMarkedRule } from '../models/rules/countAsMarked.js';
import { CritBackRule } from '../models/rules/critBack.js';
import { CritDiceRule } from '../models/rules/critDice.js';
import { CritDiceSaveRule } from '../models/rules/critDiceSave.js';
import { DamageBackRule } from '../models/rules/damageBack.js';
import { DamageBonusRule } from '../models/rules/damageBonus.js';
import { DamageMultiplierRule } from '../models/rules/damageMultiplier.js';
import { DamageReductionRule } from '../models/rules/damageReduction.js';
import { DefendOptionRule } from '../models/rules/defendOption.js';
import { DiceConsumerRule } from '../models/rules/diceConsumer.js';
import { DicePoolRule } from '../models/rules/dicePool.js';
import { DieResultEffectRule } from '../models/rules/dieResultEffect.js';
import { DyingActionLimitRule } from '../models/rules/dyingActionLimit.js';
import { EmptyPoolsAtEndRule } from '../models/rules/emptyPoolsAtEnd.js';
import { FreeAssessRule } from '../models/rules/freeAssess.js';
import { FreeMoveRule } from '../models/rules/freeMove.js';
import { FreeSpellCostRule } from '../models/rules/freeSpellCost.js';
import { GrantActivationRule } from '../models/rules/grantActivation.js';
import { ItemGrantRule } from '../models/rules/grantItem.js';
import { GrantMovementRule } from '../models/rules/grantMovement.js';
import { GrantProficiencyRule } from '../models/rules/grantProficiencies.js';
import { GrantSpellsRule } from '../models/rules/grantSpells.js';
import { HealingPotionBonusRule } from '../models/rules/healingPotionBonus.js';
import { HeldRollRule } from '../models/rules/heldRoll.js';
import { HitConditionRule } from '../models/rules/hitCondition.js';
import { HitDiceAdvantageRule } from '../models/rules/hitDiceAdvantage.js';
import { HoldOnTargetRule } from '../models/rules/holdOnTarget.js';
import { IncrementHitDiceRule } from '../models/rules/incrementHitDice.js';
import { InitiativeBonusRule } from '../models/rules/initiativeBonus.js';
import { InitiativeManaRule } from '../models/rules/initiativeMana.js';
import { InitiativeManaRerollOnesRule } from '../models/rules/initiativeManaRerollOnes.js';
import { InitiativeMessageRule } from '../models/rules/initiativeMessage.js';
import { InitiativeRollModeRule } from '../models/rules/initiativeRollMode.js';
import { KeepAmountRule } from '../models/rules/keepAmount.js';
import { MakeCritRule } from '../models/rules/makeCrit.js';
import { MarkTargetRule } from '../models/rules/markTarget.js';
import { MaxActionBonusRule } from '../models/rules/maxActionBonus.js';
import { MaxDamageRule } from '../models/rules/maxDamage.js';
import { MaxHitDiceRule } from '../models/rules/maxHitDice.js';
import { MaxHpBonusRule } from '../models/rules/maxHpBonus.js';
import { MaximizeHitDiceRule } from '../models/rules/maximizeHitDice.js';
import { MaxWoundsRule } from '../models/rules/maxWounds.js';
import { ModifyConsumerRule } from '../models/rules/modifyConsumer.js';
import { ModifyIncomingAttackRule } from '../models/rules/modifyIncomingAttack.js';
import { ModifyPoolRule } from '../models/rules/modifyPool.js';
import { ModifyRerollRule } from '../models/rules/modifyReroll.js';
import { MovementTriggerRule } from '../models/rules/movementTrigger.js';
import { NoteRule } from '../models/rules/note.js';
import { OfferAttackBonusRule } from '../models/rules/offerAttackBonus.js';
import { OptionSwapRule } from '../models/rules/optionSwap.js';
import { OptionWindowRule } from '../models/rules/optionWindow.js';
import { PoolDieToMaxRule } from '../models/rules/poolDieToMax.js';
import { PoolEmptyEffectRule } from '../models/rules/poolEmptyEffect.js';
import { PoolGainMessageRule } from '../models/rules/poolGainMessage.js';
import { PoolMaxBonusRule } from '../models/rules/poolMaxBonus.js';
import { PrimaryDieBonusRule } from '../models/rules/primaryDieBonus.js';
import { RerollRule } from '../models/rules/reroll.js';
import { SaveOnEventRule } from '../models/rules/saveOnEvent.js';
import { SavingThrowBonusRule } from '../models/rules/savingThrowBonus.js';
import { SavingThrowRollModeRule } from '../models/rules/savingThrowRollMode.js';
import { SituationalRollModeRule } from '../models/rules/situationalRollMode.js';
import { SkillBonusRule } from '../models/rules/skillBonus.js';
import { SkillPointMoveRule } from '../models/rules/skillPointMove.js';
import { SkillRollModeRule } from '../models/rules/skillRollMode.js';
import { SpeedBonusRule } from '../models/rules/speedBonus.js';
import { TableRollRule } from '../models/rules/tableRoll.js';
import { TableRollOptionsRule } from '../models/rules/tableRollOptions.js';
import { TagsRule } from '../models/rules/tags.js';
import { UnarmedDamageRule } from '../models/rules/unarmedDamage.js';
import { UseItemFreeRule } from '../models/rules/useItemFree.js';

/** Every rule type and its class. A rule type's label key is `NIMBLE.ruleTypes.<type>`. */
export const RULE_CLASSES = {
	abilityBonus: AbilityBonusRule,
	actionCost: ActionCostRule,
	actionDelta: ActionDeltaRule,
	applyCondition: ApplyConditionRule,
	armorClass: ArmorClassRule,
	auraReach: AuraReachRule,
	attackOutcome: AttackOutcomeRule,
	chargeConsumer: ChargeConsumerRule,
	changeDie: ChangeDieRule,
	changeEffect: ChangeEffectRule,
	changeResult: ChangeResultRule,
	chargePool: ChargePoolRule,
	combatMana: CombatManaRule,
	concentrationTrack: ConcentrationTrackRule,
	conditionalBonus: ConditionalBonusRule,
	conditionImmunity: ConditionImmunityRule,
	damageBonus: DamageBonusRule,
	damageBack: DamageBackRule,
	defendOption: DefendOptionRule,
	damageReduction: DamageReductionRule,
	dyingActionLimit: DyingActionLimitRule,
	emptyPoolsAtEnd: EmptyPoolsAtEndRule,
	freeMove: FreeMoveRule,
	freeSpellCost: FreeSpellCostRule,
	grantActivation: GrantActivationRule,
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
	optionWindow: OptionWindowRule,
	damageMultiplier: DamageMultiplierRule,
	heldRoll: HeldRollRule,
	countAsMarked: CountAsMarkedRule,
	poolEmptyEffect: PoolEmptyEffectRule,
	dieResultEffect: DieResultEffectRule,
	holdOnTarget: HoldOnTargetRule,
	keepAmount: KeepAmountRule,
	makeCrit: MakeCritRule,
	maxDamage: MaxDamageRule,
	maxActionBonus: MaxActionBonusRule,
	critDice: CritDiceRule,
	critDiceSave: CritDiceSaveRule,
	saveOnEvent: SaveOnEventRule,
	critBack: CritBackRule,
	freeAssess: FreeAssessRule,
	hitCondition: HitConditionRule,
	offerAttackBonus: OfferAttackBonusRule,
	poolDieToMax: PoolDieToMaxRule,
	tableRoll: TableRollRule,
	tableRollOptions: TableRollOptionsRule,
	initiativeMana: InitiativeManaRule,
	initiativeManaRerollOnes: InitiativeManaRerollOnesRule,
	maxHitDice: MaxHitDiceRule,
	maxHpBonus: MaxHpBonusRule,
	markTarget: MarkTargetRule,
	maximizeHitDice: MaximizeHitDiceRule,
	maxWounds: MaxWoundsRule,
	modifyIncomingAttack: ModifyIncomingAttackRule,
	modifyConsumer: ModifyConsumerRule,
	modifyPool: ModifyPoolRule,
	modifyReroll: ModifyRerollRule,
	movementTrigger: MovementTriggerRule,
	note: NoteRule,
	optionSwap: OptionSwapRule,
	poolGainMessage: PoolGainMessageRule,
	poolMaxBonus: PoolMaxBonusRule,
	primaryDieBonus: PrimaryDieBonusRule,
	reroll: RerollRule,
	savingThrowBonus: SavingThrowBonusRule,
	savingThrowRollMode: SavingThrowRollModeRule,
	situationalRollMode: SituationalRollModeRule,
	skillBonus: SkillBonusRule,
	skillPointMove: SkillPointMoveRule,
	skillRollMode: SkillRollModeRule,
	speedBonus: SpeedBonusRule,
	tags: TagsRule,
	useItemFree: UseItemFreeRule,
	unarmedDamage: UnarmedDamageRule,
} as const;
