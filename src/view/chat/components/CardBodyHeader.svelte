<script lang="ts">
	interface Props {
		alt?: string;
		fa?: boolean;
		heading: string;
		image?: string;
		subheading?: string;
	}

	let { alt, fa, heading, subheading, image }: Props = $props();
</script>

<header class="nimble-chat-card__body-header">
	{#if image && fa}
		<i class="nimble-chat-card__image nimble-chat-card__image--fa-icon {image}"></i>
	{:else if image}
		<img class="nimble-chat-card__image" src={image} {alt} />
	{/if}

	<div class="nimble-chat-card__title-wrapper">
		<h3 class="nimble-chat-card__title">{heading}</h3>

		{#if subheading}
			<h4 class="nimble-chat-card__meta">{subheading}</h4>
		{/if}
	</div>
</header>
