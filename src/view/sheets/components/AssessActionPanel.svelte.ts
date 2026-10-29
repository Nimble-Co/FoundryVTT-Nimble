import type { SkillKeyType } from '#types/skillKey.js';
import type { NimbleCharacter } from '../../../documents/actor/character.js';
import { assessOptions } from '../../../utils/assessOptions.js';
import { runAssess } from '../../../utils/heroicActions/assess.js';
import {
	getInvalidTargets,
	getTargetedTokens,
	getTargetName,
} from '../../../utils/tokens/targeting.js';

export function createAssessPanelState(getActor: () => NimbleCharacter) {
	const { skills: skillNames } = CONFIG.NIMBLE;
	let selectedOption = $state<string | null>(null);
	let selectedSkill = $state<string | null>(null);
	let targetingVersion = $state(0);

	// ============================================================================
	// Derived Values
	// ============================================================================

	const currentOptionRequiresTarget = $derived(
		assessOptions.find((o) => o.id === selectedOption)?.requiresTarget ?? false,
	);

	const availableTargets = $derived.by(() => {
		void targetingVersion;
		return getTargetedTokens(getActor().id ?? '');
	});

	const hasTargetedSelf = $derived.by(() => {
		void targetingVersion;
		return getInvalidTargets(getActor().id ?? '').length > 0;
	});

	const selectedTarget = $derived.by(() => {
		if (currentOptionRequiresTarget && availableTargets.length === 1) {
			return availableTargets[0];
		}
		return null;
	});

	const sortedSkills = $derived(
		Object.entries(skillNames).sort(([, nameA], [, nameB]) =>
			(nameA as string).localeCompare(nameB as string),
		),
	);

	const isSubmitDisabled = $derived(
		!selectedOption ||
			!selectedSkill ||
			(currentOptionRequiresTarget && availableTargets.length !== 1),
	);

	// ============================================================================
	// Hook Setup
	// ============================================================================

	function setupTargetingHook(): () => void {
		const hookId = Hooks.on('targetToken', () => {
			targetingVersion++;
		});
		return () => Hooks.off('targetToken', hookId);
	}

	// ============================================================================
	// Event Handlers
	// ============================================================================

	async function handleRoll(): Promise<void> {
		if (isSubmitDisabled || !selectedOption || !selectedSkill) return;

		await runAssess(getActor(), {
			optionId: selectedOption,
			skillKey: selectedSkill as SkillKeyType,
		});
	}

	return {
		get selectedOption() {
			return selectedOption;
		},
		set selectedOption(value: string | null) {
			selectedOption = value;
		},
		get selectedSkill() {
			return selectedSkill;
		},
		set selectedSkill(value: string | null) {
			selectedSkill = value;
		},
		get currentOptionRequiresTarget() {
			return currentOptionRequiresTarget;
		},
		get availableTargets() {
			return availableTargets;
		},
		get hasTargetedSelf() {
			return hasTargetedSelf;
		},
		get selectedTarget() {
			return selectedTarget;
		},
		get sortedSkills() {
			return sortedSkills;
		},
		get isSubmitDisabled() {
			return isSubmitDisabled;
		},
		assessOptions,
		skillNames,
		getTargetName,
		setupTargetingHook,
		handleRoll,
	};
}
