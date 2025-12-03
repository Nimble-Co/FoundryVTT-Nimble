import type { DeepPartial } from 'fvtt-types/utils';
import { SvelteApplicationMixin } from '#lib/SvelteApplicationMixin.svelte.js';
import getChoicesFromCompendium from '../../utils/getChoicesFromCompendium.js';
import sortDocumentsByName from '../../utils/sortDocumentsByName.js';
import CharacterCreationDialogComponent from '../../view/dialogs/CharacterCreationDialog.svelte';

const { ApplicationV2 } = foundry.applications.api;

/** Render context for character creation dialog */
interface CharacterCreationRenderContext
	extends foundry.applications.api.ApplicationV2.RenderContext {
	ancestryOptions: Promise<Record<'core' | 'exotic', NimbleAncestryItem[]>>;
	backgroundOptions: Promise<NimbleBackgroundItem[]>;
	bonusLanguageOptions: { value: string; label: string; tooltip: string }[];
	classOptions: Promise<NimbleClassItem[]>;
	statArrayOptions: { key: string; array: number[]; name: string }[];
	dialog: CharacterCreationDialog;
}

// Interface for submission results
interface CharacterCreationResults {
	name?: string;
	origins?: {
		background?: { uuid: string };
		characterClass?: { uuid: string };
		ancestry?: { uuid: string };
	};
	sizeCategory?: string;
	abilityScores?: Record<string, number>;
	skills?: Record<string, unknown>;
	languages?: string[];
}

// Interface for origin items that can be used with createEmbeddedDocuments
interface OriginItemSource {
	_stats: { compendiumSource?: string };
	toObject(): Item.Source;
}

export default class CharacterCreationDialog extends SvelteApplicationMixin(ApplicationV2) {
	data: Record<string, unknown>;
	parent: Actor | null;
	pack: string | null;

	protected root: typeof CharacterCreationDialogComponent;

	constructor(
		data: Record<string, unknown> = {},
		{ parent = null, pack = null }: { parent?: Actor | null; pack?: string | null } = {},
	) {
		super();

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
		_options: DeepPartial<foundry.applications.api.ApplicationV2.RenderOptions> & {
			isFirstRender: boolean;
		},
	): Promise<CharacterCreationRenderContext> {
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
		};
	}

	async submitCharacter(results: CharacterCreationResults): Promise<this> {
		const actor = await Actor.create(
			{ name: results.name || 'New Character', type: 'character' },
			{ renderSheet: true },
		);

		const { background, characterClass, ancestry } = results?.origins ?? {};
		const originSources: Item.Source[] = [];

		const backgroundDocument = background?.uuid
			? ((await fromUuid(background.uuid as `Item.${string}`)) as OriginItemSource | null)
			: null;
		const classDocument = characterClass?.uuid
			? ((await fromUuid(characterClass.uuid as `Item.${string}`)) as
					| (OriginItemSource & NimbleClassItem)
					| null)
			: null;
		const ancestryDocument = ancestry?.uuid
			? ((await fromUuid(ancestry.uuid as `Item.${string}`)) as OriginItemSource | null)
			: null;

		if (backgroundDocument && background?.uuid) {
			const source = backgroundDocument.toObject();
			source._stats.compendiumSource = background.uuid;
			originSources.push(source);
		}

		if (classDocument && characterClass?.uuid) {
			const source = classDocument.toObject();
			source._stats.compendiumSource = characterClass.uuid;
			originSources.push(source);
		}

		if (ancestryDocument && ancestry?.uuid) {
			const source = ancestryDocument.toObject();
			source._stats.compendiumSource = ancestry.uuid;
			originSources.push(source);
		}

		await actor?.createEmbeddedDocuments('Item', originSources as Item.CreateData[]);

		await actor?.update({
			'system.attributes.sizeCategory': results.sizeCategory,
			'system.abilities': results.abilityScores ?? {},
			'system.skills': results.skills ?? {},
			'system.savingThrows': {
				[`${classDocument?.system.savingThrows.advantage}.defaultRollMode`]: 1,
				[`${classDocument?.system.savingThrows.disadvantage}.defaultRollMode`]: -1,
			},
			'system.proficiencies.languages': results.languages,
		} as Record<string, unknown>);

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
			getChoicesFromCompendium('ancestry').map(
				(uuid) => fromUuid(uuid as `Item.${string}`) as Promise<NimbleAncestryItem | null>,
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
