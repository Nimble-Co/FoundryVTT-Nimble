import { STATUS_EFFECT_IDS } from '../../config/registerConditionsConfig.js';
import { isRuleAutomationEnabled } from '../../settings/automationSettings.js';
import type { Moment } from '../lastsUntil/momentReached.js';
import { applyEffectToActor, payloadFromCondition } from './applyEffectToActor.js';

const ONE_MINUTE: Moment = {
	kind: 'time',
	boundary: null,
	clock: null,
	span: null,
	value: 1,
	units: 'minutes',
	who: null,
	event: null,
	effectName: '',
};

interface ChargeTarget {
	uuid: string;
	isOwner?: boolean;
	update(data: Record<string, unknown>): Promise<unknown>;
}

/** "Whenever you take lightning damage, you are Charged for 1 minute." (Core, Lightning spells) */
export async function chargeOnLightning(
	target: ChargeTarget | null | undefined,
	damageTypes: readonly string[] | null | undefined,
	sourceActorUuid: string | null = null,
): Promise<void> {
	if (!target || !damageTypes?.includes('lightning') || !isRuleAutomationEnabled()) return;
	const payload = payloadFromCondition(STATUS_EFFECT_IDS.charged, [ONE_MINUTE], {
		itemUuid: null,
		actorUuid: sourceActorUuid,
	});
	await applyEffectToActor(target as never, payload).catch((error) =>
		console.error('Nimble | Could not make the creature Charged.', error),
	);
}
