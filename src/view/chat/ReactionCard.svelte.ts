import localize from '../../utils/localize.js';
import calculateHeaderTextColor from '../dataPreparationHelpers/calculateHeaderTextColor.js';

interface ReactionConfig {
	icon: string;
	title: string;
	colorHue: number;
	showTargets: boolean;
	targetLabel: string | null;
}

export function createReactionCardState(getMessageDocument: () => unknown) {
	const system = $derived(
		(getMessageDocument() as { reactive: { system: unknown } }).reactive.system as Record<
			string,
			unknown
		>,
	);
	const headerBackgroundColor = $derived(
		(getMessageDocument() as { reactive: { author: { color: string } } }).reactive.author.color,
	);
	const headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));

	const reactionType = $derived(system.reactionType as string);
	const armorValue = $derived(system.armorValue as number | null);
	const weaponName = $derived(system.weaponName as string | null);
	const weaponDamage = $derived(system.weaponDamage as string | null);
	const actorName = $derived(system.actorName as string);

	const chatMessage = $derived.by(() => {
		switch (reactionType) {
			case 'defend':
				return localize('NIMBLE.ui.heroicActions.reactions.defend.chatMessage', {
					name: actorName,
					armor: armorValue ?? 0,
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
		headerBackgroundColor,
		headerTextColor,
		reactionType,
		armorValue,
		weaponName,
		weaponDamage,
		chatMessage,
		reactionConfig,
	};
}
