import { NimbleCharacterData } from './CharacterDataModel.js';
import { NimbleNPCData } from './NPCDataModel.js';
import { NimbleMinionData } from './MinionDataModel.js';
import { NimbleSoloMonsterData } from './SoloMonsterDataModel.js';

const actorDataModels = {
	character: NimbleCharacterData,
	npc: NimbleNPCData,
	minion: NimbleMinionData,
	soloMonster: NimbleSoloMonsterData,
};

export default actorDataModels;

// Merge types into fvtt-types
declare module 'fvtt-types/configuration' {
	interface DataModelConfig {
		Actor: {
			character: typeof NimbleCharacterData;
			npc: typeof NimbleNPCData;
			minion: typeof NimbleMinionData;
			soloMonster: typeof NimbleSoloMonsterData;
		};
	}
}
