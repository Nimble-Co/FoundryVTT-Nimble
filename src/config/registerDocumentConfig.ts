// Actors
import { NimbleBaseActor } from '../documents/actor/base.svelte';
import { NimbleCharacter } from '../documents/actor/character';
import { NimbleMinion } from '../documents/actor/minion';
import { NimbleNPC } from '../documents/actor/npc';
import { NimbleSoloMonster } from '../documents/actor/soloMonster';

// Combat
import { NimbleCombat } from '../documents/combat/combat.svelte';
import { NimbleCombatant } from '../documents/combatant/combatant.svelte';

// Chat Messages
import { NimbleChatMessage } from '../documents/chatMessage';

// Items
import { NimbleBackgroundItem } from '../documents/item/background';
import { NimbleBaseItem } from '../documents/item/base.svelte';
import { NimbleBoonItem } from '../documents/item/boon';
import { NimbleClassItem } from '../documents/item/class';
import { NimbleFeatureItem } from '../documents/item/feature';
import { NimbleMonsterFeatureItem } from '../documents/item/monsterFeature';
import { NimbleObjectItem } from '../documents/item/object';
import { NimbleAncestryItem } from '../documents/item/ancestry';
import { NimbleSpellItem } from '../documents/item/spell';
import { NimbleSubclassItem } from '../documents/item/subclass';

// Tokens
import { NimbleTokenDocument } from '../documents/token/tokenDocument';

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
		Token: {
			documentClass: NimbleTokenDocument,
		},
	};
}
