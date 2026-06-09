<script lang="ts">
	import { getContext } from 'svelte';
	import type { NimbleChatMessage } from '../../../documents/chatMessage.js';
	import localize from '../../../utils/localize.js';
	import { tokenHoverIn, tokenHoverOut } from '../../../utils/tokenHoverHighlight.js';

	function addSelectedTokensAsTargets() {
		messageDocument.addSelectedTokensAsTargets();
	}

	function addTargetedTokensAsTargets() {
		messageDocument.addTargetedTokensAsTargets();
	}

	function getArmorIcon(token: TokenDocument.Implementation) {
		const armor = (token.actor?.system as { attributes?: { armor?: string } } | undefined)
			?.attributes?.armor;
		if (!armor) return null;
		const armorIcon = npcArmorIcons[armor];

		if (armor !== 'heavy' && armor !== 'medium') return null;

		return `
		<i
            class="nimble-armor-icon ${armorIcon}"
            data-tooltip="${getArmorTooltip(armor)}"
            data-tooltip-class='nimble-tooltip nimble-tooltip--rules';
        >
		</i>
	`;
	}

	function getArmorTooltip(armor: string) {
		const armorEffect = npcArmorEffects[armor];
		const armorIcon = npcArmorIcons[armor];
		const armorLabel = npcArmorTypes[armor];

		return `
        <header class='nimble-tooltip__enricher-header'>
            <h3 class='nimble-tooltip__enricher-heading'>
                <i class='${armorIcon}'></i>
                ${armorLabel}
            </h3>
        </header>

        ${armorEffect}
    `;
	}

	async function prepareTargets(targetIDs: string[]): Promise<TokenDocument.Implementation[]> {
		const tokenDocuments = await Promise.all(
			targetIDs.map((id) => fromUuid(id as Parameters<typeof fromUuid>[0])),
		);
		return tokenDocuments.filter(Boolean) as unknown as TokenDocument.Implementation[];
	}

	function removeTarget(targetId: string) {
		messageDocument.removeTarget(targetId);
	}

	const { npcArmorEffects, npcArmorIcons, npcArmorTypes } = CONFIG.NIMBLE;

	let messageDocument = getContext('messageDocument') as NimbleChatMessage;
	let targets = $derived(
		(messageDocument?.reactive?.system as { targets?: string[] } | undefined)?.targets ?? [],
	);
</script>

<section class="nimble-card-section nimble-card-section--targets">
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">
			{localize('NIMBLE.chatTargets.targets')}
		</h3>

		<button
			class="nimble-button"
			data-button-variant="icon"
			aria-label={localize('NIMBLE.chatTargets.addSelectedTokensAsTargets')}
			data-tooltip="NIMBLE.chatTargets.addSelectedTokensAsTargets"
			type="button"
			onclick={addSelectedTokensAsTargets}
		>
			<i class="nimble-button__icon fa-solid fa-plus"></i>
		</button>

		<button
			class="nimble-button"
			data-button-variant="icon"
			aria-label={localize('NIMBLE.chatTargets.addTargetedTokensAsTargets')}
			data-tooltip="NIMBLE.chatTargets.addTargetedTokensAsTargets"
			type="button"
			onclick={addTargetedTokensAsTargets}
		>
			<i class="nimble-button__icon fa-solid fa-crosshairs"></i>
		</button>
	</header>

	<ul class="nimble-target-list">
		{#await prepareTargets(targets) then tokens}
			{#each tokens as token}
				<li
					class="nimble-card"
					onmouseenter={() => tokenHoverIn(token.object)}
					onmouseleave={() => tokenHoverOut(token.object)}
				>
					<img
						class="nimble-card__img"
						src={token.texture.src || 'icons/svg/mystery-man.svg'}
						alt={token?.actor?.name || token.name}
					/>

					<span class="nimble-card__title">
						{token?.actor?.name || token.name}
					</span>

					{#if token?.actor?.type !== 'character'}
						{@html getArmorIcon(token)}
					{/if}

					<button
						class="nimble-button"
						aria-label={localize('NIMBLE.chatTargets.removeTarget')}
						data-button-variant="icon"
						data-tooltip="NIMBLE.chatTargets.removeTarget"
						type="button"
						onclick={() => removeTarget(token.uuid)}
					>
						<i class="fa-solid fa-trash" style="translate: 0 2px;"></i>
					</button>
				</li>
			{:else}
				<li style="color: var(--nimble-medium-text-color);">
					{localize('NIMBLE.chatTargets.noTargetsSelected')}
				</li>
			{/each}
		{/await}
	</ul>
</section>

<style lang="scss">
	.nimble-button {
		grid-area: button;
		align-self: center;
		justify-self: center;
		pointer-events: all;

		&__icon {
			line-height: 0;
		}
	}

	.nimble-card-section {
		padding: var(--nimble-card-section-padding, 0);

		&--targets {
			--nimble-card-section-padding: 0.5rem;
		}

		&:not(:last-of-type) {
			border-bottom: 1px solid var(--nimble-card-border-color);
		}
	}

	.nimble-target-list {
		--nimble-button-padding: 0;

		--nimble-card-content-grid: 'img title armor button';
		--nimble-card-column-dimensions: 1.75rem 1fr 1rem 2rem;
		--nimble-card-row-dimensions: 1.75rem;

		--nimble-card-title-alignment: center;
		--nimble-card-title-justification: start;

		--nimble-card-image-height: 1.75rem;
		--nimble-card-image-width: 1.75rem;

		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		list-style: none;
		padding: 0;
		margin: 0;
	}
</style>
