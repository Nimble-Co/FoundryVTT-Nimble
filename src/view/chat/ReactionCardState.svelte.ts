import type { ReactionCardProps } from '../../../types/components/ReactionCard.d.ts';
import localize from '../../utils/localize.js';
import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';

export interface ReactionConfig {
	icon: string;
	title: string;
	colorHue: number;
	showTargets: boolean;
	targetLabel: string | null;
}

export interface ReactionSystemData {
	reactionType: string;
	armorValue: number | null;
	weaponName: string | null;
	weaponDamage: string | null;
	actorName: string;
}

export function createReactionCardState(
	getMessageDocument: () => ReactionCardProps['messageDocument'],
) {
	const system = $derived(getMessageDocument().reactive.system as unknown as ReactionSystemData);
	const headerBackgroundColor = $derived(getMessageDocument().reactive.author.color);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));

	const reactionType = $derived(system.reactionType);
	const armorValue = $derived(system.armorValue);
	const weaponName = $derived(system.weaponName);
	const weaponDamage = $derived(system.weaponDamage);
	const actorName = $derived(system.actorName);

	const chatMessage = $derived.by(() => {
		switch (reactionType) {
			case 'defend':
				return localize('NIMBLE.ui.heroicActions.reactions.defend.chatMessage', {
					name: actorName,
					armor: String(armorValue ?? 0),
				});
			case 'interpose':
				return localize('NIMBLE.ui.heroicActions.reactions.interpose.chatMessage', {
					name: actorName,
					target: 'an ally',
				});
			case 'opportunity':
				return localize('NIMBLE.ui.heroicActions.reactions.opportunity.chatMessage', {
					name: actorName,
					weapon: weaponName ?? 'a weapon',
				});
			case 'help':
				return localize('NIMBLE.ui.heroicActions.reactions.help.chatMessage', {
					name: actorName,
					target: 'an ally',
				});
			default:
				return null;
		}
	});

	const reactionConfig = $derived.by((): ReactionConfig => {
		switch (reactionType) {
			case 'defend':
				return {
					icon: 'fa-solid fa-shield',
					title: localize('NIMBLE.ui.heroicActions.reactions.defend.title'),
					colorHue: 210,
					showTargets: false,
					targetLabel: null,
				};
			case 'interpose':
				return {
					icon: 'fa-solid fa-people-arrows',
					title: localize('NIMBLE.ui.heroicActions.reactions.interpose.title'),
					colorHue: 270,
					showTargets: true,
					targetLabel: localize('NIMBLE.ui.heroicActions.reactions.interpose.protecting'),
				};
			case 'opportunity':
				return {
					icon: 'fa-solid fa-bullseye',
					title: localize('NIMBLE.ui.heroicActions.reactions.opportunity.title'),
					colorHue: 15,
					showTargets: true,
					targetLabel: localize('NIMBLE.chatTargets.targets'),
				};
			case 'help':
				return {
					icon: 'fa-solid fa-handshake-angle',
					title: localize('NIMBLE.ui.heroicActions.reactions.help.title'),
					colorHue: 145,
					showTargets: true,
					targetLabel: localize('NIMBLE.ui.heroicActions.reactions.help.helping'),
				};
			default:
				return {
					icon: 'fa-solid fa-bolt',
					title: 'Reaction',
					colorHue: 210,
					showTargets: false,
					targetLabel: null,
				};
		}
	});

	return {
		get headerBackgroundColor() {
			return headerBackgroundColor;
		},
		get headerTextColor() {
			return headerTextColor;
		},
		get reactionType() {
			return reactionType;
		},
		get armorValue() {
			return armorValue;
		},
		get weaponName() {
			return weaponName;
		},
		get weaponDamage() {
			return weaponDamage;
		},
		get chatMessage() {
			return chatMessage;
		},
		get reactionConfig() {
			return reactionConfig;
		},
	};
}
