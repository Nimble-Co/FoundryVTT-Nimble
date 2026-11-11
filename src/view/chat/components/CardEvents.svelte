<script lang="ts">
	import type { CardEvent, EndedEffectRow } from '#types/cardEvent.d.ts';
	import type { CardEventsProps } from '#types/components/CardEvents.d.ts';
	import { cardEventsOf, cardEventText } from '#utils/chat/cardEvents.js';
	import { undoEndedEffect } from '#utils/lastsUntil/endEffects.js';
	import localize from '#utils/localize.js';

	let { messageDocument, labelled = true }: CardEventsProps = $props();

	// Bumped when an effect is made or deleted, so "On <name>" shows on every client.
	let effectsVersion = $state(0);
	let busy = $state<Record<string, boolean>>({});

	const events = $derived(cardEventsOf(messageDocument.reactive));
	const hasUndo = $derived(events.some((event) => event.action?.kind === 'undoEnd'));

	$effect(() => {
		if (!hasUndo) return;
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

	async function undo(event: CardEvent, row: EndedEffectRow) {
		busy[event.id] = true;
		try {
			await undoEndedEffect(row);
		} finally {
			busy[event.id] = false;
		}
	}
</script>

{#if events.length > 0}
	<section
		class="nimble-card-section nimble-card-events"
		class:nimble-card-events--labelled={labelled}
		aria-label={localize('NIMBLE.chat.events.label')}
	>
		{#if labelled}
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.chat.events.label')}
				</h3>
			</header>
		{/if}

		<ul class="nimble-card-events__lines">
			{#each events as event (event.id)}
				<li class="nimble-card-events__line" data-event-kind={event.kind}>
					<span class="nimble-card-events__plate" aria-hidden="true">
						{#if event.img}
							<img src={event.img} alt="" />
						{:else}
							<i class={event.icon ?? 'fa-solid fa-circle-info'}></i>
						{/if}
					</span>

					<span class="nimble-card-events__text">
						<strong>{cardEventText(event.text)}</strong>
						{#if event.cause}
							<small>{cardEventText(event.cause)}</small>
						{/if}
					</span>

					{#if event.action?.kind === 'undoEnd'}
						{@const row = event.action.row}
						{#if isBack(row)}
							<span class="nimble-card-events__back" role="status">
								<i class="fa-solid fa-check" aria-hidden="true"></i>
								{localize('NIMBLE.chat.events.backOn', { name: row.holderName })}
							</span>
						{:else if canUndo(row)}
							<button
								class="nimble-card-events__action"
								type="button"
								aria-label={localize('NIMBLE.chat.events.undoLabel', {
									effect: row.name,
									name: row.holderName,
								})}
								aria-busy={busy[event.id] ?? false}
								disabled={busy[event.id]}
								onclick={() => undo(event, row)}
							>
								<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
								{localize('NIMBLE.chat.events.undo')}
							</button>
						{/if}
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style lang="scss">
	.nimble-card-events {
		--nimble-header-margin-block-end: 0.125rem;

		// The sections before the strip draw their own border; other parts do not.
		&--labelled:first-of-type:not(:first-child) {
			border-top: 1px solid var(--nimble-card-border-color);
		}

		&__lines {
			display: flex;
			flex-direction: column;
			margin: 0;
			padding: 0;
			list-style: none;
		}

		&__line {
			display: grid;
			grid-template-columns: auto 1fr auto;
			align-items: center;
			gap: 0.4375rem;
			padding-block: 0.25rem;

			& + & {
				border-top: 1px solid var(--nimble-card-border-color);
			}
		}

		&__plate {
			display: grid;
			place-items: center;
			width: 1.375rem;
			height: 1.375rem;
			overflow: hidden;
			border-radius: 3px;
			background: var(--nimble-card-status-icon-plate);
			color: var(--nimble-card-status-icon-color);
			font-size: 0.625rem;

			img {
				width: 1.25rem;
				height: 1.25rem;
				border: 0;
			}
		}

		&__text {
			display: flex;
			flex-direction: column;
			gap: 0.0625rem;
			min-width: 0;
			line-height: 1.25;
			color: var(--nimble-card-text-color);
			font-size: var(--nimble-sm-text);

			small {
				font-size: var(--nimble-xs-text);
				opacity: 0.8;
			}
		}

		&__action {
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
