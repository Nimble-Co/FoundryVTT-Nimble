import { NIMBLE } from './config.js';

// Sheets
import BackgroundSheet from './documents/sheets/BackgroundSheet.svelte.js';
import BoonSheet from './documents/sheets/BoonSheet.svelte.js';
import ClassSheet from './documents/sheets/ClassSheet.svelte.js';
import FeatureSheet from './documents/sheets/FeatureSheet.svelte.js';
import MonsterFeatureSheet from './documents/sheets/MonsterFeatureSheet.svelte.js';
import ObjectSheet from './documents/sheets/ObjectSheet.svelte.js';
import PlayerCharacterSheet from './documents/sheets/PlayerCharacterSheet.svelte.js';
import AncestrySheet from './documents/sheets/AncestrySheet.svelte.js';
import SpellSheet from './documents/sheets/SpellSheet.svelte.js';
import SubclassSheet from './documents/sheets/SubclassSheet.svelte.js';

// Dialogs
import NimbleNexusImportDialog from './import/nimbleNexus/NimbleNexusImportDialog.svelte.js';

// Managers
import { ConditionManager } from './managers/ConditionManager.js';
import { ModifierManager } from './managers/ModifierManager.js';

// Macros
import { activateItemMacro } from './macros/activateItemMacro.ts';
import { createMacro } from './macros/createMacro.ts';

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
	dialogs: {
		NimbleNexusImportDialog,
	},
	macros: {
		activateItemMacro,
		createMacro,
	},
	managers,
	migrations: {},
	utils: {},
};

export { NIMBLE_GAME };
