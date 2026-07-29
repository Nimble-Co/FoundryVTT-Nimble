<script lang="ts">
	import type {
		DamageModifierKind,
		NimbleChatMessage,
		TargetDamageBreakdown,
	} from '#documents/chatMessage.ts';

	import { getContext } from 'svelte';
	import localize from '../../../utils/localize.js';
	import { tokenHoverIn, tokenHoverOut } from '../../../utils/tokenHoverHighlight.js';

	const { npcArmorEffects, npcArmorIcons, npcArmorTypes } = CONFIG.NIMBLE;

	const badgeOrder: DamageModifierKind[] = ['immune', 'vulnerable', 'resistant', 'reduction'];
	const badgeLabels: Record<DamageModifierKind, string> = {
		immune: 'NIMBLE.damageModifiers.badgeImmune',
		vulnerable: 'NIMBLE.damageModifiers.badgeVulnerable',
		resistant: 'NIMBLE.damageModifiers.badgeResistant',
		reduction: 'NIMBLE.damageModifiers.badgeReduction',
	};

	function addSelectedTokensAsTargets() {
		messageDocument.addSelectedTokensAsTargets();
	}

	function addTargetedTokensAsTargets() {
		messageDocument.addTargetedTokensAsTargets();
	}

	function getArmorIcon(token: TokenDocument.Implementation) {
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

	async function prepareTargets(targetIDs: string[]) {
		const tokenDocuments = await Promise.all(targetIDs.map((id) => fromUuid(id)));
		return tokenDocuments.filter(Boolean);
	}

	function removeTarget(targetId: string) {
		messageDocument.removeTarget(targetId);
	}

	/**
	 * One badge per distinct reason this target takes different damage, in a
	 * fixed order so the row reads the same way every time. Each badge carries
	 * the full rule text of every modifier it stands for as its tooltip.
	 */
	function getDamageBadges(breakdown: TargetDamageBreakdown | null | undefined) {
		const modifiers = breakdown?.components.flatMap((component) => component.modifiers) ?? [];

		return badgeOrder
			.filter((kind) => modifiers.some((modifier) => modifier.kind === kind))
			.map((kind) => ({
				kind,
				abbreviation: localize(badgeLabels[kind]),
				tooltip: [
					...new Set(
						modifiers.filter((modifier) => modifier.kind === kind).map(({ label }) => label),
					),
				].join(', '),
			}));
	}

	/** Per damage type: what it resolved to, and what it rolled when they differ. */
	function getDamageTooltip(breakdown: TargetDamageBreakdown | null | undefined) {
		const components = breakdown?.components ?? [];
		if (components.length < 1) return localize('NIMBLE.chatTargets.damagePreview');

		return components
			.map(({ typeLabel, damageBeforeDefenses, adjustedDamage }) => {
				const unchanged = adjustedDamage === damageBeforeDefenses;
				const key = typeLabel
					? `NIMBLE.damageModifiers.${unchanged ? 'componentUnchanged' : 'component'}`
					: `NIMBLE.damageModifiers.${unchanged ? 'untypedComponentUnchanged' : 'untypedComponent'}`;

				return localize(key, {
					type: typeLabel ?? '',
					value: String(adjustedDamage),
					before: String(damageBeforeDefenses),
				});
			})
			.join(', ');
	}

	let messageDocument = getContext<NimbleChatMessage>('messageDocument');
	let targets = $derived(messageDocument?.reactive?.system?.targets ?? []);
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

	{#await prepareTargets(targets) then tokens}
		<ul class="nimble-target-list">
			{#each tokens as token}
				{@const breakdown =
					token && game.user?.isGM
						? messageDocument?.reactive?.getDamageBreakdownForTarget(token.uuid)
						: null}
				{@const damageBadges = getDamageBadges(breakdown)}
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
						<!-- Badges and the damage total win the row, so a long name ellipsizes
						     and carries the full text as a tooltip. -->
						<span class="nimble-target-name" data-tooltip={token?.actor?.name || token.name}>
							{token?.actor?.name || token.name}
						</span>
						{#if breakdown}
							<span class="nimble-target-damage" data-tooltip={getDamageTooltip(breakdown)}>
								({breakdown.total})
							</span>
						{/if}
					</span>

					{#if damageBadges.length > 0}
						<span class="nimble-target-badges">
							{#each damageBadges as badge (badge.kind)}
								<span
									class="nimble-target-badge"
									data-badge-kind={badge.kind}
									data-tooltip={badge.tooltip}
								>
									{badge.abbreviation}
								</span>
							{/each}
						</span>
					{/if}

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
		</ul>
	{/await}
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

	// Let a long target name ellipsize instead of pushing the damage total and
	// badges out of the row.
	.nimble-card__title {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.nimble-target-name {
		min-width: 3rem;
		overflow: hidden;
		white-space: nowrap;
		pointer-events: all;
		text-overflow: ellipsis;
	}

	.nimble-target-damage {
		flex: 0 0 auto;
		margin-left: 0.25rem;
		font-weight: 700;
		color: var(--color-level-error, #7a1e1e);
	}

	.nimble-target-badges {
		display: flex;
		grid-area: badges;
		align-self: center;
		gap: 0.125rem;
	}

	.nimble-target-badge {
		padding: 0 0.25rem;
		font-size: var(--nimble-xs-text);
		font-weight: 700;
		line-height: 1.4;
		letter-spacing: 0.04em;
		color: var(--nimble-damage-badge-color);
		pointer-events: all;
		background: var(--nimble-damage-badge-background-color);
		border-radius: 3px;

		&[data-badge-kind='immune'] {
			--nimble-damage-badge-color: var(--nimble-damage-badge-immune-color);
			--nimble-damage-badge-background-color: var(--nimble-damage-badge-immune-background-color);
		}

		&[data-badge-kind='vulnerable'] {
			--nimble-damage-badge-color: var(--nimble-damage-badge-vulnerable-color);
			--nimble-damage-badge-background-color: var(
				--nimble-damage-badge-vulnerable-background-color
			);
		}

		&[data-badge-kind='resistant'] {
			--nimble-damage-badge-color: var(--nimble-damage-badge-resistant-color);
			--nimble-damage-badge-background-color: var(--nimble-damage-badge-resistant-background-color);
		}

		&[data-badge-kind='reduction'] {
			--nimble-damage-badge-color: var(--nimble-damage-badge-reduction-color);
			--nimble-damage-badge-background-color: var(--nimble-damage-badge-reduction-background-color);
		}
	}

	.nimble-target-list {
		--nimble-button-padding: 0;

		--nimble-card-content-grid: 'img title badges armor button';
		--nimble-card-column-dimensions: 1.75rem 1fr auto 1rem 2rem;
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
