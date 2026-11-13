export const MULTIPLY_DOWN_CHANGE = 'multiplyDown';

/** The phase after every rule of the actor: a Multiply, round down change applies here. */
export const AFTER_RULES_PHASE = 'afterRules';

interface ChangeField {
	_castChangeDelta?: (raw: unknown, replacementData?: object) => unknown;
}

interface HandlerOptions {
	field?: ChangeField | null;
	replacementData?: object;
	modifyTarget?: boolean;
}

/** Float error must not drop a whole number: 0.29 * 100 is 28.999... */
const EPSILON = 1e-9;

/** Multiplies a number and rounds down. Core's multiply rounds an integer field to the nearest. */
export function applyMultiplyDown(
	targetDoc: object,
	change: { key: string; value: unknown },
	{ field, replacementData = {}, modifyTarget = true }: HandlerOptions = {},
): number | undefined {
	const current = Number(foundry.utils.getProperty(targetDoc, change.key));
	const delta = Number(field?._castChangeDelta?.(change.value, replacementData) ?? change.value);
	if (!Number.isFinite(current) || !Number.isFinite(delta)) return undefined;
	const update = Math.floor(current * delta + EPSILON);
	if (modifyTarget) foundry.utils.setProperty(targetDoc, change.key, update);
	return update;
}

/**
 * Core's multiply has priority 10; this one goes at the same step. It applies in its own phase
 * after every rule, so a halving also halves the bonuses that rules give.
 */
export function registerMultiplyDownChange(): void {
	const config = CONFIG.ActiveEffect as {
		changeTypes?: Record<string, object>;
		phases?: Record<string, { label: string; hint?: string }>;
	};
	config.phases ??= {};
	config.phases[AFTER_RULES_PHASE] = {
		label: 'NIMBLE.effectSheet.phases.afterRules.label',
		hint: 'NIMBLE.effectSheet.phases.afterRules.hint',
	};
	config.changeTypes ??= {};
	config.changeTypes[MULTIPLY_DOWN_CHANGE] = {
		label: 'NIMBLE.effectSheet.changeTypes.multiplyDown',
		defaultPriority: 10,
		handler: applyMultiplyDown,
	};
}
