import type { DatabaseCreateOperation } from '@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/abstract/_types.d.mts';
import type Document from '@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/abstract/document.d.mts';
import type {
	DeepPartial,
	InexactPartial,
} from '@league-of-foundry-developers/foundry-vtt-types/src/types/utils.d.mts';
import type { ActorRollOptions } from './actorData.js';
import type { NimbleBaseItem } from '../item/base.svelte.js';
import type { NimbleBaseRule } from '../../models/rules/base.js';

import { NimbleRoll } from '../../dice/NimbleRoll.js';

import calculateRollMode from '../../utils/calculateRollMode.js';
import getRollFormula from '../../utils/getRollFormula.js';
import { createSubscriber } from 'svelte/reactivity';

import ActorCreationDialog from '../dialogs/ActorCreationDialog.svelte.js';
import ActorSavingThrowConfigDialog from '../../view/dialogs/ActorSavingThrowConfigDialog.svelte';
import CheckRollDialog from '../dialogs/CheckRollDialog.svelte.js';
import GenericDialog from '../dialogs/GenericDialog.svelte.js';

export type SystemActorTypes = Exclude<foundry.documents.BaseActor.TypeNames, 'base'>;

// @ts-ignore - Ignoring infinite error
interface NimbleBaseActor<ActorType extends SystemActorTypes = SystemActorTypes> {
	type: ActorType;
	system: DataModelConfig['Actor'][ActorType];
	items: foundry.abstract.EmbeddedCollection<NimbleBaseItem, Actor.ConfiguredInstance>;
}

export interface CheckRollDialogData extends ActorRollOptions {
	abilityKey?: abilityKey | undefined;
	saveKey?: saveKey | undefined;
	skillKey?: skillKey | undefined;
}

class NimbleBaseActor extends Actor {
	declare initialized: boolean;

	declare rules: InstanceType<typeof NimbleBaseRule>[];

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

			const embeddedItemHooks = ['create', 'delete', 'update'].reduce(
				(hooks, hookType) => {
					hooks[hookType] = Hooks.on(`${hookType}Item`, (triggeringDocument, _, { diff }) => {
						if (diff === false) return;

						if (triggeringDocument?.actor?._id === this.id) update();
					});

					return hooks;
				},
				{} as Record<string, number>,
			);

			return () => {
				Hooks.off('updateActor', updateActorHook);
				Hooks.off('createItem', embeddedItemHooks.create);
				Hooks.off('deleteItem', embeddedItemHooks.delete);
				Hooks.off('updateItem', embeddedItemHooks.update);
			};
		});
	}

	static override async createDialog<T extends Document.AnyConstructor>(
		this: T,
		data?: DeepPartial<Document.ConstructorDataFor<T> & Record<string, unknown>>,
		context?: Pick<DatabaseCreateOperation<InstanceType<T>>, 'parent' | 'pack'> &
			InexactPartial<
				DialogOptions & {
					/** A restriction the selectable sub-types of the Dialog. */
					types: string[];
				}
			>,
	): Promise<Document.ToConfiguredInstance<T> | null | undefined> {
		const {
			// @ts-expect-error
			parent,
			pack,
			types,
			...options
		} = context;

		const dialog = new ActorCreationDialog(
			{
				...data,
				parent,
				pack,
				types,
			},
			{ ...options },
		);

		// @ts-expect-error
		return dialog.render(true);
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

	get sourceId(): string {
		return this._stats.compendiumSource || this.flags?.core?.source || undefined;
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
		this.rules.forEach((rule) => rule.afterPrepareData?.());
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
		this.rules.forEach((rule) => rule.prePrepareData?.());

		this._populateDerivedTags();
	}

	_populateDerivedTags(): void {}

	/** ------------------------------------------------------ */
	/**                    Config Methods                      */
	/** ------------------------------------------------------ */

	async configureSavingThrows() {
		const dialog = new GenericDialog(
			`${this.name}: Configure Saving Throws`,
			ActorSavingThrowConfigDialog,
			{ document: this },
			// @ts-expect-error
			{ icon: 'fa-solid fa-shield', width: 600 },
		);

		await dialog.render(true);
	}

	/** ------------------------------------------------------ */
	/**                Data Update Helpers                     */
	/** ------------------------------------------------------ */
	async applyHealing(healing: number, healingType?: string) {
		const updates = {};
		const { value, max, temp } = this.system.attributes.hp;
		healing = Math.floor(healing);

		if (healingType === 'temporaryHealing') {
			if (healing <= temp) {
				ui.notifications.warn('Temporary hit points were not granted to {this.name}. ', {
					localize: true,
				});
				return;
			}

			updates['system.attributes.hp.temp'] = healing;
		} else {
			updates['system.attributes.hp.value'] = Math.clamp(value + healing, value, max);
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

		if (this.getFlag('nimble', 'automaticallyExecuteAvailableMacros') ?? true) {
			options.executeMacro ??= item?.hasMacro;
		}

		return item.activate(options);
	}

	async rollAbilityCheckToChat(
		abilityKey: abilityKey,
		options = {} as ActorRollOptions,
	): Promise<ChatMessage | null> {
		const { roll, rollData } = await this.rollAbilityCheck(abilityKey, options);
		const { rollMode, visibilityMode } = rollData ?? {};

		if (!roll) return null;

		const chatData = await this.prepareAbilityCheckChatCardData(abilityKey, roll, {
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
		const baseRollMode = calculateRollMode(
			this.isType('character') ? (this.system.abilities[abilityKey].defaultRollMode ?? 0) : 0,
			options.rollModeModifier,
			options.rollMode,
		);

		let rollData;

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
		const rollFormula = getRollFormula(this, {
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

		let rollData;

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
		const rollFormula = getRollFormula(this, {
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
		rollOptions ??= {};

		if (!this.isType('character')) {
			return '0';
		}

		const rollMode = rollOptions.rollMode ?? 1;
		let modifiers = '';

		if (rollMode > 1) modifiers = `kh${rollMode - 1}`;
		else if (rollMode < 0) modifiers = `kl${Math.abs(rollMode) - 1}`;
		else modifiers = '';

		const bonus = this.system.attributes.initiative.mod || '';

		if (!bonus) return `${rollMode}d20${modifiers}`;

		return `${rollMode}d20${modifiers} + ${bonus}`;
	}

	/** ------------------------------------------------------ */
	/**                         CRUD                           */
	/** ------------------------------------------------------ */
	override async _preUpdate(
		changes: foundry.documents.BaseActor.ConstructorData,
		options: any,
		user: foundry.documents.BaseUser,
	) {
		// If hp drops below 0, set the value to 0.
		if (foundry.utils.getProperty(changes, 'system.attributes.hp.value') < 0) {
			foundry.utils.setProperty(changes, 'system.attributes.hp.value', 0);
		}

		// If temp hp drops to or below 0, set the value to 0.
		if (foundry.utils.getProperty(changes, 'system.attributes.hp.temp') < 0) {
			foundry.utils.setProperty(changes, 'system.attributes.hp.temp', 0);
		}

		// If Image is changed, change prototype token as well
		const img = foundry.utils.getProperty(changes, 'img');
		if (img) {
			foundry.utils.setProperty(changes, 'prototypeToken.texture.src', img);
		}

		return super._preUpdate(changes, options, user);
	}
}

export { NimbleBaseActor };
