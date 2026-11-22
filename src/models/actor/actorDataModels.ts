import { NimbleCharacterData } from './CharacterDataModel.js';
import { NimbleMinionData } from './MinionDataModel.js';
import { NimbleNPCData } from './NPCDataModel.js';
import { NimblePartyInventoryData } from './PartyInventoryDataModel.js';
import { NimbleSoloMonsterData } from './SoloMonsterDataModel.js';

const actorDataModels = {
	character: NimbleCharacterData,
	npc: NimbleNPCData,
	minion: NimbleMinionData,
	soloMonster: NimbleSoloMonsterData,
	partyInventory: NimblePartyInventoryData,
};

export default actorDataModels;

// Merge types into fvtt-types
declare global {
	interface DataModelConfig {
		Actor: {
			character: typeof NimbleCharacterData;
			npc: typeof NimbleNPCData;
			minion: typeof NimbleMinionData;
			soloMonster: typeof NimbleSoloMonsterData;
			partyInventory: typeof NimblePartyInventoryData;
		};
	}
}
