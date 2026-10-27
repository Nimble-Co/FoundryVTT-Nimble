import type { MeasurableTokenDocument } from '#types/movement.js';
import type { RerollGrant } from './incomingReactionEntry.js';
import { spacesBetween } from './movement/spacesBetween.js';
import { countsAsAlly, type ScannedToken } from './rerollAllies.js';

/** What one Modify Reroll rule gives creatures, its formulas already worked out. */
interface GrantModifier {
	label: string;
	actions: number;
	tempHp: number;
	/** Spaces from the owner's token; 0 is any distance. */
	tempHpWithin: number;
}

type ActionState = 'ok' | 'notInCombat' | 'notACharacter';

interface GrantActor {
	uuid: string;
	name?: string | null;
	system?: { attributes?: { hp?: { temp?: number } } };
}

interface RerollGrantsInput {
	modifiers: readonly GrantModifier[];
	rollerActor: GrantActor | null;
	rollerToken: ScannedToken | null;
	ownerActor: GrantActor | null;
	ownerToken: ScannedToken | null;
	actionState: (actor: GrantActor) => ActionState;
	featureEffects: boolean;
	measure?: (a: ScannedToken, b: ScannedToken) => number;
}

const measureOnGrid = (a: ScannedToken, b: ScannedToken) =>
	spacesBetween(a as unknown as MeasurableTokenDocument, b as unknown as MeasurableTokenDocument);

/** The creatures that gain temp HP: allies of the one who rolled near the owner, not the owner. */
function tempHpCreatures(
	input: RerollGrantsInput,
	within: number,
): Array<{ actor: GrantActor; token: ScannedToken }> {
	const { rollerToken, ownerToken, ownerActor } = input;
	const sceneTokens = ownerToken?.parent?.tokens;
	if (!rollerToken || !ownerToken || !sceneTokens) return [];
	const found = new Map<string, { actor: GrantActor; token: ScannedToken }>();
	for (const token of sceneTokens) {
		const actor = token.actor as GrantActor | null | undefined;
		if (!actor || token.hidden || actor.uuid === ownerActor?.uuid || found.has(actor.uuid))
			continue;
		const isRoller = token.uuid === rollerToken.uuid;
		if (!isRoller && !countsAsAlly(rollerToken, token)) continue;
		if (within > 0 && (input.measure ?? measureOnGrid)(ownerToken, token) > within) continue;
		found.set(actor.uuid, { actor, token });
	}
	return [...found.values()];
}

/**
 * What creatures get from one use of a reroll: temp HP for allies of the one
 * who rolled, near the reroll owner, and actions for the one who rolled. One
 * row per creature, the one who rolled first.
 */
function rerollGrants(input: RerollGrantsInput): RerollGrant[] {
	const rows = new Map<string, RerollGrant>();
	const rowOf = (actor: GrantActor) => {
		let row = rows.get(actor.uuid);
		if (!row) {
			row = {
				actorUuid: actor.uuid,
				name: actor.name ?? '',
				tempHp: null,
				actions: null,
				applied: input.featureEffects,
			};
			rows.set(actor.uuid, row);
		}
		return row;
	};

	const roller = input.rollerActor;
	if (roller) {
		for (const modifier of input.modifiers) {
			if (modifier.actions <= 0) continue;
			const state = input.actionState(roller);
			const row = rowOf(roller);
			const amount = state === 'ok' ? (row.actions?.amount ?? 0) + modifier.actions : 0;
			row.actions = {
				amount,
				reason: state === 'ok' ? null : state,
				source: modifier.label,
			};
		}
	}

	for (const modifier of input.modifiers) {
		if (modifier.tempHp <= 0) continue;
		for (const { actor } of tempHpCreatures(input, modifier.tempHpWithin)) {
			const row = rowOf(actor);
			if (row.tempHp && row.tempHp.amount >= modifier.tempHp) continue;
			const current = Number(actor.system?.attributes?.hp?.temp) || 0;
			row.tempHp = {
				amount: modifier.tempHp,
				keeps: current >= modifier.tempHp ? current : null,
				source: modifier.label,
			};
		}
	}

	const all = [...rows.values()];
	const rollerRow = roller ? all.filter((row) => row.actorUuid === roller.uuid) : [];
	return [...rollerRow, ...all.filter((row) => !rollerRow.includes(row))];
}

export { type ActionState, type GrantModifier, type RerollGrant, rerollGrants };
