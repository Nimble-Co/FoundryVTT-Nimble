import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { DuplicateSourceGroupProps } from '#types/components/DuplicateSourceGroup.d.ts';
import getDocumentSourceLabel from '#utils/getDocumentSourceLabel.ts';
import getItemSource from '#utils/getItemSource.ts';
import localize from '#utils/localize.js';
import type { DescriptionSegment } from '../../featureDiff.ts';
import { compareFeatures, diffDescription, toPlainText } from '../../featureDiff.ts';

type StateProps = Pick<DuplicateSourceGroupProps, 'group' | 'selectedFeatures'>;

export interface DuplicateCandidate {
	feature: NimbleFeatureItem;
	/** Where this copy lives, e.g. a world folder path or the compendium's label. */
	origin: string;
	/** Where it came from, e.g. "from Nimble Core" or "packaged default". */
	lineage: string;
	/** "identical to X" / "differs: duration, healing" / "" for the baseline itself. */
	note: string;
	/** True when nothing at all differs from the baseline — not worth opening. */
	isIdentical: boolean;
	isOwned: boolean;
	isRecommended: boolean;
	source: ReturnType<typeof getItemSource>;
	/** Description split into runs, with the runs that differ from the baseline marked. */
	segments: DescriptionSegment[];
}

interface FolderLike {
	name?: string;
	folder?: FolderLike | null;
}

/** Deepest folder path worth showing; beyond this the origin line is all path and no signal. */
const MAX_FOLDER_PATH_DEPTH = 4;

/**
 * Folder path of a world item, outermost folder first.
 *
 * The leaf name alone is not enough: two copies can sit in identically named leaf folders under
 * different parents, which is exactly the case the picker exists to disambiguate.
 */
function describeFolderPath(folder: FolderLike | null | undefined): string {
	const names: string[] = [];

	for (let current = folder; current; current = current.folder) {
		if (names.length >= MAX_FOLDER_PATH_DEPTH) break;
		if (current.name) names.unshift(current.name);
	}

	return names.join(' / ');
}

/** Human name for where a copy physically lives. */
function describeOrigin(feature: NimbleFeatureItem): string {
	if (getItemSource(feature.uuid) === 'compendium') {
		return getDocumentSourceLabel(feature.uuid);
	}

	// World items are organized in folders; the folder is the only thing that reliably tells
	// two world copies of one feature apart.
	const path = describeFolderPath((feature as { folder?: FolderLike | null }).folder);
	return path || localize('NIMBLE.classFeatureSelection.duplicateWorldRoot');
}

/** Where a copy originally came from, which distinguishes an import from a hand-made item. */
function describeLineage(feature: NimbleFeatureItem): string {
	if (getItemSource(feature.uuid) === 'compendium') {
		return localize('NIMBLE.classFeatureSelection.duplicatePackagedDefault');
	}

	const sourceId = feature.sourceId;
	if (!sourceId) return localize('NIMBLE.classFeatureSelection.duplicateCreatedHere');

	return localize('NIMBLE.classFeatureSelection.duplicateDerivedFrom', {
		source: getDocumentSourceLabel(sourceId),
	});
}

/**
 * Picks the copy every other copy is described relative to: the one already on the sheet if
 * there is one, otherwise the packaged original, otherwise whichever came first. Comparing
 * against the thing the player already has — or against the published default — is what makes
 * "differs" mean something to them.
 */
function pickBaseline(group: StateProps['group']): NimbleFeatureItem | undefined {
	const owned = group.features.find((feature) => group.ownedUuids?.has(feature.uuid));
	if (owned) return owned;

	return (
		group.features.find((feature) => getItemSource(feature.uuid) === 'compendium') ??
		group.features[0]
	);
}

/**
 * Localized name for a rule or activation-effect `type` discriminator.
 *
 * The diff reports raw schema identifiers (`damageBonus`, `diceConsumer`), which must never reach
 * the player. `CONFIG.NIMBLE` already holds the labels the Rules Builder shows for exactly these
 * types, so the picker names them the same way. Returns `null` for a type with no label, leaving
 * the caller to fall back to the field it came from.
 */
function describeRuleType(type: string): string | null {
	const ruleTypes = CONFIG.NIMBLE.ruleTypes as Record<string, string | undefined>;
	const effectTypes = CONFIG.NIMBLE.effectTypes as Record<string, string | undefined>;

	return ruleTypes[type] ?? effectTypes[type] ?? null;
}

function describeDifference(
	feature: NimbleFeatureItem,
	baseline: NimbleFeatureItem | undefined,
	baselineOrigin: string,
): { note: string; isIdentical: boolean } {
	if (!baseline || baseline.uuid === feature.uuid) {
		return { note: localize('NIMBLE.classFeatureSelection.duplicateBaseline'), isIdentical: true };
	}

	const { isIdentical, changedFields, changedRuleTypes } = compareFeatures(baseline, feature);
	if (isIdentical) {
		return {
			note: localize('NIMBLE.classFeatureSelection.duplicateIdenticalTo', {
				source: baselineOrigin,
			}),
			isIdentical: true,
		};
	}

	// Name the rule types behind an effects/rules change — "Healing" says more than "effects".
	const labels = changedFields.flatMap((field) => {
		const fieldLabel = localize(`NIMBLE.classFeatureSelection.diffField.${field}`);
		if (field !== 'effects' && field !== 'rules') return fieldLabel;
		if (changedRuleTypes.length === 0) return fieldLabel;

		return changedRuleTypes.map((type) => describeRuleType(type) ?? fieldLabel);
	});

	return {
		note: localize('NIMBLE.classFeatureSelection.duplicateDiffers', {
			fields: [...new Set(labels)].join(', '),
		}),
		isIdentical: false,
	};
}

/**
 * Gives an element a tooltip carrying its own text, but only while that text is clipped.
 *
 * The identity line can be long — "identical to Nimble Class Features" against a narrow
 * dialog — so it truncates. A tooltip that repeats fully visible text is noise, so it is
 * attached and removed as the element resizes.
 */
export function tooltipWhenClipped(node: HTMLElement) {
	const sync = () => {
		// +1 absorbs sub-pixel rounding, which otherwise reports untruncated text as clipped.
		if (node.scrollWidth > node.clientWidth + 1) {
			node.setAttribute('data-tooltip', node.textContent?.trim() ?? '');
		} else {
			node.removeAttribute('data-tooltip');
		}
	};

	sync();

	// Absent in some test environments; the initial sync still covers the common case.
	const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
	observer?.observe(node);

	return {
		update: sync,
		destroy: () => observer?.disconnect(),
	};
}

/**
 * Reactive state for the duplicate-source picker.
 *
 * The cluster and the selection are taken as separate getters on purpose: building the candidate
 * list diffs every copy against the baseline, and a single getter returning both would tie that
 * work to the selection, re-running an LCS per candidate on every click.
 */
export function createDuplicateSourceGroupState(
	getGroup: () => StateProps['group'],
	getSelectedFeatures: () => StateProps['selectedFeatures'],
) {
	function buildCandidates(): DuplicateCandidate[] {
		const group = getGroup();
		const baseline = pickBaseline(group);
		const baselineOrigin = baseline ? describeOrigin(baseline) : '';
		const baselineDescription = baseline?.system?.description ?? '';

		return group.features.map((feature) => {
			const { note, isIdentical } = describeDifference(feature, baseline, baselineOrigin);

			return {
				feature,
				origin: describeOrigin(feature),
				lineage: describeLineage(feature),
				note,
				isIdentical,
				isOwned: group.ownedUuids?.has(feature.uuid) ?? false,
				isRecommended: group.recommendedUuid === feature.uuid,
				source: getItemSource(feature.uuid),
				segments:
					baseline && baseline.uuid !== feature.uuid
						? diffDescription(baselineDescription, feature.system?.description ?? '')
						: [{ text: toPlainText(feature.system?.description ?? ''), changed: false }],
			};
		});
	}

	const candidates = $derived.by(buildCandidates);
	/** Copies that can actually be granted — everything except what is already owned. */
	const offerable = $derived.by(() => {
		const group = getGroup();
		return group.features.filter((feature) => !group.ownedUuids?.has(feature.uuid));
	});
	const hasOwnedCopy = $derived((getGroup().ownedUuids?.size ?? 0) > 0);

	return {
		get candidates() {
			return candidates;
		},
		get offerable() {
			return offerable;
		},
		/** The copy "Keep recommended" falls back to; the first offerable if none is marked. */
		get recommended() {
			const recommendedUuid = getGroup().recommendedUuid;
			return offerable.find((feature) => feature.uuid === recommendedUuid) ?? offerable[0];
		},
		get heading() {
			return getGroup().displayName ?? '';
		},
		/**
		 * Whether keeping nothing at all is a legal outcome. It is exactly when a copy is already
		 * on the sheet, which is what drops the group's floor to zero — so the radios have to be
		 * able to give the selection back, not just move it.
		 */
		get canKeepNone() {
			return getGroup().selectionCount === 0;
		},
		isSelected(feature: NimbleFeatureItem) {
			return getSelectedFeatures().some((f) => f.uuid === feature.uuid);
		},
		get allSelected() {
			return offerable.length > 1 && getSelectedFeatures().length === offerable.length;
		},
		/** One line stating exactly what pressing Confirm will do. */
		get outcomeText() {
			const selectedFeatures = getSelectedFeatures();
			if (selectedFeatures.length === 0) {
				// Nothing selected means two different things: with a copy already on the sheet it is
				// a complete, valid outcome; without one the player still has a choice to make.
				return hasOwnedCopy
					? localize('NIMBLE.classFeatureSelection.duplicateOutcomeNone')
					: localize('NIMBLE.classFeatureSelection.duplicateOutcomePending');
			}
			if (selectedFeatures.length === 1) {
				return localize('NIMBLE.classFeatureSelection.duplicateOutcomeOne', {
					name: describeOrigin(selectedFeatures[0]),
				});
			}
			return localize('NIMBLE.classFeatureSelection.duplicateOutcomeAll', {
				count: String(selectedFeatures.length),
			});
		},
	};
}
