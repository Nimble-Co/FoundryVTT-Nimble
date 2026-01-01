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
		const startingEquipmentChoice = results?.startingEquipmentChoice ?? 'equipment';

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

		if (backgroundDocument && background?.uuid) {
			const source = backgroundDocument.toObject();
			source._stats.compendiumSource = background.uuid;
			originDocumentSources.push(source as object as Item.CreateData);
		}

		if (classDocument && characterClass?.uuid) {
			const source = classDocument.toObject();
			source._stats.compendiumSource = characterClass.uuid;
			originDocumentSources.push(source as object as Item.CreateData);
		}

		if (ancestryDocument && ancestry?.uuid) {
			const source = ancestryDocument.toObject();
			source._stats.compendiumSource = ancestry.uuid;
			originDocumentSources.push(source as object as Item.CreateData);
		}

		await actor?.createEmbeddedDocuments('Item', originDocumentSources);

		// Handle starting equipment choice
		if (startingEquipmentChoice === 'equipment') {
			// Collect grantItem rules from class, background, and ancestry to get starting equipment
			const equipmentSources: Item.CreateData[] = [];
			const originDocuments = [classDocument, backgroundDocument, ancestryDocument].filter(
				Boolean,
			) as Array<NimbleClassItem | NimbleBackgroundItem | NimbleAncestryItem>;

			for (const originDoc of originDocuments) {
				const systemWithRules = originDoc.system as {
					rules?: Array<{ type: string; disabled: boolean; uuid?: string; label?: string }>;
				};

				if (!systemWithRules.rules) continue;

				for (const rule of systemWithRules.rules) {
					if (rule.type === 'grantItem' && !rule.disabled && rule.uuid) {
						try {
							// Parse the compendium UUID to get pack and document ID
							// Format: Compendium.system.packName.DocumentType.documentId
							const uuidParts = rule.uuid.split('.');

							if (uuidParts[0] === 'Compendium' && uuidParts.length >= 5) {
								const packKey = `${uuidParts[1]}.${uuidParts[2]}`;
								const documentId = uuidParts[4];

								const pack = game.packs.get(packKey);

								if (pack) {
									await pack.getIndex();

									// First try to get by ID
									let equipmentItem = await pack.getDocument(documentId);

									// If not found by ID, the compendium IDs might have been regenerated
									// Try to find by name from the rule label (e.g., "Starting Gear - Battle Axe" -> "Battleaxe")
									if (!equipmentItem && rule.label) {
										// Extract item name from label (e.g., "Starting Gear - Battle Axe" -> "Battle Axe")
										const labelParts = rule.label.split(' - ');
										const itemName = labelParts.length > 1 ? labelParts[1] : rule.label;

										// Search the index for a matching name
										for (const [id, entry] of pack.index.entries()) {
											const entryName = (entry as { name?: string }).name?.toLowerCase() ?? '';
											const searchName = itemName.toLowerCase().replace(/\s+/g, '');
											const entryNameNormalized = entryName.replace(/\s+/g, '');

											if (
												entryNameNormalized === searchName ||
												entryName.includes(searchName) ||
												searchName.includes(entryNameNormalized)
											) {
												equipmentItem = await pack.getDocument(id);
												break;
											}
										}
									}

									if (equipmentItem && equipmentItem instanceof Item) {
										const equipmentSource = equipmentItem.toObject();
										equipmentSource._stats.compendiumSource = rule.uuid;
										equipmentSources.push(equipmentSource as object as Item.CreateData);
									} else {
										console.warn(
											`[CharacterCreation] Equipment item not found for rule: ${rule.label}`,
										);
									}
								} else {
									console.warn(`[CharacterCreation] Pack not found: ${packKey}`);
								}
							} else {
								// Try direct fromUuid for non-compendium items
								const equipmentItem = await fromUuid(rule.uuid as `Item.${string}`);

								if (equipmentItem && equipmentItem instanceof Item) {
									const equipmentSource = equipmentItem.toObject();
									equipmentSource._stats.compendiumSource = rule.uuid;
									equipmentSources.push(equipmentSource as object as Item.CreateData);
								}
							}
						} catch (e) {
							console.warn(
								`[CharacterCreation] Failed to fetch starting equipment item: ${rule.uuid}`,
								e,
							);
						}
					}
				}
			}

			if (equipmentSources.length > 0) {
				await actor?.createEmbeddedDocuments('Item', equipmentSources);
			}
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
