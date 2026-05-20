import type {
	StatArrayOption,
	StatIncreaseEntry,
} from '#types/components/CharacterStatConfigDialog.d.ts';
import arraysAreEqual from '#utils/arraysAreEqual.ts';
import generateBlankAttributeSet from '#utils/generateBlankAttributeSet.ts';
import localize from '#utils/localize.ts';
import replaceHyphenWithMinusSign from '../dataPreparationHelpers/replaceHyphenWithMinusSign.js';

interface AbilityData {
	baseValue: number;
	value?: number;
	mod: number;
	bonus?: number;
}

interface ClassItem {
	type: string;
	_id: string;
	system?: {
		classLevel?: number;
		abilityScoreData?: Record<string, unknown>;
		keyAbilityScores?: string[];
		savingThrows?: { advantage: string | null; disadvantage: string | null };
	};
	identifier?: string;
	ASI?: Record<string, number>;
	totalASI?: Record<string, number>;
	rules?: Map<string, { type: string; disabled?: boolean; abilities?: string[]; value?: unknown }>;
	name?: string;
	id?: string;
	items?: unknown;
}

interface StatConfigDocument {
	reactive: {
		items: ClassItem[];
		system: { abilities: Record<string, AbilityData> };
	};
	system: { abilities: Record<string, AbilityData> };
	update(updates: Record<string, unknown>): Promise<void>;
	updateItem(itemId: string, updates: Record<string, unknown>): Promise<void>;
}

function prepareStatArrayOptions(): StatArrayOption[] {
	const { statArrayModifiers, statArrays } = CONFIG.NIMBLE;
	return Object.entries(statArrayModifiers as Record<string, number[]>).reduce(
		(arrays: StatArrayOption[], [key, array]) => {
			arrays.push({
				key,
				array,
				name: (statArrays as Record<string, string>)[key],
			});
			return arrays;
		},
		[],
	);
}

function checkBaseStatsMatchCoreArray(
	characterAbilityScores: Record<string, AbilityData>,
): boolean {
	const { statArrayModifiers } = CONFIG.NIMBLE;
	const baseScores = Object.values(characterAbilityScores).map(({ baseValue }) => baseValue);
	return Object.values(statArrayModifiers as Record<string, number[]>).some((standardArrayOption) =>
		arraysAreEqual(standardArrayOption, baseScores),
	);
}

function detectCurrentArrayAndAssignment(characterAbilityScores: Record<string, AbilityData>): {
	arrayKey: string;
	arrayOption: StatArrayOption;
	assignment: Record<string, number | null>;
} | null {
	const { abilityScores, statArrayModifiers } = CONFIG.NIMBLE;
	const abilityKeys = Object.keys(abilityScores as Record<string, string>);
	const baseScores = abilityKeys.map((key) => characterAbilityScores[key]?.baseValue ?? 0);
	const statArrayOptions = prepareStatArrayOptions();

	for (const [arrayKey, arrayValues] of Object.entries(
		statArrayModifiers as Record<string, number[]>,
	)) {
		const sortedBase = [...baseScores].sort((a, b) => b - a);
		const sortedArray = [...arrayValues].sort((a, b) => b - a);

		if (arraysAreEqual(sortedBase, sortedArray)) {
			const assignment: Record<string, number | null> = {};
			const usedIndices = new Set<number>();

			for (let i = 0; i < abilityKeys.length; i++) {
				const abilityKey = abilityKeys[i];
				const baseValue = baseScores[i];

				const matchingIndex = arrayValues.findIndex(
					(val, idx) => val === baseValue && !usedIndices.has(idx),
				);

				if (matchingIndex !== -1) {
					assignment[abilityKey] = matchingIndex;
					usedIndices.add(matchingIndex);
				} else {
					assignment[abilityKey] = null;
				}
			}

			return {
				arrayKey,
				arrayOption: statArrayOptions.find((opt) => opt.key === arrayKey)!,
				assignment,
			};
		}
	}

	return null;
}

function getAbilityBonusSources(actor: {
	items?: ClassItem[];
}): Record<string, Array<{ itemName: string; itemId: string; value: number }>> {
	const { abilityScores } = CONFIG.NIMBLE;
	const bonusSources = Object.keys(abilityScores as Record<string, string>).reduce(
		(acc: Record<string, Array<{ itemName: string; itemId: string; value: number }>>, key) => {
			acc[key] = [];
			return acc;
		},
		{},
	);

	if (!actor?.items) return bonusSources;

	for (const item of actor.items) {
		if (!item.rules) continue;

		for (const [, rule] of item.rules) {
			if (rule.type !== 'abilityBonus') continue;
			if (rule.disabled) continue;

			let abilities = rule.abilities ?? [];
			if (abilities.includes('all')) {
				abilities = Object.keys(abilityScores as Record<string, string>);
			}

			const value =
				typeof rule.value === 'string'
					? parseInt(rule.value, 10) || 0
					: ((rule.value as number) ?? 0);

			if (value === 0) continue;

			for (const ability of abilities) {
				if (bonusSources[ability]) {
					bonusSources[ability].push({
						itemName: item.name ?? '',
						itemId: item.id ?? '',
						value,
					});
				}
			}
		}
	}

	return bonusSources;
}

function prepareStatIncreases(
	statIncreaseData: Record<string, unknown>,
	currentClassLevel: number,
): StatIncreaseEntry[] {
	if (!statIncreaseData || currentClassLevel === 0) return [];

	const increases: StatIncreaseEntry[] = [];

	Object.entries(statIncreaseData).forEach(([level, data]) => {
		if (Number(level) > currentClassLevel) return;

		const { statIncreaseType, type, value } = data as {
			statIncreaseType?: string;
			type?: string;
			value?: unknown;
		};

		if (type === 'boon') {
			increases.push({
				level: Number(level),
				type: 'boon',
				statIncreaseType: null,
				value,
				label: `Level ${level}`,
			});
			return;
		}

		const selectedValues = Array.isArray(value)
			? value
			: value
				? (value as string).split(',').filter(Boolean)
				: [];

		increases.push({
			level: Number(level),
			type: 'statIncrease',
			statIncreaseType: statIncreaseType ?? null,
			selectedAbilities: selectedValues,
			label: `Level ${level}`,
		});
	});

	return increases.sort((a, b) => a.level - b.level);
}

export function formatModifier(value: number): string {
	return replaceHyphenWithMinusSign(
		new Intl.NumberFormat('en-US', {
			signDisplay: 'always',
		}).format(value),
	);
}

export function createCharacterStatConfigDialogState(getDocument: () => StatConfigDocument) {
	const { abilityScores, abilityScoreTooltips } = CONFIG.NIMBLE;
	const abilityScoreKeys = Object.keys(abilityScores as Record<string, string>);
	const abilityScoreLabels = Object.values(abilityScores as Record<string, string>);
	const abilityScoreCount = abilityScoreLabels.length;
	const statArrayOptions = prepareStatArrayOptions();

	let isEditing = $state(false);
	let selectedArray: StatArrayOption | null = $state(null);
	let tempSelectedAbilityScores: Record<string, number | null> = $state(
		generateBlankAttributeSet(),
	);

	const characterClass = $derived(
		getDocument().reactive.items.find((item) => item.type === 'class'),
	);

	const characterAbilityScores = $derived(getDocument().reactive.system.abilities);
	const keyAbilityScores = $derived(characterClass?.system?.keyAbilityScores ?? []);

	const savingThrowAdvantage = $derived(characterClass?.system?.savingThrows?.advantage ?? null);
	const savingThrowDisadvantage = $derived(
		characterClass?.system?.savingThrows?.disadvantage ?? null,
	);

	const detectedArrayInfo = $derived(detectCurrentArrayAndAssignment(characterAbilityScores));

	const allStatsSelected = $derived(
		Object.values(tempSelectedAbilityScores).every((value) => value !== null),
	);

	const baseStatsMatchCoreArray = $derived(checkBaseStatsMatchCoreArray(characterAbilityScores));

	const abilityBonusSources = $derived(
		getAbilityBonusSources(getDocument().reactive as { items: ClassItem[] }),
	);

	const abilityScoreIncreases = $derived.by(() => {
		const classItem = getDocument().reactive.items.find((item) => item.type === 'class');
		if (!classItem) return [];

		const classLevel = classItem.system?.classLevel ?? 0;
		const abilityScoreData = classItem.system?.abilityScoreData ?? {};

		return prepareStatIncreases(abilityScoreData as Record<string, unknown>, classLevel);
	});

	const classASI = $derived.by(() => {
		const classItem = getDocument().reactive.items.find((item) => item.type === 'class');
		return classItem?.ASI ?? {};
	});

	const allAssignedASI = $derived.by(() => {
		const classItem = getDocument().reactive.items.find((item) => item.type === 'class');
		return classItem?.totalASI ?? {};
	});

	const bonusTotals = $derived(
		abilityScoreKeys.reduce((acc: Record<string, number>, key) => {
			acc[key] = abilityBonusSources[key]?.reduce((sum, source) => sum + source.value, 0) ?? 0;
			return acc;
		}, {}),
	);

	const asiTotals = $derived(
		abilityScoreKeys.reduce((acc: Record<string, number>, key) => {
			acc[key] = (classASI as Record<string, number>)[key] ?? 0;
			return acc;
		}, {}),
	);

	function handleAbilityModifierDrop(event: DragEvent, abilityKey: string) {
		const modifierIndex = Number.parseInt(
			(event.dataTransfer as DataTransfer).getData('modifier'),
			10,
		);

		const existingModifier = Object.entries(tempSelectedAbilityScores).find(
			([, value]) => value === modifierIndex,
		);

		if (existingModifier) {
			const [previousKey] = existingModifier;
			tempSelectedAbilityScores[previousKey] = tempSelectedAbilityScores[abilityKey];
		}

		tempSelectedAbilityScores[abilityKey] = modifierIndex;
	}

	function selectArray(arrayOption: StatArrayOption) {
		selectedArray = arrayOption;
		tempSelectedAbilityScores = generateBlankAttributeSet();
	}

	function applyBaseScoreChanges() {
		if (!selectedArray) return;

		const updates: Record<string, unknown> = {};
		for (const [abilityKey, arrayIndex] of Object.entries(tempSelectedAbilityScores)) {
			if (arrayIndex !== null) {
				updates[`system.abilities.${abilityKey}.baseValue`] = selectedArray.array[arrayIndex];
			}
		}

		getDocument().update(updates);
		isEditing = false;
	}

	function cancelEditing() {
		const detected = detectCurrentArrayAndAssignment(characterAbilityScores);
		if (detected) {
			selectedArray = detected.arrayOption;
			tempSelectedAbilityScores = { ...detected.assignment };
		} else {
			selectedArray = null;
			tempSelectedAbilityScores = generateBlankAttributeSet();
		}
		isEditing = false;
	}

	function startEditing() {
		const detected = detectCurrentArrayAndAssignment(characterAbilityScores);
		if (detected) {
			selectedArray = detected.arrayOption;
			tempSelectedAbilityScores = { ...detected.assignment };
		} else {
			selectedArray = null;
			tempSelectedAbilityScores = generateBlankAttributeSet();
		}
		isEditing = true;
	}

	function isKeyAbility(abilityKey: string): boolean {
		return keyAbilityScores.includes(abilityKey);
	}

	function getSavingThrowStatus(abilityKey: string): 'advantage' | 'disadvantage' | null {
		if (abilityKey === savingThrowAdvantage) return 'advantage';
		if (abilityKey === savingThrowDisadvantage) return 'disadvantage';
		return null;
	}

	function toggleStatIncreaseOption(level: number, key: string) {
		const classItem = characterClass;
		if (!classItem) return;

		const currentData = (
			classItem.system?.abilityScoreData as Record<
				string,
				{ value?: unknown; statIncreaseType?: string }
			>
		)?.[level];
		if (!currentData) return;

		const { value, statIncreaseType } = currentData;

		const currentValues = Array.isArray(value)
			? value
			: value
				? (value as string).split(',').filter(Boolean)
				: [];

		const isSelected = currentValues.includes(key);
		const baseValue = characterAbilityScores[key]?.baseValue ?? 0;
		const asiCount = (allAssignedASI as Record<string, number>)[key] ?? 0;
		if (!isSelected && baseValue + asiCount >= 5) return;

		if (statIncreaseType === 'capstone') {
			let newValues: string[];

			if (currentValues.includes(key)) {
				newValues = currentValues.filter((k) => k !== key);
			} else if (currentValues.length < 2) {
				newValues = [...currentValues, key];
			} else {
				newValues = [currentValues[1], key];
			}

			return getDocument().updateItem(classItem._id, {
				[`system.abilityScoreData.${level}.value`]: newValues.join(','),
			});
		}

		return getDocument().updateItem(classItem._id, {
			[`system.abilityScoreData.${level}.value`]: key,
		});
	}

	function getStatIncreaseTypeLabel(type: string): string {
		const labels: Record<string, string> = {
			primary: localize('NIMBLE.statConfig.primary'),
			secondary: localize('NIMBLE.statConfig.secondary'),
			capstone: localize('NIMBLE.statConfig.capstone'),
		};
		return labels[type] ?? type;
	}

	function getStatIncreaseTypeTooltip(type: string): string {
		const tooltips: Record<string, string> = {
			primary: localize('NIMBLE.statConfig.primaryTooltip'),
			secondary: localize('NIMBLE.statConfig.secondaryTooltip'),
			capstone: localize('NIMBLE.statConfig.capstoneTooltip'),
		};
		return tooltips[type] ?? '';
	}

	return {
		abilityScores: abilityScores as Record<string, string>,
		abilityScoreTooltips: abilityScoreTooltips as Record<string, string>,
		abilityScoreKeys,
		abilityScoreLabels,
		abilityScoreCount,
		statArrayOptions,
		get isEditing() {
			return isEditing;
		},
		get selectedArray() {
			return selectedArray;
		},
		get tempSelectedAbilityScores() {
			return tempSelectedAbilityScores;
		},
		get characterClass() {
			return characterClass;
		},
		get characterAbilityScores() {
			return characterAbilityScores;
		},
		get keyAbilityScores() {
			return keyAbilityScores;
		},
		get detectedArrayInfo() {
			return detectedArrayInfo;
		},
		get allStatsSelected() {
			return allStatsSelected;
		},
		get baseStatsMatchCoreArray() {
			return baseStatsMatchCoreArray;
		},
		get abilityBonusSources() {
			return abilityBonusSources;
		},
		get abilityScoreIncreases() {
			return abilityScoreIncreases;
		},
		get allAssignedASI() {
			return allAssignedASI as Record<string, number>;
		},
		get bonusTotals() {
			return bonusTotals;
		},
		get asiTotals() {
			return asiTotals;
		},
		handleAbilityModifierDrop,
		selectArray,
		applyBaseScoreChanges,
		cancelEditing,
		startEditing,
		isKeyAbility,
		getSavingThrowStatus,
		toggleStatIncreaseOption,
		getStatIncreaseTypeLabel,
		getStatIncreaseTypeTooltip,
	};
}
