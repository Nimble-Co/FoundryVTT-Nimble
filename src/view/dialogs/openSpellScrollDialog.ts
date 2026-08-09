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
			mana?: { current?: number; max?: number };
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
	/** How many spells the drop covered. A batch asks once and applies to all. */
	batchCount?: number;
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

async function buildCandidates(tier: number): Promise<SpellScrollCandidate[]> {
	// A GM may inscribe a secret spell; a player may not even see that one exists.
	const index = await buildSpellIndex({ includeSecretSpells: Boolean(game.user?.isGM) });

	const entries: SpellIndexEntry[] = [];
	for (const tierMap of index.values()) {
		entries.push(...(tierMap.get(tier) ?? []));
	}

	const candidates = await Promise.all(
		entries.map(async (entry) => {
			const spell = (await fromUuid(entry.uuid as Parameters<typeof fromUuid>[0])) as
				| (DroppedSpell & {
						system?: { description?: { baseEffect?: string } };
				  })
				| null;

			return {
				...entry,
				activationSummary: spell ? activationSummary(spell) : '',
				description: await enrichSpellText(spell?.system?.description?.baseEffect ?? ''),
			} satisfies SpellScrollCandidate;
		}),
	);

	// The shared sort strips parentheses, so scroll candidates order the same way
	// as every other alphabetical document list in the system.
	return sortDocumentsByName(candidates);
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
					batchCount: options.batchCount ?? 0,
				}
			: {
					mode: 'picker' as const,
					actorName,
					tier: options.tier,
					tierLabel: getSpellTierLabel(options.tier),
					scrollPrice: SPELL_SCROLL_PRICE_BY_TIER[options.tier] ?? SPELL_SCROLL_PRICE_BY_TIER[0],
					candidates: await buildCandidates(options.tier),
				};

	const title =
		options.mode === 'chooser'
			? (options.batchCount ?? 0) > 1
				? localize('NIMBLE.spellScroll.dialog.batchChooserTitle', {
						name: actorName,
						count: String(options.batchCount),
					})
				: localize('NIMBLE.spellScroll.dialog.chooserTitle', {
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
