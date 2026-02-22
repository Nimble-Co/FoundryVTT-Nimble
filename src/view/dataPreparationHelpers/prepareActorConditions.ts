import localize from '../../utils/localize.js';

export type ActorCondition = {
	id: string;
	name: string;
	img: string;
	descriptionHtml: string;
	active: boolean;
	isOverlay: boolean;
	durationLabel: string;
	durationSortMs: number | null;
	sourceLabel: string;
	tooltipHtml: string;
};

type ActorWithConditionsMetadata = Actor.Implementation & {
	conditionsMetadata?: {
		active?: Set<string>;
		overlay?: Set<string>;
	};
};

type EffectDurationDetails = {
	label: string;
	sortMs: number | null;
};

type ConditionEffectCandidate = {
	durationLabel: string;
	durationSortMs: number | null;
	sourceName: string | null;
};

const ROUND_SECONDS = 6;
const TURN_SECONDS = 6;

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function compactSecondsLabel(seconds: number): string {
	const boundedSeconds = Math.max(seconds, 0);

	if (boundedSeconds < 60) return `${Math.ceil(boundedSeconds)}s`;
	if (boundedSeconds < 3600) return `${Math.ceil(boundedSeconds / 60)}m`;
	return `${Math.ceil(boundedSeconds / 3600)}h`;
}

function deriveDurationDetails(
	duration:
		| {
				remaining?: number;
				seconds?: number;
				rounds?: number;
				turns?: number;
		  }
		| null
		| undefined,
): EffectDurationDetails {
	if (!duration) {
		return { label: '∞', sortMs: null };
	}

	if (typeof duration.remaining === 'number' && Number.isFinite(duration.remaining)) {
		const remainingMs = Math.max(duration.remaining, 0) * 1000;
		return { label: compactSecondsLabel(duration.remaining), sortMs: remainingMs };
	}

	if (typeof duration.turns === 'number' && Number.isFinite(duration.turns) && duration.turns > 0) {
		return { label: `${Math.ceil(duration.turns)}t`, sortMs: duration.turns * TURN_SECONDS * 1000 };
	}

	if (
		typeof duration.rounds === 'number' &&
		Number.isFinite(duration.rounds) &&
		duration.rounds > 0
	) {
		return {
			label: `${Math.ceil(duration.rounds)}r`,
			sortMs: duration.rounds * ROUND_SECONDS * 1000,
		};
	}

	if (typeof duration.seconds === 'number' && Number.isFinite(duration.seconds)) {
		const secondsMs = Math.max(duration.seconds, 0) * 1000;
		return { label: compactSecondsLabel(duration.seconds), sortMs: secondsMs };
	}

	return { label: '∞', sortMs: null };
}

function getEffectSourceName(effect: ActiveEffect): string | null {
	const directSourceName =
		(effect as ActiveEffect & { sourceName?: string }).sourceName ??
		(effect as ActiveEffect & { _sourceName?: string })._sourceName;
	if (typeof directSourceName === 'string' && directSourceName.length > 0) {
		return directSourceName;
	}

	const fallbackSource = (effect as ActiveEffect & { name?: string }).name;
	if (typeof fallbackSource === 'string' && fallbackSource.length > 0) {
		return fallbackSource;
	}

	return null;
}

function getBestEffectCandidate(effects: ActiveEffect[]): ConditionEffectCandidate {
	const candidates = effects.map((effect) => {
		const duration = deriveDurationDetails(
			(
				effect as ActiveEffect & {
					duration?: { remaining?: number; seconds?: number; rounds?: number; turns?: number };
				}
			).duration,
		);

		return {
			durationLabel: duration.label,
			durationSortMs: duration.sortMs,
			sourceName: getEffectSourceName(effect),
		};
	});

	const timedCandidates = candidates.filter(
		(candidate) => typeof candidate.durationSortMs === 'number',
	) as Array<ConditionEffectCandidate & { durationSortMs: number }>;
	if (timedCandidates.length > 0) {
		timedCandidates.sort((a, b) => a.durationSortMs - b.durationSortMs);
		return timedCandidates[0];
	}

	return candidates[0] ?? { durationLabel: '∞', durationSortMs: null, sourceName: null };
}

function buildConditionTooltip(
	condition: Pick<ActorCondition, 'name' | 'descriptionHtml' | 'durationLabel' | 'sourceLabel'>,
): string {
	const conditionTag = localize('NIMBLE.ui.condition');
	const durationTagLabel = localize('NIMBLE.ui.duration');
	const sourceTagLabel = localize('NIMBLE.ui.source');
	const unlimitedText = localize('NIMBLE.ui.unlimited');
	const description =
		condition.descriptionHtml || localize('NIMBLE.ui.conditionDescriptionUnavailable');
	const escapedName = escapeHtml(condition.name);
	const escapedConditionTag = escapeHtml(conditionTag);
	const expandedDurationLabel = (() => {
		const roundsMatch = condition.durationLabel.match(/^(\d+)r$/i);
		if (roundsMatch) {
			const count = Number.parseInt(roundsMatch[1], 10);
			const roundLabel =
				count === 1 ? localize('NIMBLE.durations.round') : localize('NIMBLE.durationsPlural.round');
			return `${count} ${roundLabel}`;
		}

		const turnsMatch = condition.durationLabel.match(/^(\d+)t$/i);
		if (turnsMatch) {
			const count = Number.parseInt(turnsMatch[1], 10);
			const turnLabel =
				count === 1 ? localize('NIMBLE.durations.turn') : localize('NIMBLE.durationsPlural.turn');
			return `${count} ${turnLabel}`;
		}

		return condition.durationLabel;
	})();
	const escapedDurationLabel = escapeHtml(
		condition.durationLabel === '∞' ? unlimitedText : expandedDurationLabel,
	);
	const escapedSourceLabel = escapeHtml(condition.sourceLabel);
	const escapedDurationTagLabel = escapeHtml(durationTagLabel);
	const escapedSourceTagLabel = escapeHtml(sourceTagLabel);

	return `
		<header class="nimble-tooltip__enricher-header">
			<h3 class="nimble-tooltip__enricher-heading">${escapedName}</h3>
			<span class="nimble-tooltip__tag">${escapedConditionTag}</span>
		</header>
		<div class="nimble-tooltip__tag-group">
			<span class="nimble-tooltip__tag nimble-tooltip__tag--item">${escapedDurationTagLabel}: ${escapedDurationLabel}</span>
			<span class="nimble-tooltip__tag nimble-tooltip__tag--item">${escapedSourceTagLabel}: ${escapedSourceLabel}</span>
		</div>
		<section class="nimble-tooltip__description-wrapper">
			${description}
		</section>
	`.trim();
}

export default function prepareActorConditions(
	actor: Actor.Implementation | null,
	options: { includeInactive?: boolean; includeEffectStatuses?: boolean } = {},
): ActorCondition[] {
	if (!actor) return [];
	const { includeInactive = false, includeEffectStatuses = false } = options;

	const actorWithMetadata = actor as ActorWithConditionsMetadata;
	const activeConditions = actorWithMetadata.conditionsMetadata?.active ?? new Set<string>();
	const overlayConditions = actorWithMetadata.conditionsMetadata?.overlay ?? new Set<string>();
	const conditionDescriptions = CONFIG.NIMBLE.conditionDescriptions ?? {};
	const effectConditions = new Map<string, ActiveEffect[]>();
	const actorEffects = Array.from((actor.effects ?? []) as Iterable<ActiveEffect>);
	const sourceNoneText = localize('NIMBLE.ui.sourceNone');

	for (const effect of actorEffects) {
		const statuses = effect.statuses;
		if (!statuses) continue;

		for (const statusId of statuses) {
			const existing = effectConditions.get(statusId) ?? [];
			existing.push(effect);
			effectConditions.set(statusId, existing);
		}
	}

	const conditionIds = includeInactive
		? new Set([...Object.keys(CONFIG.NIMBLE.conditions ?? {}), ...activeConditions])
		: includeEffectStatuses
			? new Set([...activeConditions, ...effectConditions.keys()])
			: new Set(activeConditions);

	const conditions = [...conditionIds].map((conditionId) => {
		const matchingEffects = effectConditions.get(conditionId) ?? [];
		const metadata = game.nimble.conditions.get(conditionId);
		const fallbackName =
			CONFIG.NIMBLE.conditions?.[conditionId] ?? (matchingEffects[0]?.name || conditionId);
		const fallbackImage =
			CONFIG.NIMBLE.conditionDefaultImages?.[conditionId] ?? (matchingEffects[0]?.img || '');
		const bestEffect = getBestEffectCandidate(matchingEffects);
		const sourceLabel = bestEffect.sourceName ?? sourceNoneText;
		const descriptionHtml = conditionDescriptions[conditionId] ?? '';
		const baseCondition = {
			id: conditionId,
			name: metadata?.name ?? fallbackName,
			img: metadata?.img ?? fallbackImage,
			descriptionHtml,
			active: activeConditions.has(conditionId) || matchingEffects.length > 0,
			isOverlay: overlayConditions.has(conditionId),
			durationLabel: bestEffect.durationLabel,
			durationSortMs: bestEffect.durationSortMs,
			sourceLabel,
		};

		return { ...baseCondition, tooltipHtml: buildConditionTooltip(baseCondition) };
	});

	return conditions.sort((a, b) => a.name.localeCompare(b.name));
}
