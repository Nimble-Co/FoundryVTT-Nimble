import { untrack } from 'svelte';
import type { NimbleCharacter } from '#documents/actor/character.js';
import {
	SvelteApplicationMixin,
	type SvelteApplicationRenderContext,
} from '#lib/SvelteApplicationMixin.svelte.js';
import {
	getInitiativeCombatManaRules,
	primeActorCombatManaSourceRules,
} from '#utils/actor/combatManaRules.js';
import type { MissingLevelSelection } from '#utils/classProgression/findMissingLevelSelections.ts';
import {
	createSheetUiState,
	type RevealRequest,
	revealIn,
	type SheetUiState,
} from '../shared/sheetUiState.ts';
import HeroSheetComponent from './HeroSheet.svelte';
import { createHeroSource } from './heroAdapter.ts';
import type { HeroPerform } from './heroIntent.ts';
import { createHeroPerform } from './heroPerform.ts';
import type { HeroSource } from './heroSource.ts';

/** What the level choice audit depends on: the class, its level, and the feature sources. */
function levelAuditKey(actor: NimbleCharacter): string {
	const items = [...actor.reactive.items] as unknown as {
		type: string;
		identifier?: string;
		system: { classLevel?: number };
		_stats?: { compendiumSource?: string | null };
	}[];
	const characterClass = items.find((item) => item.type === 'class');
	if (!characterClass) return '';
	const sources = items
		.filter((item) => item.type === 'feature')
		.map((item) => item._stats?.compendiumSource ?? '')
		.sort()
		.join(',');
	return `${characterClass.identifier}:${characterClass.system.classLevel}:${sources}`;
}

/** The new character sheet. Not registered yet: Storybook and the tests show it. */
export default class HeroSheet extends SvelteApplicationMixin(
	foundry.applications.sheets.ActorSheetV2,
) {
	protected root;

	#actor: NimbleCharacter;

	#ui: SheetUiState = $state(createSheetUiState('core'));

	#missingLevelSelections: number[] = $state([]);

	#combatManaPrimed = $state(0);

	#enrichedNotes = $state('');

	#stopEffects: (() => void) | null = null;

	#props: { source: () => HeroSource; ui: SheetUiState; perform: HeroPerform } | null = null;

	constructor(
		actor: { document: NimbleCharacter },
		options = {} as SvelteApplicationRenderContext,
	) {
		super(
			foundry.utils.mergeObject(options, {
				document: actor.document,
			}) as object as ConstructorParameters<typeof foundry.applications.sheets.ActorSheetV2>[0],
		);
		this.root = HeroSheetComponent;
		const resolved = actor.document.isToken
			? ((actor.document.parent as TokenDocument | undefined)?.actor as NimbleCharacter | undefined)
			: actor.document;
		this.#actor = resolved ?? actor.document;
	}

	static override DEFAULT_OPTIONS = {
		classes: ['nimble-actor-sheet', 'nimble-actor-sheet--hero'],
		window: {
			icon: 'fa-solid fa-user',
			resizable: true,
		},
		position: { width: 720, height: 850 },
	};

	override get actor(): Actor {
		return this.#actor as unknown as Actor;
	}

	/** The only entry for outside code: go to a tab, open a choice step, flash a row. */
	reveal(request: RevealRequest): void {
		revealIn(this.#ui, request);
		if (!this.rendered) void this.render({ force: true });
		else this.bringToFront();
	}

	protected override async _prepareContext(
		options: Parameters<foundry.applications.sheets.ActorSheetV2['_prepareContext']>[0],
	): ReturnType<foundry.applications.sheets.ActorSheetV2['_prepareContext']> {
		const context = await super._prepareContext(options);
		const actor = this.#actor;
		this.#props ??= {
			source: createHeroSource(actor, {
				missingLevelSelections: () => this.#missingLevelSelections,
				enrichedNotes: () => this.#enrichedNotes,
				manaFromInitiative: () => {
					// read only to recompute when the combat mana rules are primed
					void this.#combatManaPrimed;
					return getInitiativeCombatManaRules(actor as unknown as Actor).length > 0;
				},
			}),
			ui: this.#ui,
			perform: createHeroPerform(actor),
		};
		return { ...context, ...this.#props } as object as Awaited<
			ReturnType<foundry.applications.sheets.ActorSheetV2['_prepareContext']>
		>;
	}

	protected override async _onFirstRender(
		context: Parameters<foundry.applications.sheets.ActorSheetV2['_onFirstRender']>[0],
		options: Parameters<foundry.applications.sheets.ActorSheetV2['_onFirstRender']>[1],
	): Promise<void> {
		await super._onFirstRender(context, options);
		const actor = this.#actor;
		void primeActorCombatManaSourceRules(actor as unknown as Actor).then(() => {
			this.#combatManaPrimed += 1;
		});

		let lastKey: string | null = null;
		this.#stopEffects = $effect.root(() => {
			$effect(() => {
				const key = levelAuditKey(actor);
				if (key === lastKey) return;
				lastKey = key;
				untrack(() => this.#audit(key));
			});
			$effect(() => {
				const notes = String(
					(actor.reactive.system as { details?: { notes?: string } }).details?.notes ?? '',
				);
				untrack(() => this.#enrichNotes(notes));
			});
		});
	}

	protected override _onClose(
		options: Parameters<foundry.applications.sheets.ActorSheetV2['_onClose']>[0],
	): void {
		super._onClose(options);
		this.#stopEffects?.();
		this.#stopEffects = null;
	}

	#enrichNotes(notes: string): void {
		const actor = this.#actor;
		void foundry.applications.ux.TextEditor.implementation
			.enrichHTML(notes, {
				secrets: actor.isOwner,
				rollData: actor.getRollData(),
				relativeTo: actor as unknown as foundry.abstract.Document.Any,
			})
			.then((html: string) => {
				this.#enrichedNotes = html;
			});
	}

	#audit(key: string): void {
		if (!key) {
			this.#missingLevelSelections = [];
			return;
		}
		void this.#actor
			.getMissingLevelSelections()
			.then((gaps: MissingLevelSelection[]) => {
				this.#missingLevelSelections = gaps.map((gap) => gap.level);
			})
			.catch((error: unknown) => {
				console.warn('Nimble | Failed to audit level selections:', error);
			});
	}
}
