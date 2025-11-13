<script>
	import calculateHeaderTextColor from '../../dataPreparationHelpers/calculateHeaderTextColor.js';

	const { messageDocument } = $props();

	let messageAuthor = $derived(messageDocument.reactive.author);
	let headerBackgroundColor = $derived(messageAuthor.color);
	let headerTextColor = $derived(calculateHeaderTextColor(headerBackgroundColor));
</script>

<header
	class="nimble-chat-card__header"
	style="--nimble-user-background-color: {headerBackgroundColor}; --nimble-user-text-color: {headerTextColor};"
>
	<span>
		{messageDocument.reactive.system.actorName}
	</span>

	<time class="message-timestamp">
		{foundry.utils.timeSince(messageDocument.timestamp)}
	</time>

	<button
		aria-label="Delete"
		class="nimble-u-unstyled-button message-delete"
		onclick={() => messageDocument.delete()}
	>
		<i class="fas fa-trash"></i>
	</button>
</header>
