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
	mustAttackOther: 'icons/svg/daze.svg',
	vulnerableOnce: 'icons/svg/fire.svg',
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
	if (!change.combatId) return false;
	const combat = (game.combats as unknown as { get?(id: string): LiveCombat } | undefined)?.get?.(
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
	/** The roll spends a change that ignores negative effects. */
	ignoresNegative?: boolean;
}): HeldChange[] {
	if (input.area) return [];
	const own = heldChangesOn(input.attacker).filter((held) => held.appliesTo === 'holderAttacks');
	const onTarget = heldChangesOn(input.target).filter(
		(held) => held.appliesTo === 'attacksOnHolder',
	);
	return [...own, ...onTarget].filter(
		(held) => held.kind === 'primaryDie' && !(input.ignoresNegative && held.value < 0),
	);
}

/** The change that takes disadvantage out of the holder's next roll. */
export function ignoreDisadvantageChange(attacker: Holder | null | undefined): HeldChange | null {
	return (
		heldChangesOn(attacker).find(
			(held) => held.kind === 'ignoreDisadvantage' && held.appliesTo === 'holderAttacks',
		) ?? null
	);
}

/** The change that says who the holder's next attack must be against. It only reports. */
export function mustAttackOtherChange(attacker: Holder | null | undefined): HeldChange | null {
	return heldChangesOn(attacker).find((held) => held.kind === 'mustAttackOther') ?? null;
}

/** The one-use vulnerability of a creature to this damage type. */
export function heldVulnerabilityTo(
	holder: Holder | null | undefined,
	damageType: string | undefined,
): HeldChange | null {
	if (!damageType) return null;
	return (
		heldChangesOn(holder).find(
			(held) => held.kind === 'vulnerableOnce' && held.damageType === damageType,
		) ?? null
	);
}

/** The read-only lines of a roll window. */
export function heldLines(held: HeldChange[]) {
	return held.map((change) => ({
		key: `${change.holderUuid}.${change.effectId}`,
		text: localize(`NIMBLE.heldChange.line.${change.kind}`, {
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

function firstDamageNode(effects: unknown[] | undefined): AttackNodeLike | undefined {
	return (flattenEffectsTree((effects ?? []) as never) as AttackNodeLike[]).find(
		(node) => node.type === 'damage',
	);
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
export function heldLinesForItem(
	attacker: Holder | null | undefined,
	item: ActivatedItem,
	options: { ignoresDisadvantage?: boolean } = {},
) {
	const activation = item.system?.activation;
	const node = firstDamageNode(activation?.effects);
	const ended = keptAmountEndedBy(attacker, item);
	const mustAttack = node ? mustAttackOtherChange(attacker) : null;
	const endedLines = ended
		? [
				{
					key: ended.effectId,
					text: localize('NIMBLE.heldChange.line.wholeAmountEnds', {
						label: ended.label,
						value: String(ended.value),
					}),
					source: localize('NIMBLE.heldChange.line.endsSource', { source: ended.sourceName }),
				},
			]
		: [];
	const mustAttackLines = heldLines(mustAttack ? [mustAttack] : []);
	if (!activation || !isAttackRoll(activation.targets?.attackType, node)) {
		return [...mustAttackLines, ...endedLines];
	}
	const ignore = options.ignoresDisadvantage ? null : ignoreDisadvantageChange(attacker);
	return [
		...mustAttackLines,
		...endedLines,
		...heldLines([
			...(ignore ? [ignore] : []),
			...heldChangesForAttack({
				attacker,
				target: firstTargetActor(),
				area: !!activation.acquireTargetsFromTemplate && !!activation.template?.shape,
				ignoresNegative: !!ignore,
			}),
		]),
	];
}

/** The amount the holder keeps for its next attack. Any damage that can harm is an attack (C:452); an area does not use it. */
export function keptAmountFor(
	attacker: Holder | null | undefined,
	item: ActivatedItem,
): HeldChange | null {
	const activation = item.system?.activation;
	const node = firstDamageNode(activation?.effects);
	if (!activation || !node) return null;
	if (activation.acquireTargetsFromTemplate && activation.template?.shape) return null;
	return (
		heldChangesOn(attacker).find(
			(held) => held.kind === 'wholeAmount' && held.appliesTo === 'holderAttacks',
		) ?? null
	);
}

/** An area attack (C:1403) is the next attack: it rolls as normal, does not use the amount, and ends it. */
export function keptAmountEndedBy(
	attacker: Holder | null | undefined,
	item: ActivatedItem,
): HeldChange | null {
	const activation = item.system?.activation;
	if (!activation?.acquireTargetsFromTemplate || !activation.template?.shape) return null;
	if (!firstDamageNode(activation.effects)) return null;
	return (
		heldChangesOn(attacker).find(
			(held) => held.kind === 'wholeAmount' && held.appliesTo === 'holderAttacks',
		) ?? null
	);
}

interface DamageNodeLike extends AttackNodeLike {
	roll?: { total?: number } | null;
	damageMultiplier?: number;
}

/** The damage total a card shows: each rolled damage node and the spends folded in. */
export function cardDamageTotal(system: {
	activation?: { effects?: unknown[] };
	incomingReactions?: Array<{ used?: boolean; kind?: string; usedAmount?: number }>;
}): number {
	const nodes = flattenEffectsTree((system.activation?.effects ?? []) as never) as DamageNodeLike[];
	const rolled = nodes
		.filter((node) => node.type === 'damage')
		.reduce((sum, node) => sum + (Number(node.roll?.total) || 0) * (node.damageMultiplier ?? 1), 0);
	const folded = (system.incomingReactions ?? [])
		.filter((entry) => entry.kind === 'spendPoolForDamage' && entry.used)
		.reduce((sum, entry) => sum + (entry.usedAmount ?? 0), 0);
	return rolled + folded;
}

/** Holds the amount for the next attack of the holder. It ends with the turn. */
export async function keepAmount(holder: Holder, label: string, amount: number): Promise<void> {
	const combat = game.combat;
	await createHeldChange(holder, {
		kind: 'wholeAmount',
		value: amount,
		label,
		sourceName: label,
		appliesTo: 'holderAttacks',
		spentBy: 'oneRoll',
		ends: 'turn',
		combatId: combat?.started ? (combat.id ?? '') : '',
		round: combat?.round ?? 0,
		turn: combat?.turn ?? 0,
	});
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

async function deleteHeld(holder: Holder, effectId: string): Promise<void> {
	if (holder.isOwner) await deleteHere(holder, effectId);
	else await askGm({ action: 'delete', actorUuid: holder.uuid, effectId });
}

async function askGm(data: object): Promise<void> {
	const gm = (game.users as unknown as { activeGM?: QueryUser | null }).activeGM;
	if (!gm) {
		ui.notifications?.warn(localize('NIMBLE.chat.cardActionNeedsGm'));
		return;
	}
	await gm.query(QUERY_NAME, data);
}

/**
 * Puts a Held Change on a creature. A player without ownership asks the GM.
 * Outside combat nothing would end it, so nothing is held.
 */
export async function createHeldChange(holder: Holder, change: HeldChangeData): Promise<void> {
	if (!change.combatId) return;
	if (holder.isOwner) return createHere(holder, change);
	await askGm({ action: 'create', actorUuid: holder.uuid, change });
}

/** Removes what a roll spent. A change that stays for every roll is not spent. */
export async function spendHeldChanges(held: HeldChange[]): Promise<void> {
	for (const change of held) {
		if (change.spentBy !== 'oneRoll') continue;
		const holder = fromUuidSync(change.holderUuid as never) as unknown as Holder | null;
		if (!holder) continue;
		await deleteHeld(holder, change.effectId);
	}
}

/** Removes the changes that one card made on a creature, and says how many there were. */
export async function takeBackHeldChanges(
	holder: Holder,
	sourceMessageId: string,
): Promise<number> {
	const made = allHeldOn(holder).filter((held) => held.sourceMessageId === sourceMessageId);
	for (const change of made) await deleteHeld(holder, change.effectId);
	return made.length;
}

/** It lasts for the next action. An attack spends it at its roll; any other action spends it here. */
export async function spendHeldIgnoreDisadvantage(
	holder: Holder,
	usedItemName?: string | null,
): Promise<void> {
	const held = ignoreDisadvantageChange(holder);
	if (held && held.sourceName !== usedItemName) await spendHeldChanges([held]);
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
