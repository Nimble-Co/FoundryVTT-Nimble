<script lang="ts">
	import DocumentLink from '../../components/DocumentLink.svelte';

	interface Props {
		alt?: string;
		fa?: boolean;
		heading: string;
		/** The document the heading names: the heading opens it for a user who may see it. */
		headingUuid?: string | null;
		image?: string;
		subheading?: string;
	}

	let { alt, fa, heading, headingUuid = null, subheading, image }: Props = $props();
</script>

<header class="nimble-chat-card__body-header">
	{#if image && fa}
		<i class="nimble-chat-card__image nimble-chat-card__image--fa-icon {image}"></i>
	{:else if image}
		<img class="nimble-chat-card__image" src={image} {alt} />
	{/if}

	<div class="nimble-chat-card__title-wrapper">
		<h3 class="nimble-chat-card__title">
			<DocumentLink link={{ name: heading, uuid: headingUuid }} />
		</h3>

		{#if subheading}
			<h4 class="nimble-chat-card__meta">{subheading}</h4>
		{/if}
	</div>
</header>
