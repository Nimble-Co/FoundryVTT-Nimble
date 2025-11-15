import { NimbleAbilityCheckCardData } from './AbilityCheckCardDataModel';
import { NimbleFeatureCardData } from './FeatureCardDataModel';
import { NimbleLevelUpSummaryCardData } from './LevelUpSummaryCardDataModel';
import { NimbleObjectCardData } from './ObjectCardDataModel';
import { NimbleSavingThrowCardData } from './SavingThrowCardDataModel';
import { NimbleSkillCheckCardData } from './SkillCheckCardDataModel';
import { NimbleSpellCardData } from './SpellCardDataModel';

const chatDataModels = {
	abilityCheck: NimbleAbilityCheckCardData,
	feature: NimbleFeatureCardData,
	levelUpSummary: NimbleLevelUpSummaryCardData,
	object: NimbleObjectCardData,
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
			feature: NimbleFeatureCardData;
			levelUpSummary: NimbleLevelUpSummaryCardData;
			object: NimbleObjectCardData;
			savingThrow: NimbleSavingThrowCardData;
			skillCheck: NimbleSkillCheckCardData;
			spell: NimbleSpellCardData;
		};
	}
}
