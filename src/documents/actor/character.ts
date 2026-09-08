import type { NimbleAncestryItem } from '#documents/item/ancestry.js';
import type { NimbleAncestryBonusItem } from '#documents/item/ancestryBonus.js';
import type { NimbleBackgroundItem } from '#documents/item/background.js';
import type { NimbleBoonItem } from '#documents/item/boon.js';
import type { NimbleClassItem } from '#documents/item/class.js';
import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { NimbleSubclassItem } from '#documents/item/subclass.js';
import { SYSTEM_ID, systemHookName } from '#system';
import type {
	LevelCorrectionSelection,
	LevelCorrectionSubmitData,
	ResolvedLevelSelectionGap,
} from '#types/components/CharacterLevelCorrectionDialog.d.ts';
import type { ResolvedOptionSwapOffer, ResolvedSwappableOptionPool } from '#types/optionSwap.d.ts';
import type { SkillKeyType } from '#types/skillKey.js';
import collectOptionPicks from '#utils/collectOptionPicks.ts';
import collectSwappableOptions from '#utils/collectSwappableOptions.ts';
import findMissingLevelSelections, {
	type MissingLevelSelection,
} from '#utils/findMissingLevelSelections.ts';
import { buildClassFeatureIndex } from '#utils/getClassFeatures.ts';
import localize from '#utils/localize.js';
import planOptionSwap, { type OptionSwapPlan } from '#utils/planOptionSwap.ts';
import resolveOptionSwapOffer from '#utils/resolveOptionSwapOffer.ts';
import { getHighestSpellTier } from '#utils/spell/getHighestSpellTier.ts';
import summarizeOptionSwap from '#utils/summarizeOptionSwap.ts';
import CharacterMetaConfigDialog from '#view/dialogs/CharacterMetaConfigDialog.svelte';
import getDeterministicBonus from '../../dice/getDeterministicBonus.ts';
import { NimbleRoll } from '../../dice/NimbleRoll.js';
import { HitDiceManager, incrementDieSize } from '../../managers/HitDiceManager.js';
import { type OptionChange, RestManager } from '../../managers/RestManager.js';
import type { NimbleCharacterData } from '../../models/actor/CharacterDataModel.js';
import type { MaxHpBonusRule } from '../../models/rules/maxHpBonus.js';
import calculateRollMode from '../../utils/calculateRollMode.js';
import {
	consumeCombatantAction,
	getCombatantCurrentActions,
} from '../../utils/combatTurnActions.js';
import getRollFormula from '../../utils/getRollFormula.js';
import showInsufficientActionsConfirmation from '../../utils/showInsufficientActionsConfirmation.js';
import toMessageMode from '../../utils/toMessageMode.js';
import CharacterArmorProficienciesConfigDialog from '../../view/dialogs/CharacterArmorProficienciesConfigDialog.svelte';
import CharacterLanguageProficienciesConfigDialog from '../../view/dialogs/CharacterLanguageProficienciesConfigDialog.svelte';
import CharacterLevelCorrectionDialog from '../../view/dialogs/CharacterLevelCorrectionDialog.svelte';
import CharacterLevelDownDialog from '../../view/dialogs/CharacterLevelDownDialog.svelte';
import CharacterLevelUpDialog from '../../view/dialogs/CharacterLevelUpDialog.svelte';
import CharacterMovementConfigDialog from '../../view/dialogs/CharacterMovementConfigDialog.svelte';
import CharacterSkillsConfigDialog from '../../view/dialogs/CharacterSkillsConfigDialog.svelte';
import CharacterStatConfigDialog from '../../view/dialogs/CharacterStatConfigDialog.svelte';
import CharacterWeaponProficienciesConfigDialog from '../../view/dialogs/CharacterWeaponProficienciesConfigDialog.svelte';
import DamageDefensesConfig from '../../view/dialogs/components/DamageDefensesConfig.svelte';
import EditCurrentHitDiceDialog from '../../view/dialogs/EditCurrentHitDiceDialog.svelte';
import EditHitDiceDialog from '../../view/dialogs/EditHitDiceDialog.svelte';
import EditHitPointsDialog from '../../view/dialogs/EditHitPointsDialog.svelte';
import EditManaDialog from '../../view/dialogs/EditManaDialog.svelte';
import FieldRestDialog from '../../view/dialogs/FieldRestDialog.svelte';
import RollHitDiceDialog from '../../view/dialogs/RollHitDiceDialog.svelte';
import SafeRestDialog from '../../view/dialogs/SafeRestDialog.svelte';
import GenericDialog from '../dialogs/GenericDialog.svelte.js';
import type { ActorRollOptions } from './actorInterfaces.ts';
import { NimbleBaseActor } from './base.svelte.js';
import resolveCharacterItemActionCost, {
	type ActivatableItem,
} from './resolveCharacterItemActionCost.js';

// Note: NimbleClassItem, NimbleSubclassItem, NimbleAncestryItem, NimbleBackgroundItem
// are ambient types declared in src/documents/item/item.d.ts

/** Wide enough for the option cards a rest dialog shows when a swap is on offer. */
const REST_DIALOG_WIDTH_WITH_OPTIONS = 480;

/** Extended dialog result type for configuring hit points */
interface ConfigureHitPointsResult {
	classUpdates: Array<{ id: string; hpData: number[] }>;
	bonus: number;
}

/** Extended dialog result type for configuring hit dice */
interface ConfigureHitDiceResult {
	bonusDice: Array<{ size: number; value: number; name: string }>;
}

/** Roll hit dice dialog result data */
interface RollHitDiceResult {
	selections: Record<string, number>;
	addStrBonus: boolean;
	applyToHP: boolean;
}

/** Edit current hit dice dialog result data */
interface EditCurrentHitDiceResult {
	currentValues: Record<string, number>;
}

/** Configure mana dialog result data */
interface ConfigureManaResult {
	baseMax: number;
}

/** Level up dialog result data */
interface LevelUpDialogData {
	takeAverageHp: boolean;
	selectedAbilityScore: string | null;
	skillPointChanges: Record<string, number>;
	selectedSubclass: NimbleSubclassItem | null;
	selectedEpicBoon: NimbleBoonItem | null;
	classFeatures?: {
		autoGrant: string[];
		selected: Map<string, NimbleFeatureItem[]>;
		grantedOptionItems?: string[];
	};
	spellUuids: string[];
}

export class NimbleCharacter extends NimbleBaseActor<'character'> {
	declare _ancestry: NimbleAncestryItem | undefined;

	declare _ancestryBonus: NimbleAncestryBonusItem | undefined;

	declare _background: NimbleBackgroundItem | undefined;

	declare _classes: Record<string, NimbleClassItem> | undefined;

	declare levels: { character: number; classes: Record<string, number> };

	declare system: NimbleCharacterData;

	declare HitDiceManager: HitDiceManager;

	#dialogs: Record<string, GenericDialog>;

	constructor(data: Actor.CreateData<'character'>, context?: Actor.ConstructionContext) {
		super(data, context);

		this.#dialogs = {};
	}

	get ancestry() {
		if (this._ancestry !== undefined) return this._ancestry;

		this._ancestry = this.items.find((i) => i.isType('ancestry')) as NimbleAncestryItem | undefined;
		return this._ancestry;
	}

	get ancestryBonus() {
		if (this._ancestryBonus !== undefined) return this._ancestryBonus;

		this._ancestryBonus = this.items.find((i) => i.isType('ancestryBonus')) as
			| NimbleAncestryBonusItem
			| undefined;
		return this._ancestryBonus;
	}

	get background() {
		if (this._background !== undefined) return this._background;

		this._background = this.items.find((i) => i.isType('background')) as
			| NimbleBackgroundItem
			| undefined;
		return this._background;
	}

	get classes(): Record<string, NimbleClassItem> {
		if (this._classes !== undefined) return this._classes;

		this._classes = this.items.reduce(
			(acc, item) => {
				if (!item.isType('class')) return acc;

				// Cast to ambient NimbleClassItem type (from item.d.ts)
				acc[item.identifier] = item as unknown as NimbleClassItem;
				return acc;
			},
			{} as Record<string, NimbleClassItem>,
		);

		return this._classes;
	}

	/** ------------------------------------------------------ */
	/**                 Data Prep Functions                    */
	/** ------------------------------------------------------ */
	protected override _onBeforePrepareData(): void {
		this._ancestry = undefined;
		this._ancestryBonus = undefined;
		this._background = undefined;
		this._classes = undefined;
		this.HitDiceManager = null!;
	}

	protected override _onAfterPrepareData(): void {
		this._applyConfiguredLanguageGrants();
		this._prepareArmorClass();
	}

	/**
	 * Apply language grants beyond the items on the actor:
	 *  - Common is universal — every character speaks it, regardless of ancestry or INT.
	 *  - GM-configured ancestry→language grants from the language-customization setting,
	 *    mirroring the ancestry rule: "You know {Language} if your INT is not negative."
	 */
	private _applyConfiguredLanguageGrants(): void {
		const known = this.system.proficiencies.languages;
		if ('common' in CONFIG.NIMBLE.languages) known.add('common');

		const speakers = (CONFIG.NIMBLE as unknown as { languageSpeakers?: Record<string, string[]> })
			.languageSpeakers;
		if (!speakers) return;

		const ancestryIdentifier = this.ancestry?.identifier;
		if (!ancestryIdentifier) return;

		// "...if your INT is not negative."
		if ((this.system.abilities?.intelligence?.mod ?? 0) < 0) return;

		for (const [languageKey, ancestries] of Object.entries(speakers)) {
			if (ancestries.includes(ancestryIdentifier)) known.add(languageKey);
		}
	}

	override prepareBaseData(): void {
		super.prepareBaseData();

		// Setup Managers

		this._prepareLevelData();
	}

	override _populateBaseTags(): void {
		super._populateBaseTags();

		// Add proficiencies
		this.system.proficiencies.armor.forEach((a) => {
			this.tags.add(`proficiency:armor:${a}`);
		});
		this.system.proficiencies.languages.forEach((l) => {
			this.tags.add(`proficiency:language:${l}`);
		});
		this.system.proficiencies.weapons.forEach((w) => {
			this.tags.add(`proficiency:weapon:${w}`);
		});
	}

	override prepareDerivedData(): void {
		// Reset armor components so afterPrepareData() rules always start from a clean slate.
		// Without this, removing an ancestry then re-adding it leaves stale entries in the array.
		this.system.attributes.armor.components = [];

		super.prepareDerivedData();

		// Setup Managers - cast to NimbleCharacterInterface to satisfy type requirements
		this.HitDiceManager = new HitDiceManager(this as unknown as NimbleCharacterInterface);

		const actorData = this.system;

		this._prepareAbilitySaveAndSkillModifiers();

		// Prepare Initiative Data
		// Reset defaultRollMode to 0 before rules apply their modifiers
		// This prevents accumulation when rules use 'adjust' mode
		actorData.attributes.initiative.defaultRollMode = 0;
		actorData.attributes.initiative.mod = actorData.abilities.dexterity.mod;

		// Prepare Class Data
		this.prepareClassData(actorData);

		// Prepare max Mana
		actorData.resources.mana.value = actorData.resources.mana.current;
		actorData.resources.mana.max = this._prepareMaxMana(actorData);

		// Prepare highest unlocked spell tier (only if not manually set)
		actorData.resources.highestUnlockedSpellTier ??=
			this._prepareHighestUnlockedSpellTier(actorData);

		// Prepare Inventory Slots
		const baseInventorySlots = 10 + actorData.abilities.strength.mod;
		const bonusInventorySlots = actorData.inventory.bonusSlots;

		actorData.inventory.totalSlots = baseInventorySlots + bonusInventorySlots;
		actorData.inventory.usedSlots = this.getUsedInventorySlots();

		// Prepare Wounds
		actorData.attributes.wounds.max = 6 + actorData.attributes.wounds.bonus;

		// Add ability score modifier tags for predicate evaluation
		// This must happen after ability mods are calculated above
		Object.entries(actorData.abilities).forEach(([key, ability]) => {
			this.tags.add(`${key}:${ability.mod}`);
		});
	}

	override _populateDerivedTags(): void {
		super._populateDerivedTags();

		// Add level
		this.tags.add(`level:${this.levels.character ?? 0}`);

		// Add class tags
		for (const cls of Object.values(this.classes ?? {})) {
			this.tags.add(`class:${cls.identifier}`);
		}

		// Add subclass tags, so rules can be gated on the specific option a
		// character picked within a class rather than only on the class itself.
		for (const item of this.items) {
			if (!item.isType('subclass')) continue;
			this.tags.add(`subclass:${item.identifier}`);
		}

		// Adds ancestry tags
		if (this.ancestry) {
			this.tags.add(`ancestry:${this.ancestry.identifier}`);
		}

		// Adds background tags
		if (this.background) {
			this.tags.add(`background:${this.background.identifier}`);
		}

		// Add armor status tag - only count items that actually provide armor (have armorClass rules)
		const hasArmor = this.items.some((item) => {
			if (!item.isType('object')) return false;
			const objectItem = item as unknown as NimbleObjectItem;
			if (objectItem.system.objectType !== 'armor') return false;
			// Check if this armor item has any armorClass rules that provide actual protection
			// Items like "Traveling Robes & Sandals" have objectType "armor" but no armorClass rules
			return [...item.rules.values()].some((rule) => rule.type === 'armorClass');
		});
		this.tags.add(`armor:${hasArmor ? 'equipped' : 'unarmored'}`);

		// Shield status tag — character-only. Monsters/NPCs don't have an equipment
		// system, so predicates using self:shield / self:noShield only apply to PCs.
		const hasShield = this.items.some((item) => {
			if (!item.isType('object')) return false;
			const objectItem = item as unknown as NimbleObjectItem;
			return objectItem.system.objectType === 'shield';
		});
		this.tags.add(hasShield ? 'self:shield' : 'self:noShield');
	}

	getClassAbilityBonuses() {
		const classes = Object.values(this.classes ?? {});
		if (!classes.length) return {};

		const abilities = Object.keys(CONFIG.NIMBLE.abilityScores).reduce(
			(acc, key) => {
				acc[key] = 0;
				return acc;
			},
			{} as Record<string, number>,
		);

		classes.forEach((cls) => {
			Object.entries(cls.ASI ?? {}).forEach(([ability, value]) => {
				abilities[ability] += value;
			});
		});

		return abilities;
	}

	getUsedInventorySlots(): number {
		let slotsRequiredSum = 0;
		let smallObjectsCarried = false;
		// Sum up each object
		this.items.forEach((item) => {
			if (!item.isType('object')) return;
			// Cast to NimbleObjectItem (ambient type from item.d.ts)
			const object = item as unknown as NimbleObjectItem;
			switch (object.system.objectSizeType) {
				case 'slots':
					slotsRequiredSum += object.system.slotsRequired;
					break;
				case 'stackable': {
					const slotsRequiredByStack = Math.ceil(object.system.quantity / object.system.stackSize);
					slotsRequiredSum += slotsRequiredByStack;
					break;
				}
				case 'smallSized':
					smallObjectsCarried = true;
					break;
				default:
					console.log(
						"Can't calculate slots used for object size type",
						object.system.objectSizeType,
					);
			}
		});
		// round up to account for half used slots e.g. a single potion
		slotsRequiredSum = Math.ceil(slotsRequiredSum);
		// add one slots for all small stuff
		if (smallObjectsCarried) slotsRequiredSum += 1;
		// account for coinage
		if (this.getFlag(SYSTEM_ID, 'includeCurrencyBulk') ?? true) {
			const totalCoinage = Object.values(this.system.currency).reduce(
				(totalCurrencyBulk, { value }) => totalCurrencyBulk + value,
				0,
			) as number;

			// Coins consume 1 slot per full 500 units
			slotsRequiredSum += Math.floor(totalCoinage / 500);
		}
		return slotsRequiredSum;
	}

	protected override _prepareEarlyDerivedData(): void {
		this._prepareHitPoints(this.system);

		// Rule formulas resolve against `getRollData()`, which reads ability, save
		// and skill modifiers straight off `system`. Those are derived, not stored,
		// so without this pass they are still at their source value (0) when the
		// prePrepareData sweep runs and a bonus of `@strength` silently resolves to
		// nothing. Computed again after the sweep so abilityBonus and skillBonus
		// rules land in the final numbers.
		this._prepareAbilitySaveAndSkillModifiers();
	}

	/**
	 * Ability, saving-throw and skill modifiers, derived from their base values
	 * plus whatever bonuses are on `system` at the time of the call.
	 */
	protected _prepareAbilitySaveAndSkillModifiers(): void {
		const actorData = this.system;
		const { defaultSkillAbilities } = CONFIG.NIMBLE;
		const abilityBonusesFromClasses = this.getClassAbilityBonuses();

		// Prepare Ability Data
		// Uncapped: the rules put a hero's stat at "typically +5", which is guidance
		// for character building, not a ceiling the system gets to enforce.
		Object.entries(actorData.abilities).forEach(([ablKey, ability]): void => {
			const abilityBonus = ability.bonus;

			ability.mod = ability.baseValue + abilityBonus + (abilityBonusesFromClasses[ablKey] ?? 0);
		});

		// Prepare Saving Throw Data
		Object.entries(actorData.savingThrows).forEach(([saveKey, save]): void => {
			const abilityMod = actorData.abilities[saveKey].mod;
			const saveBonus = save.bonus ?? 0;
			save.mod = abilityMod + saveBonus;
		});

		// Prepare Skill Data
		Object.entries(actorData.skills).forEach(([skillKey, skill]): void => {
			const defaultAbility = defaultSkillAbilities[skillKey];
			const abilityMod = actorData.abilities[defaultAbility]?.mod;
			const skillPoints = skill.points;
			const skillBonus = skill.bonus;

			// The max according to the rules is +12 but we won't enforce that limit to avoid homebrew issues
			skill.mod = abilityMod + skillPoints + skillBonus;

			// Reset defaultRollMode to 0 before rules apply their modifiers
			// This prevents accumulation when rules use 'adjust' mode
			skill.defaultRollMode = 0;
		});
	}

	prepareClassData(actorData: NimbleCharacterData): void {
		// Prepare Proficiencies
		const classes = Object.values(this.classes ?? {});

		if (classes.length !== 0) {
			classes.forEach((cls) => {
				cls.grantedArmorProficiencies.forEach((a) => {
					actorData.proficiencies.armor.add(a);
				});
				cls.grantedWeaponProficiencies.forEach((w) => {
					if (!actorData.proficiencies.weapons.includes(w)) actorData.proficiencies.weapons.push(w);
				});
			});
		}
	}

	_prepareHitPoints(actorData: NimbleCharacterData): void {
		const classes = Object.values(this.classes ?? {});
		if (classes.length === 0) return;

		// Summed here rather than through a `prePrepareData` hook because `hp.max`
		// has to be final before `_populateDerivedTags()` runs, which is ahead of
		// the rule sweep.
		const rules = this.rules as unknown as MaxHpBonusRule[];
		const bonusFromRules = rules.reduce(
			(acc, rule) => acc + (rule.type === 'maxHpBonus' ? rule.resolvedBonus() : 0),
			0,
		);

		actorData.attributes.hp.max =
			classes.reduce((acc, classData) => acc + classData.maxHp, 0) +
			actorData.attributes.hp.bonus +
			bonusFromRules;
	}

	_prepareLevelData(): void {
		const levelData = this.system.classData.levels;

		const character = levelData.length;

		const classes = levelData.reduce((acc, identifier) => {
			acc[identifier] ??= 0;
			acc[identifier] += 1;

			return acc;
		}, {});

		this.levels = { character, classes };
	}

	_prepareMaxMana(actorData: NimbleCharacterData): number {
		const classes = Object.values(this.classes ?? {});
		if (classes.length === 0) return actorData.resources.mana.baseMax;
		if (this.levels.character === 1) return actorData.resources.mana.baseMax;

		let maxMana = actorData.resources.mana.baseMax;

		classes.forEach((cls) => {
			const manaFormula = cls.system.mana.formula;
			const resolvedValue = getDeterministicBonus(manaFormula, this.getRollData())!;
			maxMana += resolvedValue;
		});

		return maxMana;
	}

	_prepareHighestUnlockedSpellTier(_: NimbleCharacterData): number | null {
		const classes = Object.values(this.classes ?? {});
		if (classes.length === 0) return 0;
		// Check if there are any spellcasting classes - if not, return null
		const isSpellCaster = this.system.resources.mana.max > 0;

		if (!isSpellCaster) return null;
		// Only update if value is null e.g not migrated
		return getHighestSpellTier(this);
	}

	_prepareArmorClass(): void {
		const { components } = this.system.attributes.armor;

		components.sort((a, b) => {
			if (a.mode === 'override' && b.mode === 'override') return a.priority - b.priority;
			if (a.mode === 'override' && b.mode !== 'override') return 1;
			if (b.mode === 'override' && a.mode !== 'override') return -1;
			return a.priority - b.priority;
		});

		let hint = 'Unarmored';
		let value: number = this.system.abilities.dexterity.mod;

		components.forEach((c) => {
			if (c.mode === 'override') {
				hint = c.source;
				value = c.value;
			}

			if (c.mode === 'add') {
				if (c.value >= 0) hint += ` + ${c.source} `;
				else hint += ` - ${c.source} `;
				value += c.value;
			}

			if (c.mode === 'multiply') {
				hint += ` * ${c.source} `;
				value *= c.value;
			}
		});

		this.system.attributes.armor.hint = hint;
		this.system.attributes.armor.value = value;
	}

	/** ------------------------------------------------------ */
	/**                    Config Methods                      */
	/** ------------------------------------------------------ */

	async configureAbilityScores() {
		this.#dialogs.configureAbilityScores ??= new GenericDialog(
			`${this.name}: Configure Stats`,
			CharacterStatConfigDialog,
			{ document: this },
			{ icon: 'fa-solid fa-wrench', width: 600 },
		);

		this.#dialogs.configureAbilityScores.setTitle(`${this.name}: Configure Stats`);
		await this.#dialogs.configureAbilityScores.render(true);
	}

	async configureArmorProficiencies() {
		this.#dialogs.configureArmorProficiencies ??= new GenericDialog(
			`${this.name}: Configure Armor Proficiencies`,
			CharacterArmorProficienciesConfigDialog,
			{ document: this },
			{ icon: 'fa-solid fa-shield' },
		);

		this.#dialogs.configureArmorProficiencies.setTitle(
			`${this.name}: Configure Armor Proficiencies`,
		);
		await this.#dialogs.configureArmorProficiencies.render(true);
	}

	async configureDamageDefenses() {
		this.#dialogs.configureDamageDefenses ??= new GenericDialog(
			`${this.name}: Configure Damage Defenses`,
			DamageDefensesConfig,
			{ actor: this },
			{ icon: 'fa-solid fa-shield-halved' },
		);

		this.#dialogs.configureDamageDefenses.setTitle(`${this.name}: Configure Damage Defenses`);
		await this.#dialogs.configureDamageDefenses.render(true);
	}

	async configureLanguageProficiencies() {
		this.#dialogs.configureLanguageProficiencies ??= new GenericDialog(
			`${this.name}: Configure Language Proficiencies`,
			CharacterLanguageProficienciesConfigDialog,
			{ document: this },
			{ icon: 'fa-solid fa-language' },
		);

		this.#dialogs.configureLanguageProficiencies.setTitle(
			`${this.name}: Configure Language Proficiencies`,
		);
		await this.#dialogs.configureLanguageProficiencies.render(true);
	}

	async configureMovement() {
		this.#dialogs.configureMovement ??= new GenericDialog(
			`${this.name}: Configure Movement Speeds`,
			CharacterMovementConfigDialog,
			{ document: this },
			{ icon: 'fa-solid fa-person-running', width: 600 },
		);

		this.#dialogs.configureMovement.setTitle(`${this.name}: Configure Movement Speeds`);
		await this.#dialogs.configureMovement.render(true);
	}

	async configureWeaponProficiencies() {
		this.#dialogs.configureWeaponProficiencies ??= new GenericDialog(
			`${this.name}: Configure Weapon Proficiencies`,
			CharacterWeaponProficienciesConfigDialog,
			{ document: this },
			{ icon: 'fa-solid fa-hand-fist' },
		);

		this.#dialogs.configureWeaponProficiencies.setTitle(
			`${this.name}: Configure Weapon Proficiencies`,
		);
		await this.#dialogs.configureWeaponProficiencies.render(true);
	}

	async configureSkills() {
		this.#dialogs.configureSkills ??= new GenericDialog(
			`${this.name}: Configure Skills`,
			CharacterSkillsConfigDialog,
			{ document: this },
			{ icon: 'fa-solid fa-wrench', width: 600, height: 600 },
		);

		this.#dialogs.configureSkills.setTitle(`${this.name}: Configure Skills`);
		await this.#dialogs.configureSkills.render(true);
	}

	async configureHitPoints() {
		const dialog = GenericDialog.getOrCreate(
			`${this.name}: Configure Hit Points`,
			EditHitPointsDialog,
			{ document: this },
			{ icon: 'fa-solid fa-heart', width: 250, uniqueId: `${this.id}-configure-hp` },
		);

		await dialog.render(true);
		const result = (await dialog.promise) as ConfigureHitPointsResult | null;

		if (result === null) {
			return;
		}
		// Update class items
		for (const clsUpdate of result.classUpdates) {
			await this.updateItem(clsUpdate.id, { 'system.hpData': clsUpdate.hpData });
		}
		// Update bonus - use Record cast to allow string keys
		await this.update({ 'system.attributes.hp.bonus': result.bonus } as Record<string, unknown>);

		// If HP is now greater then max, reduce it
		if (this.system.attributes.hp.value > this.system.attributes.hp.max) {
			await this.update({
				'system.attributes.hp.value': this.system.attributes.hp.max,
			} as Record<string, unknown>);
		}
	}

	async configureHitDice() {
		const dialog = GenericDialog.getOrCreate(
			`${this.name}: Configure Hit Dice`,
			EditHitDiceDialog,
			{ document: this },
			{ icon: 'fa-solid fa-dice-d20', width: 420, uniqueId: `${this.id}-configure-hd` },
		);

		await dialog.render(true);
		const result = (await dialog.promise) as ConfigureHitDiceResult | null;

		if (result === null) {
			return;
		}

		const updates: Record<string, unknown> = {
			'system.attributes.bonusHitDice': result.bonusDice,
		};

		// Calculate class contributions per die size
		const classContributions: Record<string, number> = {};
		for (const cls of Object.values(this.classes)) {
			const size = cls.hitDice.size;
			classContributions[size] = (classContributions[size] ?? 0) + cls.hitDice.total;
		}

		// Calculate OLD bonus contributions (before the change)
		const oldBonusContributions: Record<string, number> = {};
		for (const entry of this.system.attributes.bonusHitDice ?? []) {
			oldBonusContributions[entry.size] = (oldBonusContributions[entry.size] ?? 0) + entry.value;
		}

		// Calculate NEW bonus contributions (after the change)
		const newBonusContributions: Record<string, number> = {};
		for (const entry of result.bonusDice) {
			newBonusContributions[entry.size] = (newBonusContributions[entry.size] ?? 0) + entry.value;
		}

		// Update current hit dice for each affected size
		const allSizes = new Set([
			...Object.keys(oldBonusContributions),
			...Object.keys(newBonusContributions),
			...Object.keys(classContributions),
		]);

		for (const sizeStr of allSizes) {
			const size = sizeStr;
			const classTotal = classContributions[size] ?? 0;
			const oldBonus = oldBonusContributions[size] ?? 0;
			const newBonus = newBonusContributions[size] ?? 0;
			const bonusDelta = newBonus - oldBonus;
			const newMax = Math.max(classTotal + newBonus, 0);

			const currentValue = this.system.attributes.hitDice[size]?.current ?? 0;

			// If bonus increased, add the new dice as available (increase current)
			// If bonus decreased, clamp current to new max
			if (bonusDelta > 0) {
				// Adding bonus dice - increase current by the amount added
				updates[`system.attributes.hitDice.${size}.current`] = currentValue + bonusDelta;
			} else if (currentValue > newMax) {
				// Removing bonus dice and current exceeds new max - clamp down
				updates[`system.attributes.hitDice.${size}.current`] = newMax;
			}
		}

		await this.update(updates);
	}

	async configureMana() {
		const dialog = GenericDialog.getOrCreate(
			`${this.name}: ${game.i18n.localize(CONFIG.NIMBLE.manaConfig.configureMana)}`,
			EditManaDialog,
			{ document: this },
			{ icon: 'fa-solid fa-sparkles', width: 340, uniqueId: `${this.id}-configure-mana` },
		);

		await dialog.render(true);
		const result = (await dialog.promise) as ConfigureManaResult | null;

		if (result === null) {
			return;
		}

		const nextBaseMax = Math.max(0, Number(result.baseMax) || 0);
		let nextMaxMana = nextBaseMax;

		// Match character max mana prep logic: formula-based class mana starts applying at level 2.
		if (this.levels.character > 1) {
			for (const cls of Object.values(this.classes ?? {})) {
				const manaFormula = cls.system.mana.formula;
				if (!manaFormula?.trim()) continue;
				const resolvedValue = getDeterministicBonus(manaFormula, this.getRollData()) ?? 0;
				nextMaxMana += resolvedValue;
			}
		}

		const boundedMaxMana = Math.max(0, nextMaxMana);
		const updates: Record<string, unknown> = {
			'system.resources.mana.baseMax': nextBaseMax,
		};

		// Clamp current mana down if max decreased below current.
		if (this.system.resources.mana.current > boundedMaxMana) {
			updates['system.resources.mana.current'] = boundedMaxMana;
		}

		await this.update(updates);
	}

	async editCurrentHitDice() {
		const dialog = GenericDialog.getOrCreate(
			`${this.name}: Edit Current Hit Dice`,
			EditCurrentHitDiceDialog,
			{ document: this },
			{ icon: 'fa-solid fa-dice-d20', width: 340, uniqueId: `${this.id}-edit-current-hd` },
		);

		await dialog.render(true);
		const result = (await dialog.promise) as EditCurrentHitDiceResult | null;

		if (result === null || !result.currentValues) {
			return;
		}

		const { currentValues } = result;

		// Build updates for each die size
		const updates: Record<string, unknown> = {};
		for (const [size, value] of Object.entries(currentValues)) {
			updates[`system.attributes.hitDice.${size}.current`] = value;
		}

		await this.update(updates);
	}

	async rollHitDice() {
		const dialog = GenericDialog.getOrCreate(
			`${this.name}: Roll Hit Dice`,
			RollHitDiceDialog,
			{ document: this },
			{ icon: 'fa-solid fa-dice-d20', width: 320, uniqueId: `${this.id}-roll-hd` },
		);

		await dialog.render(true);
		const result = (await dialog.promise) as RollHitDiceResult | null;

		if (result === null || !result.selections) {
			return;
		}

		const { selections, addStrBonus, applyToHP } = result;

		// Check if the actor has the maximizeHitDice flag from rules (e.g., Oozeling's Odd Constitution)
		const maximizeHitDice =
			(this.system.attributes as { maximizeHitDice?: boolean }).maximizeHitDice ?? false;

		// Build the roll formula from selections
		const rollParts: string[] = [];
		for (const [size, count] of Object.entries(selections)) {
			if (count > 0) {
				if (maximizeHitDice) {
					// Use maximum value instead of rolling
					rollParts.push(`${count * Number(size)}`);
				} else {
					rollParts.push(`${count}d${size}`);
				}
			}
		}

		if (rollParts.length === 0) {
			return;
		}

		// Add STR modifier for each die rolled (if enabled)
		const totalDice = Object.values(selections).reduce((sum, count) => sum + count, 0);
		const strMod = this.system.abilities.strength.mod;
		const strBonus = addStrBonus ? totalDice * strMod : 0;
		const formula = addStrBonus ? `${rollParts.join(' + ')} + ${strBonus}` : rollParts.join(' + ');

		const roll = new NimbleRoll(formula, this.getRollData() as NimbleRoll.Data);
		await roll.evaluate();

		// Update hit dice counts
		const updates: Record<string, unknown> = {};
		for (const [size, count] of Object.entries(selections)) {
			if (count > 0) {
				const currentDice = this.system.attributes.hitDice[size]?.current ?? 0;
				updates[`system.attributes.hitDice.${size}.current`] = Math.max(0, currentDice - count);
			}
		}

		await this.update(updates);

		// Apply healing to HP if enabled
		let healingApplied = 0;
		if (applyToHP && roll.total) {
			const currentHP = this.system.attributes.hp.value;
			const maxHP = this.system.attributes.hp.max;
			const newHP = Math.min(currentHP + roll.total, maxHP);
			healingApplied = newHP - currentHP;

			if (healingApplied > 0) {
				await this.setCurrentHP(newHP);
			}
		}

		// Output to chat
		await this.outputHitDiceRoll(roll, selections, addStrBonus, applyToHP, healingApplied);
	}

	async outputHitDiceRoll(
		roll: NimbleRoll,
		selections: Record<string, number>,
		addStrBonus: boolean,
		applyToHP: boolean,
		healingApplied: number,
	) {
		// Build dice summary string
		const diceParts: string[] = [];
		for (const [size, count] of Object.entries(selections)) {
			if (count > 0) {
				diceParts.push(`${count}d${size}`);
			}
		}
		const diceSummary = diceParts.join(' + ');

		// Extract individual dice results from the roll
		const diceResults: { size: number; results: number[]; total: number }[] = [];
		for (const term of roll.terms) {
			if (term instanceof foundry.dice.terms.Die) {
				const dieTerm = term as foundry.dice.terms.Die;
				if (!dieTerm.faces) continue;
				const results = dieTerm.results.map((r) => r.result);
				diceResults.push({
					size: dieTerm.faces,
					results,
					total: results.reduce((sum, v) => sum + v, 0),
				});
			}
		}

		// Sort by die size descending for display
		diceResults.sort((a, b) => b.size - a.size);

		// Calculate STR bonus
		const strMod = this.system.abilities.strength.mod;
		const totalDice = Object.values(selections).reduce((sum, count) => sum + count, 0);
		const strBonus = addStrBonus ? totalDice * strMod : 0;

		let content = `<div class="nimble-hit-dice-roll">`;

		// Main result header with total
		content += `<div class="nimble-hit-dice-roll__header">`;
		content += `<span class="nimble-hit-dice-roll__label">Hit Dice Recovery</span>`;
		content += `<span class="nimble-hit-dice-roll__total">${roll.total}</span>`;
		content += `</div>`;

		// Expandable dice details
		content += `<details class="nimble-hit-dice-roll__details">`;
		content += `<summary class="nimble-hit-dice-roll__summary">${diceSummary}${addStrBonus ? ` + ${strBonus}` : ''}</summary>`;
		content += `<div class="nimble-hit-dice-roll__breakdown">`;

		// Show each die type with individual results
		for (const dieGroup of diceResults) {
			const resultsStr = dieGroup.results
				.map((r) => `<span class="nimble-hit-dice-roll__die-result">${r}</span>`)
				.join(' ');
			content += `<div class="nimble-hit-dice-roll__die-group">`;
			content += `<span class="nimble-hit-dice-roll__die-type">d${dieGroup.size}</span>`;
			content += `<span class="nimble-hit-dice-roll__die-results">${resultsStr}</span>`;
			content += `<span class="nimble-hit-dice-roll__die-subtotal">= ${dieGroup.total}</span>`;
			content += `</div>`;
		}

		// Show STR bonus if applicable
		if (addStrBonus) {
			content += `<div class="nimble-hit-dice-roll__die-group nimble-hit-dice-roll__die-group--bonus">`;
			content += `<span class="nimble-hit-dice-roll__die-type">STR</span>`;
			content += `<span class="nimble-hit-dice-roll__die-results">${strMod} × ${totalDice}</span>`;
			content += `<span class="nimble-hit-dice-roll__die-subtotal">= ${strBonus}</span>`;
			content += `</div>`;
		}

		content += `</div>`; // breakdown
		content += `</details>`;

		// HP healing status
		if (applyToHP) {
			if (healingApplied > 0) {
				content += `<div class="nimble-hit-dice-roll__healing">`;
				content += `<i class="fa-solid fa-heart"></i> Healed ${healingApplied} HP`;
				content += `</div>`;
			} else {
				content += `<div class="nimble-hit-dice-roll__healing nimble-hit-dice-roll__healing--full">`;
				content += `<i class="fa-solid fa-heart"></i> Already at max HP`;
				content += `</div>`;
			}
		}

		content += `</div>`;

		const chatData = {
			author: game.user?.id,
			flavor: `${this.name}: Hit Dice Roll`,
			content,
			rolls: [roll],
			speaker: ChatMessage.getSpeaker({ actor: this as object as Actor }),
		};

		ChatMessage.applyMode(chatData as unknown as ChatMessage.CreateData);

		await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);
	}

	async updateCurrentHitDice(newTotal: number) {
		const bySize = this.HitDiceManager.bySize;
		const currentTotal = this.HitDiceManager.value;
		const maxTotal = this.HitDiceManager.max;

		// Clamp the new value
		const clampedTotal = Math.max(0, Math.min(newTotal, maxTotal));
		const delta = clampedTotal - currentTotal;

		if (delta === 0) return;

		const updates: Record<string, unknown> = {};

		// Sort die sizes: largest first for restoring, smallest first for spending
		const sizes = Object.keys(bySize)
			.map(Number)
			.sort((a, b) => (delta > 0 ? b - a : a - b));

		let remaining = Math.abs(delta);

		for (const size of sizes) {
			if (remaining <= 0) break;

			const { current, total } = bySize[size];

			if (delta > 0) {
				// Restoring dice - add up to max for this size
				const canAdd = total - current;
				const toAdd = Math.min(canAdd, remaining);
				if (toAdd > 0) {
					updates[`system.attributes.hitDice.${size}.current`] = current + toAdd;
					remaining -= toAdd;
				}
			} else {
				// Spending dice - remove from current
				const toRemove = Math.min(current, remaining);
				if (toRemove > 0) {
					updates[`system.attributes.hitDice.${size}.current`] = current - toRemove;
					remaining -= toRemove;
				}
			}
		}

		if (Object.keys(updates).length > 0) {
			await this.update(updates);
		}
	}

	/** ------------------------------------------------------ */
	/**                    Data Methods                        */
	/** ------------------------------------------------------ */
	override getRollData(_item?: Item.Implementation): Record<string, any> {
		const data = { ...super.getRollData() } as Record<string, any>;

		const { abilities, skills } = this.system;

		// TODO: Add a shortcut for <ability>
		Object.entries(abilities).reduce((acc, [key, ability]) => {
			acc[key] = ability.mod;
			return acc;
		}, data);

		// Add a shortcut for skills
		Object.entries(skills).reduce((acc, [key, skill]) => {
			acc[key] = skill.mod;
			return acc;
		}, data);

		const characterClass = Object.values(this.classes)[0];
		const keyAbilities = characterClass?.system?.keyAbilityScores ?? [];
		const highestKeyAbility = Math.max(...keyAbilities.map((key) => abilities[key]?.mod ?? 0));

		data.key = highestKeyAbility;

		data.level = this.levels.character ?? 1;

		// NOTE: Pool max bonuses (e.g. "+1 Max Combat Die") are applied directly in the
		// charge-pool max computation (see getChargePoolDefinitions), which sums the
		// poolMaxBonus rules the actor's items carry. They are intentionally NOT exposed as
		// roll-data variables here: doing so required every embedded pool formula to reference
		// @<pool>Bonus, which silently dropped the bonus whenever an actor carried a stale
		// formula. Applying the bonus in code makes it robust regardless of the formula.

		return data;
	}

	/** ------------------------------------------------------ */
	/**                    Roll Methods                        */
	/** ------------------------------------------------------ */
	async rollSkillCheckToChat(
		skillKey: SkillKeyType,
		options: ActorRollOptions = {},
	): Promise<ChatMessage | null> {
		const { roll, rollData } = await this.rollSkillCheck(skillKey, options);
		const { rollMode, visibilityMode } = rollData ?? {};

		if (!roll) return null;

		const chatData = await this.prepareSkillCheckChatCardData(skillKey, roll, {
			...options,
			rollMode,
		});

		ChatMessage.applyMode(
			chatData as unknown as ChatMessage.CreateData,
			toMessageMode(visibilityMode),
		);
		const chatCard = await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);

		return chatCard ?? null;
	}

	async rollSkillCheck(skillKey: SkillKeyType, options: ActorRollOptions = {}) {
		const baseRollMode = calculateRollMode(
			this.system.skills[skillKey].defaultRollMode ?? 0,
			options.rollModeModifier,
			options.rollMode,
		);

		const rollData = await (options.skipRollDialog
			? this.getDefaultSkillCheckData(skillKey, baseRollMode, options)
			: this.showCheckRollDialog('skillCheck', {
					...options,
					skillKey,
					rollMode: baseRollMode,
				}));

		if (!rollData) return { roll: null, rollData: null };

		const roll = new NimbleRoll(rollData.rollFormula, {
			...this.getRollData(),
			prompted: options.prompted ?? false,
			respondentId: this.uuid,
		} as NimbleRoll.Data);

		await roll.evaluate();

		return { roll, rollData };
	}

	getDefaultSkillCheckData(
		skillKey: SkillKeyType,
		rollMode: number,
		options = {} as ActorRollOptions,
	) {
		const rollFormula = getRollFormula(this, {
			skillKey,
			rollMode,
			situationalMods: options.situationalMods ?? '',
			type: 'skillCheck',
		});

		return { rollFormula, rollMode, visibilityMode: options.visibilityMode };
	}

	async prepareSkillCheckChatCardData(
		skillKey: SkillKeyType,
		roll: NimbleRoll,
		options = { rollMode: 0 } as ActorRollOptions,
	) {
		return {
			author: game.user?.id,
			flavor: `${this.name}: ${CONFIG.NIMBLE.skills[skillKey]} Check`,
			type: 'skillCheck',
			rolls: [roll],
			system: {
				actorName: this?.name ?? game?.user?.name ?? '',
				actorType: this.type,
				permissions: this.permission,
				rollMode: options.rollMode,
				skillKey,
			},
		};
	}

	/**
	 * Get the unique dialog ID for level up dialogs for this character.
	 */
	getLevelUpDialogId(): string {
		return `${this.id}-level-up`;
	}

	/**
	 * Get the unique dialog ID for level down dialogs for this character.
	 */
	getLevelDownDialogId(): string {
		return `${this.id}-level-down`;
	}

	/**
	 * Get the unique dialog ID for level correction dialogs for this character.
	 */
	getLevelCorrectionDialogId(): string {
		return `${this.id}-level-correction`;
	}

	/**
	 * The class feature pools this character is still owed picks from.
	 *
	 * A level-up grant that was wrong when the character passed through it leaves no trace on the
	 * sheet — the picks simply never happened — so the shortfall has to be recomputed from the
	 * class data every time rather than read back from `levelUpHistory`.
	 */
	async getMissingLevelSelections(): Promise<MissingLevelSelection[]> {
		const characterClass = Object.values(this.classes)?.[0];
		if (!characterClass) return [];

		const ownedSourceUuids = new Set<string>();
		for (const item of this.items) {
			if (item.type !== 'feature') continue;
			const compendiumSource = item._stats?.compendiumSource;
			if (compendiumSource) ownedSourceUuids.add(compendiumSource);
		}

		const index = await buildClassFeatureIndex();

		return findMissingLevelSelections(
			index,
			characterClass.identifier,
			characterClass.system.classLevel,
			ownedSourceUuids,
		);
	}

	/**
	 * Opens the level correction dialog so the player can make the picks a past level owes them,
	 * then grants what they chose.
	 */
	async triggerLevelCorrection() {
		const gaps = await this.getMissingLevelSelections();

		if (gaps.length === 0) {
			ui.notifications?.info(game.i18n.localize('NIMBLE.levelCorrectionDialog.nothingMissing'));
			return;
		}

		const resolvedGaps: ResolvedLevelSelectionGap[] = [];
		for (const gap of gaps) {
			const { candidateUuids, ...rest } = gap;
			const candidates = await Promise.all(
				candidateUuids.map((uuid) => fromUuid(uuid as `Item.${string}`)),
			);
			resolvedGaps.push({
				...rest,
				candidates: candidates.filter((doc): doc is NimbleFeatureItem => Boolean(doc)),
			});
		}

		const dialogId = this.getLevelCorrectionDialogId();
		const dialog = GenericDialog.getOrCreate(
			`${this.name}: ${game.i18n.localize('NIMBLE.levelCorrectionDialog.title')}`,
			CharacterLevelCorrectionDialog,
			{ gaps: resolvedGaps },
			{ icon: 'fa-solid fa-triangle-exclamation', width: 600, uniqueId: dialogId },
		);

		if (dialog.rendered) return;

		await dialog.render(true);
		const dialogData = await dialog.promise;
		if (!dialogData) return;

		await this.applyLevelCorrection(
			(dialogData as unknown as LevelCorrectionSubmitData).selections,
		);
	}

	/**
	 * Grants the picks chosen in the level correction dialog.
	 *
	 * Each grant is recorded on the `levelUpHistory` entry for the level it was owed to, so
	 * reverting that level still removes it. A correction owed to level 1 has no history entry
	 * to record against — the character keeps the feature, and reverting cannot reach it anyway.
	 */
	async applyLevelCorrection(selections: LevelCorrectionSelection[]): Promise<void> {
		const featureSources: Item.CreateData[] = [];
		const levelByCreatedIndex: number[] = [];

		for (const selection of selections) {
			for (const uuid of selection.uuids) {
				const feature = await fromUuid(uuid as `Item.${string}`);
				if (!feature) continue;
				const source = (feature as NimbleFeatureItem).toObject();
				source._stats.compendiumSource = uuid;
				featureSources.push(source as object as Item.CreateData);
				levelByCreatedIndex.push(selection.level);
			}
		}

		if (featureSources.length === 0) return;

		const created = (await this.createEmbeddedDocuments('Item', featureSources)) ?? [];

		const idsByLevel = new Map<number, string[]>();
		created.forEach((doc, position) => {
			const id = (doc as unknown as { id: string | null }).id;
			if (!id) return;
			const level = levelByCreatedIndex[position];
			const ids = idsByLevel.get(level);
			if (ids) ids.push(id);
			else idsByLevel.set(level, [id]);
		});

		const levelUpHistory = this.system.levelUpHistory.map((entry) => {
			const ids = idsByLevel.get(entry.level);
			if (!ids?.length) return entry;
			return { ...entry, grantedFeatureIds: [...entry.grantedFeatureIds, ...ids] };
		});

		const actorUpdates: Record<string, unknown> = { 'system.levelUpHistory': levelUpHistory };
		await this.update(actorUpdates);
		this.sheet?.render(true);
	}

	/**
	 * What this character may change on a given rest, or `null` when nothing is offered.
	 *
	 * The offer comes from `optionSwap` and `skillPointMove` rules the character's features
	 * carry, so a class that never prints such a feature gets no surface at all.
	 */
	async getOptionSwapOffer(trigger: string): Promise<ResolvedOptionSwapOffer | null> {
		const offer = resolveOptionSwapOffer(this, trigger);
		if (!offer) return null;

		const characterClass = Object.values(this.classes)?.[0];

		const pools: ResolvedSwappableOptionPool[] = [];
		if (characterClass && offer.allowedGroups?.size !== 0) {
			// The history records item ids only, so each pick's source is read off the live item.
			const sourceByItemId = new Map<string, string>();
			for (const item of this.items) {
				if (item.type !== 'feature') continue;
				const compendiumSource = item._stats?.compendiumSource;
				if (compendiumSource && item.id) sourceByItemId.set(item.id, compendiumSource);
			}
			const picks = collectOptionPicks(this.system.levelUpHistory, (itemId) =>
				sourceByItemId.get(itemId),
			);

			const index = await buildClassFeatureIndex();
			const collected = await collectSwappableOptions(
				index,
				characterClass.identifier,
				characterClass.system.classLevel,
				picks,
				offer.allowedGroups,
			);

			for (const pool of collected) {
				const candidates = await Promise.all(
					pool.candidateUuids.map((uuid) => fromUuid(uuid as `Item.${string}`)),
				);
				pools.push({
					...pool,
					candidates: candidates.filter((doc): doc is NimbleFeatureItem => Boolean(doc)),
				});
			}
		}

		// An offer with no pools is still shown, so a character whose history records no pick
		// sees the feature and why it has nothing to swap, rather than nothing at all.
		return { ...offer, pools };
	}

	/**
	 * Applies a set of option swaps and skill point moves.
	 *
	 * Each replacement takes the `levelUpHistory` entry of the pick it replaces, so the entry
	 * keeps naming exactly what that level currently owns and level down needs no knowledge
	 * that a swap ever happened. Skill totals are written straight to `system.skills`: a move
	 * is net zero and belongs to no level, so recording it would make level down reverse it.
	 */
	async applyOptionSwap(
		pools: readonly ResolvedSwappableOptionPool[],
		selections: ReadonlyMap<string, readonly string[]>,
		skillPoints: ReadonlyMap<string, number> = new Map(),
	): Promise<OptionSwapPlan | null> {
		const plan = planOptionSwap(pools, selections, this.system.levelUpHistory);
		// A pick that left the history since the offer was made cannot be replaced by an item
		// no level records, so that pool is left alone and the player told why.
		if (plan.refusedPoolKeys.length > 0) {
			ui.notifications?.warn(localize('NIMBLE.optionSwap.staleSwapRefused'));
		}

		const featureSources: Item.CreateData[] = [];
		const historyIndexByCreatedIndex: number[] = [];
		for (const grant of plan.grants) {
			const feature = await fromUuid(grant.uuid as `Item.${string}`);
			// Deleting the old pick with nothing to put in its place would cost the player an
			// option, so the whole swap stops here.
			if (!feature) {
				ui.notifications?.error(localize('NIMBLE.optionSwap.grantFailed'));
				return null;
			}
			const source = (feature as NimbleFeatureItem).toObject();
			source._stats.compendiumSource = grant.uuid;
			featureSources.push(source as object as Item.CreateData);
			historyIndexByCreatedIndex.push(grant.historyIndex);
		}

		// The dropped picks as they stand, so a failure part way through can put them back.
		const removedSources = plan.deleteItemIds
			.map((itemId) => this.items.get(itemId)?.toObject())
			.filter((source): source is NonNullable<typeof source> => Boolean(source));

		// Grant before removing. The two orders fail differently, and only one of them is
		// recoverable by hand: granting first can leave the character holding one option too
		// many, while removing first can leave them holding none. A pool maximum derived from
		// the items held reads one too high in between, for the moment before the removal.
		const created = featureSources.length
			? ((await this.createEmbeddedDocuments('Item', featureSources)) ?? [])
			: [];

		// A create that drops an invalid entry returns fewer documents than it was given, and
		// the history below pairs them off by position, so a short result would file the
		// survivors under the wrong levels. Nothing has been removed yet, so backing out here
		// only costs the grants.
		if (created.length !== featureSources.length) {
			console.error(
				`Nimble | option swap granted ${created.length} of ${featureSources.length} options, undoing it`,
			);
			await this.#undoOptionSwap(created, []);
			ui.notifications?.error(localize('NIMBLE.optionSwap.swapFailed'));
			return null;
		}

		const addedIdsByHistoryIndex = new Map<number, string[]>();
		created.forEach((doc, position) => {
			const id = (doc as unknown as { id: string | null }).id;
			const historyIndex = historyIndexByCreatedIndex[position];
			if (!id) return;
			const ids = addedIdsByHistoryIndex.get(historyIndex);
			if (ids) ids.push(id);
			else addedIdsByHistoryIndex.set(historyIndex, [id]);
		});

		const removedIds = new Set(plan.deleteItemIds);
		const levelUpHistory = this.system.levelUpHistory.map((entry, index) => {
			const kept = entry.grantedFeatureIds.filter((id) => !removedIds.has(id));
			const added = addedIdsByHistoryIndex.get(index) ?? [];
			if (kept.length === entry.grantedFeatureIds.length && added.length === 0) return entry;
			return { ...entry, grantedFeatureIds: [...kept, ...added] };
		});

		const actorUpdates: Record<string, unknown> = { 'system.levelUpHistory': levelUpHistory };
		for (const [skill, points] of skillPoints) {
			actorUpdates[`system.skills.${skill}.points`] = points;
		}

		try {
			if (plan.deleteItemIds.length > 0) {
				await this.deleteEmbeddedDocuments('Item', [...plan.deleteItemIds]);
				// The history is about to stop naming these, so one left behind would become a
				// pick no level accounts for and no later swap can reach.
				const survivor = plan.deleteItemIds.find((itemId) => this.items.get(itemId));
				if (survivor) throw new Error(`item ${survivor} outlived its deletion`);
			}
			await this.update(actorUpdates);
		} catch (error) {
			console.error('Nimble | option swap failed part way through, undoing it', error);
			await this.#undoOptionSwap(created, removedSources);
			ui.notifications?.error(localize('NIMBLE.optionSwap.swapFailed'));
			return null;
		}

		this.sheet?.render(true);

		return plan;
	}

	/**
	 * Puts the character back as they were after a swap failed mid-write.
	 *
	 * Each step is attempted on its own: a rollback that gives up on its first failure would
	 * leave a worse state than the one it is repairing. The history is left alone, because it
	 * is only written once both item writes have gone through.
	 */
	async #undoOptionSwap(
		created: readonly unknown[],
		removedSources: readonly Record<string, unknown>[],
	): Promise<void> {
		const createdIds = created
			.map((doc) => (doc as { id?: string | null }).id)
			.filter((id): id is string => Boolean(id) && Boolean(this.items.get(id as string)));

		if (createdIds.length > 0) {
			await this.deleteEmbeddedDocuments('Item', createdIds).catch((error) =>
				console.error('Nimble | could not remove the granted options again', error),
			);
		}

		const missing = removedSources.filter((source) => !this.items.get(source._id as string));
		if (missing.length > 0) {
			await this.createEmbeddedDocuments('Item', missing as unknown as Item.CreateData[], {
				keepId: true,
			}).catch((error) => console.error('Nimble | could not restore the removed options', error));
		}
	}

	/**
	 * Check if a level up dialog is currently open for this character.
	 */
	isLevelUpInProgress(): boolean {
		return GenericDialog.isOpen(this.getLevelUpDialogId());
	}

	/**
	 * Validates that the character's level history is consistent with their current level.
	 * If the character is beyond level 1 but doesn't have enough level up history entries,
	 * this will reset them to level 1.
	 * @returns true if the level was reset, false if no changes were needed
	 */
	async validateLevelHistory(): Promise<boolean> {
		const characterClass = Object.values(this.classes)?.[0];

		if (!characterClass) return false;

		const currentClassLevel = characterClass.system.classLevel;
		const historyLength = this.system.levelUpHistory.length;

		// Level 1 characters should have 0 history entries
		// Level 2 should have 1, Level 3 should have 2, etc.
		const expectedHistoryLength = currentClassLevel - 1;

		if (currentClassLevel > 1 && historyLength < expectedHistoryLength) {
			ui.notifications?.warn(`${this.name}'s level history is inconsistent. Resetting to level 1.`);

			// Reset to level 1
			const actorUpdates: Record<string, unknown> = {};
			const itemUpdates: Record<string, unknown> = {};

			// Reset class level to 1
			itemUpdates['system.classLevel'] = 1;

			// Clear HP data (keep only the first level HP)
			itemUpdates['system.hpData'] = characterClass.system.hpData.slice(0, 1);

			// Clear ability score data for all levels except level 1
			for (let level = 2; level <= currentClassLevel; level++) {
				itemUpdates[`system.abilityScoreData.${level}.value`] = null;
			}

			// Clear level up history
			actorUpdates['system.levelUpHistory'] = [];

			// Reset classData.levels to just the first level
			actorUpdates['system.classData.levels'] = this.system.classData.levels.slice(0, 1);

			// Remove any subclasses (they require level 3+)
			const subclasses = this.items.filter((i) => i.type === 'subclass');
			if (subclasses.length > 0) {
				const subclassIds = subclasses.map((s) => s.id).filter((id): id is string => id !== null);
				if (subclassIds.length > 0) {
					await this.deleteEmbeddedDocuments('Item', subclassIds);
				}
			}

			await this.updateItem(characterClass.id!, itemUpdates);
			await this.update(actorUpdates);
			this.sheet?.render(true);

			return true;
		}

		return false;
	}

	async triggerLevelUp() {
		// Validate level history before allowing level up
		const wasReset = await this.validateLevelHistory();
		if (wasReset) {
			// Level was reset, don't proceed with level up
			return;
		}

		const characterClass = Object.values(this.classes)?.[0];

		if (!characterClass) return;

		const currentClassLevel = characterClass.system.classLevel;

		if (currentClassLevel >= 20) return;

		const levelUpDialogId = this.getLevelUpDialogId();
		const levelDownDialogId = this.getLevelDownDialogId();

		// Close any open level down dialog when starting level up
		await GenericDialog.closeById(levelDownDialogId);

		const nextClassLevel = currentClassLevel + 1;

		// Use singleton pattern to prevent multiple level up dialogs
		const dialog = GenericDialog.getOrCreate(
			`${this.name}: Level Up (${currentClassLevel} → ${nextClassLevel})`,
			CharacterLevelUpDialog,
			{ document: this },
			{ icon: 'fa-solid fa-arrow-up-right-dots', width: 600, uniqueId: levelUpDialogId },
		);

		// If dialog is already rendered, just bring it to front (handled by getOrCreate)
		if (dialog.rendered) {
			return;
		}

		await dialog.render(true);
		const dialogData = await dialog.promise;

		if (!dialogData) return;

		const typedDialogData = dialogData as unknown as LevelUpDialogData;
		const actorUpdates: Record<string, unknown> = {};
		const itemUpdates: Record<string, unknown> = { 'system.classLevel': nextClassLevel };

		const classHitDieSize = characterClass.system.hitDieSize;
		const currentHitDice = this.system.attributes.hitDice[classHitDieSize.toString()]?.current;
		const maxHitDice = this.system.attributes.hitDice?.[classHitDieSize.toString()]?.origin ?? [];
		const currentHp = this.system.attributes.hp.value;

		// Apply hit dice size bonus from rules (e.g., Oozeling's Odd Constitution)
		const hitDiceSizeBonus =
			(this.system.attributes as { hitDiceSizeBonus?: number }).hitDiceSizeBonus ?? 0;
		const effectiveHitDieSize = incrementDieSize(classHitDieSize, hitDiceSizeBonus);

		// Hit-dice advantage rules (e.g., the Hardy boon) can raise the advantage
		// level on the max-HP-increase roll. The base level-up roll is already made
		// with advantage (`2d{size}khn`), so the baseline advantage level is 1.
		const maxHpAdvantageRules = (
			(
				this.system.attributes as {
					hitDiceAdvantageRules?: Array<{ label: string; amount: number; rollContext: string }>;
				}
			).hitDiceAdvantageRules ?? []
		).filter((rule) => (rule.rollContext ?? 'fieldRest') === 'maxHpIncrease');

		const advantageLevel = maxHpAdvantageRules.reduce(
			(highest, rule) => Math.max(highest, rule.amount ?? 1),
			1,
		);

		// Surface the boon(s) that raised the advantage level above the baseline.
		const hitDiceAdvantageSource =
			advantageLevel > 1
				? (maxHpAdvantageRules
						.filter((rule) => (rule.amount ?? 1) >= advantageLevel)
						.map((rule) => rule.label)
						.find((label) => label) ?? null)
				: null;

		let formula: string;

		if (typedDialogData.takeAverageHp) {
			formula = Math.ceil((effectiveHitDieSize + 1) / 2).toString();
		} else {
			// Roll one die per advantage level plus one, keeping the highest. Uses
			// Nimble's leftmost-on-tie keep modifier (`khn`) instead of Foundry's bare
			// `kh`. Advantage 1 → `2d{size}khn`; advantage 2 (Hardy) → `3d{size}khn`.
			formula = `${advantageLevel + 1}d${effectiveHitDieSize}khn`;
		}

		const roll = new Roll(formula);
		await roll.evaluate();
		const hp = roll.total!;

		this.outputLevelUpSummary(
			{ currentClassLevel, ...typedDialogData, hitDiceAdvantageSource },
			roll,
		);

		itemUpdates['system.hpData'] = [...characterClass.system.hpData, hp];

		if (typedDialogData.selectedAbilityScore) {
			itemUpdates[`system.abilityScoreData.${nextClassLevel}.value`] =
				typedDialogData.selectedAbilityScore;
		}

		actorUpdates['system.attributes.hp.value'] = currentHp + hp;

		actorUpdates[`system.attributes.hitDice.${classHitDieSize}`] = {
			origin: [...maxHitDice, characterClass.identifier],
			current: currentHitDice + 1,
		};

		actorUpdates['system.classData.levels'] = [
			...this.system.classData.levels,
			characterClass.identifier,
		];

		Object.entries(typedDialogData.skillPointChanges).forEach(([skillKey, change]) => {
			if (change) {
				const path = `system.skills.${skillKey}.points`;
				const currentPoints = this.system.skills[skillKey].points;

				actorUpdates[path] = currentPoints + change;
			}
		});

		// Add selected subclass if available
		const subclass = typedDialogData.selectedSubclass;

		if (subclass) {
			if (subclass.system.parentClass === characterClass.identifier) {
				// Check if this subclass is actually for this class
				// Create a copy of the subclass for the character
				const subclassData = subclass.toObject();
				(subclassData as { _stats: { compendiumSource?: string } })._stats.compendiumSource =
					subclass.uuid ?? undefined;

				await this.createEmbeddedDocuments('Item', [subclassData]);
			} else {
				ui.notifications?.warn(
					`The selected subclass "${subclass.name}" is not compatible with your ${characterClass.name} class.`,
				);
			}
		}

		// Grant epic boon if selected
		let epicBoonIds: string[] = [];
		if (typedDialogData.selectedEpicBoon) {
			const boonData = typedDialogData.selectedEpicBoon.toObject();
			(boonData as { _stats: { compendiumSource?: string } })._stats.compendiumSource =
				typedDialogData.selectedEpicBoon.uuid ?? undefined;
			const created = await this.createEmbeddedDocuments('Item', [boonData] as Parameters<
				typeof this.createEmbeddedDocuments
			>[1]);
			epicBoonIds = (created ?? [])
				.map((item) => item.id)
				.filter((id): id is string => id !== null);
		}

		// Grant any class features gained at this level (auto + selected)
		const classFeatureIds = await this.grantLevelUpFeatures(typedDialogData.classFeatures);

		const grantedFeatureIds = [...epicBoonIds, ...classFeatureIds];

		// Create spell documents
		let grantedSpellIds: string[] = [];
		const spellUuids = typedDialogData.spellUuids ?? [];

		if (spellUuids.length > 0) {
			const spellDocumentSources: Item.CreateData[] = [];
			const seenSpellUuids = new Set<string>();

			for (const uuid of spellUuids) {
				if (seenSpellUuids.has(uuid)) continue;
				seenSpellUuids.add(uuid);

				const spell = await fromUuid(uuid as `Item.${string}`);
				if (spell) {
					const source = (spell as Item).toObject();
					(source as { _stats: { compendiumSource?: string } })._stats.compendiumSource = uuid;
					spellDocumentSources.push(source as object as Item.CreateData);
				}
			}

			if (spellDocumentSources.length > 0) {
				const createdSpells = await this.createEmbeddedDocuments('Item', spellDocumentSources);
				grantedSpellIds = (createdSpells ?? [])
					.map((item) => item.id)
					.filter((id): id is string => id !== null);
			}
		}

		// Record level up history
		const historyEntry = {
			level: nextClassLevel,
			hpIncrease: hp,
			abilityIncreases: typedDialogData.selectedAbilityScore,
			skillIncreases: typedDialogData.skillPointChanges,
			hitDieAdded: true,
			classIdentifier: characterClass.identifier,
			grantedFeatureIds,
			grantedSpellIds,
		};

		actorUpdates['system.levelUpHistory'] = [...this.system.levelUpHistory, historyEntry];

		await this.updateItem(characterClass.id!, itemUpdates);
		await this.update(actorUpdates);
		this.sheet?.render(true);
	}

	/**
	 * Opens a confirmation dialog for reverting the last level up.
	 * This dialog cannot be opened while a level up dialog is in progress.
	 */
	async triggerLevelDown() {
		// Validate level history before allowing level down
		const wasReset = await this.validateLevelHistory();
		if (wasReset) {
			// Level was reset, don't proceed with level down
			return;
		}

		// Don't allow level down if no history exists
		if (this.system.levelUpHistory.length === 0) return;

		// Don't allow level down while level up is in progress
		if (GenericDialog.isOpen(this.getLevelUpDialogId())) {
			ui.notifications?.warn(game.i18n.localize('NIMBLE.levelDownDialog.levelUpInProgress'));
			return;
		}

		const levelDownDialogId = this.getLevelDownDialogId();

		// Use singleton pattern to prevent multiple level down dialogs
		const dialog = GenericDialog.getOrCreate(
			`${this.name}: Revert Level Up`,
			CharacterLevelDownDialog,
			{ document: this },
			{ icon: 'fa-solid fa-undo', width: 400, uniqueId: levelDownDialogId },
		);

		// If dialog is already rendered, just bring it to front
		if (dialog.rendered) {
			return;
		}

		await dialog.render(true);
		const dialogData = await dialog.promise;

		// If user confirmed, perform the revert
		if (dialogData?.confirmed) {
			await this.revertLastLevelUp();
			this.sheet?.render(true);
		}
	}

	/**
	 * Applies the option swaps a rest dialog collected, and describes them for the rest card.
	 *
	 * Returns an empty list when the dialog offered nothing or the player changed nothing,
	 * which is the ordinary rest.
	 */
	async #applyRestOptionSwap(restData: RestManager.Data): Promise<OptionChange[]> {
		const { optionSwap } = restData;
		if (!optionSwap) return [];

		const { pools = [], selections = new Map(), skillPoints = new Map() } = optionSwap;

		const skillChanges = new Map<string, { from: number; to: number }>();
		for (const [skillKey, to] of skillPoints) {
			const from = this.system.skills[skillKey as keyof typeof this.system.skills]?.points ?? 0;
			if (from !== to) skillChanges.set(skillKey, { from, to });
		}

		const plan = await this.applyOptionSwap(pools, selections, skillPoints);
		if (!plan) return [];

		// Only the pools the plan acted on are reported, so the card never names a swap that
		// did not happen.
		const changedPools = pools.filter((pool) => plan.changedPoolKeys.includes(pool.poolKey));
		return summarizeOptionSwap(changedPools, selections, skillChanges, (skillKey) =>
			localize(CONFIG.NIMBLE.skills[skillKey as keyof typeof CONFIG.NIMBLE.skills] ?? skillKey),
		);
	}

	/**
	 * Creates embedded feature documents for features gained on level-up (both
	 * auto-grant groups and user-selected groups) and returns the newly created
	 * item ids so they can be tracked in the level-up history for later reversal.
	 */
	async grantLevelUpFeatures(classFeatures: LevelUpDialogData['classFeatures']): Promise<string[]> {
		if (!classFeatures) return [];

		const featureDocumentSources: Item.CreateData[] = [];

		for (const uuid of classFeatures.autoGrant ?? []) {
			const feature = await fromUuid(uuid as `Item.${string}`);
			if (!feature) continue;
			const source = (feature as NimbleFeatureItem).toObject();
			source._stats.compendiumSource = uuid;
			featureDocumentSources.push(source as object as Item.CreateData);
		}

		for (const [, features] of classFeatures.selected ?? []) {
			for (const feature of features) {
				const source = feature.toObject();
				source._stats.compendiumSource = feature.uuid;
				featureDocumentSources.push(source as object as Item.CreateData);
			}
		}

		for (const uuid of classFeatures.grantedOptionItems ?? []) {
			const feature = await fromUuid(uuid as `Item.${string}`);
			if (!feature) continue;
			const source = (feature as NimbleFeatureItem).toObject();
			source._stats.compendiumSource = uuid;
			featureDocumentSources.push(source as object as Item.CreateData);
		}

		if (featureDocumentSources.length === 0) return [];

		const created = (await this.createEmbeddedDocuments('Item', featureDocumentSources)) ?? [];
		return created
			.map((doc) => (doc as unknown as { id: string | null }).id)
			.filter((id): id is string => typeof id === 'string' && id.length > 0);
	}

	async revertLastLevelUp() {
		if (this.system.levelUpHistory.length === 0) return;

		const lastHistory = this.system.levelUpHistory[this.system.levelUpHistory.length - 1];
		const characterClass = this.classes[lastHistory.classIdentifier];

		if (!characterClass) return;

		const actorUpdates: Record<string, any> = {};
		const itemUpdates: Record<string, any> = {};

		// Revert HP
		actorUpdates['system.attributes.hp.value'] =
			this.system.attributes.hp.value - lastHistory.hpIncrease;

		// Revert hit dice
		if (lastHistory.hitDieAdded) {
			const classHitDieSize = characterClass.system.hitDieSize;
			const currentHitDice =
				this.system.attributes.hitDice[classHitDieSize.toString()]?.current ?? 0;
			const maxHitDice = this.system.attributes.hitDice?.[classHitDieSize.toString()]?.origin ?? [];

			actorUpdates[`system.attributes.hitDice.${classHitDieSize}`] = {
				origin: maxHitDice.slice(0, -1),
				current: currentHitDice - 1,
			};
		}

		// Revert abilities
		if (Object.keys(lastHistory.abilityIncreases).length > 0) {
			itemUpdates[`system.abilityScoreData.${lastHistory.level}.value`] = null;
		}

		// Revert skills. Clamped at zero: a point moved to another skill since the level up
		// leaves less to take back than the level added, and a negative skill is not a state
		// the rules have. What is left over sits on whichever skill it was moved to, and only
		// the table knows which point that was, so this reports the shortfall rather than
		// taking a point from a skill of its own choosing.
		const unreverted: string[] = [];
		Object.entries(lastHistory.skillIncreases).forEach(([skill, change]) => {
			if (change) {
				const path = `system.skills.${skill}.points`;
				const current = this.system.skills[skill].points;
				actorUpdates[path] = Math.max(0, current - change);
				const shortfall = change - Math.min(current, change);
				if (shortfall > 0) {
					unreverted.push(
						`${localize(CONFIG.NIMBLE.skills[skill as keyof typeof CONFIG.NIMBLE.skills] ?? skill)} (${shortfall})`,
					);
				}
			}
		});

		if (unreverted.length > 0) {
			ui.notifications?.warn(
				localize('NIMBLE.levelDownDialog.skillPointsMovedAway', {
					skills: unreverted.join(', '),
				}),
			);
		}

		// Remove all subclasses if reverting from level 3
		if (lastHistory.level <= 3) {
			const subclasses = this.items.filter((i) => i.type === 'subclass');

			if (subclasses.length > 0) {
				const subclassIds = subclasses.map((s) => s.id).filter((id): id is string => id !== null);
				if (subclassIds.length > 0) {
					await this.deleteEmbeddedDocuments('Item', subclassIds);
				}
			}
		}

		// Remove granted features
		if (lastHistory.grantedFeatureIds && lastHistory.grantedFeatureIds.length > 0) {
			const validIds = lastHistory.grantedFeatureIds.filter((id) => this.items.get(id));
			if (validIds.length > 0) {
				await this.deleteEmbeddedDocuments('Item', validIds);
			}
		}

		// Remove granted spells
		if (lastHistory.grantedSpellIds && lastHistory.grantedSpellIds.length > 0) {
			const validSpellIds = lastHistory.grantedSpellIds.filter((id) => this.items.get(id));
			if (validSpellIds.length > 0) {
				await this.deleteEmbeddedDocuments('Item', validSpellIds);
			}
		}

		// Revert class level
		itemUpdates['system.classLevel'] = characterClass.system.classLevel - 1;

		// Revert hpData
		itemUpdates['system.hpData'] = characterClass.system.hpData.slice(0, -1);

		// Revert levels
		actorUpdates['system.classData.levels'] = this.system.classData.levels.slice(0, -1);

		// Remove from history
		actorUpdates['system.levelUpHistory'] = this.system.levelUpHistory.slice(0, -1);

		await this.updateItem(characterClass.id!, itemUpdates);
		await this.update(actorUpdates);
	}

	async outputLevelUpSummary(data, roll: Roll | undefined) {
		const rolls = roll ? [roll] : [];
		const { currentClassLevel, takeAverageHp, hitDiceAdvantageSource = null } = data;

		const chatData = {
			author: game.user?.id,
			flavor: `${this.name}: Level Up Summary`,
			type: 'levelUpSummary',
			rolls,
			system: {
				actorName: this?.name ?? game?.user?.name ?? '',
				actorType: this.type,
				currentClassLevel,
				takeAverageHp,
				hitDiceAdvantageSource,
				permissions: this.permission,
			},
		};

		ChatMessage.applyMode(chatData as unknown as ChatMessage.CreateData);
		const chatCard = await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);

		return chatCard ?? null;
	}

	async triggerRest(restOptions = {} as RestManager.Data) {
		let restData: RestManager.Data;

		if (restOptions.skipChatCard) {
			restData = restOptions;
		} else if (restOptions.restType === 'safe') {
			// Launch Safe Rest Dialog (singleton per actor)
			const optionSwapOffer = await this.getOptionSwapOffer('safeRest');
			const dialog = GenericDialog.getOrCreate(
				game.i18n.format(CONFIG.NIMBLE.safeRest.dialogTitle, { name: this.name }),
				SafeRestDialog,
				{ document: this, optionSwapOffer },
				{
					icon: 'fa-solid fa-moon',
					uniqueId: `safe-rest-${this.uuid}`,
					width: optionSwapOffer ? REST_DIALOG_WIDTH_WITH_OPTIONS : undefined,
				},
			);

			await dialog.render(true);
			const dialogData = await dialog.promise;
			if (!dialogData) return; // Dialog was closed without submitting

			restData = { ...dialogData, restType: 'safe' } as RestManager.Data;
		} else {
			// Launch Field Rest Dialog (singleton per actor)
			const optionSwapOffer = await this.getOptionSwapOffer('fieldRest');
			const dialog = GenericDialog.getOrCreate(
				`${this.name}: Field Rest`,
				FieldRestDialog,
				{ document: this, optionSwapOffer },
				{
					icon: 'fa-solid fa-hourglass-half',
					uniqueId: `field-rest-${this.uuid}`,
					width: optionSwapOffer ? REST_DIALOG_WIDTH_WITH_OPTIONS : undefined,
				},
			);

			await dialog.render(true);
			const dialogData = await dialog.promise;
			if (!dialogData) return; // Dialog was closed without submitting

			restData = { ...dialogData, restType: restOptions.restType } as RestManager.Data;
		}

		// Apply before resting: a swap can change a pool's maximum, and the rest should
		// recover against the maximum the character just chose, not the one they dropped.
		restData.optionChanges = await this.#applyRestOptionSwap(restData);

		// Cast to RestableCharacter interface (extends NimbleCharacterInterface with HitDiceManager)
		const manager = new RestManager(
			this as unknown as NimbleCharacterInterface & { HitDiceManager: HitDiceManager },
			restData,
		);
		await manager.rest();

		// @ts-expect-error - nimble.rest is a custom Nimble hook consumed by ruleEventDispatch
		Hooks.callAll(systemHookName('rest'), {
			actor: this,
			restType: restData.restType,
		});
	}

	/** ------------------------------------------------------ */
	/**                 Special Overrides                      */
	/** ------------------------------------------------------ */
	override async modifyTokenAttribute(
		attribute: string,
		value: number,
		isDelta = false,
		isBar?: boolean,
	): Promise<this | undefined> {
		if (attribute === 'resources.mana') {
			// Special handling for mana
			const currentMana = this.system.resources.mana.current;
			const newMana = isDelta ? currentMana + value : value;

			await this.update({ 'system.resources.mana.current': newMana } as Record<string, unknown>);
			return this;
		}

		// Default behavior for other attributes
		const result = await super.modifyTokenAttribute(attribute, value, isDelta, isBar);
		return result as this | undefined;
	}

	/** ------------------------------------------------------ */
	/**                         CRUD                           */
	/** ------------------------------------------------------ */
	protected override async _preCreate(
		data: Actor.CreateData,
		options: Actor.Database.PreCreateOptions,
		user: User.Stored,
		// biome-ignore lint/suspicious/noConfusingVoidType: Matching parent class signature
	): Promise<boolean | void> {
		// Player character configuration. Token sight is keyed on `sight.enabled`,
		// and `enabled` only auto-defaults to true when `sight.range > 0` — which it
		// is not — so enable it explicitly. Range stays at the default 0: Nimble has
		// no darkvision, so the token sees illuminated areas rather than a fixed
		// radius. `displayBars` is seeded here because V14 removed the world-level
		// default token configuration (`core.defaultToken`); the schema default is
		// NONE, which would hide the HP/mana bar mappings entirely.
		const prototypeToken = {
			sight: { enabled: true },
			actorLink: true,
			disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
			displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
		};
		this.updateSource({ prototypeToken } as Record<string, unknown>);

		return super._preCreate(data, options, user);
	}

	async editMetadata() {
		this.#dialogs.metaConfig ??= new GenericDialog(
			`${this.name}: Configuration`,
			CharacterMetaConfigDialog,
			{ actor: this },
		);

		this.#dialogs.metaConfig.setTitle(`${this.name}: Configuration`);
		this.#dialogs.metaConfig.render(true);
	}

	override async activateItem(
		id: string,
		options: Record<string, unknown> = {},
	): Promise<ChatMessage | null> {
		const item = this.items.get(id);

		// Soft-block gate: when the activation costs more actions than the
		// combatant has remaining, confirm before any activation side effects
		// (dialogs, rolls, card creation) so a cancelled overspend leaves no
		// trace. `force` bypasses the prompt; paths that manage the cost
		// themselves pass `skipActionDeduction` and are never prompted.
		if (item && !options.skipActionDeduction) {
			const actionCost = resolveCharacterItemActionCost(this, item as ActivatableItem);
			if (actionCost > 0) {
				const combat = game.combat as Combat | null;
				const combatant =
					combat?.combatants?.find(
						(entry: Combatant.Implementation) => entry.actorId === this.id,
					) ?? null;
				if (combat?.started && combatant) {
					const confirmed = await showInsufficientActionsConfirmation({
						activityName: item.name ?? '',
						requiredActions: actionCost,
						currentActions: getCombatantCurrentActions(combatant),
						force: options.force === true,
					});
					if (!confirmed) return null;
				}
			}
		}

		const result = await super.activateItem(id, options);

		if (result && item && !options.skipActionDeduction) {
			const actionCost = resolveCharacterItemActionCost(this, item as ActivatableItem);
			if (actionCost > 0) {
				const combat = game.combat as Combat | null;
				const combatant =
					combat?.combatants?.find(
						(entry: Combatant.Implementation) => entry.actorId === this.id,
					) ?? null;
				if (combat?.started && combatant?.id) {
					await consumeCombatantAction({
						combat,
						combatantId: combatant.id,
						actionCost,
					});
				}
			}
		}

		return result;
	}
}
