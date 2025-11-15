import { NimbleCharacterCombatantData } from './CharacterCombatantDataModel';
import { NimbleNPCCombatantData } from './NPCCombatantDataModel';
import { NimbleSoloMonsterCombatantData } from './SoloMonsterCombatantDataModel';

const actorDataModels = {
	character: NimbleCharacterCombatantData,
	npc: NimbleNPCCombatantData,
	soloMonster: NimbleSoloMonsterCombatantData,
};

export default actorDataModels;

// Merge types into fvtt-types
declare global {
	interface DataModelConfig {
		Combatant: {
			character: NimbleCharacterCombatantData;
			npc: NimbleNPCCombatantData;
			soloMonster: NimbleSoloMonsterCombatantData;
		};
	}
}
