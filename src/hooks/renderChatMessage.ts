import { mount } from 'svelte';

import NimbleAbilityCheckCard from '../view/chat/AbilityCheckCard.svelte';
import NimbleFeatureCard from '../view/chat/FeatureCard.svelte';
import NimbleFieldRestCard from '../view/chat/FieldRestCard.svelte';
import NimbleLevelUpSummaryCard from '../view/chat/LevelUpSummaryCard.svelte';
import NimbleMinionGroupAttackCard from '../view/chat/MinionGroupAttackCard.svelte';
import NimbleObjectCard from '../view/chat/ObjectCard.svelte';
import NimbleSafeRestCard from '../view/chat/SafeRestCard.svelte';
import NimbleSavingThrowCard from '../view/chat/SavingThrowCard.svelte';
import NimbleSkillCheckCard from '../view/chat/SkillCheckCard.svelte';
import NimbleSpellCard from '../view/chat/SpellCard.svelte';

export default function renderChatMessageHTML(message, html) {
	const target = $(html)[0];
	if (!target) return;

	// Check if this is a whispered message the current user shouldn't see details of
	const whisperIds: string[] = message.whisper ?? [];
	const currentUserId = game.user?.id;
	const isHiddenFromUser =
		whisperIds.length > 0 && currentUserId && !whisperIds.includes(currentUserId);

	if (isHiddenFromUser) {
		// Show a "privately rolled" placeholder instead of the full content
		target.classList.add('nimble-chat-card', 'nimble-chat-card--hidden');
		$(html).find('.message-header')[0]?.remove();
		$(html).find('.message-content')[0]?.remove();

		const speakerName = message.speaker?.alias || message.author?.name || 'Someone';
		target.innerHTML = `
			<div class="nimble-hidden-roll">
				<div class="nimble-hidden-roll__header">${speakerName}</div>
				<div class="nimble-hidden-roll__message">${speakerName} privately rolled some dice</div>
				<div class="nimble-hidden-roll__result">???</div>
			</div>
		`;
		return;
	}

	let component:
		| typeof NimbleAbilityCheckCard
		| typeof NimbleObjectCard
		| typeof NimbleFeatureCard
		| typeof NimbleFieldRestCard
		| typeof NimbleSafeRestCard
		| typeof NimbleMinionGroupAttackCard
		| typeof NimbleSavingThrowCard
		| typeof NimbleSkillCheckCard
		| typeof NimbleSpellCard
		| typeof NimbleLevelUpSummaryCard;

	const nimbleChatCardType = (
		message as {
			flags?: {
				nimble?: { chatCardType?: string };
			};
		}
	).flags?.nimble?.chatCardType;

	if (message.type === 'base' && nimbleChatCardType === 'minionGroupAttack') {
		component = NimbleMinionGroupAttackCard;
	} else {
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
			case 'minionGroupAttack':
				component = NimbleMinionGroupAttackCard;
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
	}

	target.classList.add('nimble-chat-card');
	$(html).find('.message-header')[0]?.remove();
	$(html).find('.message-content')[0]?.remove();

	message._svelteComponent = mount(component, {
		target,
		props: { messageDocument: message },
	});
}
