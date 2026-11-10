import { rulesOfType } from '#utils/actor/actorRules.js';
import { applyEffectHere, payloadFromEffect } from '#utils/actor/applyEffectToActor.js';
import { ruleChargesLeft } from '#utils/chargePool/ruleChargeGate.js';
import { isActiveGM } from '#utils/isActiveGM.js';
import { isRuleAutomationEnabled } from '../settings/automationSettings.js';

interface ItemEffect {
	transfer?: boolean;
	toObject(): Record<string, unknown>;
}

interface RuleItem {
	uuid?: string;
	effects?: Iterable<ItemEffect>;
}

interface Owner {
	uuid?: string;
	rules?: unknown[];
	effects?: Iterable<{ origin?: string | null }>;
}

/** The effect the item gives: its first effect that stays on the item. */
function itemEffectOf(item: RuleItem | null | undefined): ItemEffect | null {
	return [...(item?.effects ?? [])].find((effect) => effect.transfer === false) ?? null;
}

function hasEffectFrom(actor: Owner, itemUuid: string): boolean {
	return [...(actor.effects ?? [])].some((effect) => effect.origin === itemUuid);
}

const running = new WeakMap<object, Promise<void>>();

/**
 * The owner gets each effect whose pool is empty now. A check waits for the one before it on the
 * same actor, so a turn start and an update at the same time give one effect.
 */
export function applyPoolEmptyEffects(actor: Owner): Promise<void> {
	const next = (running.get(actor) ?? Promise.resolve()).then(() => applyNow(actor));
	const settled = next.catch(() => {});
	running.set(actor, settled);
	return next;
}

async function applyNow(actor: Owner): Promise<void> {
	if (!isRuleAutomationEnabled()) return;
	const rules = rulesOfType(actor, 'poolEmptyEffect').filter((rule) => rule.isLive());
	for (const rule of rules) {
		const item = rule.item as RuleItem | null;
		const effect = itemEffectOf(item);
		if (!item?.uuid || !effect || hasEffectFrom(actor, item.uuid)) continue;
		if (ruleChargesLeft(actor as never, rule.chargePoolIdentifier) !== 0) continue;
		await applyEffectHere(
			actor as never,
			payloadFromEffect(effect, { itemUuid: item.uuid, user: null }),
		);
	}
}

function isOwnTurn(actor: Owner): boolean {
	const combat = game.combat;
	return !!combat?.started && !!actor.uuid && combat.combatant?.actor?.uuid === actor.uuid;
}

let registered = false;

/** The active GM checks at the start of a turn, and when the actor or its items change on its turn. */
export function registerPoolEmptyEffectHooks(): void {
	if (registered) return;
	registered = true;
	Hooks.on(
		'nimbleCombatTurnStart' as never,
		((combatant: Combatant) => {
			if (!isActiveGM()) return;
			const actor = combatant?.actor as Owner | null;
			if (actor) void applyPoolEmptyEffects(actor);
		}) as never,
	);
	const onChange = (actor: Owner | null | undefined) => {
		if (!actor || !isActiveGM() || !isOwnTurn(actor)) return;
		void applyPoolEmptyEffects(actor);
	};
	// A pool lives on the actor or on one of its items.
	Hooks.on('updateActor', (actor: Actor) => onChange(actor as Owner));
	Hooks.on('updateItem', (item: Item) => onChange(item.parent as Owner | null));
}
