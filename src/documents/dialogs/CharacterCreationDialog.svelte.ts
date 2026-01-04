import type { DeepPartial } from 'fvtt-types/utils';
import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';
import getChoicesFromCompendium from '../../utils/getChoicesFromCompendium.js';
import sortDocumentsByName from '../../utils/sortDocumentsByName.js';
import CharacterCreationDialogComponent from '../../view/dialogs/CharacterCreationDialog.svelte';

const { ApplicationV2 } = foundry.applications.api;

export default class CharacterCreationDialog extends SvelteApplicationMixin(ApplicationV2) {
	data: Record<string, any>;
	parent: any;
	pack: any;

	protected root;

	constructor(data = {}, { parent = null, pack = null, ...options } = {}) {
		const width = 608;
		super(
			foundry.utils.mergeObject(options, {
				position: {
					width,
					top: Math.round(window.innerHeight * 0.1),
					left: Math.round((window.innerWidth - width) / 2),
				},
			}),
		);

		this.root = CharacterCreationDialogComponent;

		this.data = data;
		this.parent = parent;
		this.pack = pack;
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-sheet'],
		window: {
			icon: 'fa-solid fa-user',
			title: 'Character Creation Helper',
			resizable: true,
		},
		position: {
			height: 'auto' as const,
			top: 5,
			width: 608,
		},
		actions: {},
	};

	protected override async _prepareContext(
		_options: Parameters<foundry.applications.api.ApplicationV2['_prepareContext']>[0],
	): ReturnType<foundry.applications.api.ApplicationV2['_prepareContext']> {
		const ancestryOptions = this.prepareAncestryOptions();
		const backgroundOptions = this.prepareBackgroundOptions();
		const bonusLanguageOptions = this.prepareBonusLanguageOptions();
		const classOptions = this.prepareClassOptions();
		const statArrayOptions = this.prepareArrayOptions();

		return {
			ancestryOptions,
			backgroundOptions,
			bonusLanguageOptions,
			classOptions,
			statArrayOptions,
			dialog: this,
		} as object as ReturnType<
			foundry.applications.api.ApplicationV2['_prepareContext']
		> extends Promise<infer T>
			? T
			: never;
	}

	async submitCharacterCreation(results: {
		name?: string;
		sizeCategory?: string;
		abilityScores?: Record<string, number>;
		skills?: Record<string, number>;
		languages?: string[];
		startingEquipmentChoice?: 'equipment' | 'gold';
		origins?: {
			background?: { uuid?: string };
			characterClass?: { uuid?: string };
			ancestry?: { uuid?: string };
		};
	}) {
		const actor = await Actor.create(
			{ name: results.name || 'New Character', type: 'character' },
			{ renderSheet: true },
		);

		const { background, characterClass, ancestry } = results?.origins ?? {};
		const startingEquipmentChoice = results?.startingEquipmentChoice;

		const backgroundDocument = background?.uuid
			? ((await fromUuid(background.uuid as `Item.${string}`)) as NimbleBackgroundItem | null)
			: null;
		const classDocument = characterClass?.uuid
			? ((await fromUuid(characterClass.uuid as `Item.${string}`)) as NimbleClassItem | null)
			: null;
		const ancestryDocument = ancestry?.uuid
			? ((await fromUuid(ancestry.uuid as `Item.${string}`)) as NimbleAncestryItem | null)
			: null;

		const originDocumentSources: Item.CreateData[] = [];

		// Helper to process origin document sources
		const processOriginSource = (
			doc: NimbleBackgroundItem | NimbleClassItem | NimbleAncestryItem | null,
			uuid: string | undefined,
		) => {
			if (!doc || !uuid) return;

			const source = doc.toObject();
			source._stats.compendiumSource = uuid;

			// Only grant starting equipment if explicitly chosen during character creation
			// If gold was chosen or choice wasn't made (early exit), disable grantItem rules
			if (startingEquipmentChoice !== 'equipment') {
				const systemWithRules = source.system as {
					rules?: Array<{ type: string; disabled: boolean }>;
				};
				if (systemWithRules.rules) {
					for (const rule of systemWithRules.rules) {
						if (rule.type === 'grantItem') {
							rule.disabled = true;
						}
					}
				}
			}

			originDocumentSources.push(source as object as Item.CreateData);
		};

		processOriginSource(backgroundDocument, background?.uuid);
		processOriginSource(classDocument, characterClass?.uuid);
		processOriginSource(ancestryDocument, ancestry?.uuid);

		// When origin documents are added, the system automatically processes grantItem rules
		// If equipment was chosen, items will be granted automatically
		// If gold was chosen, grantItem rules were disabled above so no items are granted
		await actor?.createEmbeddedDocuments('Item', originDocumentSources);

		const updateData: Record<string, unknown> = {
			system: {
				'attributes.sizeCategory': results.sizeCategory,
				abilities: results.abilityScores ?? {},
				skills: results.skills ?? {},
				savingThrows: {
					[`${classDocument?.system.savingThrows.advantage}.defaultRollMode`]: 1,
					[`${classDocument?.system.savingThrows.disadvantage}.defaultRollMode`]: -1,
				},
				proficiencies: {
					languages: results.languages,
				},
			},
		};

		// If gold was chosen, add 50 gp to the character
		if (startingEquipmentChoice === 'gold') {
			(updateData.system as Record<string, unknown>)['currency.gp.value'] = 50;
		}

		await actor?.update(updateData);

		return super.close();
	}

	override async close(
		options?: DeepPartial<foundry.applications.api.ApplicationV2.ClosingOptions>,
	): Promise<this> {
		return super.close(options);
	}

	async prepareAncestryOptions(): Promise<Record<'core' | 'exotic', NimbleAncestryItem[]>> {
		const coreAncestries: NimbleAncestryItem[] = [];
		const exoticAncestries: NimbleAncestryItem[] = [];

		const ancestryOptions = await Promise.all(
			getChoicesFromCompendium('ancestry').map((uuid) =>
				fromUuid(uuid as `Item.${string}`).then((doc) => doc as NimbleAncestryItem | null),
			),
		);

		for (const ancestry of ancestryOptions) {
			if (!ancestry) continue;
			const ancestryItem = ancestry as NimbleAncestryItem;

			if (ancestryItem.system.exotic) exoticAncestries.push(ancestry);
			else coreAncestries.push(ancestry);
		}

		return {
			core: sortDocumentsByName(
				coreAncestries as ({ name?: string } | null)[],
			) as NimbleAncestryItem[],
			exotic: sortDocumentsByName(
				exoticAncestries as ({ name?: string } | null)[],
			) as NimbleAncestryItem[],
		};
	}

	prepareArrayOptions() {
		const { statArrays, statArrayModifiers } = CONFIG.NIMBLE;

		return Object.entries(statArrayModifiers).reduce((arrays: any[], [key, array]) => {
			arrays.push({
				key,
				array,
				name: statArrays[key] as string,
			});

			return arrays;
		}, []);
	}

	async prepareBackgroundOptions(): Promise<NimbleBackgroundItem[]> {
		const compendiumChoices = getChoicesFromCompendium('background');

		const documents = await Promise.all(
			compendiumChoices.map((uuid) => fromUuid(uuid as `Item.${string}`)),
		);

		return sortDocumentsByName(documents as ({ name?: string } | null)[]) as NimbleBackgroundItem[];
	}

	prepareBonusLanguageOptions() {
		const { languages, languageHints } = CONFIG.NIMBLE;
		const { common: _, ...languageOptions } = languages;

		return Object.entries(languageOptions).map(([value, label]) => ({
			value,
			label,
			tooltip: languageHints[value],
		}));
	}

	async prepareClassOptions(): Promise<NimbleClassItem[]> {
		const compendiumChoices = getChoicesFromCompendium('class');

		const documents = await Promise.all(
			compendiumChoices.map((uuid) => fromUuid(uuid as `Item.${string}`)),
		);

		return sortDocumentsByName(documents as ({ name?: string } | null)[]) as NimbleClassItem[];
	}
}
