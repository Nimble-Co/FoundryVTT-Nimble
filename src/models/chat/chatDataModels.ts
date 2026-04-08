import { NimbleAbilityCheckCardData } from './AbilityCheckCardDataModel.js';
import { NimbleAssessActionCardData } from './AssessActionCardDataModel.js';
import { NimbleChargeAdjustmentCardData } from './ChargeAdjustmentCardDataModel.js';
import { NimbleFeatureCardData } from './FeatureCardDataModel.js';
import { NimbleFieldRestCardData } from './FieldRestCardDataModel.js';
import { NimbleLevelUpSummaryCardData } from './LevelUpSummaryCardDataModel.js';
import { NimbleMinionGroupAttackCardData } from './MinionGroupAttackCardDataModel.js';
import { NimbleMoveActionCardData } from './MoveActionCardDataModel.js';
import { NimbleObjectCardData } from './ObjectCardDataModel.js';
import { NimbleReactionCardData } from './ReactionCardDataModel.js';
import { NimbleSafeRestCardData } from './SafeRestCardDataModel.js';
import { NimbleSavingThrowCardData } from './SavingThrowCardDataModel.js';
import { NimbleSkillCheckCardData } from './SkillCheckCardDataModel.js';
import { NimbleSpellCardData } from './SpellCardDataModel.js';

const chatDataModels = {
	abilityCheck: NimbleAbilityCheckCardData,
	assessAction: NimbleAssessActionCardData,
	chargeAdjustment: NimbleChargeAdjustmentCardData,
	feature: NimbleFeatureCardData,
	fieldRest: NimbleFieldRestCardData,
	levelUpSummary: NimbleLevelUpSummaryCardData,
	minionGroupAttack: NimbleMinionGroupAttackCardData,
	moveAction: NimbleMoveActionCardData,
	object: NimbleObjectCardData,
	reaction: NimbleReactionCardData,
	safeRest: NimbleSafeRestCardData,
	savingThrow: NimbleSavingThrowCardData,
	skillCheck: NimbleSkillCheckCardData,
	spell: NimbleSpellCardData,
};

export default chatDataModels;

// Merge types into fvtt-types
declare global {
	interface DataModelConfig {
		ChatMessage: {
			abilityCheck: NimbleAbilityCheckCardData;
			assessAction: NimbleAssessActionCardData;
			chargeAdjustment: NimbleChargeAdjustmentCardData;
			feature: NimbleFeatureCardData;
			fieldRest: NimbleFieldRestCardData;
			levelUpSummary: NimbleLevelUpSummaryCardData;
			minionGroupAttack: NimbleMinionGroupAttackCardData;
			moveAction: NimbleMoveActionCardData;
			object: NimbleObjectCardData;
			reaction: NimbleReactionCardData;
			safeRest: NimbleSafeRestCardData;
			savingThrow: NimbleSavingThrowCardData;
			skillCheck: NimbleSkillCheckCardData;
			spell: NimbleSpellCardData;
		};
	}
}
