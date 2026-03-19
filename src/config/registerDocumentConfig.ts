// Actors
import { NimbleBaseActor } from '../documents/actor/base.svelte.js';
import { NimbleCharacter } from '../documents/actor/character.js';
import { NimbleMinion } from '../documents/actor/minion.js';
import { NimbleNPC } from '../documents/actor/npc.js';
import { NimbleSoloMonster } from '../documents/actor/soloMonster.js';
// Chat Messages
import { NimbleChatMessage } from '../documents/chatMessage.js';
// Combat
import { NimbleCombat } from '../documents/combat/combat.svelte.js';
import { NimbleCombatant } from '../documents/combatant/combatant.svelte.js';
import { NimbleAncestryItem } from '../documents/item/ancestry.js';
// Items
import { NimbleBackgroundItem } from '../documents/item/background.js';
import { NimbleBaseItem } from '../documents/item/base.svelte.js';
import { NimbleBoonItem } from '../documents/item/boon.js';
import { NimbleClassItem } from '../documents/item/class.js';
import { NimbleFeatureItem } from '../documents/item/feature.js';
import { NimbleMonsterFeatureItem } from '../documents/item/monsterFeature.js';
import { NimbleObjectItem } from '../documents/item/object.js';
import { NimbleSpellItem } from '../documents/item/spell.js';
import { NimbleSubclassItem } from '../documents/item/subclass.js';

// Scenes
import { NimbleScene } from '../documents/scene/scene.js';

// Tokens
import { NimbleTokenDocument } from '../documents/token/tokenDocument.js';

export default function registerDocumentConfig() {
	return {
		Actor: {
			documentClasses: {
				base: NimbleBaseActor,
				character: NimbleCharacter,
				soloMonster: NimbleSoloMonster,
				npc: NimbleNPC,
				minion: NimbleMinion,
			},
		},
		ChatMessage: {
			documentClass: NimbleChatMessage,
		},
		Combat: {
			documentClass: NimbleCombat,
		},
		Combatant: {
			documentClass: NimbleCombatant,
		},
		Item: {
			documentClasses: {
				base: NimbleBaseItem,
				background: NimbleBackgroundItem,
				boon: NimbleBoonItem,
				class: NimbleClassItem,
				feature: NimbleFeatureItem,
				monsterFeature: NimbleMonsterFeatureItem,
				object: NimbleObjectItem,
				ancestry: NimbleAncestryItem,
				spell: NimbleSpellItem,
				subclass: NimbleSubclassItem,
			},
		},
		Scene: {
			documentClass: NimbleScene,
		},
		Token: {
			documentClass: NimbleTokenDocument,
		},
	};
}
