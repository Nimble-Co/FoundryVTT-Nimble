<script lang="ts">
	import type { ChatCardProps } from '#types/components/ChatCard.d.ts';
	import { type EndedEffectRow, undoEndedEffect } from '#utils/lastsUntil/endEffects.js';
	import localize from '#utils/localize.js';
	import CardHeader from './components/CardHeader.svelte';

	let { messageDocument }: ChatCardProps = $props();

	const system = $derived(
		(
			messageDocument.reactive as unknown as {
				system: { heading: string; rows?: EndedEffectRow[] };
			}
		).system,
	);
	const rows = $derived(system.rows ?? []);

	// Bumped when an effect is made or deleted, so "On <name>" shows on every client.
	let effectsVersion = $state(0);
	let busy = $state<Record<string, boolean>>({});

	$effect(() => {
		const bump = () => {
			effectsVersion += 1;
		};
		const ids = ['createActiveEffect', 'deleteActiveEffect'].map((hook) => ({
			hook,
			id: Hooks.on(hook as never, bump as never),
		}));
		return () => {
			for (const { hook, id } of ids) Hooks.off(hook as never, id);
		};
	});

	const keyOf = (row: EndedEffectRow) => `${row.holderUuid}.${row.effectId}`;

	function holderOf(row: EndedEffectRow): Actor | null {
		return fromUuidSync(row.holderUuid as never, { strict: false }) as Actor | null;
	}

	function isBack(row: EndedEffectRow): boolean {
		void effectsVersion;
		return !!holderOf(row)?.effects?.get(row.effectId);
	}

	function canUndo(row: EndedEffectRow): boolean {
		return !!game.user?.isGM || !!holderOf(row)?.isOwner;
	}

	async function undo(row: EndedEffectRow) {
		busy[keyOf(row)] = true;
		try {
			await undoEndedEffect(row);
		} finally {
			busy[keyOf(row)] = false;
		}
	}
</script>

<CardHeader {messageDocument} />

<article class="nimble-chat-card__body nimble-effects-ended" data-card-type="effectsEnded">
	<h3 class="nimble-effects-ended__heading">{system.heading}</h3>

	<ul class="nimble-effects-ended__rows">
		{#each rows as row (keyOf(row))}
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

				{#if isBack(row)}
					<span class="nimble-effects-ended__back" role="status">
						<i class="fa-solid fa-check" aria-hidden="true"></i>
						{localize('NIMBLE.lastsUntil.chat.backOn', { name: row.holderName })}
					</span>
				{:else if canUndo(row)}
					<button
						class="nimble-effects-ended__undo"
						type="button"
						aria-label={localize('NIMBLE.lastsUntil.chat.undoLabel', {
							effect: row.name,
							name: row.holderName,
						})}
						aria-busy={busy[keyOf(row)] ?? false}
						disabled={busy[keyOf(row)]}
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
			background: var(--nimble-card-status-icon-plate);
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
			color: var(--nimble-card-text-color);
		}
	}
</style>
