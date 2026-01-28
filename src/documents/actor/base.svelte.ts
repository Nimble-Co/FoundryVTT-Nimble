import type { DeepPartial, InexactPartial } from 'fvtt-types/utils';
import { createSubscriber } from 'svelte/reactivity';
import type { AbilityKeyType } from '#types/abilityKey.d.ts';
import type { SaveKeyType } from '#types/saveKey.d.ts';
import { NimbleRoll } from '../../dice/NimbleRoll.js';
import calculateRollMode from '../../utils/calculateRollMode.js';
import getRollFormula from '../../utils/getRollFormula.js';
import type { ActorRollOptions, CheckRollDialogData, SystemActorTypes } from './actorInterfaces.ts';

export type { ActorRollOptions, CheckRollDialogData, SystemActorTypes };

// Forward declarations to avoid circular dependencies
import type { SystemItemTypes } from '../item/itemInterfaces.js';

interface NimbleBaseItem extends Item {
	rules: RulesManagerInterface;
	identifier: string;
	hasMacro?: boolean;
	activate?(options?: Record<string, unknown>): Promise<ChatMessage | null>;
	prepareActorData?(): void;
	isType<TypeName extends SystemItemTypes>(
		type: TypeName,
	): this is NimbleBaseItem & {
		type: TypeName;
		system: TypeName extends keyof DataModelConfig['Item']
			? DataModelConfig['Item'][TypeName]
			: object;
	};
}

/** Base system data that all actor types share */
interface BaseActorSystemData {
	attributes: {
		hp: {
			value: number;
			max: number;
			temp: number;
		};
		sizeCategory?: string;
		initiative?: {
			mod: number;
		};
	};
	abilities?: Record<string, { mod: number; defaultRollMode?: number }>;
	savingThrows?: Record<string, { mod: number; defaultRollMode?: number }>;
}

class NimbleBaseActor<ActorType extends SystemActorTypes = SystemActorTypes> extends Actor {
	declare type: ActorType;

	declare initialized: boolean;

	declare rules: NimbleBaseRule[];

	declare items: foundry.abstract.EmbeddedCollection<NimbleBaseItem, Actor.Implementation>;

	#subscribe: ReturnType<typeof createSubscriber>;

	tags: Set<string> = new Set();

	// *************************************************
	constructor(data: Actor.CreateData, context?: Actor.ConstructionContext) {
		super(data, context);

		this.#subscribe = createSubscriber((update) => {
			const updateActorHook = Hooks.on('updateActor', (triggeringDocument, _, { diff }) => {
				if (diff === false) return;

				if (triggeringDocument._id === this.id) update();
			});

			const embeddedItemHooks = {
				create: Hooks.on('createItem', (doc) => {
					if (doc?.actor?.id === this.id) update();
				}),
				delete: Hooks.on('deleteItem', (doc) => {
					if (doc?.actor?.id === this.id) update();
				}),
				update: Hooks.on('updateItem', (doc, _change, { diff }) => {
					if (diff === false) return;
					if (doc?.actor?.id === this.id) update();
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
		data?: DeepPartial<Actor.CreateData & Record<string, unknown>>,
		context?: InexactPartial<{
			parent: Actor.Implementation['parent'] | null;
			pack: string | null;
			types: string[];
			icon: string;
			width: number;
		}>,
	): Promise<Actor.Stored | null | undefined> {
		const { parent, pack, types } = context ?? {};

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
			{ parent: (parent ?? null) as null, pack: (pack ?? null) as null },
		);

		return dialog.render(true) as object as Promise<Actor.Stored | null | undefined>;
	}

	/** ------------------------------------------------------ */
	/**                    Type Helpers                        */
	/** ------------------------------------------------------ */
	isType<TypeName extends SystemActorTypes>(type: TypeName): this is NimbleBaseActor<TypeName> {
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
		return (
			this._stats.compendiumSource ??
			((this.flags as Record<string, Record<string, unknown>>)?.core?.source as string | undefined)
		);
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
		this.rules.forEach((rule) => {
			rule.afterPrepareData?.();
		});
	}

	override prepareBaseData(): void {
		super.prepareBaseData();

		// Resets
		this.tags = new Set();
		this._populateBaseTags();
	}

	_populateBaseTags(): void {
		const dispositions = foundry.utils.invertObject(CONST.TOKEN_DISPOSITIONS);
		const systemData = this.system as unknown as BaseActorSystemData;

		if (systemData.attributes.sizeCategory) {
			this.tags.add(`size:${systemData.attributes.sizeCategory}`);
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
		this.rules.forEach((rule) => {
			rule.prePrepareData?.();
		});

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
			`${this.name}: Configure Saves`,
			ActorSavingThrowConfigDialog,
			{ document: this },
			{ icon: 'fa-solid fa-shield', width: 600 },
		);

		await dialog.render(true);
	}

	/** ------------------------------------------------------ */
	/**                Data Update Helpers                     */
	/** ------------------------------------------------------ */
	async applyHealing(healing: number, healingType?: string) {
		const updates: Record<string, unknown> = {};
		const systemData = this.system as unknown as BaseActorSystemData;
		const { value, max, temp } = systemData.attributes.hp;
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
	override getRollData(_item?: Item.Implementation): Record<string, unknown> {
		const data = { ...super.getRollData() } as Record<string, unknown>;
		const systemData = this.system as unknown as BaseActorSystemData;
		const savingThrows = systemData.savingThrows ?? {};

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
			console.error(
				`Attempted to display document sheet for item with id ${item}, but the item could not be found.`,
			);
			return;
		}

		item.sheet?.render(true);
	}

	async createItem(data: Item.CreateData) {
		this.createEmbeddedDocuments('Item', [data], { renderSheet: true });
	}

	async deleteItem(id: string): Promise<Item[]> {
		return this.deleteEmbeddedDocuments('Item', [id]);
	}

	async updateItem(id: string, data: Record<string, any>): Promise<NimbleBaseItem | undefined> {
		const item = this.items.get(id);

		if (!item) {
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
			console.error(`Attempted to activate item with id ${item}, but the item could not be found.`);
			return null;
		}

		const autoExecMacros =
			(this as Actor).getFlag('nimble', 'automaticallyExecuteAvailableMacros') ?? true;
		if (autoExecMacros) {
			options.executeMacro ??= item?.hasMacro;
		}

		if (!item.activate) return null;
		return item.activate(options);
	}

	async rollAbilityCheckToChat(
		abilityKey: AbilityKeyType,
		options = {} as ActorRollOptions,
	): Promise<ChatMessage | null> {
		const { roll, rollData } = await this.rollAbilityCheck(abilityKey, options);
		const { rollMode, visibilityMode } = rollData ?? {};

		if (!roll) return null;

		const chatData = await this.prepareAbilityCheckChatCardData(abilityKey, roll, {
			...options,
			rollMode,
		});

		ChatMessage.applyRollMode(
			chatData as Record<string, unknown>,
			visibilityMode ?? game.settings.get('core', 'rollMode'),
		);
		const chatCard = await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);

		return chatCard ?? null;
	}

	async rollAbilityCheck(abilityKey: AbilityKeyType, options: ActorRollOptions = {}) {
		const systemData = this.system as unknown as BaseActorSystemData;
		const baseRollMode = calculateRollMode(
			this.isType('character') ? (systemData.abilities?.[abilityKey]?.defaultRollMode ?? 0) : 0,
			options.rollModeModifier,
			options.rollMode,
		);

		const rollData = await (options.skipRollDialog
			? this.getDefaultAbilityCheckData(abilityKey, baseRollMode, options)
			: this.showCheckRollDialog('abilityCheck', {
					...options,
					abilityKey,
					rollMode: baseRollMode,
				}));

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
		abilityKey: AbilityKeyType,
		rollMode: number,
		options = {} as ActorRollOptions,
	) {
		const rollFormula = getRollFormula(this, {
			abilityKey,
			rollMode,
			situationalMods: options.situationalMods ?? '',
			type: 'abilityCheck',
		});

		return { rollFormula, rollMode, visibilityMode: options.visibilityMode };
	}

	async prepareAbilityCheckChatCardData(
		abilityKey: AbilityKeyType,
		roll: Roll<Record<string, unknown>>,
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
		saveKey: SaveKeyType,
		options = {} as ActorRollOptions,
	): Promise<ChatMessage | null> {
		const { roll, rollData } = await this.rollSavingThrow(saveKey, options);
		const { rollMode, visibilityMode } = rollData ?? {};

		if (!roll) return null;

		const chatData = await this.prepareSavingThrowChatCardData(saveKey, roll, {
			...options,
			rollMode,
		});

		ChatMessage.applyRollMode(
			chatData as Record<string, unknown>,
			visibilityMode ?? game.settings.get('core', 'rollMode'),
		);
		const chatCard = await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);

		return chatCard ?? null;
	}

	async rollSavingThrow(saveKey: SaveKeyType, options: ActorRollOptions = {}) {
		const systemData = this.system as unknown as BaseActorSystemData;
		const baseRollMode = calculateRollMode(
			systemData.savingThrows?.[saveKey]?.defaultRollMode ?? 0,
			options.rollModeModifier,
			options.rollMode,
		);

		const rollData = options.skipRollDialog
			? this.getDefaultSavingThrowData(saveKey, baseRollMode, options)
			: await this.showCheckRollDialog('savingThrow', {
					...options,
					saveKey,
					rollMode: baseRollMode,
				});

		if (!rollData) return { roll: null, rollData: null };

		const roll = new NimbleRoll(rollData.rollFormula, {
			...this.getRollData(),
			prompted: options.prompted ?? false,
			respondentId: this?.token?.uuid ?? this.uuid,
		} as NimbleRoll.Data);

		await roll.evaluate();

		return { roll, rollData };
	}

	getDefaultSavingThrowData(
		saveKey: SaveKeyType,
		rollMode: number,
		options = {} as ActorRollOptions,
	) {
		const rollFormula = getRollFormula(this, {
			saveKey,
			rollMode,
			situationalMods: options.situationalMods ?? '',
			type: 'savingThrow',
		});

		return { rollFormula, rollMode, visibilityMode: options.visibilityMode };
	}

	async prepareSavingThrowChatCardData(
		saveKey: SaveKeyType,
		roll: NimbleRoll | Roll<Record<string, unknown>>,
		options = { rollMode: 0 } as ActorRollOptions,
	) {
		return {
			author: game.user?.id,
			flavor: `${this.name}: ${CONFIG.NIMBLE.savingThrows[saveKey]} Save`,
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
				title = `${this.name}: Configure ${
					CONFIG.NIMBLE.abilityScores[data?.abilityKey ?? '']
				} Ability Check`;
				break;
			case 'savingThrow':
				title = `${this.name}: Configure ${CONFIG.NIMBLE.savingThrows[data?.saveKey ?? '']} Save`;
				break;
			case 'skillCheck':
				title = `${this.name}: Configure ${CONFIG.NIMBLE.skills[data?.skillKey ?? '']} Skill Check`;
				break;
			default:
				return null;
		}

		const { default: CheckRollDialog } = await import('../dialogs/CheckRollDialog.svelte.js');
		const dialog = new CheckRollDialog(this, title, { ...data, type });

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

	_getInitiativeFormula(rollOptions: Record<string, any>): string {
		if (!this.isType('character')) {
			return '0';
		}

		const systemData = this.system as unknown as BaseActorSystemData & {
			attributes: { initiative: { defaultRollMode?: number } };
		};

		// Get the default roll mode from character data (set by rules like initiativeRollMode)
		const defaultRollMode = systemData.attributes.initiative?.defaultRollMode ?? 0;

		// Calculate the effective roll mode: override > (default + modifier)
		const rollModeOverride = rollOptions?.rollMode ?? null;
		const rollModeModifier = rollOptions?.rollModeModifier ?? 0;
		const rollMode =
			rollModeOverride !== null ? rollModeOverride : defaultRollMode + rollModeModifier;

		// Build the d20 term based on roll mode (following constructD20Term pattern)
		let d20Term = '1d20';
		if (rollMode > 0) {
			d20Term = `${rollMode + 1}d20kh`;
		} else if (rollMode < 0) {
			d20Term = `${Math.abs(rollMode) + 1}d20kl`;
		}

		const bonus = systemData.attributes.initiative?.mod || '';

		if (!bonus) return d20Term;

		return `${d20Term} + ${bonus}`;
	}

	/** ------------------------------------------------------ */
	/**                         CRUD                           */
	/** ------------------------------------------------------ */
	override async _preUpdate(
		changes: Actor.UpdateData,
		options: Actor.Database.PreUpdateOptions,
		user: User.Implementation,
	) {
		const changesObj = changes as Record<string, unknown>;
		// If hp drops below 0, set the value to 0.
		const hpValue = foundry.utils.getProperty(changesObj, 'system.attributes.hp.value');
		if (typeof hpValue === 'number' && hpValue < 0) {
			foundry.utils.setProperty(changesObj, 'system.attributes.hp.value', 0);
		}

		// If temp hp drops to or below 0, set the value to 0.
		const tempValue = foundry.utils.getProperty(changesObj, 'system.attributes.hp.temp');
		if (typeof tempValue === 'number' && tempValue < 0) {
			foundry.utils.setProperty(changesObj, 'system.attributes.hp.temp', 0);
		}

		// If Image is changed, change prototype token as well
		const img = foundry.utils.getProperty(changesObj, 'img');
		if (img) {
			// we don't update the token image if the tokenizer module is installed & active
			if (game.modules.get('tokenizer')?.active === false) {
				foundry.utils.setProperty(changes, 'prototypeToken.texture.src', img);
			}
		}

		return super._preUpdate(changes, options, user);
	}
}

export { NimbleBaseActor };
