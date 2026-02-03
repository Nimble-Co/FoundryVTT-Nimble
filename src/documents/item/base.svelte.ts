import { createSubscriber } from 'svelte/reactivity';
import { DamageRoll } from '../../dice/DamageRoll.js';
import { ItemActivationManager } from '../../managers/ItemActivationManager.js';
import { RulesManager } from '../../managers/RulesManager.js';

export type { SystemItemTypes } from './itemInterfaces.js';

import type { SystemItemTypes } from './itemInterfaces.js';

// Forward declaration to avoid circular dependency
interface NimbleBaseActor extends Actor {
	initialized?: boolean;
	getDomain(): Set<string>;
	getRollData(item?: unknown): Record<string, unknown>;
}

/** Base system data that all item types share */
interface BaseItemSystemData {
	identifier?: string;
	macro?: string;
}

/**
 * Override and extend the basic Item implementation.
 * @extends {Item}
 */
class NimbleBaseItem<ItemType extends SystemItemTypes = SystemItemTypes> extends Item {
	declare type: ItemType;

	declare parent: NimbleBaseActor | null;

	declare initialized: boolean;

	declare rules: RulesManager;

	/** Reference to the item that granted this item, if any */
	grantedBy: NimbleBaseItem | null = null;

	tags: Set<string> = new Set();

	#subscribe: ReturnType<typeof createSubscriber>;

	constructor(data: Item.CreateData, context?: Item.ConstructionContext) {
		super(data, context);

		this.#subscribe = createSubscriber((update) => {
			const updateItemHook = Hooks.on('updateItem', (triggeringDocument, _change, options) => {
				if ((options as { diff?: boolean }).diff === false) return;

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
	isType<TypeName extends SystemItemTypes>(type: TypeName): this is NimbleBaseItem<TypeName> {
		return type === (this.type as SystemItemTypes);
	}

	/** ------------------------------------------------------ */
	/**                       Getters                          */
	/** ------------------------------------------------------ */
	get identifier(): string {
		const systemData = this.system as unknown as BaseItemSystemData;
		return systemData.identifier || this.name.slugify({ strict: true });
	}

	get hasMacro(): boolean {
		const systemData = this.system as unknown as BaseItemSystemData;
		const macro = systemData.macro ?? '';
		return macro.trim().length > 0;
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

	/** Get the document reference (self-reference for ambient interface compatibility) */
	get document(): Item {
		return this as object as Item;
	}

	/** ------------------------------------------------------ */
	/**                      Data Prep                         */
	/** ------------------------------------------------------ */
	protected override _initialize(options?: Record<string, unknown>) {
		this.initialized = false;

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

		const systemData = this.system as unknown as BaseItemSystemData;
		systemData.identifier = this.name.slugify({ strict: true });

		// Resets
		this.tags = new Set();

		// Add basic tags
		this._populateBaseTags();

		// Setup rules TODO: Possibly move this further up in the data prep stage.
		// Cast for RulesManager compatibility (uses ambient NimbleBaseItem type)
		this.rules = new RulesManager(this as unknown as ConstructorParameters<typeof RulesManager>[0]);
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

		const manager = new ItemActivationManager(
			this as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
			options,
		);
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
					targets: Array.from(game.user?.targets?.map((token) => token.document.uuid) ?? []),
				},
				type: 'base',
			},
			await this.prepareChatCardData(options),
		);

		const rollModeValue = options.visibilityMode ?? game.settings.get('core', 'rollMode');
		ChatMessage.applyRollMode(
			chatData as Record<string, unknown>,
			rollModeValue as foundry.CONST.DICE_ROLL_MODES,
		);

		const chatCard = await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);
		return chatCard ?? null;
	}

	/** Override in subclasses to add custom chat card data */
	async prepareChatCardData(
		_options: ItemActivationManager.ActivationOptions,
	): Promise<Record<string, unknown>> {
		return {};
	}

	async #executeMacro(): Promise<null> {
		if (!this.hasMacro) {
			ui.notifications?.error(`There is no macro configured for ${this.name}.`);
			return null;
		}

		try {
			const systemData = this.system as unknown as BaseItemSystemData;
			const macro = systemData.macro ?? '';

			// eslint-disable-next-line @typescript-eslint/no-implied-eval
			const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
				...args: string[]
			) => (...args: unknown[]) => Promise<void>;
			new AsyncFunction('actor', 'item', macro)(this.actor, this);
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
	/**                  Lifecycle Hooks                       */
	/** ------------------------------------------------------ */
	protected override async _preUpdate(
		changed: Record<string, unknown>,
		options: Item.Database.UpdateOptions,
		user: User.Implementation,
	): Promise<boolean | undefined> {
		// Call preUpdate on all rules
		if (this.rules) {
			for (const rule of this.rules.values()) {
				const ruleWithPreUpdate = rule as object as {
					preUpdate?: (changes: Record<string, unknown>) => Promise<void>;
				};
				await ruleWithPreUpdate.preUpdate?.(changed);
			}
		}

		return (await super._preUpdate(changed, options, user)) ?? undefined;
	}

	override _onDelete(options, userId: string): void {
		// Call afterDelete on all rules
		if (this.rules) {
			for (const rule of this.rules.values()) {
				const ruleWithAfterDelete = rule as object as {
					afterDelete?: () => Promise<void>;
				};
				// Fire and forget - afterDelete runs asynchronously after delete completes
				ruleWithAfterDelete.afterDelete?.();
			}
		}

		super._onDelete(options, userId);
	}

	/** ------------------------------------------------------ */
	/**                    Document CRUD                       */
	/** ------------------------------------------------------ */
	static override async createDocuments<Temporary extends boolean | undefined = undefined>(
		data: Array<Item | Item.CreateData> | undefined,
		operation?: Item.Database.CreateDocumentsOperation<Temporary>,
	): Promise<Item.Stored[]> {
		if (!data) return [] as Item.Stored[];
		const itemSources = data.map((d) => (d instanceof NimbleBaseItem ? d.toObject() : d)) as Array<
			Item.CreateData & Record<string, unknown>
		>;

		// TODO: Migrate older versions here

		const actor = operation?.parent;
		if (!actor) return Item.createDocuments(data, operation) as Promise<Item.Stored[]>;

		const items = itemSources.map((s) => {
			const source = s as Record<string, unknown>;
			if (!(operation?.keepId || operation?.keepEmbeddedIds)) source._id = foundry.utils.randomID();

			return new CONFIG.Item.documentClass(s as Item.CreateData, {
				parent: actor,
			}) as NimbleBaseItem;
		});

		const outputSources = items.map((i) => i._source);

		// Process rules
		for await (const item of [...items]) {
			(item as { prepareActorData?(): void })?.prepareActorData?.();
			const itemSource = item._source;
			const rules = [...item.rules.values()];

			for await (const rule of rules) {
				const ruleWithPreCreate = rule as object as {
					preCreate?: (args: Record<string, unknown>) => Promise<void>;
				};
				await ruleWithPreCreate.preCreate?.({
					itemSource,
					pendingItems: outputSources,
					tempItems: itemSources,
					operation,
				});
			}
		}

		return Item.createDocuments(
			outputSources as unknown as Item.CreateData[],
			operation,
		) as Promise<Item.Stored[]>;
	}

	override toObject(source = true) {
		const data = super.toObject(source);

		if (source) return data;

		return foundry.utils.mergeObject(data, {
			identifier: this.identifier,
			rules: Array.from(this.rules).reduce(
				(rules, [id, rule]) => {
					rules[id] = rule.toObject?.() ?? {};
					rules[id].tooltipInfo = rule.tooltipInfo?.() ?? '';
					return rules;
				},
				{} as Record<string, Record<string, unknown>>,
			),
		});
	}
}

export { NimbleBaseItem };
