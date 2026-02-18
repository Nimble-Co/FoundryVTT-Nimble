import { isCombatantDead } from './isCombatantDead.js';

export const MINION_GROUP_FLAG_ROOT = 'flags.nimble.minionGroup';
export const MINION_GROUP_ID_PATH = `${MINION_GROUP_FLAG_ROOT}.id`;
export const MINION_GROUP_ROLE_PATH = `${MINION_GROUP_FLAG_ROOT}.role`;
export const MINION_GROUP_LABEL_PATH = `${MINION_GROUP_FLAG_ROOT}.label`;
export const MINION_GROUP_LABEL_INDEX_PATH = `${MINION_GROUP_FLAG_ROOT}.labelIndex`;
export const MINION_GROUP_MEMBER_NUMBER_PATH = `${MINION_GROUP_FLAG_ROOT}.memberNumber`;
export const MINION_GROUP_IDENTITY_COLOR_PALETTE = [
	'#3B82F6', // A - Blue
	'#F97316', // B - Orange
	'#8B5CF6', // C - Violet
	'#FACC15', // D - Yellow
	'#06B6D4', // E - Cyan
	'#D946EF', // F - Magenta
] as const;

export type MinionGroupRole = 'leader' | 'member';

interface MinionGroupFlagData {
	id?: unknown;
	role?: unknown;
	label?: unknown;
	labelIndex?: unknown;
	memberNumber?: unknown;
}

export interface MinionGroupSummary {
	id: string;
	members: Combatant.Implementation[];
	explicitLeader: Combatant.Implementation | null;
	aliveMembers: Combatant.Implementation[];
	deadMembers: Combatant.Implementation[];
	label: string | null;
	labelIndex: number | null;
}

function getMinionGroupFlagData(
	combatant: Combatant.Implementation | null | undefined,
): MinionGroupFlagData {
	if (!combatant) return {};

	const data = foundry.utils.getProperty(combatant, MINION_GROUP_FLAG_ROOT) as
		| MinionGroupFlagData
		| null
		| undefined;
	return data ?? {};
}

function getCombatantManualSortValue(combatant: Combatant.Implementation): number {
	return Number(foundry.utils.getProperty(combatant, 'system.sort') ?? 0);
}

function getCombatantInitiativeValue(combatant: Combatant.Implementation): number {
	return Number(combatant.initiative ?? Number.NEGATIVE_INFINITY);
}

function compareCombatantsForGroupResolution(
	a: Combatant.Implementation,
	b: Combatant.Implementation,
): number {
	const manualSortDiff = getCombatantManualSortValue(a) - getCombatantManualSortValue(b);
	if (manualSortDiff !== 0) return manualSortDiff;

	const initiativeDiff = getCombatantInitiativeValue(b) - getCombatantInitiativeValue(a);
	if (initiativeDiff !== 0) return initiativeDiff;

	return (a.name ?? '').localeCompare(b.name ?? '');
}

export function sortCombatantsForGroupResolution(
	combatants: Combatant.Implementation[],
): Combatant.Implementation[] {
	return [...combatants].sort(compareCombatantsForGroupResolution);
}

export function isMinionCombatant(
	combatant: Combatant.Implementation | null | undefined,
): combatant is Combatant.Implementation {
	const combatantType = combatant?.type as string | undefined;
	const actorType = combatant?.actor?.type as string | undefined;
	return Boolean(combatant && (actorType === 'minion' || combatantType === 'minion'));
}

export function getMinionGroupId(
	combatant: Combatant.Implementation | null | undefined,
): string | null {
	if (!isMinionCombatant(combatant)) return null;

	const { id } = getMinionGroupFlagData(combatant);
	return typeof id === 'string' && id.length > 0 ? id : null;
}

export function getMinionGroupRole(
	combatant: Combatant.Implementation | null | undefined,
): MinionGroupRole | null {
	if (!isMinionCombatant(combatant)) return null;

	const { role } = getMinionGroupFlagData(combatant);
	return role === 'leader' || role === 'member' ? role : null;
}

export function formatMinionGroupLabel(index: number): string {
	const normalized = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;

	let value = normalized;
	let label = '';
	do {
		const remainder = value % 26;
		label = String.fromCharCode(65 + remainder) + label;
		value = Math.floor(value / 26) - 1;
	} while (value >= 0);

	return label;
}

export function parseMinionGroupLabel(label: string | null | undefined): number | null {
	if (!label) return null;
	const normalized = label.trim().toUpperCase();
	if (!/^[A-Z]+$/.test(normalized)) return null;

	let value = 0;
	for (const char of normalized) {
		value = value * 26 + (char.charCodeAt(0) - 64);
	}

	return value - 1;
}

export function getMinionGroupLabel(
	combatant: Combatant.Implementation | null | undefined,
): string | null {
	if (!isMinionCombatant(combatant)) return null;

	const { label } = getMinionGroupFlagData(combatant);
	if (typeof label !== 'string') return null;
	const normalized = label.trim().toUpperCase();
	return /^[A-Z]+$/.test(normalized) ? normalized : null;
}

export function getMinionGroupIdentityColorByLabelIndex(
	labelIndex: number | null | undefined,
): string {
	const palette = MINION_GROUP_IDENTITY_COLOR_PALETTE;
	const normalizedIndex =
		typeof labelIndex === 'number' && Number.isFinite(labelIndex)
			? Math.max(0, Math.floor(labelIndex))
			: 0;
	return palette[normalizedIndex % palette.length];
}

export function getMinionGroupIdentityColorByLabel(label: string | null | undefined): string {
	const labelIndex = parseMinionGroupLabel(label);
	return getMinionGroupIdentityColorByLabelIndex(labelIndex);
}

export function getMinionGroupIdentityColorNumberByLabel(label: string | null | undefined): number {
	const hex = getMinionGroupIdentityColorByLabel(label);
	return Number.parseInt(hex.slice(1), 16);
}

export function getMinionGroupLabelIndex(
	combatant: Combatant.Implementation | null | undefined,
): number | null {
	if (!isMinionCombatant(combatant)) return null;

	const { labelIndex } = getMinionGroupFlagData(combatant);
	if (typeof labelIndex === 'number' && Number.isFinite(labelIndex) && labelIndex >= 0) {
		return Math.floor(labelIndex);
	}

	const label = getMinionGroupLabel(combatant);
	return parseMinionGroupLabel(label);
}

export function getMinionGroupMemberNumber(
	combatant: Combatant.Implementation | null | undefined,
): number | null {
	if (!isMinionCombatant(combatant)) return null;

	const { memberNumber } = getMinionGroupFlagData(combatant);
	const parsed = Number(memberNumber);
	if (!Number.isFinite(parsed) || parsed < 1) return null;

	return Math.floor(parsed);
}

export function isMinionGrouped(combatant: Combatant.Implementation | null | undefined): boolean {
	return getMinionGroupId(combatant) !== null;
}

export function isExplicitMinionGroupLeader(
	combatant: Combatant.Implementation | null | undefined,
): boolean {
	return getMinionGroupRole(combatant) === 'leader' && getMinionGroupId(combatant) !== null;
}

export function getMinionGroupSummaries(
	combatants: Combatant.Implementation[],
): Map<string, MinionGroupSummary> {
	const summaries = new Map<string, MinionGroupSummary>();

	for (const combatant of combatants) {
		const groupId = getMinionGroupId(combatant);
		if (!groupId) continue;

		let summary = summaries.get(groupId);
		if (!summary) {
			summary = {
				id: groupId,
				members: [],
				explicitLeader: null,
				aliveMembers: [],
				deadMembers: [],
				label: null,
				labelIndex: null,
			};
			summaries.set(groupId, summary);
		}

		summary.members.push(combatant);
	}

	for (const summary of summaries.values()) {
		const sortedMembers = sortCombatantsForGroupResolution(summary.members);
		const explicitLeaders = sortedMembers.filter((member) => isExplicitMinionGroupLeader(member));

		summary.members = sortedMembers;
		summary.explicitLeader = explicitLeaders[0] ?? null;
		summary.aliveMembers = sortedMembers.filter((member) => !isCombatantDead(member));
		summary.deadMembers = sortedMembers.filter((member) => isCombatantDead(member));

		const labelIndexFromMembers = sortedMembers
			.map((member) => getMinionGroupLabelIndex(member))
			.find((labelIndex): labelIndex is number => typeof labelIndex === 'number');
		const labelFromMembers = sortedMembers
			.map((member) => getMinionGroupLabel(member))
			.find((label): label is string => typeof label === 'string');

		summary.labelIndex =
			typeof labelIndexFromMembers === 'number'
				? labelIndexFromMembers
				: parseMinionGroupLabel(labelFromMembers);
		summary.label =
			typeof summary.labelIndex === 'number'
				? formatMinionGroupLabel(summary.labelIndex)
				: (labelFromMembers ?? null);
	}

	return summaries;
}

export function getEffectiveMinionGroupLeader(
	summary: MinionGroupSummary,
	options: { aliveOnly?: boolean } = {},
): Combatant.Implementation | null {
	const { aliveOnly = false } = options;
	const candidatePool = aliveOnly ? summary.aliveMembers : summary.members;
	if (candidatePool.length === 0) return null;

	if (
		summary.explicitLeader &&
		candidatePool.some((member) => member.id === summary.explicitLeader?.id)
	) {
		return summary.explicitLeader;
	}

	return candidatePool[0] ?? null;
}
