import type { SkillKeyType } from '#types/skillKey.js';
import type { NimbleCharacter } from '../../documents/actor/character.js';
import { ASSESS_DC, assessOptions } from '../../utils/assessOptions.js';
import localize from '../../utils/localize.js';
import { getInvalidTargets, getTargetedTokens, getTargetName } from '../../utils/targeting.js';

interface AssessDialogResult {
	option: string;
	skill: string;
	isSuccess: boolean;
	target?: string;
}

export function createAssessDialogState(
	getDocument: () => NimbleCharacter,
	dialog: { close: () => void; submit: (result: AssessDialogResult) => void },
	getDeductActionPip: () => () => Promise<void>,
	getInCombat: () => boolean,
) {
	const { skills: skillNames } = CONFIG.NIMBLE;
	let selectedOption = $state<string | null>(null);
	let selectedSkill = $state<string | null>(null);
	let selectedTarget = $state<Token | null>(null);
	let targetingVersion = $state(0);

	// ============================================================================
	// Derived Values
	// ============================================================================

	const currentOptionRequiresTarget = $derived(
		assessOptions.find((o) => o.id === selectedOption)?.requiresTarget ?? false,
	);

	const availableTargets = $derived.by(() => {
		void targetingVersion;
		return getTargetedTokens(getDocument().id ?? '');
	});

	const hasTargetedSelf = $derived.by(() => {
		void targetingVersion;
		return getInvalidTargets(getDocument().id ?? '').length > 0;
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
	// Effects - must be called in component
	// ============================================================================

	function setupTargetingHook(onUpdate: () => void): () => void {
		const hookId = Hooks.on('targetToken', () => {
			targetingVersion++;
			onUpdate();
		});
		return () => Hooks.off('targetToken', hookId);
	}

	function updateSelectedTarget(): void {
		if (currentOptionRequiresTarget && availableTargets.length === 1) {
			selectedTarget = availableTargets[0];
		} else if (currentOptionRequiresTarget && availableTargets.length !== 1) {
			selectedTarget = null;
		}

		if (!currentOptionRequiresTarget) {
			selectedTarget = null;
		}
	}

	// ============================================================================
	// Event Handlers
	// ============================================================================

	async function handleSubmit(): Promise<void> {
		if (!selectedOption || !selectedSkill) return;

		const option = assessOptions.find((o) => o.id === selectedOption);
		if (!option) return;

		if (option.requiresTarget && !selectedTarget) return;

		const { roll } = await getDocument().rollSkillCheck(selectedSkill as SkillKeyType, {
			skipRollDialog: true,
		});

		if (!roll) {
			dialog.close();
			return;
		}

		// Deduct action pip only after roll is confirmed (not cancelled)
		if (getInCombat()) {
			await getDeductActionPip()();
		}

		const isSuccess = (roll.total ?? 0) >= ASSESS_DC;
		const resultKey = isSuccess ? option.successKey : option.failureKey;
		const targetName = selectedTarget ? getTargetName(selectedTarget) : null;
		const resultMessage = localize(resultKey, {
			name: getDocument().name,
			target: targetName ?? '',
		});

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await ChatMessage.create({
			author: game.user?.id,
			speaker: ChatMessage.getSpeaker({ actor: getDocument() }),
			sound: CONFIG.sounds.dice,
			rolls: [roll],
			type: 'assessAction',
			system: {
				actorName: getDocument().name,
				actorType: getDocument().type,
				permissions: getDocument().permission,
				rollMode: 0,
				skillKey: selectedSkill,
				dc: ASSESS_DC,
				isSuccess,
				optionTitle: localize(option.chatTitleKey),
				resultMessage,
				target: selectedTarget ? selectedTarget.document.uuid : null,
				targetName,
			},
		} as any);

		dialog.submit({
			option: selectedOption,
			skill: selectedSkill,
			isSuccess,
			target: selectedTarget?.document.uuid,
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
		get selectedTarget() {
			return selectedTarget;
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
		updateSelectedTarget,
		handleSubmit,
	};
}
