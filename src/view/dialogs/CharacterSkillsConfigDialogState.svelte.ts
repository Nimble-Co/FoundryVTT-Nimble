import type { SkillHistoryEntry } from '#types/components/CharacterSkillsConfigDialog.d.ts';

interface SkillData {
	points: number;
	bonus: number;
	mod: number;
}

interface LevelUpHistoryEntry {
	level: number;
	skillIncreases: Record<string, number>;
}

interface SkillsDocument {
	reactive: {
		system: {
			skills: Record<string, SkillData>;
			levelUpHistory: LevelUpHistoryEntry[];
			abilities: Record<string, { baseValue: number; bonus: number; mod: number }>;
		};
		items: Array<{ type: string; system?: { abilityScoreData?: Record<string, unknown> } }>;
	};
	system: {
		skills: Record<string, SkillData>;
		levelUpHistory: LevelUpHistoryEntry[];
	};
	update(updates: Record<string, unknown>): Promise<void>;
}

function buildSkillHistory(
	levelUpHistory: LevelUpHistoryEntry[],
	currentSkills: Record<string, SkillData>,
	abilityScoreData: Record<string, unknown>,
	characterAbilities: Record<string, { baseValue: number; bonus: number; mod: number }>,
): SkillHistoryEntry[] {
	const { defaultSkillAbilities, skills } = CONFIG.NIMBLE;

	const asiByLevel: Record<number, string[]> = {};
	for (const [level, data] of Object.entries(abilityScoreData ?? {})) {
		const entry = data as { type?: string; value?: unknown };
		if (entry.type !== 'statIncrease') continue;
		const values = Array.isArray(entry.value)
			? entry.value
			: entry.value
				? String(entry.value).split(',').filter(Boolean)
				: [];
		if (values.length > 0) asiByLevel[Number(level)] = values;
	}

	function abilityModAtLevel(abilityKey: string, upToLevel: number): number {
		const ability = characterAbilities[abilityKey];
		if (!ability) return 0;
		const base = (ability.baseValue ?? 0) + 0;
		const asiCount = Object.entries(asiByLevel)
			.filter(([lvl]) => Number(lvl) <= upToLevel)
			.reduce((acc, [, abilities]) => acc + abilities.filter((a) => a === abilityKey).length, 0);
		return Math.min(base + asiCount, 12);
	}

	function skillModAtLevel(skillKey: string, skillPointsAtLevel: number, level: number): number {
		const skill = currentSkills[skillKey];
		const defaultAbility =
			(defaultSkillAbilities as Record<string, string>)[skillKey] ?? 'Strength';
		const abilityMod = abilityModAtLevel(defaultAbility, level);
		return Math.min(abilityMod + skillPointsAtLevel + (skill?.bonus ?? 0), 12);
	}

	const allLevelUpChanges: Record<string, number> = {};
	for (const entry of levelUpHistory) {
		for (const [skillKey, change] of Object.entries(entry.skillIncreases)) {
			allLevelUpChanges[skillKey] = (allLevelUpChanges[skillKey] ?? 0) + change;
		}
	}

	const runningPointTotals: Record<string, number> = {};
	const entries: SkillHistoryEntry[] = [];

	const hasLevel1Entry = levelUpHistory.some((e) => e.level === 1);
	if (!hasLevel1Entry) {
		const level1Changes = Object.entries(currentSkills)
			.filter(([skillKey, skillData]) => {
				const levelUpTotal = allLevelUpChanges[skillKey] ?? 0;
				return skillData.points - levelUpTotal > 0;
			})
			.sort(([keyA, dataA], [keyB, dataB]) => {
				const aLevel1 = dataA.points - (allLevelUpChanges[keyA] ?? 0);
				const bLevel1 = dataB.points - (allLevelUpChanges[keyB] ?? 0);
				return bLevel1 - aLevel1;
			})
			.map(([skillKey, skillData]) => {
				const level1Points = skillData.points - (allLevelUpChanges[skillKey] ?? 0);
				runningPointTotals[skillKey] = level1Points;
				return {
					skillKey,
					change: level1Points,
					total: skillModAtLevel(skillKey, level1Points, 1),
					name: (skills as Record<string, string>)[skillKey] ?? skillKey,
				};
			});

		if (level1Changes.length > 0) {
			entries.push({ level: 1, changes: level1Changes });
		}
	}

	const sortedHistory = [...levelUpHistory]
		.sort((a, b) => a.level - b.level)
		.filter((entry) => Object.values(entry.skillIncreases).some((c) => c !== 0));

	for (const entry of sortedHistory) {
		const changes = Object.entries(entry.skillIncreases)
			.filter(([, change]) => change !== 0)
			.sort(([, a], [, b]) => b - a)
			.map(([skillKey, change]) => {
				runningPointTotals[skillKey] = (runningPointTotals[skillKey] ?? 0) + change;
				return {
					skillKey,
					change,
					total: skillModAtLevel(skillKey, runningPointTotals[skillKey], entry.level),
					name: (skills as Record<string, string>)[skillKey] ?? skillKey,
				};
			});

		entries.push({ level: entry.level, changes });
	}

	return entries;
}

export function createCharacterSkillsConfigDialogState(getDocument: () => SkillsDocument) {
	const { defaultSkillAbilities, skills } = CONFIG.NIMBLE;

	const sortedSkillEntries = $derived(
		Object.entries(getDocument().reactive.system.skills).sort(([keyA], [keyB]) =>
			((skills as Record<string, string>)[keyA] ?? keyA).localeCompare(
				(skills as Record<string, string>)[keyB] ?? keyB,
			),
		),
	);

	const classItem = $derived(getDocument().reactive.items.find((item) => item.type === 'class'));

	const skillHistory = $derived(
		buildSkillHistory(
			getDocument().reactive.system.levelUpHistory,
			getDocument().reactive.system.skills,
			classItem?.system?.abilityScoreData ?? {},
			getDocument().reactive.system.abilities,
		),
	);

	let editingLevel: number | null = $state(null);
	let editingChanges: Record<string, number> = $state({});
	let editingBudget = $state(0);

	const remainingPoints = $derived(
		editingBudget - Object.values(editingChanges).reduce((sum, v) => sum + v, 0),
	);

	function getLevel1Changes(): Record<string, number> {
		const allLevelUpChanges: Record<string, number> = {};
		for (const entry of getDocument().reactive.system.levelUpHistory) {
			for (const [skillKey, change] of Object.entries(entry.skillIncreases)) {
				allLevelUpChanges[skillKey] = (allLevelUpChanges[skillKey] ?? 0) + change;
			}
		}
		const changes: Record<string, number> = {};
		for (const [skillKey, skillData] of Object.entries(getDocument().reactive.system.skills)) {
			const level1Points = skillData.points - (allLevelUpChanges[skillKey] ?? 0);
			if (level1Points > 0) changes[skillKey] = level1Points;
		}
		return changes;
	}

	function startEditing(level: number) {
		if (level === 1) {
			const changes = getLevel1Changes();
			editingBudget = Object.values(changes).reduce((sum, v) => sum + v, 0);
			editingChanges = changes;
		} else {
			const entry = getDocument().reactive.system.levelUpHistory.find((e) => e.level === level);
			const raw = entry?.skillIncreases ?? {};
			editingChanges = Object.fromEntries(Object.entries(raw).filter(([, v]) => v > 0));
			editingBudget = Object.values(editingChanges).reduce((sum, v) => sum + v, 0);
		}
		editingLevel = level;
	}

	function adjustChange(skillKey: string, delta: number) {
		const current = editingChanges[skillKey] ?? 0;
		const next = current + delta;
		if (next < 0) return;
		if (delta > 0 && remainingPoints <= 0) return;
		editingChanges[skillKey] = next;
	}

	function cancelEdit() {
		editingLevel = null;
		editingChanges = {};
		editingBudget = 0;
	}

	async function saveEdits() {
		if (remainingPoints !== 0) return;

		const updates: Record<string, unknown> = {};

		const oldChanges =
			editingLevel === 1
				? getLevel1Changes()
				: (getDocument().system.levelUpHistory.find((e) => e.level === editingLevel)
						?.skillIncreases ?? {});

		const allSkillKeys = new Set([...Object.keys(oldChanges), ...Object.keys(editingChanges)]);
		for (const skillKey of allSkillKeys) {
			const delta = (editingChanges[skillKey] ?? 0) - (oldChanges[skillKey] ?? 0);
			if (delta !== 0) {
				updates[`system.skills.${skillKey}.points`] =
					(getDocument().system.skills[skillKey]?.points ?? 0) + delta;
			}
		}

		if (editingLevel !== 1) {
			const cleanedChanges = Object.fromEntries(
				Object.entries(editingChanges).filter(([, v]) => v !== 0),
			);
			updates['system.levelUpHistory'] = getDocument().system.levelUpHistory.map((entry) =>
				entry.level === editingLevel ? { ...entry, skillIncreases: cleanedChanges } : entry,
			);
		}

		if (Object.keys(updates).length > 0) {
			await getDocument().update(updates);
		}

		editingLevel = null;
		editingChanges = {};
		editingBudget = 0;
	}

	return {
		defaultSkillAbilities: defaultSkillAbilities as Record<string, string>,
		skills: skills as Record<string, string>,
		get sortedSkillEntries() {
			return sortedSkillEntries;
		},
		get skillHistory() {
			return skillHistory;
		},
		get editingLevel() {
			return editingLevel;
		},
		get editingChanges() {
			return editingChanges;
		},
		get editingBudget() {
			return editingBudget;
		},
		get remainingPoints() {
			return remainingPoints;
		},
		startEditing,
		adjustChange,
		cancelEdit,
		saveEdits,
	};
}
