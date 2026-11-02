import { SYSTEM_ID } from '#system';
import type { HeldChange, HeldChangeData } from '#types/heldChange.d.ts';
import localize from '#utils/localize.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';

const QUERY_NAME = `${SYSTEM_ID}.heldChange`;
const FLAG = 'heldChange';
const SHOW_ICON_ALWAYS = 2;

const ICONS: Record<HeldChangeData['kind'], string> = {
	primaryDie: 'icons/svg/target.svg',
	wholeAmount: 'icons/svg/sword.svg',
	ignoreDisadvantage: 'icons/svg/aura.svg',
};

interface HolderEffect {
	id?: string | null;
	flags?: Record<string, Record<string, unknown> | undefined>;
}

interface Holder {
	uuid?: string;
	isOwner?: boolean;
	effects?: Iterable<HolderEffect>;
	createEmbeddedDocuments?(type: string, data: object[]): Promise<unknown>;
	deleteEmbeddedDocuments?(type: string, ids: string[]): Promise<unknown>;
}

interface LiveCombat {
	started?: boolean;
	round?: number;
	turn?: number | null;
}

/** A change ends with its turn, round or combat, also if no GM was there to delete it. */
function isLive(change: HeldChangeData): boolean {
	if (!change.combatId) return true;
	const combat = (game.combats as unknown as Map<string, LiveCombat> | undefined)?.get(
		change.combatId,
	);
	if (!combat?.started) return false;
	if (change.ends === 'combat') return true;
	if (combat.round !== change.round) return false;
	return change.ends === 'round' || combat.turn === change.turn;
}

function allHeldOn(holder: Holder | null | undefined): HeldChange[] {
	const held: HeldChange[] = [];
	for (const effect of holder?.effects ?? []) {
		const change = effect.flags?.[SYSTEM_ID]?.[FLAG] as HeldChangeData | undefined;
		if (!change || !effect.id) continue;
		held.push({ ...change, effectId: effect.id, holderUuid: holder?.uuid ?? '' });
	}
	return held;
}

/** The live Held Changes on a creature. */
export function heldChangesOn(holder: Holder | null | undefined): HeldChange[] {
	return allHeldOn(holder).filter(isLive);
}

/**
 * The Primary Die changes one attack roll uses: the attacker's own, and those
 * on the target. An area roll has no Primary Die.
 */
export function heldChangesForAttack(input: {
	attacker: Holder | null | undefined;
	target: Holder | null | undefined;
	area: boolean;
}): HeldChange[] {
	if (input.area) return [];
	const own = heldChangesOn(input.attacker).filter((held) => held.appliesTo === 'holderAttacks');
	const onTarget = heldChangesOn(input.target).filter(
		(held) => held.appliesTo === 'attacksOnHolder',
	);
	return [...own, ...onTarget].filter((held) => held.kind === 'primaryDie');
}

/** The read-only lines of a roll window. */
export function heldLines(held: HeldChange[]) {
	return held.map((change) => ({
		key: `${change.holderUuid}.${change.effectId}`,
		text: localize('NIMBLE.heldChange.line.primaryDie', {
			label: change.label,
			value: change.value > 0 ? `+${change.value}` : String(change.value),
		}),
		source: localize(
			`NIMBLE.heldChange.line.${change.spentBy === 'oneRoll' ? 'spends' : 'stays'}`,
			{
				source: change.sourceName,
			},
		),
	}));
}

interface AttackNodeLike {
	type?: string;
	canCrit?: boolean;
	canMiss?: boolean;
}

/** A damage roll with an attack type or that can crit or miss is an attack roll. */
export function isAttackRoll(attackType: string | undefined, node: AttackNodeLike | undefined) {
	return Boolean(attackType || node?.canCrit || node?.canMiss);
}

interface ActivatedItem {
	system?: {
		activation?: {
			effects?: AttackNodeLike[];
			acquireTargetsFromTemplate?: boolean;
			template?: { shape?: string };
			targets?: { attackType?: string };
		};
	};
}

/** The lines for the roll window of an item, with what is targeted now. */
export function heldLinesForItem(attacker: Holder | null | undefined, item: ActivatedItem) {
	const activation = item.system?.activation;
	const node = flattenEffectsTree((activation?.effects ?? []) as never).find(
		(each) => (each as AttackNodeLike).type === 'damage',
	) as AttackNodeLike | undefined;
	if (!activation || !isAttackRoll(activation.targets?.attackType, node)) return [];
	return heldLines(
		heldChangesForAttack({
			attacker,
			target: firstTargetActor(),
			area: !!activation.acquireTargetsFromTemplate && !!activation.template?.shape,
		}),
	);
}

/** The first creature targeted. It decides what applies on a multi-target attack. */
export function firstTargetActor(): Holder | null {
	const [first] = Array.from(game.user?.targets ?? []) as unknown as Array<{ actor?: Holder }>;
	return first?.actor ?? null;
}

async function createHere(holder: Holder, change: HeldChangeData): Promise<void> {
	await holder.createEmbeddedDocuments?.('ActiveEffect', [
		{
			name: change.label,
			img: ICONS[change.kind],
			disabled: false,
			showIcon: SHOW_ICON_ALWAYS,
			flags: { [SYSTEM_ID]: { [FLAG]: change } },
		},
	]);
}

async function deleteHere(holder: Holder, effectId: string): Promise<void> {
	await holder.deleteEmbeddedDocuments?.('ActiveEffect', [effectId]);
}

interface QueryUser {
	query(name: string, data: object): Promise<unknown>;
}

async function askGm(data: object): Promise<void> {
	const gm = (game.users as unknown as { activeGM?: QueryUser | null }).activeGM;
	if (!gm) {
		ui.notifications?.warn(localize('NIMBLE.chat.cardActionNeedsGm'));
		return;
	}
	await gm.query(QUERY_NAME, data);
}

/** Puts a Held Change on a creature. A player without ownership asks the GM. */
export async function createHeldChange(holder: Holder, change: HeldChangeData): Promise<void> {
	if (holder.isOwner) return createHere(holder, change);
	await askGm({ action: 'create', actorUuid: holder.uuid, change });
}

/** Removes what a roll spent. A change that stays for every roll is not spent. */
export async function spendHeldChanges(held: HeldChange[]): Promise<void> {
	for (const change of held) {
		if (change.spentBy !== 'oneRoll') continue;
		const holder = fromUuidSync(change.holderUuid as never) as unknown as Holder | null;
		if (!holder) continue;
		if (holder.isOwner) await deleteHere(holder, change.effectId);
		else await askGm({ action: 'delete', actorUuid: change.holderUuid, effectId: change.effectId });
	}
}

/** Deletes each change whose time ended. */
export async function expireHeldChanges(holders: Iterable<Holder | null | undefined>) {
	for (const holder of holders) {
		const ended = allHeldOn(holder).filter((held) => !isLive(held));
		if (ended.length > 0) {
			await holder?.deleteEmbeddedDocuments?.(
				'ActiveEffect',
				ended.map((held) => held.effectId),
			);
		}
	}
}

export function registerHeldChangeQuery(): void {
	Hooks.once('init', () => {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<boolean>>;
		queries[QUERY_NAME] = async (data: {
			action: 'create' | 'delete';
			actorUuid: string;
			change?: HeldChangeData;
			effectId?: string;
		}) => {
			const holder = fromUuidSync(data.actorUuid as never) as unknown as Holder | null;
			if (!holder) return false;
			if (data.action === 'create' && data.change) await createHere(holder, data.change);
			if (data.action === 'delete' && data.effectId) await deleteHere(holder, data.effectId);
			return true;
		};
	});
}
