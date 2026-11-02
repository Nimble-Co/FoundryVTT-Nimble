/**
 * DC for Assess action skill checks
 */
export const ASSESS_DC = 12;

/**
 * Configuration for Assess action options
 */
export interface AssessOption {
	id: string;
	icon: string;
	titleKey: string;
	chatTitleKey: string;
	descriptionKey: string;
	successKey: string;
	failureKey: string;
	requiresTarget: boolean;
}

/**
 * Available Assess action options
 */
export const assessOptions: AssessOption[] = [
	{
		id: 'ask-question',
		icon: 'fa-solid fa-circle-question',
		titleKey: 'NIMBLE.ui.heroicActions.assess.askQuestion.title',
		chatTitleKey: 'NIMBLE.ui.heroicActions.assess.askQuestion.chatTitle',
		descriptionKey: 'NIMBLE.ui.heroicActions.assess.askQuestion.description',
		successKey: 'NIMBLE.ui.heroicActions.assess.askQuestion.success',
		failureKey: 'NIMBLE.ui.heroicActions.assess.askQuestion.failure',
		requiresTarget: false,
	},
	{
		id: 'create-opening',
		icon: 'fa-solid fa-crosshairs',
		titleKey: 'NIMBLE.ui.heroicActions.assess.createOpening.title',
		chatTitleKey: 'NIMBLE.ui.heroicActions.assess.createOpening.chatTitle',
		descriptionKey: 'NIMBLE.ui.heroicActions.assess.createOpening.description',
		successKey: 'NIMBLE.ui.heroicActions.assess.createOpening.success',
		failureKey: 'NIMBLE.ui.heroicActions.assess.createOpening.failure',
		requiresTarget: true,
	},
	{
		id: 'anticipate-danger',
		icon: 'fa-solid fa-shield',
		titleKey: 'NIMBLE.ui.heroicActions.assess.anticipateDanger.title',
		chatTitleKey: 'NIMBLE.ui.heroicActions.assess.anticipateDanger.chatTitle',
		descriptionKey: 'NIMBLE.ui.heroicActions.assess.anticipateDanger.description',
		successKey: 'NIMBLE.ui.heroicActions.assess.anticipateDanger.success',
		failureKey: 'NIMBLE.ui.heroicActions.assess.anticipateDanger.failure',
		requiresTarget: false,
	},
];
