import { actorRules } from '#utils/actor/actorRules.js';
import localize from '#utils/localize.ts';
import { spacesBetween } from '#utils/movement/spacesBetween.js';

interface KillSplashRule {
	type?: string;
	disabled?: boolean;
	reach?: number;
	halfOnKill?: () => number | null;
	appliesTo?: () => boolean;
}

interface SplashActor {
	id?: string | null;
	name?: string | null;
	applyDamage?: (amount: number) => Promise<unknown>;
	system?: object;
}

interface SplashToken {
	id?: string | null;
	name?: string | null;
	actor?: SplashActor | null;
	parent?: { tokens?: Iterable<SplashToken> } | null;
}

function finiteReach(value: unknown): number {
	const reach = Math.trunc(Number(value));
	if (!Number.isFinite(reach) || reach < 0) return 0;
	return reach;
}

/** The reach of the first applicable rule, or null when the item has none. */
function reachOf(item: unknown): number | null {
	const holder = item as { rules?: unknown } | null;
	for (const rule of actorRules<KillSplashRule>(holder)) {
		if (rule?.type !== 'halfDamageOnKill' || rule.disabled) continue;
		if (typeof rule.halfOnKill === 'function') {
			const reach = rule.halfOnKill();
			if (reach == null) continue;
			return finiteReach(reach);
		}
		if (typeof rule.appliesTo === 'function' && !rule.appliesTo()) continue;
		return finiteReach(rule.reach);
	}
	return null;
}

function hitPoints(actor: SplashActor): number {
	return Number(foundry.utils.getProperty(actor, 'system.attributes.hp.value') ?? 0);
}

function creaturesWithin(origin: SplashToken, reach: number): SplashToken[] {
	const found: SplashToken[] = [];
	for (const other of origin.parent?.tokens ?? []) {
		if (other === origin || (other.id && other.id === origin.id)) continue;
		const actor = other.actor;
		if (!actor || actor === origin.actor) continue;
		if (origin.actor?.id && actor.id && actor.id === origin.actor.id) continue;
		if (!(hitPoints(actor) > 0)) continue;
		if (spacesBetween(origin as never, other as never, undefined, reach) <= reach)
			found.push(other);
	}
	return found;
}

function choiceId(token: SplashToken, index: number): string {
	return `token:${token.id ?? index}`;
}

/**
 * Ask the client applying the damage to deal half the rolled amount, rounded
 * down, to another living creature within reach. Declining or closing deals
 * nothing. A roll that halves to 0 offers nothing.
 */
export async function offerHalfDamageOnKill(input: {
	sourceItem: unknown;
	killedToken: unknown;
	rolled: number;
	deal: (actor: SplashActor, amount: number) => Promise<unknown>;
}): Promise<void> {
	const reach = reachOf(input.sourceItem);
	const killed = input.killedToken as SplashToken | null;
	if (reach == null || !killed) return;
	const amount = Math.floor(Number(input.rolled) / 2);
	if (!Number.isFinite(amount) || amount < 1) return;

	const choices = creaturesWithin(killed, reach);
	if (choices.length < 1) return;

	const chosen: unknown = await foundry.applications.api.DialogV2.wait({
		window: { title: localize('NIMBLE.chat.halfDamageOnKill.title') },
		content: `<p>${localize('NIMBLE.chat.halfDamageOnKill.prompt')}</p>`,
		buttons: [
			...choices.map((token, index) => ({
				action: choiceId(token, index),
				label: token.name || token.actor?.name || localize('NIMBLE.chat.halfDamageOnKill.creature'),
			})),
			{ action: 'decline', label: localize('NIMBLE.chat.halfDamageOnKill.decline') },
		],
		rejectClose: false,
	});

	const pick = choices.find((token, index) => choiceId(token, index) === chosen);
	if (!pick?.actor) return;
	await input.deal(pick.actor, amount);
}
