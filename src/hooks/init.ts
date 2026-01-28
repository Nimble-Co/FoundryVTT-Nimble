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
import registerSystemSettings from '../settings/index.js';

export default function init() {
	CONFIG.NIMBLE = NIMBLE;
	CONFIG.Actor.documentClass = ActorProxy as typeof CONFIG.Actor.documentClass;
	CONFIG.Combat.documentClass = NimbleCombat as typeof CONFIG.Combat.documentClass;
	CONFIG.Combatant.documentClass = NimbleCombatant as typeof CONFIG.Combatant.documentClass;
	CONFIG.ChatMessage.documentClass = NimbleChatMessage as typeof CONFIG.ChatMessage.documentClass;
	CONFIG.Item.documentClass = ItemProxy as typeof CONFIG.Item.documentClass;
	CONFIG.Token.documentClass = NimbleTokenDocument as typeof CONFIG.Token.documentClass;

	// Add data models
	CONFIG.ActiveEffect.dataModels =
		activeEffectDataModels as object as typeof CONFIG.ActiveEffect.dataModels;
	CONFIG.Actor.dataModels = actorDataModels as object as typeof CONFIG.Actor.dataModels;
	CONFIG.ChatMessage.dataModels = chatDataModels as object as typeof CONFIG.ChatMessage.dataModels;
	CONFIG.Combatant.dataModels = combatantDataModels as object as typeof CONFIG.Combatant.dataModels;
	CONFIG.Item.dataModels = itemDataModels as object as typeof CONFIG.Item.dataModels;

	// Add Dice
	CONFIG.Dice.rolls.push(DamageRoll as (typeof CONFIG.Dice.rolls)[number]);
	CONFIG.Dice.rolls.push(NimbleRoll as (typeof CONFIG.Dice.rolls)[number]);
	CONFIG.Dice.types.push(PrimaryDie);

	// Adds Scene data
	CONFIG.Actor.trackableAttributes = trackableAttributes;

	// Add/Update Layers
	CONFIG.Canvas.layers.templates.layerClass = NimbleTemplateLayer;

	game.nimble = NIMBLE_GAME;

	// Set tooltips to animate faster
	foundry.helpers.interaction.TooltipManager.implementation.TOOLTIP_ACTIVATION_MS = 100;

	registerCustomEnrichers();
	registerSystemSettings();

	// Sheet registration types
	type ActorSheetConstructor = Parameters<
		typeof foundry.documents.collections.Actors.registerSheet
	>[1];
	type ItemSheetConstructor = Parameters<
		typeof foundry.documents.collections.Items.registerSheet
	>[1];

	// Sheet registration
	foundry.documents.collections.Actors.unregisterSheet('core', foundry.appv1.sheets.ActorSheet);

	foundry.documents.collections.Actors.registerSheet(
		'nimble',
		NPCSheet as unknown as ActorSheetConstructor,
		{
			types: ['npc'],
			makeDefault: true,
			label: 'NIMBLE.sheets.npc',
		},
	);

	foundry.documents.collections.Actors.registerSheet(
		'nimble',
		PlayerCharacterSheet as unknown as ActorSheetConstructor,
		{
			types: ['character'],
			makeDefault: true,
			label: 'NIMBLE.sheets.playerCharacter',
		},
	);

	foundry.documents.collections.Actors.registerSheet(
		'nimble',
		NPCSheet as unknown as ActorSheetConstructor,
		{
			types: ['soloMonster'],
			makeDefault: true,
			label: 'NIMBLE.sheets.npc',
		},
	);

	foundry.documents.collections.Actors.registerSheet(
		'nimble',
		NPCSheet as unknown as ActorSheetConstructor,
		{
			types: ['minion'],
			makeDefault: true,
			label: 'NIMBLE.sheets.npc',
		},
	);

	foundry.documents.collections.Items.unregisterSheet('core', foundry.appv1.sheets.ItemSheet);

	foundry.documents.collections.Items.registerSheet(
		'nimble',
		BackgroundSheet as unknown as ItemSheetConstructor,
		{
			types: ['background'],
			makeDefault: true,
			label: 'NIMBLE.sheets.background',
		},
	);

	foundry.documents.collections.Items.registerSheet(
		'nimble',
		BoonSheet as unknown as ItemSheetConstructor,
		{
			types: ['boon'],
			makeDefault: true,
			label: 'NIMBLE.sheets.boon',
		},
	);
	foundry.documents.collections.Items.registerSheet(
		'nimble',
		ClassSheet as unknown as ItemSheetConstructor,
		{
			types: ['class'],
			makeDefault: true,
			label: 'NIMBLE.sheets.class',
		},
	);

	foundry.documents.collections.Items.registerSheet(
		'nimble',
		FeatureSheet as unknown as ItemSheetConstructor,
		{
			types: ['feature'],
			makeDefault: true,
			label: 'NIMBLE.sheets.feature',
		},
	);

	foundry.documents.collections.Items.registerSheet(
		'nimble',
		MonsterFeatureSheet as unknown as ItemSheetConstructor,
		{
			types: ['monsterFeature'],
			makeDefault: true,
			label: 'NIMBLE.sheets.monsterFeature',
		},
	);

	foundry.documents.collections.Items.registerSheet(
		'nimble',
		ObjectSheet as unknown as ItemSheetConstructor,
		{
			types: ['object'],
			makeDefault: true,
			label: 'NIMBLE.sheets.object',
		},
	);

	foundry.documents.collections.Items.registerSheet(
		'nimble',
		AncestrySheet as unknown as ItemSheetConstructor,
		{
			types: ['ancestry'],
			makeDefault: true,
			label: 'NIMBLE.sheets.ancestry',
		},
	);

	foundry.documents.collections.Items.registerSheet(
		'nimble',
		SpellSheet as unknown as ItemSheetConstructor,
		{
			types: ['spell'],
			makeDefault: true,
			label: 'NIMBLE.sheets.spell',
		},
	);

	foundry.documents.collections.Items.registerSheet(
		'nimble',
		SubclassSheet as unknown as ItemSheetConstructor,
		{
			types: ['subclass'],
			makeDefault: true,
			label: 'NIMBLE.sheets.subclass',
		},
	);
}
