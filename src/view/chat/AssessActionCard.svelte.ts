import localize from '../../utils/localize.js';
import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';

interface MessageDocument {
	reactive: {
		system: Record<string, unknown>;
		rolls: unknown[];
		author: { color: string };
	};
}

export async function getTargetToken(targetUuid: string | null): Promise<unknown> {
	if (!targetUuid) return null;
	return fromUuid(targetUuid);
}

export function createAssessActionCardState(getMessageDocument: () => MessageDocument) {
	const { skills } = CONFIG.NIMBLE;

	const system = $derived(getMessageDocument().reactive.system);
	const rolls = $derived(getMessageDocument().reactive.rolls);
	const headerBackgroundColor = $derived(getMessageDocument().reactive.author.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));

	const actorType = $derived(system.actorType as string);
	const permissions = $derived(system.permissions as number);
	const rollMode = $derived(system.rollMode as number);
	const skillKey = $derived(system.skillKey as string);
	const dc = $derived(system.dc as number);
	const isSuccess = $derived(system.isSuccess as boolean);
	const optionTitle = $derived(system.optionTitle as string);
	const resultMessage = $derived(system.resultMessage as string);
	const target = $derived(system.target as string | null);
	const targetName = $derived(system.targetName as string);

	const label = $derived(
		localize('NIMBLE.ui.heroicActions.assess.checkVsDC', { skill: skills[skillKey], dc }),
	);
	const resultLabel = $derived(
		localize(
			isSuccess
				? 'NIMBLE.ui.heroicActions.assess.success'
				: 'NIMBLE.ui.heroicActions.assess.failure',
		),
	);
	const hintClass = $derived(isSuccess ? 'nimble-hint--success' : 'nimble-hint--warning');
	const hintIcon = $derived(
		isSuccess ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation',
	);

	return {
		rolls,
		headerBackgroundColor,
		headerTextColor,
		actorType,
		permissions,
		rollMode,
		optionTitle,
		resultMessage,
		target,
		targetName,
		label,
		resultLabel,
		hintClass,
		hintIcon,
	};
}
