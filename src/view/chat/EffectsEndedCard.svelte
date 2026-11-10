<script lang="ts">
	import { type EndedEffectRow, undoEndedEffect } from '#utils/lastsUntil/endEffects.js';
	import localize from '#utils/localize.js';
	import CardHeader from './components/CardHeader.svelte';

	let { messageDocument } = $props();

	const system = $derived(messageDocument.reactive.system);
	const rows: EndedEffectRow[] = $derived(system.rows ?? []);

	let undone = $state<Record<string, boolean>>({});
	let busy = $state<Record<string, boolean>>({});

	function canUndo(row: EndedEffectRow): boolean {
		if (game.user?.isGM) return true;
		const holder = fromUuidSync(row.holderUuid as never, { strict: false }) as Actor | null;
		return !!holder?.isOwner;
	}

	async function undo(row: EndedEffectRow) {
		busy[row.effectId] = true;
		try {
			if (await undoEndedEffect(row)) undone[row.effectId] = true;
		} finally {
			busy[row.effectId] = false;
		}
	}
</script>

<CardHeader {messageDocument} />

<article class="nimble-chat-card__body nimble-effects-ended" data-card-type="effectsEnded">
	<h3 class="nimble-effects-ended__heading">{system.heading}</h3>

	<ul class="nimble-effects-ended__rows">
		{#each rows as row (row.effectId + row.holderUuid)}
			<li class="nimble-effects-ended__row">
				<img class="nimble-effects-ended__icon" src={row.img || 'icons/svg/aura.svg'} alt="" />

				<span class="nimble-effects-ended__text">
					<strong>
						{localize('NIMBLE.lastsUntil.chat.ended', { effect: row.name, name: row.holderName })}
					</strong>
					{#if row.sourceName}
						<small>{row.sourceName}</small>
					{/if}
				</span>

				{#if undone[row.effectId]}
					<span class="nimble-effects-ended__back">
						<i class="fa-solid fa-check" aria-hidden="true"></i>
						{localize('NIMBLE.lastsUntil.chat.backOn', { name: row.holderName })}
					</span>
				{:else if canUndo(row)}
					<button
						class="nimble-effects-ended__undo"
						type="button"
						disabled={busy[row.effectId]}
						onclick={() => undo(row)}
					>
						<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
						{localize('NIMBLE.lastsUntil.chat.undo')}
					</button>
				{/if}
			</li>
		{/each}
	</ul>
</article>

<style lang="scss">
	.nimble-effects-ended {
		&__heading {
			margin: 0;
			padding: 0.375rem 0.5rem 0.125rem;
			border: 0;
			font-size: var(--nimble-xs-text);
			font-weight: 700;
			letter-spacing: 0.02em;
			text-transform: uppercase;
			color: var(--nimble-card-text-color);
		}

		&__rows {
			display: flex;
			flex-direction: column;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__row {
			display: grid;
			grid-template-columns: auto 1fr auto;
			align-items: center;
			gap: 0.4375rem;
			padding: 0.375rem 0.5rem;

			& + & {
				border-top: 1px solid var(--nimble-card-border-color);
			}
		}

		&__icon {
			width: 1.5rem;
			height: 1.5rem;
			padding: 0.125rem;
			border: 0;
			border-radius: 3px;
			background: hsl(0, 0%, 13%);
		}

		&__text {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			min-width: 0;
			color: var(--nimble-card-text-color);

			small {
				font-size: var(--nimble-xs-text);
				opacity: 0.8;
			}
		}

		&__undo {
			display: inline-flex;
			flex: none;
			align-items: center;
			gap: 0.3125rem;
			width: auto;
			min-height: 1.5rem;
			padding: 0 0.5625rem;
			border: 1px solid var(--nimble-card-border-color);
			border-radius: 4px;
			background: transparent;
			color: var(--nimble-card-text-color);
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			white-space: nowrap;
			cursor: pointer;

			i {
				font-size: 0.625rem;
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-card-text-color);
				outline-offset: 1px;
			}
		}

		&__back {
			display: inline-flex;
			align-items: center;
			gap: 0.3125rem;
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-ui-action, hsl(139, 45%, 40%));
		}
	}
</style>
