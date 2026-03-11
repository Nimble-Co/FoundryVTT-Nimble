import type { SkillKeyType } from '#types/skillKey.js';
import type { NimbleCharacter } from '../../../documents/actor/character.js';
import { ASSESS_DC, assessOptions } from '../../../utils/assessOptions.js';
import localize from '../../../utils/localize.js';
import { getInvalidTargets, getTargetedTokens, getTargetName } from '../../../utils/targeting.js';

export function createAssessPanelState(
	getActor: () => NimbleCharacter,
	getOnDeductAction: () => () => Promise<void>,
) {
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
		if (isSubmitDisabled || !selectedSkill) return;

		const option = assessOptions.find((o) => o.id === selectedOption);
		if (!option) return;

		// Roll the skill check (show the roll dialog)
		const { roll } = await getActor().rollSkillCheck(selectedSkill as SkillKeyType);

		if (!roll) return;

		// Deduct action pip only after roll is confirmed (not cancelled)
		await getOnDeductAction()();

		// Determine success/failure based on DC 12
		const isSuccess = (roll.total ?? 0) >= ASSESS_DC;
		const resultKey = isSuccess ? option.successKey : option.failureKey;

		// Include target name in the message if there's a target
		const targetName = selectedTarget ? getTargetName(selectedTarget) : null;
		const resultMessage = localize(resultKey, { name: getActor().name, target: targetName ?? '' });

		// Create chat message
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await ChatMessage.create({
			author: game.user?.id,
			speaker: ChatMessage.getSpeaker({ actor: getActor() }),
			sound: CONFIG.sounds.dice,
			rolls: [roll],
			type: 'assessAction',
			system: {
				actorName: getActor().name,
				actorType: getActor().type,
				permissions: getActor().permission,
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
