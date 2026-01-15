import { mount } from 'svelte';

import NimbleAbilityCheckCard from '../view/chat/AbilityCheckCard.svelte';
import NimbleFeatureCard from '../view/chat/FeatureCard.svelte';
import NimbleFieldRestCard from '../view/chat/FieldRestCard.svelte';
import NimbleLevelUpSummaryCard from '../view/chat/LevelUpSummaryCard.svelte';
import NimbleObjectCard from '../view/chat/ObjectCard.svelte';
import NimbleSafeRestCard from '../view/chat/SafeRestCard.svelte';
import NimbleSavingThrowCard from '../view/chat/SavingThrowCard.svelte';
import NimbleSkillCheckCard from '../view/chat/SkillCheckCard.svelte';
import NimbleSpellCard from '../view/chat/SpellCard.svelte';

export default function renderChatMessageHTML(message, html) {
	let component:
		| typeof NimbleAbilityCheckCard
		| typeof NimbleObjectCard
		| typeof NimbleFeatureCard
		| typeof NimbleFieldRestCard
		| typeof NimbleSafeRestCard
		| typeof NimbleSavingThrowCard
		| typeof NimbleSkillCheckCard
		| typeof NimbleSpellCard
		| typeof NimbleLevelUpSummaryCard;
	const target = $(html)[0];

	if (!target) return;

	switch (message.type) {
		case 'abilityCheck':
			component = NimbleAbilityCheckCard;
			break;
		case 'feature':
			component = NimbleFeatureCard;
			break;
		case 'fieldRest':
			component = NimbleFieldRestCard;
			break;
		case 'object':
			component = NimbleObjectCard;
			break;
		case 'safeRest':
			component = NimbleSafeRestCard;
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
	$(html).find('.message-header')[0]?.remove();
	$(html).find('.message-content')[0]?.remove();

	message._svelteComponent = mount(component, {
		target,
		props: { messageDocument: message },
	});
}
