import type { InexactPartial } from 'fvtt-types/utils';
import { createSubscriber } from 'svelte/reactivity';
import { DamageRoll } from '../../dice/DamageRoll.js';
import { ItemActivationManager } from '../../managers/ItemActivationManager.js';
import { RulesManager } from '../../managers/RulesManager.js';
import type { NimbleBaseItemData } from '../../models/item/BaseItemDataModel.js';

export type { SystemItemTypes } from './itemInterfaces.js';

import type { SystemItemTypes } from './itemInterfaces.js';

// Forward declaration to avoid circular dependency
interface NimbleBaseActorInterface extends Actor {
	initialized: boolean;
	getDomain(): Set<string>;
	getRollData(item?: Record<string, unknown>): Record<string, unknown>;
}

/** System data interface for NimbleBaseItem */
interface NimbleItemSystemData extends NimbleBaseItemData.BaseData {
	identifier: string;
	macro: string;
	activation?: {
		effects: unknown[];
	};
}

/**
 * Override and extend the basic Item implementation.
 * @extends {Item}
 */
class NimbleBaseItem extends Item {
	declare parent: NimbleBaseActorInterface | null;

	// @ts-expect-error - Override system type for NimbleBaseItem
	declare system: NimbleItemSystemData;

	prepareActorData?(): void;

	async prepareChatCardData(
		_options: ItemActivationManager.ActivationOptions,
	): Promise<Record<string, unknown>> {
		return {};
	}

	declare initialized: boolean;

	declare rules: RulesManagerInterface;

	tags: Set<string> = new Set();

	#subscribe: any;

	constructor(data, context) {
		super(data, context);

		this.#subscribe = createSubscriber((update) => {
			const updateItemHook = Hooks.on('updateItem', (triggeringDocument, _, { diff }) => {
				if (diff === false) return;

				if (triggeringDocument._id === this.id) update();
			});

			return () => {
				Hooks.off('updateItem', updateItemHook);
			};
		});
	}

	/** ------------------------------------------------------ */
	/**                    Type Helpers                        */
	/** ------------------------------------------------------ */
	isType<TypeName extends SystemItemTypes>(
		type: TypeName,
	): this is NimbleBaseItem & { type: TypeName } {
		return type === (this.type as SystemItemTypes);
	}

	/** ------------------------------------------------------ */
	/**                       Getters                          */
	/** ------------------------------------------------------ */
	get identifier(): string {
		return this.system.identifier || this.name.slugify({ strict: true });
	}

	get hasMacro(): boolean {
		const macro = this.system.macro ?? '';
		return macro.trim().length > 0;
	}

	get reactive() {
		this.#subscribe();

		return this;
	}

	get sourceId(): string {
		// @ts-expect-error
		return this._stats.compendiumSource || this.flags?.core?.source || undefined;
	}

	/** ------------------------------------------------------ */
	/**                      Data Prep                         */
	/** ------------------------------------------------------ */
	protected override _initialize(options?: Record<string, unknown>) {
		this.initialized = false;
		// @ts-expect-error
		this.rules = new Map();

		super._initialize(options);
	}

	override prepareData() {
		if (this.initialized) return;
		if (!this.parent || this.parent.initialized) {
			this.initialized = true;
			super.prepareData();
		}
	}

	override prepareBaseData(): void {
		super.prepareBaseData();

		this.system.identifier = this.name.slugify({ strict: true });

		// Resets
		this.tags = new Set();

		// Add basic tags
		this._populateBaseTags();

		// Setup rules TODO: Possibly move this further up in the data prep stage.
		this.rules = new RulesManager(this);
	}

	_populateBaseTags(): void {
		this.tags.add(`identifier:${this.identifier}`);
		this.tags.add(`type:${this.type}`);
	}

	override prepareDerivedData(): void {
		this._populateDerivedTags();
	}

	_populateDerivedTags(): void {}

	/** ------------------------------------------------------ */
	/**                  Data Functions                        */
	/** ------------------------------------------------------ */
	getDomain(): Set<string> {
		const domain = this.tags;
		return domain;
	}

	/** ------------------------------------------------------ */
	/**                      Item Activation                   */
	/** ------------------------------------------------------ */
	async activate(
		options: ItemActivationManager.ActivationOptions = {},
	): Promise<ChatMessage | null> {
		if (options?.executeMacro) return this.#executeMacro();

		const manager = new ItemActivationManager(this, options);
		const { activation, rolls } = await manager.getData();
		if (activation === null || rolls === null) {
			return null;
		}
		const { isCritical, isMiss } = rolls.find((roll) => roll instanceof DamageRoll) ?? {};

		const chatData = foundry.utils.mergeObject(
			{
				author: game.user?.id,
				flavor: `${this.actor?.name}: ${this.name}`,
				speaker: ChatMessage.getSpeaker({ actor: this.actor }),
				style: CONST.CHAT_MESSAGE_STYLES.OTHER,
				sound: CONFIG.sounds.dice,
				rolls,
				rollMode: options.visibilityMode ?? game.settings.get('core', 'rollMode'),
				system: {
					actorName: this.actor?.name ?? '',
					actorType: this.actor?.type ?? '',
					activation,
					image: this.img || 'icons/svg/item-bag.svg',
					isCritical,
					isMiss,
					permissions: this.permission,
					rollMode: options.rollMode ?? 0,
					targets: Array.from(game.user?.targets.map((token) => token.document.uuid) ?? []),
				},
				type: 'base' as const,
			},
			await this.prepareChatCardData(options),
		);

		ChatMessage.applyRollMode(
			chatData as unknown as ChatMessage.CreateData,
			(options.visibilityMode ??
				game.settings.get('core', 'rollMode')) as ChatMessage.PassableRollMode,
		);

		const chatCard = await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);
		return chatCard ?? null;
	}

	async #executeMacro(): Promise<null> {
		if (!this.hasMacro) {
			ui.notifications?.error(`There is no macro configured for ${this.name}.`);
			return null;
		}

		try {
			const { macro } = this.system;

			const AsyncFunction = async function _() {}.constructor;
			AsyncFunction('actor', 'item', macro)(this.actor, this);
		} catch (error) {
			ui.notifications?.error(
				`Could not execute the macro for ${this.name}. See the browser console for more details.`,
			);

			console.error(error);
		}

		return null;
	}

	/** ------------------------------------------------------ */
	/**                         Etc                            */
	/** ------------------------------------------------------ */

	/** ------------------------------------------------------ */
	/**                    Document CRUD                       */
	/** ------------------------------------------------------ */
	static override async createDocuments(
		data: Array<Record<string, unknown>>,
		operation?: InexactPartial<Item.Database.Create> & {
			temporary?: boolean | undefined;
		},
	): Promise<Item[] | undefined> {
		const itemSources = data.map((d) => (d instanceof NimbleBaseItem ? d.toObject() : d));

		// TODO: Migrate older versions here

		const actor = operation?.parent;
		if (!actor) return Item.createDocuments(data as Item.CreateData[], operation);

		const items = itemSources.map((s) => {
			if (!(operation?.keepId || operation?.keepEmbeddedIds))
				(s as Record<string, unknown>)._id = foundry.utils.randomID();

			// eslint-disable-next-line new-cap
			return new CONFIG.Item.documentClass(s as Item.CreateData, {
				parent: actor,
			}) as unknown as NimbleBaseItem;
		});

		const outputSources = items.map((i) => i._source);

		// Process rules
		for await (const item of [...items]) {
			item?.prepareActorData?.();
			const itemSource = item._source;
			const rules = [...item.rules.values()];

			for await (const rule of rules) {
				// eslint-disable-next-line no-await-in-loop
				await rule.preCreate?.({
					itemSource,
					pendingItems: outputSources,
					tempItems: itemSources,
					operation,
				});
			}
		}

		return Item.createDocuments(outputSources as Item.CreateData[], operation);
	}

	override toObject(source = true) {
		const data = super.toObject(source);

		if (source) return data;

		return foundry.utils.mergeObject(data, {
			identifier: this.identifier,
			rules: Array.from(this.rules).reduce(
				(rules, [id, rule]) => {
					rules[id] = rule.toObject();
					rules[id].tooltipInfo = rule.tooltipInfo?.() ?? {};
					return rules;
				},
				{} as Record<string, Record<string, unknown>>,
			),
		});
	}
}

export { NimbleBaseItem };
