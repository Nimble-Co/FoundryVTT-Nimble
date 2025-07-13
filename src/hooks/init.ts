import { NIMBLE } from '../config.js';

import activeEffectDataModels from '../models/activeEffect/activeEffectDataModels.js';
import actorDataModels from '../models/actor/actorDataModels.js';
import chatDataModels from '../models/chat/chatDataModels.js';
import combatantDataModels from '../models/combatant/combatantDataModels.js';
import itemDataModels from '../models/item/itemDataModels.js';

import ActorProxy from '../documents/actor/actorProxy.js';
import ItemProxy from '../documents/item/itemProxy.js';
import { NimbleChatMessage } from '../documents/chatMessage.js';
import { NimbleCombat } from '../documents/combat/combat.svelte.js';
import { NimbleCombatant } from '../documents/combatant/combatant.svelte.js';
import { NimbleTokenDocument } from '../documents/token/tokenDocument.js';

import PlayerCharacterSheet from '../documents/sheets/PlayerCharacterSheet.svelte.js';
import NPCSheet from '../documents/sheets/NPCSheet.svelte.js';

import BackgroundSheet from '../documents/sheets/BackgroundSheet.svelte.js';
import BoonSheet from '../documents/sheets/BoonSheet.svelte.js';
import ClassSheet from '../documents/sheets/ClassSheet.svelte.js';
import FeatureSheet from '../documents/sheets/FeatureSheet.svelte.js';
import MonsterFeatureSheet from '../documents/sheets/MonsterFeatureSheet.svelte.js';
import ObjectSheet from '../documents/sheets/ObjectSheet.svelte.js';
import AncestrySheet from '../documents/sheets/AncestrySheet.svelte.js';
import SpellSheet from '../documents/sheets/SpellSheet.svelte.js';
import SubclassSheet from '../documents/sheets/SubclassSheet.svelte.js';

import { DamageRoll } from '../dice/DamageRoll.js';
import { NimbleRoll } from '../dice/NimbleRoll.js';
import { PrimaryDie } from '../dice/terms/PrimaryDie.js';

import { NimbleTemplateLayer } from '../canvas/layers/templateLayer.js';

import { trackableAttributes } from '../documents/actor/trackableAttributes.ts';
import registerCustomEnrichers from '../enrichers/registerCustomEnrichers.js';

import { NIMBLE_GAME } from '../game.js';

export default function init() {
	CONFIG.NIMBLE = NIMBLE;
	CONFIG.Actor.documentClass = ActorProxy;
	CONFIG.Combat.documentClass = NimbleCombat;
	CONFIG.Combatant.documentClass = NimbleCombatant;
	CONFIG.ChatMessage.documentClass = NimbleChatMessage;
	CONFIG.Item.documentClass = ItemProxy;
	CONFIG.Token.documentClass = NimbleTokenDocument;

	// Add data models
	CONFIG.ActiveEffect.dataModels = activeEffectDataModels;
	CONFIG.Actor.dataModels = actorDataModels;
	CONFIG.ChatMessage.dataModels = chatDataModels;
	CONFIG.Combatant.dataModels = combatantDataModels;
	CONFIG.Item.dataModels = itemDataModels;

	// Add Dice
	CONFIG.Dice.rolls.push(DamageRoll);
	CONFIG.Dice.rolls.push(NimbleRoll);
	CONFIG.Dice.types.push(PrimaryDie);

	// Adds Scene data
	CONFIG.Actor.trackableAttributes = trackableAttributes;

	// Add/Update Layers
	CONFIG.Canvas.layers.templates.layerClass = NimbleTemplateLayer;

	game.nimble = NIMBLE_GAME;

	// Set tooltips to animate faster
	TooltipManager.TOOLTIP_ACTIVATION_MS = 100;

	registerCustomEnrichers();

	// Sheet registration
	Actors.unregisterSheet('core', ActorSheet);

	Actors.registerSheet('nimble', NPCSheet, {
		types: ['npc'],
		makeDefault: true,
		label: 'NIMBLE.sheets.npc',
	});

	Actors.registerSheet('nimble', PlayerCharacterSheet, {
		types: ['character'],
		makeDefault: true,
		label: 'NIMBLE.sheets.playerCharacter',
	});

	Actors.registerSheet('nimble', NPCSheet, {
		types: ['soloMonster'],
		makeDefault: true,
		label: 'NIMBLE.sheets.npc',
	});

	Actors.registerSheet('nimble', NPCSheet, {
		types: ['minion'],
		makeDefault: true,
		label: 'NIMBLE.sheets.npc',
	});

	Items.unregisterSheet('core', ItemSheet);

	Items.registerSheet('nimble', BackgroundSheet, {
		types: ['background'],
		makeDefault: true,
		label: 'NIMBLE.sheets.background',
	});

	Items.registerSheet('nimble', BoonSheet, {
		types: ['boon'],
		makeDefault: true,
		label: 'NIMBLE.sheets.boon',
	});
	Items.registerSheet('nimble', ClassSheet, {
		types: ['class'],
		makeDefault: true,
		label: 'NIMBLE.sheets.class',
	});

	Items.registerSheet('nimble', FeatureSheet, {
		types: ['feature'],
		makeDefault: true,
		label: 'NIMBLE.sheets.feature',
	});

	Items.registerSheet('nimble', MonsterFeatureSheet, {
		types: ['monsterFeature'],
		makeDefault: true,
		label: 'NIMBLE.sheets.monsterFeature',
	});

	Items.registerSheet('nimble', ObjectSheet, {
		types: ['object'],
		makeDefault: true,
		label: 'NIMBLE.sheets.object',
	});

	Items.registerSheet('nimble', AncestrySheet, {
		types: ['ancestry'],
		makeDefault: true,
		label: 'NIMBLE.sheets.ancestry',
	});

	Items.registerSheet('nimble', SpellSheet, {
		types: ['spell'],
		makeDefault: true,
		label: 'NIMBLE.sheets.spell',
	});

	Items.registerSheet('nimble', SubclassSheet, {
		types: ['subclass'],
		makeDefault: true,
		label: 'NIMBLE.sheets.subclass',
	});
}
