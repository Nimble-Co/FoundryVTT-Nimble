import { NimbleRoll } from '../../dice/NimbleRoll.js';
import calculateRollMode from '../../utils/calculateRollMode.js';
import getRollFormula from '../../utils/getRollFormula.js';
import { createSubscriber } from 'svelte/reactivity';
import type { SystemActorTypes, ActorRollOptions, CheckRollDialogData } from './actorInterfaces.js';
import type { NimbleCharacterData } from '../../models/actor/CharacterDataModel.js';
import type { NimbleNPCData } from '../../models/actor/NPCDataModel.js';
import type { NimbleMinionData } from '../../models/actor/MinionDataModel.js';
import type { NimbleSoloMonsterData } from '../../models/actor/SoloMonsterDataModel.js';

// Augment HookConfig to include Item document hooks
declare module 'fvtt-types/configuration' {
	interface HookConfig {
		createItem: [document: Item, options: { diff?: boolean }, userId: string];
		deleteItem: [document: Item, options: { diff?: boolean }, userId: string];
		updateItem: [
			document: Item,
			changes: Record<string, unknown>,
			options: { diff?: boolean },
			userId: string,
		];
	}
}

export type { SystemActorTypes, ActorRollOptions, CheckRollDialogData } from './actorInterfaces.js';

/** Union type of all Nimble actor system data models */
type NimbleActorSystemData =
	| NimbleCharacterData.BaseData
	| NimbleNPCData.BaseData
	| NimbleMinionData.BaseData
	| NimbleSoloMonsterData.BaseData;

// Forward declarations to avoid circular dependencies
interface NimbleBaseItem extends Item {
	rules: RulesManagerInterface;
	identifier: string;
	hasMacro?: () => boolean;
	activate?: (options?: ActorRollOptions) => Promise<void>;
	isType<T extends Item.SubType>(type: T): boolean;
	prepareActorData?(): void;
}

class NimbleBaseActor extends Actor {
	// @ts-expect-error - Override system type for NimbleBaseActor
	declare system: NimbleActorSystemData;
	declare items: foundry.abstract.EmbeddedCollection<NimbleBaseItem, Actor>;
	declare initialized: boolean;

	declare rules: NimbleBaseRule[];

	#subscribe: any;

	tags: Set<string> = new Set();

	// *************************************************
	constructor(data, context) {
		super(data, context);

		this.#subscribe = createSubscriber((update) => {
			const updateActorHook = Hooks.on('updateActor', (triggeringDocument, _, { diff }) => {
				if (diff === false) return;

				if (triggeringDocument._id === this.id) update();
			});

			const embeddedItemHooks = {
				create: Hooks.on('createItem', (triggeringDocument, options) => {
					if ((options as { diff?: boolean }).diff === false) return;
					if (triggeringDocument?.actor?._id === this.id) update();
				}),
				delete: Hooks.on('deleteItem', (triggeringDocument, options) => {
					if ((options as { diff?: boolean }).diff === false) return;
					if (triggeringDocument?.actor?._id === this.id) update();
				}),
				update: Hooks.on('updateItem', (triggeringDocument, _changes, options) => {
					if ((options as { diff?: boolean }).diff === false) return;
					if (triggeringDocument?.actor?._id === this.id) update();
				}),
			};

			return () => {
				Hooks.off('updateActor', updateActorHook);
				Hooks.off('createItem', embeddedItemHooks.create);
				Hooks.off('deleteItem', embeddedItemHooks.delete);
				Hooks.off('updateItem', embeddedItemHooks.update);
			};
		});
	}

	static override async createDialog(
		data?: Actor.CreateDialogData,
		createOptions?: Actor.Database.DialogCreateOptions,
		options?: Actor.CreateDialogOptions,
	): Promise<Actor.Stored | null | undefined> {
		const createOpts = createOptions as
			| { parent?: Actor.Parent; pack?: string | null; types?: string[] }
			| undefined;
		const { parent = null, pack = null, types } = createOpts ?? {};

		const { default: ActorCreationDialog } = await import(
			'../dialogs/ActorCreationDialog.svelte.js'
		);
		const dialog = new ActorCreationDialog(
			{
				...data,
				parent,
				pack,
				types,
			},
			{ ...options } as Record<string, unknown>,
		);

		return dialog.render(true) as unknown as Promise<Actor.Stored | null | undefined>;
	}

	/** ------------------------------------------------------ */
	/**                    Type Helpers                        */
	/** ------------------------------------------------------ */
	isType<TypeName extends SystemActorTypes>(
		type: TypeName,
	): this is NimbleBaseActor & { type: TypeName } {
		return type === (this.type as SystemActorTypes);
	}

	/** ------------------------------------------------------ */
	/**                       Getters                          */
	/** ------------------------------------------------------ */
	get conditionsMetadata() {
		return game.nimble.conditions.getMetadata(this);
	}

	get reactive() {
		this.#subscribe();

		return this;
	}

	get sourceId(): string | undefined {
		const flags = this.flags as Record<string, Record<string, unknown>> | undefined;
		return this._stats.compendiumSource || (flags?.core?.source as string | undefined) || undefined;
	}

	/** ------------------------------------------------------ */
	/**                   Data Preparation                     */
	/** ------------------------------------------------------ */
	protected override _initialize(options?: Record<string, unknown>) {
		this.initialized = false;

		super._initialize(options);
	}

	override prepareData(): void {
		if (this.initialized) return;

		this.initialized = true;
		super.prepareData();

		// Call Rule Hooks
		for (const rule of this.rules) {
			rule.afterPrepareData?.();
		}
	}

	override prepareBaseData(): void {
		super.prepareBaseData();

		// Resets
		this.tags = new Set();
		this._populateBaseTags();
	}

	_populateBaseTags(): void {
		const dispositions = foundry.utils.invertObject(CONST.TOKEN_DISPOSITIONS);

		if (this.system.attributes.sizeCategory) {
			this.tags.add(`size:${this.system.attributes.sizeCategory}`);
		}

		this.tags.add(
			`disposition:${dispositions[this.prototypeToken.disposition]?.toLowerCase() ?? 'neutral'}`,
		);
	}

	override prepareEmbeddedDocuments(): void {
		super.prepareEmbeddedDocuments();

		this._preparePropagatedItemData();
	}

	protected _preparePropagatedItemData(): void {
		for (const item of this.items) {
			item.prepareActorData?.();
		}

		this.rules = this.prepareRules();
	}

	protected prepareRules() {
		return this.items.contents
			.flatMap((i) => [...i.rules.values()])
			.filter((r) => !r.disabled)
			.sort((a, b) => a.priority - b.priority);
	}

	override prepareDerivedData(): void {
		super.prepareDerivedData();

		// Call rule hooks
		for (const rule of this.rules) {
			rule.prePrepareData?.();
		}

		this._populateDerivedTags();
	}

	_populateDerivedTags(): void {}

	/** ------------------------------------------------------ */
	/**                    Config Methods                      */
	/** ------------------------------------------------------ */

	async configureSavingThrows() {
		const { default: GenericDialog } = await import('../dialogs/GenericDialog.svelte.js');
		const { default: ActorSavingThrowConfigDialog } = await import(
			'../../view/dialogs/ActorSavingThrowConfigDialog.svelte'
		);

		const dialog = new GenericDialog(
			`${this.name}: Configure Saving Throws`,
			ActorSavingThrowConfigDialog,
			{ document: this },
			{ icon: 'fa-solid fa-shield', width: 600 } as Record<string, unknown>,
		);

		await dialog.render(true);
	}

	/** ------------------------------------------------------ */
	/**                Data Update Helpers                     */
	/** ------------------------------------------------------ */
	async applyHealing(healing: number, healingType?: string) {
		const updates: Record<string, number> = {};
		const { value, max, temp } = this.system.attributes.hp;
		const healingAmount = Math.floor(healing);

		if (healingType === 'temporaryHealing') {
			if (healingAmount <= temp) {
				ui.notifications.warn('Temporary hit points were not granted to {this.name}. ', {
					localize: true,
				});
				return;
			}

			updates['system.attributes.hp.temp'] = healingAmount;
		} else {
			updates['system.attributes.hp.value'] = Math.clamp(value + healingAmount, value, max);
		}

		// TODO: Add cascading numbers

		// TODO: Call Hook
		await this.update(updates);
	}

	/** ------------------------------------------------------ */
	/**                  Data Functions                        */
	/** ------------------------------------------------------ */
	override getRollData(): Record<string, any> {
		const data = { ...super.getRollData() } as Record<string, any>;
		const { savingThrows } = this.system;

		// TODO: Add a shortcut for <saveType>Save
		Object.entries(savingThrows).reduce((acc, [key, save]) => {
			acc[`${key}Save`] = save.mod ?? 0;
			return acc;
		}, data);

		return data;
	}

	getDomain(): Set<string> {
		const domain = this.tags;
		return domain;
	}

	async configureItem(id: string): Promise<void> {
		const item = this.items.get(id);

		if (!item) {
			// eslint-disable-next-line no-console
			console.error(
				`Attempted to display document sheet for item with id ${item}, but the item could not be found.`,
			);
			return;
		}

		item.sheet?.render(true);
	}

	async createItem(data) {
		this.createEmbeddedDocuments('Item', [data], { renderSheet: true });
	}

	async deleteItem(id: string): Promise<Item[]> {
		return this.deleteEmbeddedDocuments('Item', [id]);
	}

	async updateItem(id: string, data: Record<string, any>): Promise<NimbleBaseItem | undefined> {
		const item = this.items.get(id);

		if (!item) {
			// eslint-disable-next-line no-console
			console.error(`Attempted to update item with id ${item}, but the item could not be found.`);
			return undefined;
		}

		return item.update(data);
	}

	/** ------------------------------------------------------ */
	/**                  Roll Functions                        */
	/** ------------------------------------------------------ */
	async activateItem(id: string, options: Record<string, any> = {}): Promise<ChatMessage | null> {
		const item = this.items.get(id) as NimbleBaseItem;

		if (!item) {
			// eslint-disable-next-line no-console
			console.error(`Attempted to activate item with id ${item}, but the item could not be found.`);
			return null;
		}

		const flags = this.flags as Record<string, Record<string, unknown>> | undefined;
		if ((flags?.nimble?.automaticallyExecuteAvailableMacros as boolean | undefined) ?? true) {
			options.executeMacro ??= item?.hasMacro?.();
		}

		const result = await item.activate?.(options);
		return result as unknown as ChatMessage | null;
	}

	async rollAbilityCheckToChat(
		abilityKey: abilityKey,
		options = {} as ActorRollOptions,
	): Promise<ChatMessage | null> {
		const { roll, rollData } = await this.rollAbilityCheck(abilityKey, options);
		const { rollMode, visibilityMode } = rollData ?? {};

		if (!roll) return null;

		const chatData = await this.prepareAbilityCheckChatCardData(abilityKey, roll as Roll, {
			...options,
			rollMode,
		});

		// @ts-expect-error
		ChatMessage.applyRollMode(chatData, visibilityMode ?? game.settings.get('core', 'rollMode'));
		// @ts-expect-error
		const chatCard = await ChatMessage.create(chatData);

		return chatCard ?? null;
	}

	async rollAbilityCheck(abilityKey: abilityKey, options: ActorRollOptions = {}) {
		const characterSystem = this.system as NimbleCharacterData.BaseData;
		const baseRollMode = calculateRollMode(
			this.isType('character') ? (characterSystem.abilities[abilityKey].defaultRollMode ?? 0) : 0,
			options.rollModeModifier,
			options.rollMode,
		);

		let rollData: { rollFormula: string; rollMode: number; visibilityMode?: string } | null;

		if (options.skipRollDialog) {
			rollData = await this.getDefaultAbilityCheckData(abilityKey, baseRollMode, options);
		} else {
			rollData = await this.showCheckRollDialog('abilityCheck', {
				...options,
				abilityKey,
				rollMode: baseRollMode,
			});
		}

		if (!rollData) return { roll: null, rollData: null };

		const roll = new Roll(rollData.rollFormula, {
			...this.getRollData(),
			prompted: options.prompted ?? false,
			respondentId: this.uuid,
		} as Record<string, any>);

		await roll.evaluate();

		return { roll, rollData };
	}

	getDefaultAbilityCheckData(
		abilityKey: abilityKey,
		rollMode: number,
		options = {} as ActorRollOptions,
	) {
		const rollFormula = getRollFormula(this as unknown as globalThis.NimbleBaseActor, {
			abilityKey,
			rollMode,
			situationalMods: options.situationalMods ?? '',
			type: 'abilityCheck',
		});

		return { rollFormula, rollMode, visibilityMode: options.visibilityMode };
	}

	async prepareAbilityCheckChatCardData(
		abilityKey: abilityKey,
		roll: Roll,
		options = { rollMode: 0 } as ActorRollOptions,
	) {
		return {
			author: game.user?.id,
			flavor: `${this.name}: ${CONFIG.NIMBLE.abilityScores[abilityKey]} Check`,
			type: 'abilityCheck',
			rolls: [roll],
			system: {
				actorName: this?.name ?? game?.user?.name ?? '',
				actorType: this.type,
				permissions: this.permission,
				rollMode: options.rollMode,
				abilityKey,
			},
		};
	}

	async rollSavingThrowToChat(
		saveKey: saveKey,
		options = {} as ActorRollOptions,
	): Promise<ChatMessage | null> {
		const { roll, rollData } = await this.rollSavingThrow(saveKey, options);
		const { rollMode, visibilityMode } = rollData ?? {};

		if (!roll) return null;

		const chatData = await this.prepareSavingThrowChatCardData(
			saveKey,
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

	async rollSavingThrow(saveKey: saveKey, options: ActorRollOptions = {}) {
		const baseRollMode = calculateRollMode(
			this.system.savingThrows[saveKey].defaultRollMode ?? 0,
			options.rollModeModifier,
			options.rollMode,
		);

		let rollData: { rollFormula: string; rollMode: number; visibilityMode?: string } | null;

		if (options.skipRollDialog) {
			rollData = await this.getDefaultSavingThrowData(saveKey, baseRollMode, options);
		} else {
			rollData = await this.showCheckRollDialog('savingThrow', {
				...options,
				saveKey,
				rollMode: baseRollMode,
			});
		}

		if (!rollData) return { roll: null, rollData: null };

		const roll = new NimbleRoll(rollData.rollFormula, {
			...this.getRollData(),
			prompted: options.prompted ?? false,
			respondentId: this?.token?.uuid ?? this.uuid,
		} as Record<string, any>);

		await roll.evaluate();

		return { roll, rollData };
	}

	getDefaultSavingThrowData(saveKey: saveKey, rollMode: number, options = {} as ActorRollOptions) {
		const rollFormula = getRollFormula(this as unknown as globalThis.NimbleBaseActor, {
			saveKey,
			rollMode,
			situationalMods: options.situationalMods ?? '',
			type: 'savingThrow',
		});

		return { rollFormula, rollMode, visibilityMode: options.visibilityMode };
	}

	async prepareSavingThrowChatCardData(
		saveKey: saveKey,
		roll: Roll,
		options = { rollMode: 0 } as ActorRollOptions,
	) {
		return {
			author: game.user?.id,
			flavor: `${this.name}: ${CONFIG.NIMBLE.savingThrows[saveKey]} Saving Throw`,
			type: 'savingThrow',
			rolls: [roll],
			system: {
				actorName: this?.name ?? game?.user?.name ?? '',
				actorType: this.type,
				permissions: this.permission,
				rollMode: options.rollMode,
				saveKey,
			},
		};
	}

	async showCheckRollDialog(
		type: 'abilityCheck' | 'savingThrow' | 'skillCheck',
		data: CheckRollDialogData,
	): Promise<any> {
		let title = '';

		switch (type) {
			case 'abilityCheck':
				title = `${this.name}: Configure ${CONFIG.NIMBLE.abilityScores[data?.abilityKey ?? '']} Ability Check`;
				break;
			case 'savingThrow':
				title = `${this.name}: Configure ${CONFIG.NIMBLE.savingThrows[data?.saveKey ?? '']} Saving Throw`;
				break;
			case 'skillCheck':
				title = `${this.name}: Configure ${CONFIG.NIMBLE.skills[data?.skillKey ?? '']} Skill Check`;
				break;
			default:
				return null;
		}

		const { default: CheckRollDialog } = await import('../dialogs/CheckRollDialog.svelte.js');
		const dialog = new CheckRollDialog(this as unknown as Actor, title, { ...data, type });

		await dialog.render(true);
		const dialogData = await dialog.promise;

		return dialogData;
	}

	override async rollInitiative({
		createCombatants = false,
		rerollInitiative = false,
		initiativeOptions = {},
	}) {
		return super.rollInitiative({
			createCombatants,
			rerollInitiative,
			initiativeOptions,
		});
	}

	_getInitiativeFormula(rollOptions: Record<string, unknown> = {}): string {
		if (!this.isType('character')) {
			return '0';
		}

		const characterSystem = this.system as NimbleCharacterData.BaseData &
			NimbleCharacterData.DerivedData;
		const rollMode = (rollOptions.rollMode as number | undefined) ?? 1;
		let modifiers = '';

		if (rollMode > 1) modifiers = `kh${rollMode - 1}`;
		else if (rollMode < 0) modifiers = `kl${Math.abs(rollMode) - 1}`;
		else modifiers = '';

		const bonus = characterSystem.attributes.initiative.mod || '';

		if (!bonus) return `${rollMode}d20${modifiers}`;

		return `${rollMode}d20${modifiers} + ${bonus}`;
	}

	/** ------------------------------------------------------ */
	/**                         CRUD                           */
	/** ------------------------------------------------------ */
	protected override async _preUpdate(
		changes: Parameters<Actor['_preUpdate']>[0],
		options: Parameters<Actor['_preUpdate']>[1],
		user: Parameters<Actor['_preUpdate']>[2],
	): Promise<boolean | undefined> {
		// If hp drops below 0, set the value to 0.
		const hpValue = foundry.utils.getProperty(changes, 'system.attributes.hp.value') as
			| number
			| undefined;
		if (hpValue !== undefined && hpValue < 0) {
			foundry.utils.setProperty(
				changes as Record<string, unknown>,
				'system.attributes.hp.value',
				0,
			);
		}

		// If temp hp drops to or below 0, set the value to 0.
		const tempValue = foundry.utils.getProperty(changes, 'system.attributes.hp.temp') as
			| number
			| undefined;
		if (tempValue !== undefined && tempValue < 0) {
			foundry.utils.setProperty(changes as Record<string, unknown>, 'system.attributes.hp.temp', 0);
		}

		// If Image is changed, change prototype token as well
		const img = foundry.utils.getProperty(changes, 'img') as string | undefined;
		if (img) {
			foundry.utils.setProperty(
				changes as Record<string, unknown>,
				'prototypeToken.texture.src',
				img,
			);
		}

		const result = await super._preUpdate(changes, options, user);
		return result ?? undefined;
	}
}

export { NimbleBaseActor };
