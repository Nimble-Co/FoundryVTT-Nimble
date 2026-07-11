import { NimbleCharacterData } from './CharacterDataModel.js';
import { NimbleMinionData } from './MinionDataModel.js';
import { NimbleNPCData } from './NPCDataModel.js';
import { NimbleSoloMonsterData } from './SoloMonsterDataModel.js';

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
			minion: NimbleMinionData;
			soloMonster: NimbleSoloMonsterData;
		};
	}
}
