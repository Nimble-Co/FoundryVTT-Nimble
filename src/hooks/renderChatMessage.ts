import { mount } from 'svelte';

import NimbleAbilityCheckCard from '../view/chat/AbilityCheckCard.svelte';
import NimbleObjectCard from '../view/chat/ObjectCard.svelte';
import NimbleFeatureCard from '../view/chat/FeatureCard.svelte';
import NimbleSavingThrowCard from '../view/chat/SavingThrowCard.svelte';
import NimbleSkillCheckCard from '../view/chat/SkillCheckCard.svelte';
import NimbleSpellCard from '../view/chat/SpellCard.svelte';
import NimbleLevelUpSummaryCard from '../view/chat/LevelUpSummaryCard.svelte';

type SvelteComponent =
	| typeof NimbleAbilityCheckCard
	| typeof NimbleObjectCard
	| typeof NimbleFeatureCard
	| typeof NimbleSavingThrowCard
	| typeof NimbleSkillCheckCard
	| typeof NimbleSpellCard
	| typeof NimbleLevelUpSummaryCard;

export default function renderChatMessageHTML(
	message: ChatMessage & { type: string; _svelteComponent?: object },
	html: HTMLElement,
) {
	let component: SvelteComponent | undefined;
	const target = html;

	if (!target) return;

	switch (message.type) {
		case 'abilityCheck':
			component = NimbleAbilityCheckCard;
			break;
		case 'feature':
			component = NimbleFeatureCard;
			break;
		case 'object':
			component = NimbleObjectCard;
			break;
		case 'levelUpSummary':
			component = NimbleLevelUpSummaryCard;
			break;
		case 'savingThrow':
			component = NimbleSavingThrowCard;
			break;
		case 'skillCheck':
			component = NimbleSkillCheckCard;
			break;
		case 'spell':
			component = NimbleSpellCard;
			break;
		default:
			return;
	}

	target.classList.add('nimble-chat-card');
	target.querySelector('.message-header')?.remove();
	target.querySelector('.message-content')?.remove();

	message._svelteComponent = mount(component, {
		target,
		props: { messageDocument: message },
	});
}
