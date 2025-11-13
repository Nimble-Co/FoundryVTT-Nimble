<script>
	import { getContext } from 'svelte';

	function addSelectedTokensAsTargets() {
		messageDocument.addSelectedTokensAsTargets();
	}

	function addTargetedTokensAsTargets() {
		messageDocument.addTargetedTokensAsTargets();
	}

	function getArmorIcon(token) {
		const armor = token.actor?.system?.attributes.armor;
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

	function getArmorTooltip(armor) {
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

	async function handleTokenHighlight(event, tokenDocument, mode) {
		event.preventDefault();

		const token = tokenDocument.object;

		if (!token || !token.isVisible || token.controlled) return;

		if (mode === 'enter') {
			token._onHoverIn(event, { hoverOutOthers: true });
		} else {
			token._onHoverOut(event);
		}
	}

	async function prepareTargets(targetIDs) {
		const tokenDocuments = await Promise.all(targetIDs.map((id) => fromUuid(id)));
		return tokenDocuments.filter(Boolean);
	}

	function removeTarget(targetId) {
		console.log('CLICKED!');
		messageDocument.removeTarget(targetId);
	}

	const { npcArmorEffects, npcArmorIcons, npcArmorTypes } = CONFIG.NIMBLE;

	let messageDocument = getContext('messageDocument');
	let { targets } = messageDocument.system;
</script>

<section class="nimble-card-section nimble-card-section--targets">
	<header class="nimble-section-header">
		<h3 class="nimble-heading" data-heading-variant="section">Targets</h3>

		<button
			class="nimble-button"
			data-button-variant="icon"
			aria-label="Add Selected Tokens as Targets"
			data-tooltip="Add Selected Tokens as Targets"
			type="button"
			onclick={addSelectedTokensAsTargets}
		>
			<i class="nimble-button__icon fa-solid fa-plus"></i>
		</button>

		<button
			class="nimble-button"
			data-button-variant="icon"
			aria-label="Add Targeted Tokens as Targets"
			data-tooltip="Add Targeted Tokens as Targets"
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
					onmouseenter={(event) => handleTokenHighlight(event, token, 'enter')}
					onmouseleave={(event) => handleTokenHighlight(event, token, 'leave')}
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
						aria-label="Remove Target"
						data-button-variant="icon"
						data-tooltip="Remove Target"
						type="button"
						onclick={() => removeTarget(token.uuid)}
					>
						<i class="fa-solid fa-trash" style="translate: 0 2px;"></i>
					</button>
				</li>
			{:else}
				<li style="color: var(--nimble-medium-text-color);">No targets selected</li>
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
