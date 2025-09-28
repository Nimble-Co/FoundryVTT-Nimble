import type BaseUser from '@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/documents/user.d.mts';
import type { ActorRollOptions } from './actorData.js';
import type { NimbleCharacterData } from '../../models/actor/CharacterDataModel.js';
import type { NimbleAncestryItem } from '../item/ancestry.js';
import type { NimbleBackgroundItem } from '../item/background.js';
import type { NimbleClassItem } from '../item/class.js';

import { NimbleBaseActor } from './base.svelte.js';
import { NimbleRoll } from '../../dice/NimbleRoll.js';
import { HitDiceManager } from '../../managers/HitDiceManager.js';
import { RestManager } from '../../managers/RestManager.js';

import calculateRollMode from '../../utils/calculateRollMode.js';
import getRollFormula from '../../utils/getRollFormula.js';
import getDeterministicBonus from '../../dice/getDeterministicBonus.ts';

import CharacterArmorProficienciesConfigDialog from '../../view/dialogs/CharacterArmorProficienciesConfigDialog.svelte';
import CharacterLanguageProficienciesConfigDialog from '../../view/dialogs/CharacterLanguageProficienciesConfigDialog.svelte';
import CharacterLevelUpDialog from '../../view/dialogs/CharacterLevelUpDialog.svelte';
import CharacterMovementConfigDialog from '../../view/dialogs/CharacterMovementConfigDialog.svelte';
import CharacterSkillsConfigDialog from '../../view/dialogs/CharacterSkillsConfigDialog.svelte';
import CharacterStatConfigDialog from '../../view/dialogs/CharacterStatConfigDialog.svelte';
import CharacterWeaponProficienciesConfigDialog from '../../view/dialogs/CharacterWeaponProficienciesConfigDialog.svelte';
import GenericDialog from '../dialogs/GenericDialog.svelte.js';
import FieldRestDialog from '../../view/dialogs/FieldRestDialog.svelte';

export class NimbleCharacter extends NimbleBaseActor {
	declare _ancestry: NimbleAncestryItem | undefined;

	declare _background: NimbleBackgroundItem | undefined;

	declare _classes: Record<string, NimbleClassItem> | undefined;

	declare levels: { character: number; classes: Record<string, number> };

	declare system: NimbleCharacterData;

	declare HitDiceManager: HitDiceManager;

	#dialogs: Record<string, any>;

	constructor(data, context) {
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

	get classes() {
		if (this._classes !== undefined) return this._classes;

		this._classes = this.items.reduce((acc, item) => {
			if (!item.isType('class')) return acc;

			acc[item.identifier] = item;
			return acc;
		}, {});

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
		this.system.proficiencies.armor.forEach((a) => this.tags.add(`proficiency:armor:${a}`));
		this.system.proficiencies.languages.forEach((l) => this.tags.add(`proficiency:language:${l}`));
		this.system.proficiencies.weapons.forEach((w) => this.tags.add(`proficiency:weapon:${w}`));
	}

	override prepareDerivedData(): void {
		super.prepareDerivedData();

		// Setup Managers
		this.HitDiceManager = new HitDiceManager(this);

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
			save.mod = actorData.abilities[saveKey].mod;
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
		let totalBulk = 0;

		// Get total bulk from items
		const items = this.items.filter((i) => i.isType('object') && i.system.slotsRequired > 0);

		let seenSmallItems = false;
		items.forEach((item) => {
			const itemBulk = item.system.slotsRequired;
			if (Number.isInteger(itemBulk)) totalBulk += itemBulk;
			else seenSmallItems = true;
		});

		// If there are any small items, count them as 1 bulk
		if (seenSmallItems) totalBulk += 1;

		if (this.getFlag('nimble', 'includeCurrencyBulk') ?? true) {
			const totalCoinage = Object.values(this.system.currency).reduce(
				(totalCurrencyBulk, { value }) => totalCurrencyBulk + value,
				0,
			) as number;

			// Coins consume 1 bulk per full 500 units
			totalBulk += Math.floor(totalCoinage / 500);
		}

		return totalBulk;
	}

	prepareClassData(actorData: NimbleCharacterData): void {
		// Prepare Max Hp
		this._prepareHitPoints(actorData);

		// Prepare Proficiencies
		const classes = Object.values(this.classes ?? {});

		if (classes.length !== 0) {
			classes.forEach((cls) => {
				cls.grantedArmorProficiencies.forEach((a) => actorData.proficiencies.armor.add(a));
				cls.grantedWeaponProficiencies.forEach((w) => {
					if (!actorData.proficiencies.weapons.includes(w)) actorData.proficiencies.weapons.push(w);
				});
			});
		}
	}

	_prepareHitPoints(actorData: NimbleCharacterData): void {
		const classes = Object.values(this.classes ?? {});
		if (classes.length === 0) return;

		actorData.attributes.hp.max = classes.reduce((acc, classData) => acc + classData.maxHp, 0);
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
			`${this.name}: Configure Ability Scores`,
			CharacterStatConfigDialog,
			{ document: this },
			{ icon: 'fa-solid fa-wrench', width: 600 },
		);

		await this.#dialogs.configureAbilityScores.render(true);
	}

	async configureArmorProficiencies() {
		this.#dialogs.configureArmorProficiencies ??= new GenericDialog(
			`${this.name}: Configure Armor Proficiencies`,
			CharacterArmorProficienciesConfigDialog,
			{ document: this },
			{ icon: 'fa-solid fa-shield' },
		);

		await this.#dialogs.configureArmorProficiencies.render(true);
	}

	async configureLanguageProficiencies() {
		this.#dialogs.configureLanguageProficiencies ??= new GenericDialog(
			`${this.name}: Configure Language Proficiencies`,
			CharacterLanguageProficienciesConfigDialog,
			{ document: this },
			{ icon: 'fa-solid fa-language' },
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

		await this.#dialogs.configureMovement.render(true);
	}

	async configureWeaponProficiencies() {
		this.#dialogs.configureWeaponProficiencies ??= new GenericDialog(
			`${this.name}: Configure Weapon Proficiencies`,
			CharacterWeaponProficienciesConfigDialog,
			{ document: this },
			{ icon: 'fa-solid fa-hand-fist' },
		);

		await this.#dialogs.configureWeaponProficiencies.render(true);
	}

	async configureSkills() {
		this.#dialogs.configureSkills ??= new GenericDialog(
			`${this.name}: Configure Skills`,
			CharacterSkillsConfigDialog,
			{ document: this },
			{ icon: 'fa-solid fa-wrench', width: 600 },
		);

		await this.#dialogs.configureSkills.render(true);
	}

	/** ------------------------------------------------------ */
	/**                    Data Methods                        */
	/** ------------------------------------------------------ */
	override getRollData(): Record<string, any> {
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
		skillKey: skillKey,
		options: ActorRollOptions = {},
	): Promise<ChatMessage | null> {
		const { roll, rollData } = await this.rollSkillCheck(skillKey, options);
		const { rollMode, visibilityMode } = rollData ?? {};

		if (!roll) return null;

		const chatData = await this.prepareSkillCheckChatCardData(
			skillKey,
			// @ts-expect-error
			roll,
			{ ...options, rollMode },
		);

		// @ts-expect-error
		ChatMessage.applyRollMode(chatData, visibilityMode ?? game.settings.get('core', 'rollMode'));
		// @ts-expect-error
		const chatCard = await ChatMessage.create(chatData);

		return chatCard ?? null;
	}

	async rollSkillCheck(skillKey: skillKey, options: ActorRollOptions = {}) {
		const baseRollMode = calculateRollMode(
			this.system.skills[skillKey].defaultRollMode ?? 0,
			options.rollModeModifier,
			options.rollMode,
		);

		let rollData;

		if (options.skipRollDialog) {
			rollData = await this.getDefaultSkillCheckData(skillKey, baseRollMode, options);
		} else {
			rollData = await this.showCheckRollDialog('skillCheck', {
				...options,
				skillKey,
				rollMode: baseRollMode,
			});
		}

		if (!rollData) return { roll: null, rollData: null };

		const roll = new NimbleRoll(rollData.rollFormula, {
			...this.getRollData(),
			prompted: options.prompted ?? false,
			respondentId: this.uuid,
		} as Record<string, any>);

		await roll.evaluate();

		return { roll, rollData };
	}

	getDefaultSkillCheckData(skillKey: skillKey, rollMode: number, options = {} as ActorRollOptions) {
		const rollFormula = getRollFormula(this, {
			skillKey,
			rollMode,
			situationalMods: options.situationalMods ?? '',
			type: 'skillCheck',
		});

		return { rollFormula, rollMode, visibilityMode: options.visibilityMode };
	}

	async prepareSkillCheckChatCardData(
		skillKey: skillKey,
		roll: Roll,
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

	async triggerLevelUp() {
		const characterClass = Object.values(this.classes)?.[0];

		if (!characterClass) return;

		const currentClassLevel = characterClass.system.classLevel;

		if (currentClassLevel >= 20) return;

		const dialog = new GenericDialog(
			`${this.name}: Level Up Dialog`,
			CharacterLevelUpDialog,
			{ document: this },
			{ icon: 'fa-solid fa-arrow-up-right-dots', width: 600 },
		);

		await dialog.render(true);
		const dialogData = await dialog.promise;

		if (!dialogData) return;

		const actorUpdates = {};
		const itemUpdates = { 'system.classLevel': currentClassLevel + 1 };

		const classHitDieSize = characterClass.system.hitDieSize;
		const currentHitDice = this.system.attributes.hitDice[classHitDieSize.toString()]?.current;
		const maxHitDice = this.system.attributes.hitDice?.[classHitDieSize.toString()]?.origin ?? [];
		const currentHp = this.system.attributes.hp.value;

		let formula: string;

		if (dialogData.takeAverageHp) formula = Math.ceil((classHitDieSize + 1) / 2).toString();
		else formula = `2d${classHitDieSize}kh`;

		const roll = new Roll(formula);
		await roll.evaluate();
		const hp = roll.total!;

		this.outputLevelUpSummary({ currentClassLevel, ...dialogData }, roll);

		itemUpdates['system.hpData'] = [...characterClass.system.hpData, hp];

		if (dialogData.selectedAbilityScore) {
			itemUpdates[`system.abilityScoreData.${currentClassLevel + 1}.value`] =
				dialogData.selectedAbilityScore;
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

		Object.entries(dialogData.skillPointChanges).forEach(([skillKey, change]) => {
			if (change) {
				const path = `system.skills.${skillKey}.points`;
				const currentPoints = this.system.skills[skillKey].points;

				actorUpdates[path] = currentPoints + change;
			}
		});

		// Record level up history
		const historyEntry = {
			level: currentClassLevel + 1,
			hpIncrease: hp,
			abilityIncreases: dialogData.selectedAbilityScore,
			skillIncreases: dialogData.skillPointChanges,
			hitDieAdded: true,
			classIdentifier: characterClass.identifier,
		};

		actorUpdates['system.levelUpHistory'] = [...this.system.levelUpHistory, historyEntry];

		await this.updateItem(characterClass.id!, itemUpdates);
		await this.update(actorUpdates);
		this.sheet?.render(true);
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
			const abilityKey = Object.keys(lastHistory.abilityIncreases)[0];
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

		ChatMessage.applyRollMode(chatData, game.settings.get('core', 'rollMode'));
		// @ts-expect-error
		const chatCard = await ChatMessage.create(chatData);

		return chatCard ?? null;
	}

	async triggerRest(restOptions = {} as RestManager.Data) {
		let restData: RestManager.Data;

		if (restOptions.skipChatCard || restOptions.restType === 'safe') {
			restData = restOptions;
		} else {
			// Launch Config Dialog
			const dialog = new GenericDialog(
				'Field Rest Dialog',
				FieldRestDialog,
				{ document: this },
				{ icon: 'fa-solid fa-hourglass-half' },
			);

			await dialog.render(true);
			const dialogData = await dialog.promise;

			restData = { ...dialogData, restType: restOptions.restType } as RestManager.Data;
		}

		const manager = new RestManager(this, restData);
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
	): Promise<this> {
		if (attribute === 'resources.mana') {
			// Special handling for mana
			const currentMana = this.system.resources.mana.current;
			const newMana = isDelta ? currentMana + value : value;

			await this.update({ 'system.resources.mana.current': newMana });
			return this;
		}

		// Default behavior for other attributes
		return super.modifyTokenAttribute(attribute, value, isDelta, isBar);
	}

	/** ------------------------------------------------------ */
	/**                         CRUD                           */
	/** ------------------------------------------------------ */
	override async _preCreate(
		data: foundry.documents.BaseActor.ConstructorData,
		options: Actor.DatabaseOperations['create'],
		user: BaseUser,
	): Promise<boolean | undefined> {
		// Player character configuration
		const prototypeToken = { vision: true, actorLink: true, disposition: 1 };
		this.updateSource({ prototypeToken });

		return super._preCreate(data, options, user);
	}
}
