import { NIMBLE } from './config';
import AncestrySheet from './documents/sheets/AncestrySheet.svelte';
// Sheets
import BackgroundSheet from './documents/sheets/BackgroundSheet.svelte';
import BoonSheet from './documents/sheets/BoonSheet.svelte';
import ClassSheet from './documents/sheets/ClassSheet.svelte';
import FeatureSheet from './documents/sheets/FeatureSheet.svelte';
import MonsterFeatureSheet from './documents/sheets/MonsterFeatureSheet.svelte';
import ObjectSheet from './documents/sheets/ObjectSheet.svelte';
import PlayerCharacterSheet from './documents/sheets/PlayerCharacterSheet.svelte';
import SpellSheet from './documents/sheets/SpellSheet.svelte';
import SubclassSheet from './documents/sheets/SubclassSheet.svelte';
// Macros
import { activateItemMacro } from './macros/activateItemMacro';
import { createMacro } from './macros/createMacro';
// Managers
import { ConditionManager } from './managers/ConditionManager';
import { ModifierManager } from './managers/ModifierManager';

const managers = {
	ConditionManager,
	ModifierManager,
};

const NIMBLE_GAME = {
	applications: {
		BackgroundSheet,
		BoonSheet,
		ClassSheet,
		FeatureSheet,
		ObjectSheet,
		MonsterFeatureSheet,
		PlayerCharacterSheet,
		AncestrySheet,
		SpellSheet,
		SubclassSheet,
	},
	conditions: new ConditionManager(),
	config: NIMBLE,
	dice: {},
	documentClasses: {
		...NIMBLE.Actor.documentClasses,
		...NIMBLE.Combat.documentClass,
		...NIMBLE.Combatant.documentClass,
		...NIMBLE.Item.documentClasses,
	},
	dialogs: {},
	macros: {
		activateItemMacro,
		createMacro,
	},
	managers,
	migrations: {},
	utils: {},
};

export { NIMBLE_GAME };
