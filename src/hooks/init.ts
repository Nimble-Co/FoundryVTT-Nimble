import { NimbleTemplateLayer } from '../canvas/layers/templateLayer';
import { NIMBLE } from '../config';
import { DamageRoll } from '../dice/DamageRoll';
import { NimbleRoll } from '../dice/NimbleRoll';
import { PrimaryDie } from '../dice/terms/PrimaryDie';
import ActorProxy from '../documents/actor/actorProxy';
import { trackableAttributes } from '../documents/actor/trackableAttributes';
import { NimbleChatMessage } from '../documents/chatMessage';
import { NimbleCombat } from '../documents/combat/combat.svelte';
import { NimbleCombatant } from '../documents/combatant/combatant.svelte';
import ItemProxy from '../documents/item/itemProxy';
import AncestrySheet from '../documents/sheets/AncestrySheet.svelte';
import BackgroundSheet from '../documents/sheets/BackgroundSheet.svelte';
import BoonSheet from '../documents/sheets/BoonSheet.svelte';
import ClassSheet from '../documents/sheets/ClassSheet.svelte';
import FeatureSheet from '../documents/sheets/FeatureSheet.svelte';
import MonsterFeatureSheet from '../documents/sheets/MonsterFeatureSheet.svelte';
import NPCSheet from '../documents/sheets/NPCSheet.svelte';
import ObjectSheet from '../documents/sheets/ObjectSheet.svelte';
import PlayerCharacterSheet from '../documents/sheets/PlayerCharacterSheet.svelte';
import SpellSheet from '../documents/sheets/SpellSheet.svelte';
import SubclassSheet from '../documents/sheets/SubclassSheet.svelte';
import { NimbleTokenDocument } from '../documents/token/tokenDocument';
import registerCustomEnrichers from '../enrichers/registerCustomEnrichers';
import { NIMBLE_GAME } from '../game';
import activeEffectDataModels from '../models/activeEffect/activeEffectDataModels';
import actorDataModels from '../models/actor/actorDataModels';
import chatDataModels from '../models/chat/chatDataModels';
import combatantDataModels from '../models/combatant/combatantDataModels';
import itemDataModels from '../models/item/itemDataModels';

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
	foundry.helpers.interaction.TooltipManager.implementation.TOOLTIP_ACTIVATION_MS = 100;

	registerCustomEnrichers();

	// Sheet registration
	foundry.documents.collections.Actors.unregisterSheet('core', foundry.appv1.sheets.ActorSheet);

	foundry.documents.collections.Actors.registerSheet('nimble', NPCSheet, {
		types: ['npc'],
		makeDefault: true,
		label: 'NIMBLE.sheets.npc',
	});

	foundry.documents.collections.Actors.registerSheet('nimble', PlayerCharacterSheet, {
		types: ['character'],
		makeDefault: true,
		label: 'NIMBLE.sheets.playerCharacter',
	});

	foundry.documents.collections.Actors.registerSheet('nimble', NPCSheet, {
		types: ['soloMonster'],
		makeDefault: true,
		label: 'NIMBLE.sheets.npc',
	});

	foundry.documents.collections.Actors.registerSheet('nimble', NPCSheet, {
		types: ['minion'],
		makeDefault: true,
		label: 'NIMBLE.sheets.npc',
	});

	foundry.documents.collections.Items.unregisterSheet('core', foundry.appv1.sheets.ItemSheet);

	foundry.documents.collections.Items.registerSheet('nimble', BackgroundSheet, {
		types: ['background'],
		makeDefault: true,
		label: 'NIMBLE.sheets.background',
	});

	foundry.documents.collections.Items.registerSheet('nimble', BoonSheet, {
		types: ['boon'],
		makeDefault: true,
		label: 'NIMBLE.sheets.boon',
	});
	foundry.documents.collections.Items.registerSheet('nimble', ClassSheet, {
		types: ['class'],
		makeDefault: true,
		label: 'NIMBLE.sheets.class',
	});

	foundry.documents.collections.Items.registerSheet('nimble', FeatureSheet, {
		types: ['feature'],
		makeDefault: true,
		label: 'NIMBLE.sheets.feature',
	});

	foundry.documents.collections.Items.registerSheet('nimble', MonsterFeatureSheet, {
		types: ['monsterFeature'],
		makeDefault: true,
		label: 'NIMBLE.sheets.monsterFeature',
	});

	foundry.documents.collections.Items.registerSheet('nimble', ObjectSheet, {
		types: ['object'],
		makeDefault: true,
		label: 'NIMBLE.sheets.object',
	});

	foundry.documents.collections.Items.registerSheet('nimble', AncestrySheet, {
		types: ['ancestry'],
		makeDefault: true,
		label: 'NIMBLE.sheets.ancestry',
	});

	foundry.documents.collections.Items.registerSheet('nimble', SpellSheet, {
		types: ['spell'],
		makeDefault: true,
		label: 'NIMBLE.sheets.spell',
	});

	foundry.documents.collections.Items.registerSheet('nimble', SubclassSheet, {
		types: ['subclass'],
		makeDefault: true,
		label: 'NIMBLE.sheets.subclass',
	});
}
