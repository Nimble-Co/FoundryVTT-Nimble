import type {
	AttackOutcomeSources,
	AttackOutcomeTag,
	MultiTargetDetail,
} from '#types/attackOutcome.d.ts';
import type { EffectNode } from '#types/effectTree.js';
import { critFaceOf } from '../../../dice/critFace.js';
import { findPrimaryDamageNode } from '../../../utils/damage/foldBonusIntoPrimaryDamage.js';
import { DEFAULT_MISS_THRESHOLD } from '../../../utils/damage/missThreshold.js';
import { termsHaveDieAtMax } from '../../../utils/incomingReactions/incomingReactionEntry.js';
import localize from '../../../utils/localize.js';
import { flattenEffectsTree } from '../../../utils/treeManipulation/flattenEffectsTree.js';

interface OutcomeRollOptions {
	multiTarget?: boolean;
	multiTargetDetail?: MultiTargetDetail;
	critRange?: number;
	forcedCrit?: string;
	missThreshold?: number;
	outcomeSources?: Partial<AttackOutcomeSources>;
}

interface DieTermView {
	faces?: number;
	results?: Array<{ result: number; active?: boolean; discarded?: boolean }>;
}

/** The card's primary attack roll, as it is stored. */
interface OutcomeRollView {
	isCritical?: boolean;
	isMiss?: boolean;
	options?: (OutcomeRollOptions & { primaryDieBonusOff?: boolean }) | null;
	terms?: readonly unknown[];
}

/** The card's primary attack roll, or null when it has none. */
function cardPrimaryRoll(system: unknown): OutcomeRollView | null {
	const activation = (system as { activation?: { effects?: EffectNode[] } } | undefined)
		?.activation;
	if (!activation?.effects) return null;
	const nodes = flattenEffectsTree(activation.effects);
	return (findPrimaryDamageNode(nodes)?.roll as OutcomeRollView | undefined) ?? null;
}

const TAG_TEXT = 'NIMBLE.chat.incomingReactions.outcomeTags';

function keptFace(terms: readonly unknown[] | undefined): { face: number; faces: number } | null {
	const term = (terms ?? []).find((candidate) => (candidate as DieTermView)?.faces) as
		| DieTermView
		| undefined;
	const kept = term?.results?.find((result) => result.active !== false && !result.discarded);
	return term?.faces && kept ? { face: kept.result, faces: term.faces } : null;
}

function critCauses(
	options: OutcomeRollOptions,
	terms: readonly unknown[] | undefined,
	face: number,
	faces: number,
): string[] {
	const sources = options.outcomeSources ?? {};
	const inCritRange = face >= critFaceOf(faces, { critRange: options.critRange });
	const causes = [
		...(sources.forcedCrit ?? []),
		...(inCritRange ? (sources.critRange ?? []) : []),
		...(termsHaveDieAtMax(terms) ? (sources.anyDieCrits ?? []) : []),
	];
	return [...new Set(causes)];
}

/**
 * The tags for a result the die face does not explain: what made a face below
 * the max a crit, what made a miss face a hit, and that an attack on 2 or more
 * targets has no miss and no crit. Nothing on other rolls.
 */
function attackOutcomeTags(roll: OutcomeRollView | null): AttackOutcomeTag[] {
	const die = keptFace(roll?.terms);
	if (!roll || !die) return [];
	const options = roll.options ?? {};
	const { face, faces } = die;
	const value = { face: String(face) };
	const missFace = face <= (options.missThreshold ?? DEFAULT_MISS_THRESHOLD);

	if (options.multiTarget) {
		const detail = options.multiTargetDetail;
		const noOutcome = missFace
			? detail?.couldMiss !== false && 'noMiss'
			: face >= critFaceOf(faces, { critRange: options.critRange }) &&
				detail?.couldCrit !== false &&
				'noCrit';
		if (!noOutcome) return [];
		const count = String(detail?.targets ?? 2);
		return [
			{
				kind: 'noOutcome',
				label: localize(`${TAG_TEXT}.${noOutcome}`, { count }),
				tooltip: localize(`${TAG_TEXT}.multiTargetTooltip`, { ...value, count }),
			},
		];
	}

	const tags: AttackOutcomeTag[] = [];
	if (roll.isCritical && face < faces) {
		for (const cause of critCauses(options, roll.terms, face, faces)) {
			tags.push({
				kind: 'crit',
				label: localize(`${TAG_TEXT}.crit`, { cause }),
				tooltip: localize(`${TAG_TEXT}.critTooltip`, { ...value, cause }),
			});
		}
	}
	if (!roll.isMiss && missFace) {
		for (const feature of new Set(options.outcomeSources?.cannotMiss ?? [])) {
			tags.push({
				kind: 'cannotMiss',
				label: localize(`${TAG_TEXT}.cannotMiss`, { feature }),
				tooltip: localize(`${TAG_TEXT}.cannotMissTooltip`, { ...value, feature }),
			});
		}
	}
	return tags;
}

interface DieSetRecord {
	use?: string;
	itemUuid?: string;
	label?: string;
	change?: { mode?: string } | null;
	next?: { value?: number } | null;
}

/**
 * Why a Primary Die Bonus is not on the die, or null when it is: a die set to
 * a value keeps that face.
 */
function primaryDieBonusNotAdded(
	options: { primaryDieBonusOff?: boolean } | null | undefined,
	rerolls: readonly DieSetRecord[],
	documentName: (uuid: string) => string | null | undefined,
): string | null {
	if (!options?.primaryDieBonusOff) return null;
	const set = rerolls.findLast(
		(record) => record.use === 'change' && record.change?.mode === 'set',
	);
	if (!set) return localize('NIMBLE.chat.primaryDieBonus.notAddedTooltip');
	return localize('NIMBLE.chat.primaryDieBonus.notAddedBySetTooltip', {
		feature: (documentName(set.itemUuid ?? '') ?? '').trim() || (set.label ?? ''),
		face: String(set.next?.value ?? ''),
	});
}

export { attackOutcomeTags, cardPrimaryRoll, primaryDieBonusNotAdded };
