import type { DeepPartial } from 'fvtt-types/utils';
import type { NimbleFeatureItem } from '#documents/item/feature.js';
import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';
import getChoicesFromCompendium from '../../utils/getChoicesFromCompendium.js';
import { buildClassFeatureIndex, type ClassFeatureIndex } from '../../utils/getClassFeatures.js';
import { buildSpellIndex, getSpellsFromIndex, type SpellIndex } from '../../utils/getSpells.js';
import sortDocumentsByName from '../../utils/sortDocumentsByName.js';
import CharacterCreationDialogComponent from '../../view/dialogs/CharacterCreationDialog.svelte';

const { ApplicationV2 } = foundry.applications.api;

export default class CharacterCreationDialog extends SvelteApplicationMixin(ApplicationV2) {
	data: Record<string, any>;
	parent: any;
	pack: any;
	classFeatureIndex: Promise<ClassFeatureIndex> | null = null;
	spellIndex: Promise<SpellIndex> | null = null;

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
			// Foundry ignores small top values in practice; 0 is equivalent to the previous value of 5
			top: 0,
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
		const classFeatureIndex = (this.classFeatureIndex ??= buildClassFeatureIndex());
		const spellIndex = (this.spellIndex ??= buildSpellIndex());

		return {
			ancestryOptions,
			backgroundOptions,
			bonusLanguageOptions,
			classOptions,
			classFeatureIndex,
			spellIndex,
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
		selectedAncestrySave?: string | null;
		selectedRaisedByAncestry?: { language: string; label: string } | null;
		abilityScores?: Record<string, number>;
		skills?: Record<string, number>;
		languages?: string[];
		startingEquipmentChoice?: 'equipment' | 'gold';
		origins?: {
			background?: { uuid?: string };
			characterClass?: { uuid?: string };
			ancestry?: { uuid?: string };
		};
		classFeatures?: {
			autoGrant: string[];
			selected: Map<string, NimbleFeatureItem>;
		};
		spells?: {
			autoGrant: string[];
			selectedSchools: Map<string, string[]>;
			selectedSpells: Map<string, string[]>;
			selectionOptions?: Map<
				string,
				{ includeUtility: boolean; forClass: string; tiers: number[] }
			>;
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
			options: { isAncestry?: boolean; isBackground?: boolean } = {},
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

			// If this is an ancestry with a save choice, set the selectedSave on the rule
			if (options.isAncestry && results.selectedAncestrySave) {
				const systemWithRules = source.system as {
					rules?: Array<{
						type: string;
						requiresChoice?: boolean;
						target?: string;
						selectedSave?: string;
					}>;
				};
				if (systemWithRules.rules) {
					for (const rule of systemWithRules.rules) {
						if (
							rule.type === 'savingThrowRollMode' &&
							rule.requiresChoice === true &&
							rule.target === 'neutral'
						) {
							rule.selectedSave = results.selectedAncestrySave;
						}
					}
				}
			}

			// If this is a background with a "raised by" ancestry choice, update the name, description, and rule
			if (options.isBackground && results.selectedRaisedByAncestry) {
				const { language, label } = results.selectedRaisedByAncestry;

				// Simple pluralization for common ancestries
				const pluralize = (name: string): string => {
					const irregulars: Record<string, string> = {
						dwarf: 'Dwarves',
						elf: 'Elves',
						dragonborn: 'Dragonborn',
					};
					const lower = name.toLowerCase();
					if (irregulars[lower]) return irregulars[lower];
					// Default: capitalize and add 's'
					return `${name}s`;
				};

				const pluralLabel = pluralize(label);

				// Update the background name (e.g., "Raised by Goblins" → "Raised by Dwarves")
				if (source.name?.includes('Goblins')) {
					source.name = source.name.replace('Goblins', pluralLabel);
				}

				// Update the description - replace references to Goblin/Goblins
				const sourceWithSystem = source as { system?: { description?: string } };
				if (sourceWithSystem.system?.description) {
					sourceWithSystem.system.description = sourceWithSystem.system.description
						.replace(/Goblins/g, pluralLabel)
						.replace(/Goblin/g, label);
				}

				// Update the grantProficiency rule to use the selected language
				const systemWithRules = source.system as {
					rules?: Array<{
						type: string;
						proficiencyType?: string;
						values?: string[];
					}>;
				};
				if (systemWithRules.rules) {
					for (const rule of systemWithRules.rules) {
						if (rule.type === 'grantProficiency' && rule.proficiencyType === 'languages') {
							rule.values = [language];
						}
					}
				}
			}

			originDocumentSources.push(source as object as Item.CreateData);
		};

		processOriginSource(backgroundDocument, background?.uuid, { isBackground: true });
		processOriginSource(classDocument, characterClass?.uuid);
		processOriginSource(ancestryDocument, ancestry?.uuid, { isAncestry: true });

		// When origin documents are added, the system automatically processes grantItem rules
		// If equipment was chosen, items will be granted automatically
		// If gold was chosen, grantItem rules were disabled above so no items are granted
		await actor?.createEmbeddedDocuments('Item', originDocumentSources);

		// Create class feature documents
		const featureDocumentSources: Item.CreateData[] = [];

		// Add auto-granted features
		for (const uuid of results.classFeatures?.autoGrant ?? []) {
			const feature = await fromUuid(uuid as `Item.${string}`);
			if (feature) {
				const source = (feature as NimbleFeatureItem).toObject();
				source._stats.compendiumSource = uuid;
				featureDocumentSources.push(source as object as Item.CreateData);
			}
		}

		// Add selected features
		for (const [_group, feature] of results.classFeatures?.selected ?? []) {
			const source = feature.toObject();
			source._stats.compendiumSource = feature.uuid;
			featureDocumentSources.push(source as object as Item.CreateData);
		}

		// Create all features
		if (featureDocumentSources.length > 0) {
			await actor?.createEmbeddedDocuments('Item', featureDocumentSources);
		}

		// Create spell documents
		const spellDocumentSources: Item.CreateData[] = [];
		const spellIndex = this.spellIndex ? await this.spellIndex : null;
		// Track seen UUIDs to prevent duplicate spells
		const seenSpellUuids = new Set<string>();

		// Add auto-granted spells
		for (const uuid of results.spells?.autoGrant ?? []) {
			if (seenSpellUuids.has(uuid)) continue;
			seenSpellUuids.add(uuid);

			const spell = await fromUuid(uuid as `Item.${string}`);
			if (spell) {
				const source = (spell as Item).toObject();
				source._stats.compendiumSource = uuid;
				spellDocumentSources.push(source as object as Item.CreateData);
			}
		}

		// Add spells from school selections
		if (spellIndex && results.spells?.selectedSchools) {
			const selectionOptions = results.spells.selectionOptions ?? new Map();

			for (const [ruleId, schools] of results.spells.selectedSchools) {
				// Get filtering options for this rule, with sensible defaults
				const options = selectionOptions.get(ruleId) ?? {
					includeUtility: false,
					forClass: classDocument?.system?.identifier ?? '',
					tiers: [0],
				};

				const spells = getSpellsFromIndex(spellIndex, schools, options.tiers, {
					includeUtility: options.includeUtility,
					forClass: options.forClass,
				});

				for (const spellEntry of spells) {
					if (seenSpellUuids.has(spellEntry.uuid)) continue;
					seenSpellUuids.add(spellEntry.uuid);

					const spell = await fromUuid(spellEntry.uuid as `Item.${string}`);
					if (spell) {
						const source = (spell as Item).toObject();
						source._stats.compendiumSource = spellEntry.uuid;
						spellDocumentSources.push(source as object as Item.CreateData);
					}
				}
			}
		}

		// Add directly selected spells (from selectSpell mode)
		if (results.spells?.selectedSpells) {
			for (const [_ruleId, spellUuids] of results.spells.selectedSpells) {
				for (const uuid of spellUuids) {
					if (seenSpellUuids.has(uuid)) continue;
					seenSpellUuids.add(uuid);

					const spell = await fromUuid(uuid as `Item.${string}`);
					if (spell) {
						const source = (spell as Item).toObject();
						source._stats.compendiumSource = uuid;
						spellDocumentSources.push(source as object as Item.CreateData);
					}
				}
			}
		}

		// Create all spells
		if (spellDocumentSources.length > 0) {
			await actor?.createEmbeddedDocuments('Item', spellDocumentSources);
		}

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

		// If ancestry grants a save choice, apply the selected save's roll mode boost
		if (results.selectedAncestrySave) {
			const savingThrowsData = (updateData.system as Record<string, unknown>)
				.savingThrows as Record<string, number>;
			savingThrowsData[`${results.selectedAncestrySave}.defaultRollMode`] = 1;
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
