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

/** Human name for where a copy physically lives. */
function describeOrigin(feature: NimbleFeatureItem): string {
	if (getItemSource(feature.uuid) === 'compendium') {
		return getDocumentSourceLabel(feature.uuid);
	}

	// World items are organized in folders; the folder is the only thing that reliably tells
	// two world copies of one feature apart.
	const folder = (feature as { folder?: { name?: string } | null }).folder;
	return folder?.name || localize('NIMBLE.classFeatureSelection.duplicateWorldRoot');
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

	// Name the rule types behind an effects/rules change — "healing" says more than "effects".
	const labels = changedFields.flatMap((field) => {
		if ((field === 'effects' || field === 'rules') && changedRuleTypes.length > 0) {
			return changedRuleTypes;
		}
		return localize(`NIMBLE.classFeatureSelection.diffField.${field}`);
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

export function createDuplicateSourceGroupState(getProps: () => StateProps) {
	function buildCandidates(): DuplicateCandidate[] {
		const { group } = getProps();
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

	return {
		get candidates() {
			return buildCandidates();
		},
		/** Copies that can actually be granted — everything except what is already owned. */
		get offerable() {
			const { group } = getProps();
			return group.features.filter((feature) => !group.ownedUuids?.has(feature.uuid));
		},
		/** The copy "Keep recommended" falls back to; the first offerable if none is marked. */
		get recommended() {
			const { group } = getProps();
			const offerable = group.features.filter((feature) => !group.ownedUuids?.has(feature.uuid));
			return offerable.find((feature) => feature.uuid === group.recommendedUuid) ?? offerable[0];
		},
		get heading() {
			const { group } = getProps();
			return group.displayName ?? '';
		},
		get hasOwnedCopy() {
			const { group } = getProps();
			return (group.ownedUuids?.size ?? 0) > 0;
		},
		isSelected(feature: NimbleFeatureItem) {
			return getProps().selectedFeatures.some((f) => f.uuid === feature.uuid);
		},
		get allSelected() {
			const { group, selectedFeatures } = getProps();
			const offerableCount = group.features.filter(
				(feature) => !group.ownedUuids?.has(feature.uuid),
			).length;
			return offerableCount > 1 && selectedFeatures.length === offerableCount;
		},
		/** One line stating exactly what pressing Confirm will do. */
		get outcomeText() {
			const { selectedFeatures } = getProps();
			if (selectedFeatures.length === 0) {
				return localize('NIMBLE.classFeatureSelection.duplicateOutcomeNone');
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
