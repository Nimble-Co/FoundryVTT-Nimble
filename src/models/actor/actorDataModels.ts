import { NimbleCharacterData } from './CharacterDataModel';
import { NimbleNPCData } from './NPCDataModel';
import { NimbleMinionData } from './MinionDataModel';
import { NimbleSoloMonsterData } from './SoloMonsterDataModel';

const actorDataModels = {
	character: NimbleCharacterData,
	npc: NimbleNPCData,
	minion: NimbleMinionData,
	soloMonster: NimbleSoloMonsterData,
};

export default actorDataModels;

// Merge types into fvtt-types
declare global {
	interface DataModelConfig {
		Actor: {
			character: NimbleCharacterData;
			npc: NimbleNPCData;
			soloMonster: NimbleSoloMonsterData;
		};
	}
}
