import type { DeepPartial, InexactPartial } from 'fvtt-types/utils';
import { createSubscriber } from 'svelte/reactivity';
import type { AbilityKeyType } from '#types/abilityKey.d.ts';
import type { SaveKeyType } from '#types/saveKey.d.ts';
import { NimbleRoll } from '../../dice/NimbleRoll.js';
import { getAdjacencySyncEnabled } from '../../settings/adjacencySettings.js';
import calculateRollMode from '../../utils/calculateRollMode.js';
import getRollFormula from '../../utils/getRollFormula.js';
import { ADJACENCY_QUALIFIER } from '../../utils/tokenAdjacency.js';
import GenericDialog from '../dialogs/GenericDialog.svelte.js';
import type { ActorRollOptions, CheckRollDialogData, SystemActorTypes } from './actorInterfaces.ts';
import { HP_SCROLLING_TEXT_COLORS } from './hpScrollingTextColors.ts';

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

interface HpSnapshot {
	value: number;
	max: number;
	temp: number;
}

interface HpTrackingOptions {
	nimble?: {
		previousHp?: HpSnapshot;
	};
}

interface InitiativeRollData {
	rollFormula: string;
	rollMode: number;
	visibilityMode?: string | undefined;
}

type HpScrollingEffectType = keyof typeof HP_SCROLLING_TEXT_COLORS;

function toFiniteInteger(value: unknown): number {
	const numericValue = Number(value);
	if (!Number.isFinite(numericValue)) return 0;
	return Math.floor(numericValue);
}

function toSignedIntegerString(value: number): string {
	const integerValue = Math.trunc(value);
	if (integerValue >= 0) return `+${integerValue}`;
	return `${integerValue}`;
}

class NimbleBaseActor<ActorType extends SystemActorTypes = SystemActorTypes> extends Actor {
	declare type: ActorType;

	declare initialized: boolean;

	declare rules: NimbleBaseRule[];

	declare items: foundry.abstract.EmbeddedCollection<NimbleBaseItem, Actor.Implementation>;

	#subscribe: ReturnType<typeof createSubscriber>;
	#lastHpSnapshot: HpSnapshot | null = null;

	tags: Set<string> = new Set();

	// *************************************************
	constructor(data: Actor.CreateData, context?: Actor.ConstructionContext) {
		super(data, context);
		this.#lastHpSnapshot = this.#getCurrentHpSnapshot();

		this.#subscribe = createSubscriber((update) => {
			const updateActorHook = Hooks.on('updateActor', (triggeringDocument, _, { diff }) => {
				if (diff === false) return;

				if (triggeringDocument._id === this.id) {
					update();
				}
			});

			const embeddedItemHooks = {
				create: Hooks.on('createItem', (doc) => {
					if (doc?.actor?.id === this.id) {
						update();
					}
				}),
				delete: Hooks.on('deleteItem', (doc) => {
					if (doc?.actor?.id === this.id) {
						update();
					}
				}),
				update: Hooks.on('updateItem', (doc, _change, { diff }) => {
					if (diff === false) return;
					if (doc?.actor?.id === this.id) {
						update();
					}
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

		// Populate derived tags before rules run so predicates can evaluate against them
		this._populateDerivedTags();

		// Call rule hooks
		this.rules.forEach((rule) => {
			rule.prePrepareData?.();
		});
	}

	_populateDerivedTags(): void {
		if (!getAdjacencySyncEnabled()) return;

		const adjacency = this.getFlag('nimble', 'adjacency') as
			| { enemiesAdjacentCount?: number; hasMostAdjacentEnemies?: boolean }
			| undefined;

		if (!adjacency) return;

		const { enemiesAdjacentCount: count, hasMostAdjacentEnemies: hasMost } = adjacency;

		if (typeof count === 'number' && count > 0) {
			this.tags.add(`enemiesAdjacent:${count}`);
		}

		if (hasMost) {
			this.tags.add(`enemiesAdjacent:${ADJACENCY_QUALIFIER.MOST}`);
		}
	}

	/** ------------------------------------------------------ */
	/**                    Config Methods                      */
	/** ------------------------------------------------------ */

	async configureSavingThrows() {
		const { default: ActorSavingThrowConfigDialog } = await import(
			'../../view/dialogs/ActorSavingThrowConfigDialog.svelte'
		);

		const uniqueId = `configure-saves-${this.id}`;
		const dialog = GenericDialog.getOrCreate(
			`${this.name}: Configure Saves`,
			ActorSavingThrowConfigDialog,
			{ document: this },
			{ icon: 'fa-solid fa-shield', width: 600, uniqueId },
		);

		await dialog.render(true);
	}

	/** ------------------------------------------------------ */
	/**                Data Update Helpers                     */
	/** ------------------------------------------------------ */
	#getCurrentHpSnapshot(): HpSnapshot {
		const systemData = this.system as unknown as BaseActorSystemData | undefined;
		const hpData = systemData?.attributes?.hp ?? { value: 0, max: 0, temp: 0 };
		return {
			value: Math.max(0, toFiniteInteger(hpData.value)),
			max: Math.max(0, toFiniteInteger(hpData.max)),
			temp: Math.max(0, toFiniteInteger(hpData.temp)),
		};
	}

	#emitHpChangeScrollingText(changes: { hp: number; temp: number; total: number }): void {
		let effectType: HpScrollingEffectType | null = null;
		let effectValue = 0;

		if (changes.hp < 0) {
			effectType = 'damage';
			effectValue = changes.total;
		} else if (changes.hp > 0) {
			effectType = 'healing';
			effectValue = changes.total;
		} else if (changes.temp !== 0) {
			effectType = 'temp';
			effectValue = changes.temp;
		}

		if (!effectType || effectValue === 0) return;

		const canvasReference = (
			globalThis as {
				canvas?: {
					ready?: boolean;
					interface?: unknown;
				};
			}
		).canvas;
		const canvasInterface = canvasReference?.interface as
			| {
					createScrollingText?: (
						origin: { x: number; y: number },
						content: string,
						options?: {
							anchor?: number;
							jitter?: number;
							fontSize?: number;
							fill?: number;
							stroke?: number;
							strokeThickness?: number;
						},
					) => Promise<void>;
			  }
			| undefined;
		if (!canvasReference?.ready || !canvasInterface?.createScrollingText) return;

		const tokens = this.isToken ? [this.token] : this.getActiveTokens(true, true);
		if (tokens.length < 1) return;

		const fill = HP_SCROLLING_TEXT_COLORS[effectType];

		for (const tokenDocument of tokens) {
			if (!tokenDocument) continue;

			const isSecret = (tokenDocument as TokenDocument & { isSecret?: boolean }).isSecret === true;
			const tokenObject = tokenDocument.object as {
				visible?: boolean;
				center?: { x: number; y: number };
			} | null;
			if (!tokenObject?.visible || !tokenObject.center || isSecret) continue;

			const ringToken = tokenDocument as TokenDocument & {
				hasDynamicRing?: boolean;
				flashRing?: (ringType: string) => void;
			};
			if (ringToken.hasDynamicRing && ringToken.flashRing) {
				ringToken.flashRing(effectType);
			}

			void canvasInterface.createScrollingText(
				tokenObject.center,
				toSignedIntegerString(effectValue),
				{
					anchor: CONST.TEXT_ANCHOR_POINTS.TOP,
					jitter: 0.25,
					fill,
				},
			);
		}
	}

	async applyDamage(damage: number): Promise<void> {
		const damageAmount = Math.floor(Math.abs(Number(damage)));
		if (!Number.isFinite(damageAmount) || damageAmount <= 0) return;

		const { value, temp } = this.#getCurrentHpSnapshot();
		const absorbedByTemp = Math.min(temp, damageAmount);
		const nextTemp = temp - absorbedByTemp;
		const remainingDamage = damageAmount - absorbedByTemp;
		const nextHp = Math.max(value - remainingDamage, 0);

		const updates: Record<string, unknown> = {};
		if (nextTemp !== temp) updates['system.attributes.hp.temp'] = nextTemp;
		if (nextHp !== value) updates['system.attributes.hp.value'] = nextHp;

		if (Object.keys(updates).length < 1) return;
		await this.update(updates as Actor.UpdateData);
	}

	async setCurrentHP(value: number): Promise<void> {
		const hpData = this.#getCurrentHpSnapshot();
		const requestedValue = Math.floor(Number(value));
		if (!Number.isFinite(requestedValue)) return;

		const nextValue = Math.clamp(requestedValue, 0, hpData.max);
		if (nextValue === hpData.value) return;

		await this.update({ 'system.attributes.hp.value': nextValue } as Actor.UpdateData);
	}

	async setMaxHP(value: number): Promise<void> {
		const hpData = this.#getCurrentHpSnapshot();
		const requestedMax = Math.floor(Number(value));
		if (!Number.isFinite(requestedMax)) return;

		const nextMax = Math.max(0, requestedMax);
		const nextCurrent = Math.min(hpData.value, nextMax);

		const updates: Record<string, unknown> = {};
		if (nextMax !== hpData.max) updates['system.attributes.hp.max'] = nextMax;
		if (nextCurrent !== hpData.value) updates['system.attributes.hp.value'] = nextCurrent;

		if (Object.keys(updates).length < 1) return;
		await this.update(updates as Actor.UpdateData);
	}

	async setTempHP(value: number): Promise<void> {
		const hpData = this.#getCurrentHpSnapshot();
		const requestedTemp = Math.floor(Number(value));
		if (!Number.isFinite(requestedTemp)) return;

		const nextTemp = Math.max(0, requestedTemp);
		if (nextTemp === hpData.temp) return;

		await this.update({ 'system.attributes.hp.temp': nextTemp } as Actor.UpdateData);
	}

	async applyHealing(healing: number, healingType?: string) {
		const { value, temp } = this.#getCurrentHpSnapshot();
		const healingAmount = Math.floor(Number(healing));
		if (!Number.isFinite(healingAmount) || healingAmount <= 0) return;

		if (healingType === 'tempHealing') {
			if (healingAmount <= temp) {
				ui.notifications.warn('Temporary hit points were not granted to {this.name}. ', {
					localize: true,
				});
				return;
			}

			await this.setTempHP(healingAmount);
			return;
		}

		await this.setCurrentHP(value + healingAmount);
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

	async rollInitiativeToChat(options = {} as ActorRollOptions): Promise<ChatMessage | null> {
		const rollData = await this.resolveInitiativeRollData(options);
		if (!rollData) return null;

		const roll = Roll.create(rollData.rollFormula, this.getRollData());
		await roll.evaluate();

		const chatData = (await roll.toMessage(
			{
				speaker: ChatMessage.getSpeaker({ actor: this }),
				flavor: game.i18n.format('COMBAT.RollsInitiative', { name: this.name }),
				flags: { core: { initiativeRoll: true } },
			},
			{ create: false },
		)) as ChatMessage.CreateData;
		const visibilityMode = (rollData.visibilityMode ??
			(game.settings.get('core', 'rollMode') as CONST.DICE_ROLL_MODES)) as CONST.DICE_ROLL_MODES;

		ChatMessage.applyRollMode(chatData as Record<string, unknown>, visibilityMode);

		return (await ChatMessage.create(chatData)) ?? null;
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

	async resolveInitiativeRollData(
		options = {} as ActorRollOptions,
	): Promise<InitiativeRollData | null> {
		const systemData = this.system as unknown as BaseActorSystemData & {
			attributes: { initiative: { defaultRollMode?: number } };
		};
		const baseRollMode = calculateRollMode(
			systemData.attributes.initiative?.defaultRollMode ?? 0,
			options.rollModeModifier,
			options.rollMode,
		);

		return options.skipRollDialog
			? this.getDefaultInitiativeData(baseRollMode, options)
			: await this.showCheckRollDialog('initiative', {
					...options,
					rollMode: baseRollMode,
				});
	}

	getDefaultInitiativeData(rollMode: number, options = {} as ActorRollOptions): InitiativeRollData {
		return {
			rollFormula: this._getInitiativeFormula({ ...options, rollMode }),
			rollMode,
			visibilityMode: options.visibilityMode,
		};
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
		type: 'abilityCheck' | 'savingThrow' | 'skillCheck' | 'initiative',
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
			case 'initiative':
				title = `${this.name}: Configure Initiative`;
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
		const hpWasChanged =
			foundry.utils.hasProperty(changesObj, 'system.attributes.hp.value') ||
			foundry.utils.hasProperty(changesObj, 'system.attributes.hp.temp');
		if (hpWasChanged) {
			const optionsWithTracking = options as Actor.Database.PreUpdateOptions & HpTrackingOptions;
			optionsWithTracking.nimble ??= {};
			optionsWithTracking.nimble.previousHp = this.#getCurrentHpSnapshot();
		}

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

	override _onUpdate(
		_changed: Actor.UpdateData,
		options: Actor.Database.OnUpdateOperation,
		_userId: string,
	): void {
		super._onUpdate(_changed, options, _userId);

		const currentHp = this.#getCurrentHpSnapshot();
		const optionsWithTracking = options as Actor.Database.OnUpdateOperation & HpTrackingOptions;
		const previousHp = optionsWithTracking.nimble?.previousHp ?? this.#lastHpSnapshot;

		this.#lastHpSnapshot = currentHp;
		if (!previousHp) return;

		const hpDelta = currentHp.value - previousHp.value;
		const tempDelta = currentHp.temp - previousHp.temp;
		if (hpDelta === 0 && tempDelta === 0) return;

		this.#emitHpChangeScrollingText({
			hp: hpDelta,
			temp: tempDelta,
			total: hpDelta + tempDelta,
		});
	}
}

export { NimbleBaseActor };
