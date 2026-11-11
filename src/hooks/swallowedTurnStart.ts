import type { CardEvent } from '#types/cardEvent.d.ts';
import { addMomentEvents } from '#utils/chat/cardEvents.js';
import { type TurnPlace, turnMoment } from '#utils/lastsUntil/turnMoment.js';
import { STATUS_EFFECT_IDS } from '../config/registerConditionsConfig.js';
import { isRuleAutomationEnabled } from '../settings/automationSettings.js';

const SWALLOWED_DAMAGE = 20;

interface SwallowedCombatant {
	id?: string | null;
	name?: string | null;
	combat?: { id?: string | null; round?: number | null } | null;
	actor?: {
		uuid?: string | null;
		name?: string | null;
		statuses?: Set<string>;
		applyDamage?(amount: number): Promise<void>;
	} | null;
}

function swallowedIcon(): string | undefined {
	const statuses = (CONFIG.statusEffects ?? []) as unknown as { id?: string; img?: string }[];
	return statuses.find((status) => status.id === STATUS_EFFECT_IDS.swallowed)?.img;
}

/**
 * A Swallowed creature takes its damage at the start of its turn, on the active GM's client. The
 * line goes on the card of that turn start.
 */
export function registerSwallowedTurnStartHooks(): void {
	Hooks.on(
		'nimbleCombatTurnStart' as never,
		(async (combatant: SwallowedCombatant, place?: TurnPlace) => {
			const actor = combatant.actor;
			if (!isRuleAutomationEnabled() || !actor?.statuses?.has(STATUS_EFFECT_IDS.swallowed)) return;
			await actor.applyDamage?.(SWALLOWED_DAMAGE);
			const found = turnMoment('turnStart', combatant, place);
			if (!found) return;
			const at = Date.now();
			const img = swallowedIcon();
			const event: CardEvent = {
				id: `damage.swallowed.${actor.uuid ?? combatant.id ?? ''}.${at}`,
				kind: 'damage',
				...(img ? { img } : { icon: 'fa-solid fa-heart-crack' }),
				text: {
					key: 'NIMBLE.chat.swallowedDamage.text',
					data: { name: actor.name ?? '', amount: SWALLOWED_DAMAGE },
				},
				cause: { key: 'NIMBLE.chat.swallowedDamage.cause' },
				at,
			};
			await addMomentEvents(found.moment, [event]);
		}) as never,
	);
}
