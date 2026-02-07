import type { NimbleAncestryItem } from '#documents/item/ancestry.js';
import type { NimbleBackgroundItem } from '#documents/item/background.js';
import type { NimbleClassItem } from '#documents/item/class.js';
import type { NimbleSubclassItem } from '#documents/item/subclass.js';
import type { SkillKeyType } from '#types/skillKey.js';
import CharacterMetaConfigDialog from '#view/dialogs/CharacterMetaConfigDialog.svelte';
import getDeterministicBonus from '../../dice/getDeterministicBonus.ts';
import { NimbleRoll } from '../../dice/NimbleRoll.js';
import { HitDiceManager } from '../../managers/HitDiceManager.js';
import { RestManager } from '../../managers/RestManager.js';
import type { NimbleCharacterData } from '../../models/actor/CharacterDataModel.js';
import calculateRollMode from '../../utils/calculateRollMode.js';
import getRollFormula from '../../utils/getRollFormula.js';
import CharacterArmorProficienciesConfigDialog from '../../view/dialogs/CharacterArmorProficienciesConfigDialog.svelte';
import CharacterLanguageProficienciesConfigDialog from '../../view/dialogs/CharacterLanguageProficienciesConfigDialog.svelte';
import CharacterLevelDownDialog from '../../view/dialogs/CharacterLevelDownDialog.svelte';
import CharacterLevelUpDialog from '../../view/dialogs/CharacterLevelUpDialog.svelte';
import CharacterMovementConfigDialog from '../../view/dialogs/CharacterMovementConfigDialog.svelte';
import CharacterSkillsConfigDialog from '../../view/dialogs/CharacterSkillsConfigDialog.svelte';
import CharacterStatConfigDialog from '../../view/dialogs/CharacterStatConfigDialog.svelte';
import CharacterWeaponProficienciesConfigDialog from '../../view/dialogs/CharacterWeaponProficienciesConfigDialog.svelte';
import EditCurrentHitDiceDialog from '../../view/dialogs/EditCurrentHitDiceDialog.svelte';
import EditHitDiceDialog from '../../view/dialogs/EditHitDiceDialog.svelte';
import EditHitPointsDialog from '../../view/dialogs/EditHitPointsDialog.svelte';
import FieldRestDialog from '../../view/dialogs/FieldRestDialog.svelte';
import RollHitDiceDialog from '../../view/dialogs/RollHitDiceDialog.svelte';
import SafeRestDialog from '../../view/dialogs/SafeRestDialog.svelte';
import GenericDialog from '../dialogs/GenericDialog.svelte.js';
import type { ActorRollOptions } from './actorInterfaces.ts';
import { NimbleBaseActor } from './base.svelte.js';

// Note: NimbleClassItem, NimbleSubclassItem, NimbleAncestryItem, NimbleBackgroundItem
// are ambient types declared in src/documents/item/item.d.ts

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

/** Level up dialog result data */
interface LevelUpDialogData {
	takeAverageHp: boolean;
	selectedAbilityScore: string | null;
	skillPointChanges: Record<string, number>;
	selectedSubclass: NimbleSubclassItem | null;
}

export class NimbleCharacter extends NimbleBaseActor<'character'> {
	declare _ancestry: NimbleAncestryItem | undefined;

	declare _background: NimbleBackgroundItem | undefined;

	declare _classes: Record<string, NimbleClassItem> | undefined;

	declare levels: { character: number; classes: Record<string, number> };

	declare system: NimbleCharacterData;

	declare HitDiceManager: HitDiceManager;

	#dialogs: Record<string, GenericDialog>;

	constructor(data: Actor.CreateData, context?: Actor.ConstructionContext) {
		super(data, context);

		this.#dialogs = {};
	}

	get ancestry() {
		if (this._ancestry !== undefined) return this._ancestry;

		this._ancestry = this.items.find((i) => i.isType('ancestry')) as NimbleAncestryItem | undefined;
		return this._ancestry;
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
	override prepareData(): void {
		this._ancestry = undefined;
		this._background = undefined;
		this._classes = undefined;
		this.HitDiceManager = null!;

		super.prepareData();

		this._prepareArmorClass();
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
		super.prepareDerivedData();

		// Setup Managers - cast to NimbleCharacterInterface to satisfy type requirements
		this.HitDiceManager = new HitDiceManager(this as unknown as NimbleCharacterInterface);

		const actorData = this.system;
		const { defaultSkillAbilities } = CONFIG.NIMBLE;

		const abilityBonusesFromClasses = this.getClassAbilityBonuses();

		// Prepare Ability Data
		Object.entries(actorData.abilities).forEach(([ablKey, ability]): void => {
			const abilityBonus = ability.bonus;

			// Cap ability score mods to 12
			ability.mod = Math.min(
				ability.baseValue + abilityBonus + (abilityBonusesFromClasses[ablKey] ?? 0),
				12,
			);
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

			// Cap skill modifiers at 12
			skill.mod = Math.min(abilityMod + skillPoints + skillBonus, 12);
		});

		// Prepare Initiative Data
		// TODO: Add logic to account for initiative bonuses
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
	}

	override _populateDerivedTags(): void {
		super._populateDerivedTags();

		// Add level
		this.tags.add(`level:${this.levels.character ?? 0}`);

		// Add class tags
		for (const cls of Object.values(this.classes ?? {})) {
			this.tags.add(`class:${cls.identifier}`);
		}

		// Adds ancestry tags
		if (this.ancestry) {
			this.tags.add(`ancestry:${this.ancestry.identifier}`);
		}

		// Adds background tags
		if (this.background) {
			this.tags.add(`background:${this.background.identifier}`);
		}
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
		if (this.getFlag('nimble', 'includeCurrencyBulk') ?? true) {
			const totalCoinage = Object.values(this.system.currency).reduce(
				(totalCurrencyBulk, { value }) => totalCurrencyBulk + value,
				0,
			) as number;

			// Coins consume 1 slot per full 500 units
			slotsRequiredSum += Math.floor(totalCoinage / 500);
		}
		return slotsRequiredSum;
	}

	prepareClassData(actorData: NimbleCharacterData): void {
		// Prepare Max Hp
		this._prepareHitPoints(actorData);

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

		actorData.attributes.hp.max =
			classes.reduce((acc, classData) => acc + classData.maxHp, 0) + actorData.attributes.hp.bonus;
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

		const level = this.levels.character;
		let defaultTier = 0;

		if (level >= 18) defaultTier = 9;
		else if (level >= 16) defaultTier = 8;
		else if (level >= 14) defaultTier = 7;
		else if (level >= 12) defaultTier = 6;
		else if (level >= 10) defaultTier = 5;
		else if (level >= 8) defaultTier = 4;
		else if (level >= 6) defaultTier = 3;
		else if (level >= 4) defaultTier = 2;
		else if (level >= 1) defaultTier = 1;

		// Only update if value is null e.g not migrated
		return defaultTier;
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
		const { default: GenericDialog } = await import('../dialogs/GenericDialog.svelte.js');

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
		const { default: GenericDialog } = await import('../dialogs/GenericDialog.svelte.js');

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

	async configureLanguageProficiencies() {
		const { default: GenericDialog } = await import('../dialogs/GenericDialog.svelte.js');

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
		const { default: GenericDialog } = await import('../dialogs/GenericDialog.svelte.js');

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
		const { default: GenericDialog } = await import('../dialogs/GenericDialog.svelte.js');

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
		const { default: GenericDialog } = await import('../dialogs/GenericDialog.svelte.js');

		this.#dialogs.configureSkills ??= new GenericDialog(
			`${this.name}: Configure Skills`,
			CharacterSkillsConfigDialog,
			{ document: this },
			{ icon: 'fa-solid fa-wrench', width: 600 },
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
			const newMax = classTotal + newBonus;

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
				await this.update({ 'system.attributes.hp.value': newHP } as Record<string, unknown>);
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
			speaker: ChatMessage.getSpeaker({ actor: this }),
		};

		ChatMessage.applyRollMode(
			chatData as unknown as ChatMessage.CreateData,
			game.settings.get('core', 'rollMode') as CONST.DICE_ROLL_MODES,
		);

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

		ChatMessage.applyRollMode(
			chatData as unknown as ChatMessage.CreateData,
			visibilityMode ?? game.settings.get('core', 'rollMode'),
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
	 * Check if a level up dialog is currently open for this character.
	 */
	async isLevelUpInProgress(): Promise<boolean> {
		const { default: GenericDialog } = await import('../dialogs/GenericDialog.svelte.js');
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

		const { default: GenericDialog } = await import('../dialogs/GenericDialog.svelte.js');

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

		let formula: string;

		if (typedDialogData.takeAverageHp) formula = Math.ceil((classHitDieSize + 1) / 2).toString();
		else formula = `2d${classHitDieSize}kh`;

		const roll = new Roll(formula);
		await roll.evaluate();
		const hp = roll.total!;

		this.outputLevelUpSummary({ currentClassLevel, ...typedDialogData }, roll);

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
					subclass.uuid;

				await this.createEmbeddedDocuments('Item', [subclassData]);
			} else {
				ui.notifications?.warn(
					`The selected subclass "${subclass.name}" is not compatible with your ${characterClass.name} class.`,
				);
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

		// Revert skills
		Object.entries(lastHistory.skillIncreases).forEach(([skill, change]) => {
			if (change) {
				const path = `system.skills.${skill}.points`;
				const current = this.system.skills[skill].points;
				actorUpdates[path] = current - change;
			}
		});

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
		const { currentClassLevel, takeAverageHp } = data;
		console.log('currentClassLevel', currentClassLevel);
		console.log('takeAverageHp', takeAverageHp);
		console.log(data);

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
				permissions: this.permission,
			},
		};

		ChatMessage.applyRollMode(
			chatData as unknown as ChatMessage.CreateData,
			game.settings.get('core', 'rollMode') as CONST.DICE_ROLL_MODES,
		);
		const chatCard = await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);

		return chatCard ?? null;
	}

	async triggerRest(restOptions = {} as RestManager.Data) {
		let restData: RestManager.Data;

		if (restOptions.skipChatCard) {
			restData = restOptions;
		} else if (restOptions.restType === 'safe') {
			// Launch Safe Rest Dialog (singleton per actor)
			const dialog = GenericDialog.getOrCreate(
				game.i18n.format(CONFIG.NIMBLE.safeRest.dialogTitle, { name: this.name }),
				SafeRestDialog,
				{ document: this },
				{ icon: 'fa-solid fa-moon', uniqueId: `safe-rest-${this.uuid}` },
			);

			await dialog.render(true);
			const dialogData = await dialog.promise;
			if (!dialogData) return; // Dialog was closed without submitting

			restData = { ...dialogData, restType: 'safe' } as RestManager.Data;
		} else {
			// Launch Field Rest Dialog (singleton per actor)
			const dialog = GenericDialog.getOrCreate(
				`${this.name}: Field Rest`,
				FieldRestDialog,
				{ document: this },
				{ icon: 'fa-solid fa-hourglass-half', uniqueId: `field-rest-${this.uuid}` },
			);

			await dialog.render(true);
			const dialogData = await dialog.promise;
			if (!dialogData) return; // Dialog was closed without submitting

			restData = { ...dialogData, restType: restOptions.restType } as RestManager.Data;
		}

		// Cast to RestableCharacter interface (extends NimbleCharacterInterface with HitDiceManager)
		const manager = new RestManager(
			this as unknown as NimbleCharacterInterface & { HitDiceManager: HitDiceManager },
			restData,
		);
		await manager.rest();
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
		user: User.Implementation,
		// biome-ignore lint/suspicious/noConfusingVoidType: Matching parent class signature
	): Promise<boolean | void> {
		// Player character configuration
		const prototypeToken = { vision: true, actorLink: true, disposition: 1 };
		this.updateSource({ prototypeToken } as Record<string, unknown>);

		return super._preCreate(data, options, user);
	}

	async editMetadata() {
		const { default: GenericDialog } = await import('../dialogs/GenericDialog.svelte.js');

		this.#dialogs.metaConfig ??= new GenericDialog(
			`${this.name}: Configuration`,
			CharacterMetaConfigDialog,
			{ actor: this },
		);

		this.#dialogs.metaConfig.setTitle(`${this.name}: Configuration`);
		this.#dialogs.metaConfig.render(true);
	}
}
