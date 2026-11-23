import { ruleLabel } from '#utils/actor/actorRules.js';
import localize from '../localize.js';
import type { PendingMove, WoundSource } from './pendingWound.js';
import { rulesWatching, type WoundCreature } from './rulesWatching.js';

export type DropResponse = 'land' | 'prevent' | 'floor';

export interface WouldDropPlan {
	response: 'prevent' | 'floor';
	woundInstead: number;
	moveDistance: number;
}

export interface WouldDropOffer {
	name: string;
	response: 'prevent' | 'floor';
}

export interface WouldDropRequest {
	actor: WoundCreature;
	source?: WoundSource | null;
	choose?: (offer: WouldDropOffer) => Promise<boolean>;
	watchers?: readonly WoundCreature[];
}

export interface WouldDropOutcome {
	response: DropResponse;
	woundInstead: number;
	moves: PendingMove[];
}

interface DropRule {
	type?: string;
	watch?: string;
	reach?: number;
	priority?: number;
	appliesTo?: () => boolean;
	choice?: string;
	label?: string;
	parentDocument?: { name?: string | null } | null;
	matchesDrop?: () => boolean;
	planDrop?: () => WouldDropPlan;
}

function escapeName(name: string): string {
	const escapeHtml = foundry.utils?.escapeHTML;
	return typeof escapeHtml === 'function' ? escapeHtml(name) : name;
}

async function askDrop(
	offer: WouldDropOffer,
	choose: WouldDropRequest['choose'],
): Promise<boolean> {
	if (choose) return choose(offer);
	try {
		const confirm = foundry.applications?.api?.DialogV2?.confirm;
		if (!confirm) return false;
		const yes = await confirm({
			window: { title: localize('NIMBLE.wounds.drop.chooseTitle') },
			content: `<p>${localize('NIMBLE.wounds.drop.offer', { name: escapeName(offer.name) })}</p>`,
			yes: { label: localize('NIMBLE.wounds.drop.use') },
			no: { label: localize('NIMBLE.wounds.drop.skip') },
			rejectClose: false,
		});
		return yes === true;
	} catch {
		return false;
	}
}

async function finish(
	actor: WoundCreature,
	rule: DropRule,
	plan: WouldDropPlan,
): Promise<WouldDropOutcome> {
	const moves: PendingMove[] = [];
	if (plan.moveDistance >= 1) {
		const name = ruleLabel(rule);
		moves.push({ actorUuid: actor.uuid ?? '', distance: plan.moveDistance, name });
		try {
			const { offerWoundMove } = await import('./offerWoundMove.js');
			await offerWoundMove(actor, plan.moveDistance, name);
		} catch {
			// The move is on the outcome. Posting it must not force the drop through.
		}
	}
	const woundInstead = Number.isFinite(plan.woundInstead)
		? Math.max(0, Math.floor(plan.woundInstead))
		: 0;
	return { response: plan.response, woundInstead, moves };
}

/**
 * What happens when HP would fall from above 0 to 0. `land` is the default:
 * HP becomes 0 and the caller grants the Wound that drop causes. `prevent`
 * writes nothing. `floor` leaves the creature at 1 HP and does not grant that
 * Wound. `woundInstead` is a separate gain for the caller to apply.
 */
export async function resolveWouldDropToZero(request: WouldDropRequest): Promise<WouldDropOutcome> {
	const watching = rulesWatching<DropRule>(request.actor, 'wouldDropToZero', request.watchers);
	const matches = (rule: DropRule) => !rule.matchesDrop || rule.matchesDrop();
	const automatics = watching.filter(({ rule }) => rule.choice !== 'offer' && matches(rule));
	const first = automatics[0];
	if (first) {
		const plan = first.rule.planDrop?.();
		if (plan) return finish(request.actor, first.rule, plan);
	}

	for (const { rule } of watching) {
		if (rule.choice !== 'offer' || !matches(rule)) continue;
		const plan = rule.planDrop?.();
		if (!plan) continue;
		const accepted = await askDrop(
			{ name: ruleLabel(rule), response: plan.response },
			request.choose,
		);
		if (!accepted) continue;
		return finish(request.actor, rule, plan);
	}

	return { response: 'land', woundInstead: 0, moves: [] };
}
