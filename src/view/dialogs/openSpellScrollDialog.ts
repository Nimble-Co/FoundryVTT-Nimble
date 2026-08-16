import type { Component } from 'svelte';
import GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import type {
	SpellScrollCandidate,
	SpellScrollDialogResult,
} from '#types/components/SpellScrollDialog.d.ts';
import { SPELL_SCROLL_PRICE_BY_TIER } from '#utils/createScrollFromSpell.js';
import formatActivationCostLabel from '#utils/formatActivationCostLabel.js';
import { buildSpellIndex, type SpellIndexEntry } from '#utils/getSpells.js';
import knowsSpellSchool from '#utils/knowsSpellSchool.js';
import localize from '#utils/localize.js';
import sortDocumentsByName from '#utils/sortDocumentsByName.js';
import enrichSpellText from '#utils/spellDescription.js';
import { getSpellTierLabel } from '#utils/spellLabels.js';
import SpellScrollDialog from '#view/dialogs/SpellScrollDialog.svelte';

const DIALOG_ICON = 'fa-solid fa-scroll';
const DIALOG_WIDTH = 420;

export interface ScrollDialogActor {
	name?: string | null;
	items: Iterable<{ type: string; system?: unknown }>;
	system?: {
		resources?: {
			mana?: { max?: number };
			highestUnlockedSpellTier?: number;
		};
	};
}

interface DroppedSpell {
	name?: string | null;
	system?: {
		school?: string;
		tier?: number;
		activation?: { cost?: { type?: string; quantity?: number; isReaction?: boolean } };
	};
}

interface OpenChooserOptions {
	mode: 'chooser';
	actor: ScrollDialogActor;
	spell: DroppedSpell;
}

interface OpenPickerOptions {
	mode: 'picker';
	actor: ScrollDialogActor;
	/** Tier the dropped scroll template is fixed at. */
	tier: number;
	/** Name of the dropped scroll template, shown in the title. */
	scrollName: string;
}

type OpenSpellScrollDialogOptions = OpenChooserOptions | OpenPickerOptions;

function activationSummary(spell: DroppedSpell): string {
	return formatActivationCostLabel(spell.system?.activation?.cost ?? {}) ?? '';
}

function highestUnlockedSpellTier(actor: ScrollDialogActor): number {
	return actor.system?.resources?.highestUnlockedSpellTier ?? 0;
}

function hasMana(actor: ScrollDialogActor): boolean {
	return (actor.system?.resources?.mana?.max ?? 0) > 0;
}

/**
 * The spells of `tier` that may be inscribed, built from the pack indexes alone.
 *
 * A collapsed row needs the name, image, school and action cost, all of which the
 * index carries. Loading each document instead would mean one compendium fetch
 * per candidate — every cantrip in every installed module, for the cantrip
 * template — so the description is left to `loadCandidateDescription` when a row
 * is actually expanded.
 */
async function buildCandidates(tier: number): Promise<SpellScrollCandidate[]> {
	// A GM may inscribe a secret spell; a player may not even see that one exists.
	const index = await buildSpellIndex({ includeSecretSpells: Boolean(game.user?.isGM) });

	const entries: SpellIndexEntry[] = [];
	for (const tierMap of index.values()) {
		entries.push(...(tierMap.get(tier) ?? []));
	}

	const candidates = entries.map(
		(entry) =>
			({
				...entry,
				activationSummary: formatActivationCostLabel(entry.activationCost ?? {}) ?? '',
			}) satisfies SpellScrollCandidate,
	);

	// The shared sort strips parentheses, so scroll candidates order the same way
	// as every other alphabetical document list in the system.
	return sortDocumentsByName(candidates);
}

/**
 * Enriched description of one candidate, fetched when its row is expanded.
 *
 * Resolving `@UUID` links is the expensive half, and only the open row's text is
 * ever read.
 */
export async function loadCandidateDescription(uuid: string): Promise<string> {
	const spell = (await fromUuid(uuid as Parameters<typeof fromUuid>[0])) as {
		system?: { description?: { baseEffect?: string } };
	} | null;

	return enrichSpellText(spell?.system?.description?.baseEffect ?? '');
}

/**
 * Asks where a dropped spell should go, or which spell a dropped scroll template
 * carries. Resolves null when the player cancels.
 *
 * The question is always asked: the open tab carries no meaning, so nothing here
 * inspects the sheet's active tab.
 */
export default async function openSpellScrollDialog(
	options: OpenSpellScrollDialogOptions,
): Promise<SpellScrollDialogResult | null> {
	const actorName = options.actor.name ?? '';

	const data =
		options.mode === 'chooser'
			? {
					mode: 'chooser' as const,
					actorName,
					tier: options.spell.system?.tier ?? 0,
					school: options.spell.system?.school ?? '',
					tierLabel: getSpellTierLabel(options.spell.system?.tier ?? 0),
					activationSummary: activationSummary(options.spell),
					scrollPrice:
						SPELL_SCROLL_PRICE_BY_TIER[options.spell.system?.tier ?? 0] ??
						SPELL_SCROLL_PRICE_BY_TIER[0],
					highestUnlockedSpellTier: highestUnlockedSpellTier(options.actor),
					hasMana: hasMana(options.actor),
					knowsSchool: knowsSpellSchool(options.actor, options.spell.system?.school ?? ''),
				}
			: {
					mode: 'picker' as const,
					actorName,
					tier: options.tier,
					tierLabel: getSpellTierLabel(options.tier),
					scrollPrice: SPELL_SCROLL_PRICE_BY_TIER[options.tier] ?? SPELL_SCROLL_PRICE_BY_TIER[0],
					candidates: await buildCandidates(options.tier),
					loadDescription: loadCandidateDescription,
				};

	const title =
		options.mode === 'chooser'
			? localize('NIMBLE.spellScroll.dialog.chooserTitle', {
					name: actorName,
					spell: options.spell.name ?? '',
				})
			: localize('NIMBLE.spellScroll.dialog.pickerTitle', {
					name: actorName,
					scroll: options.scrollName,
				});

	const dialog = new GenericDialog(
		title,
		SpellScrollDialog as unknown as Component<Record<string, never>>,
		data,
		{ icon: DIALOG_ICON, width: DIALOG_WIDTH },
	);

	await dialog.render(true);
	const result = await dialog.promise;

	return (result as SpellScrollDialogResult | null) ?? null;
}
