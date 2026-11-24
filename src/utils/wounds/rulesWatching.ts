import { actorRules } from '#utils/actor/actorRules.js';
import { alliesWithin } from '#utils/movement/alliesWithin.js';
import { findActorToken } from '#utils/movement/findActorToken.js';

/** A creature whose rules can see a Wound or a drop to 0 HP. */
export interface WoundCreature {
	uuid?: string | null;
	name?: string | null;
	rules?: unknown;
	isToken?: boolean;
	token?: TokenDocument | null;
	getDependentTokens?(options?: { linked?: boolean; concreteOnly?: boolean }): TokenDocument[];
}

interface WatchedRule {
	type?: string;
	watch?: string;
	reach?: number;
	priority?: number;
	appliesTo?: () => boolean;
}

export interface Watching<T> {
	rule: T;
	holder: WoundCreature;
}

function findToken(actor: WoundCreature): TokenDocument | null {
	try {
		return findActorToken(actor as Actor);
	} catch {
		return null;
	}
}

function sameCreature(a: WoundCreature, b: WoundCreature): boolean {
	if (a === b) return true;
	return !!a.uuid && a.uuid === b.uuid;
}

function inReach(rule: WatchedRule, holder: WoundCreature, origin: TokenDocument | null): boolean {
	const reach = Number(rule.reach ?? 0);
	if (!(reach > 0)) return true;
	if (!origin) return false;
	const allyToken = findToken(holder);
	if (!allyToken || allyToken === origin) return false;
	return alliesWithin(origin, [allyToken], reach).length > 0;
}

function alliesOf(
	actor: WoundCreature,
	extra: readonly WoundCreature[] | undefined,
	origin: TokenDocument | null,
): WoundCreature[] {
	const found: WoundCreature[] = [];
	const seen = new Set<string>();
	const add = (ally: WoundCreature | null | undefined) => {
		if (!ally || sameCreature(ally, actor)) return;
		if (ally.uuid && seen.has(ally.uuid)) return;
		if (ally.uuid) seen.add(ally.uuid);
		found.push(ally);
	};

	const tokens = origin?.parent?.tokens;
	if (origin && tokens) {
		for (const token of alliesWithin(origin, tokens, 0)) add(token.actor as WoundCreature | null);
	}
	for (const watcher of extra ?? []) add(watcher);
	return found;
}

/**
 * Rules of `type` on the creature, then the same rules on allies that watch
 * allies. A reach above 0 matches only when both tokens are on the scene and
 * within that many spaces. A reach of 0 matches every ally, including an ally
 * passed in `extra` when the scene has no tokens.
 */
export function rulesWatching<T extends WatchedRule>(
	actor: WoundCreature,
	type: string,
	extra?: readonly WoundCreature[],
): Watching<T>[] {
	const origin = findToken(actor);
	const found: { rule: T; holder: WoundCreature; index: number }[] = [];
	let index = 0;

	const consider = (holder: WoundCreature, alliesOnly: boolean) => {
		for (const rule of actorRules<T>(holder)) {
			if (!rule || rule.type !== type) continue;
			if (rule.appliesTo && !rule.appliesTo()) continue;
			const watch = rule.watch ?? 'self';
			if (alliesOnly) {
				if (watch !== 'allies') continue;
				if (!inReach(rule, holder, origin)) continue;
			} else if (watch === 'allies') {
				continue;
			}
			found.push({ rule, holder, index });
			index += 1;
		}
	};

	consider(actor, false);
	for (const ally of alliesOf(actor, extra, origin)) consider(ally, true);

	found.sort((a, b) => (a.rule.priority ?? 0) - (b.rule.priority ?? 0) || a.index - b.index);
	return found.map(({ rule, holder }) => ({ rule, holder }));
}
