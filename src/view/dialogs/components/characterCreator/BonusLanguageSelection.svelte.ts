import type {
	AbilityScoreAssignment,
	GrantedLanguage,
	StatArrayOption,
} from '../../characterCreation/types.js';

// `TagGroupOption` is a global ambient type (types/tagGroupOption.d.ts).

interface BonusLanguageSelectionStateParams {
	getBonusLanguages: () => string[];
	setBonusLanguages: (languages: string[]) => void;
	getBonusLanguageOptions: () => TagGroupOption[];
	getGrantedLanguages: () => GrantedLanguage[];
	getSelectedAbilityScores: () => AbilityScoreAssignment;
	getSelectedArray: () => StatArrayOption | null;
	/** Smooth-scrolls the languages stage back into view after a selection change. */
	scrollToLanguagesStage: () => void;
}

/**
 * Reactive state for the bonus-language step: tracks the in-progress selection,
 * derives the Intelligence-driven pick budget, and exposes the toggle/lock-in
 * actions. Lives in `.svelte.ts` because it uses runes; called once during
 * component init.
 */
export function createBonusLanguageSelectionState(params: BonusLanguageSelectionStateParams) {
	const {
		getBonusLanguages,
		setBonusLanguages,
		getBonusLanguageOptions,
		getGrantedLanguages,
		getSelectedAbilityScores,
		getSelectedArray,
		scrollToLanguagesStage,
	} = params;

	let tempBonusLanguages = $state<string[]>([]);

	const hasUnassignedAbilityScores = $derived(
		Object.values(getSelectedAbilityScores()).some((mod) => mod === null),
	);

	const intelligenceModifier = $derived.by(() => {
		const index = getSelectedAbilityScores().intelligence;
		if (index == null) return 0;
		return getSelectedArray()?.array?.[index] ?? 0;
	});

	const remainingLanguagePicks = $derived(intelligenceModifier - getBonusLanguages().length);

	const remainingTempLanguagePicks = $derived(intelligenceModifier - tempBonusLanguages.length);

	const selectableOptions = $derived.by(() => {
		const grantedKeys = getGrantedLanguages().map((language) => language.key);
		return getBonusLanguageOptions().filter(
			(option) => !grantedKeys.includes(option.value as string),
		);
	});

	function toggleBonusLanguages(selection: string | number): void {
		const value = String(selection);
		const index = tempBonusLanguages.indexOf(value);

		if (index === -1) {
			if (remainingLanguagePicks > 0) tempBonusLanguages.push(value);
		} else {
			tempBonusLanguages.splice(index, 1);
		}

		scrollToLanguagesStage();
	}

	function lockInBonusLanguages(): void {
		setBonusLanguages([...tempBonusLanguages]);
	}

	// Reset the in-progress selection if Intelligence drops below the count, but
	// only once ability scores are fully assigned (not mid-drag).
	$effect(() => {
		if (hasUnassignedAbilityScores) return;
		if (tempBonusLanguages.length > 0 && intelligenceModifier < tempBonusLanguages.length) {
			tempBonusLanguages = [];
		}
	});

	return {
		get hasUnassignedAbilityScores() {
			return hasUnassignedAbilityScores;
		},
		get intelligenceModifier() {
			return intelligenceModifier;
		},
		get remainingLanguagePicks() {
			return remainingLanguagePicks;
		},
		get remainingTempLanguagePicks() {
			return remainingTempLanguagePicks;
		},
		get tempBonusLanguages() {
			return tempBonusLanguages;
		},
		get selectableOptions() {
			return selectableOptions;
		},
		toggleBonusLanguages,
		lockInBonusLanguages,
	};
}
