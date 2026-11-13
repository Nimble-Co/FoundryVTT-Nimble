<script lang="ts">
	import type { CardEventsProps } from '#types/components/CardEvents.d.ts';

	import MoveNode from './MoveNode.svelte';
	import { cardEventText } from '#utils/chat/cardEvents.js';
	import localize from '#utils/localize.js';
	import { createCardEventsState } from './CardEvents.svelte.ts';

	let { messageDocument, labelled = true }: CardEventsProps = $props();

	const headingId = $props.id();
	const strip = createCardEventsState(() => messageDocument);
	const {
		isBusy,
		isBack,
		canUndo,
		undo,
		canRollSave,
		rollSave,
		canRule,
		rule,
		canChoose,
		choose,
		backStatus,
	} = strip;
</script>

{#if strip.events.length > 0}
	<section
		class="nimble-card-section nimble-card-events"
		class:nimble-card-events--labelled={labelled}
		aria-labelledby={labelled ? headingId : undefined}
		aria-label={labelled ? undefined : localize('NIMBLE.chat.events.label')}
	>
		{#if labelled}
			<header class="nimble-section-header">
				<h3 id={headingId} class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.chat.events.label')}
				</h3>
			</header>
		{/if}

		<ul class="nimble-card-events__lines">
			{#each strip.events as event (event.id)}
				<li class="nimble-card-events__line" data-event-kind={event.kind}>
					<span class="nimble-card-events__plate" aria-hidden="true">
						{#if event.img}
							<img src={event.img} alt="" />
						{:else}
							<i class={event.icon}></i>
						{/if}
					</span>

					<span class="nimble-card-events__text">
						<strong>{cardEventText(event.text)}</strong>
						{#if event.cause}
							<small class="nimble-card-events__cause">{cardEventText(event.cause)}</small>
						{/if}
					</span>

					{#if event.action?.kind === 'undoEnd'}
						{@const row = event.action.row}
						{#if isBack(row)}
							<span
								class="nimble-card-events__back"
								role="status"
								tabindex="-1"
								{@attach backStatus(event.id)}
							>
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
								aria-busy={isBusy(event.id)}
								aria-disabled={isBusy(event.id)}
								onclick={() => undo(event, row)}
							>
								<i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
								{localize('NIMBLE.chat.events.undo')}
							</button>
						{/if}
					{/if}

					{#if event.action?.kind === 'saveRequest'}
						{@const request = event.action}
						{@const save = localize(`NIMBLE.effectSheet.escape.saves.${request.save}`)}
						{#if request.state === 'kept'}
							<span class="nimble-card-events__back" role="status">
								<i class="fa-solid fa-check" aria-hidden="true"></i>
								{localize('NIMBLE.chat.saveRequest.keptBadge')}
							</span>
						{:else if canRollSave(request)}
							<button
								class="nimble-card-events__action"
								type="button"
								aria-label={localize('NIMBLE.chat.saveRequest.rollLabel', {
									save,
									name: request.holderName,
								})}
								aria-busy={isBusy(event.id)}
								aria-disabled={isBusy(event.id)}
								onclick={() => rollSave(event)}
							>
								<i class="fa-solid fa-dice-d20" aria-hidden="true"></i>
								{localize('NIMBLE.chat.saveRequest.roll')}
							</button>
						{:else}
							<span class="nimble-card-events__back">
								<i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>
								{localize('NIMBLE.chat.events.waitingFor', { name: request.holderName })}
							</span>
						{/if}
					{/if}

					{#if event.action?.kind === 'escapeRuling' && event.action.state === 'waiting'}
						{@const ruling = event.action}
						{#if canRule(ruling)}
							<button
								class="nimble-card-events__action"
								type="button"
								aria-label={localize('NIMBLE.escape.chat.escapesLabel', {
									name: ruling.holderName,
									effect: ruling.effectName,
								})}
								aria-busy={isBusy(event.id)}
								aria-disabled={isBusy(event.id)}
								onclick={() => rule(event)}
							>
								<i class="fa-solid fa-person-running" aria-hidden="true"></i>
								{localize('NIMBLE.escape.chat.escapes')}
							</button>
						{:else}
							<span class="nimble-card-events__back">
								<i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>
								{localize('NIMBLE.escape.chat.waiting')}
							</span>
						{/if}
					{/if}

					{#if event.action?.kind === 'tempHpChoice' && event.action.state === 'waiting'}
						{@const choice = event.action}
						{#if canChoose(choice)}
							<span class="nimble-card-events__choice">
								<button
									class="nimble-card-events__action"
									type="button"
									aria-label={localize('NIMBLE.chat.tempHpChoice.keepLabel', {
										name: choice.holderName,
										amount: String(choice.had),
									})}
									aria-busy={isBusy(event.id)}
									aria-disabled={isBusy(event.id)}
									onclick={() => choose(event, false)}
								>
									{localize('NIMBLE.chat.tempHpChoice.keep', { amount: String(choice.had) })}
								</button>
								<button
									class="nimble-card-events__action"
									type="button"
									aria-label={localize('NIMBLE.chat.tempHpChoice.takeLabel', {
										name: choice.holderName,
										amount: String(choice.amount),
									})}
									aria-busy={isBusy(event.id)}
									aria-disabled={isBusy(event.id)}
									onclick={() => choose(event, true)}
								>
									{localize('NIMBLE.chat.tempHpChoice.take', { amount: String(choice.amount) })}
								</button>
							</span>
						{:else}
							<span class="nimble-card-events__back">
								<i class="fa-solid fa-hourglass-half" aria-hidden="true"></i>
								{localize('NIMBLE.chat.events.waitingFor', { name: choice.holderName })}
							</span>
						{/if}
					{/if}

					{#if event.action?.kind === 'movementOffer'}
						<div class="nimble-card-events__move">
							<MoveNode node={event.action.node} card={messageDocument} allRows />
						</div>
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
		}

		&__cause {
			display: block;
			font-size: var(--nimble-xs-text);
			opacity: 0.8;

			&::first-letter {
				text-transform: uppercase;
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

			&[aria-disabled='true'] {
				cursor: progress;
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-card-text-color);
				outline-offset: 1px;
			}
		}

		&__move {
			grid-column: 1 / -1;
		}

		&__choice {
			display: inline-flex;
			gap: 0.25rem;
		}

		&__back {
			display: inline-flex;
			align-items: center;
			gap: 0.3125rem;
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-card-text-color);

			&:focus-visible {
				outline: 2px solid var(--nimble-card-text-color);
				outline-offset: 1px;
			}
		}
	}
</style>
