<script lang="ts">
	import type { ChangeThisRollProps } from '#types/components/ChangeThisRoll.d.ts';

	import localize from '#utils/localize.js';
	import RollUsePicker from './RollUsePicker.svelte';

	let {
		control,
		groups,
		picking,
		busy,
		primaryOutcome,
		primaryDieBonuses,
		text,
	}: ChangeThisRollProps = $props();

	const listId = $props.id();
</script>

{#if control.count > 0}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="nimble-change-roll" onkeydown={control.onKeydown}>
		<button
			bind:this={control.elements.toggle}
			class="nimble-change-roll__button"
			type="button"
			aria-expanded={control.open}
			aria-controls={control.open ? listId : undefined}
			onclick={control.toggle}
		>
			<span>{localize('NIMBLE.chat.incomingReactions.changeThisRoll.label')}</span>
			{#if !control.open}
				<span class="nimble-change-roll__count">
					{localize('NIMBLE.chat.incomingReactions.changeThisRoll.count', {
						count: String(control.count),
					})}
				</span>
			{/if}
			<i class="fa-solid {control.open ? 'fa-angle-up' : 'fa-angle-down'}" aria-hidden="true"></i>
		</button>

		{#if control.open}
			<div
				bind:this={control.elements.list}
				id={listId}
				class="nimble-change-roll__rows"
				role="group"
				aria-label={localize('NIMBLE.chat.incomingReactions.changeThisRoll.label')}
			>
				{#each groups as group (group.actorUuid)}
					<div
						class="nimble-change-roll__rows"
						role={group.name ? 'group' : undefined}
						aria-label={group.name || undefined}
					>
						{#if group.name}
							<p class="nimble-change-roll__actor" aria-hidden="true">{group.name}</p>
						{/if}

						{#each group.entries as entry (entry.id)}
							{@const row = text.row(entry)}
							{@const pickingHere = picking?.entry.id === entry.id ? picking : null}
							<button
								class="nimble-change-roll__row"
								type="button"
								data-entry-id={entry.id}
								aria-label={row.sentence}
								aria-expanded={pickingHere ? true : undefined}
								disabled={busy || !!picking?.rolling}
								onclick={() => control.useEntry(entry)}
							>
								<span class="nimble-change-roll__words">
									<span class="nimble-change-roll__verb">{row.verb}</span>
									{#if row.withFeature}
										<span class="nimble-change-roll__feature">{row.withFeature}</span>
									{/if}
									{#if row.note}
										<span class="nimble-change-roll__note">{row.note}</span>
									{/if}
								</span>
								{#if row.cost}
									<span class="nimble-change-roll__cost">{row.cost}</span>
								{/if}
							</button>

							{#if pickingHere}
								<RollUsePicker
									picking={pickingHere}
									feature={text.featureName(entry) || entry.label}
									{primaryOutcome}
									{primaryDieBonuses}
									onpick={control.pickDie}
									onvalue={control.pickValue}
									oncancel={control.cancelPick}
								/>
							{/if}
						{/each}
					</div>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style lang="scss">
	.nimble-change-roll {
		display: flex;
		flex-direction: column;
		gap: 0.1875rem;
		margin-top: 0.125rem;

		&__button,
		&__row {
			width: 100%;
			height: auto;
			min-height: 28px;
			margin: 0;
			font-family: var(--nimble-primary-font);
			line-height: 1.2;
			color: inherit;
			background: transparent;
			border: 1px solid var(--nimble-input-border-color);
			border-radius: 3px;
			box-shadow: none;
			cursor: pointer;

			&:hover:not(:disabled) {
				color: inherit;
				background: var(--nimble-card-border-color);
			}

			&:focus-visible {
				outline: 2px solid var(--nimble-dark-text-color);
				outline-offset: 1px;
			}

			&:disabled {
				cursor: default;
				opacity: 0.6;
			}
		}

		&__button {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 0.375em;
			padding: 0.1875rem 0.5rem;
			font-size: var(--nimble-sm-text);
			font-weight: 800;

			&[aria-expanded='true'],
			&[aria-expanded='true']:hover:not(:disabled) {
				color: var(--nimble-navigation-active-text-color);
				background: var(--nimble-crimson);
				border-color: var(--nimble-crimson);
			}
		}

		&__count {
			font-weight: 600;
			color: var(--nimble-medium-text-color);
		}

		// The medium colour is under 4.5:1 on the hover fill in the light theme.
		&__button:hover &__count,
		&__row:hover:not(:disabled) &__feature,
		&__row:hover:not(:disabled) &__note,
		&__row:hover:not(:disabled) &__cost {
			color: inherit;
		}

		&__rows {
			display: flex;
			flex-direction: column;
			gap: 0.1875rem;
			scroll-margin-block-end: var(--nimble-chat-scroll-clearance);
		}

		&__actor {
			margin: 0.125rem 0 0;
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			color: var(--nimble-medium-text-color);
		}

		&__row {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: center;
			gap: 0.5rem;
			padding: 0.1875rem 0.5rem;
			text-align: left;
		}

		&__words {
			min-width: 0;
		}

		&__verb {
			font-size: var(--nimble-sm-text);
			font-weight: 800;
		}

		&__feature {
			margin-left: 0.25em;
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
		}

		&__note {
			display: block;
			margin-top: 0.125rem;
			font-size: var(--nimble-xs-text);
			font-weight: 400;
			color: var(--nimble-medium-text-color);
		}

		&__cost {
			font-size: var(--nimble-xs-text);
			font-weight: 600;
			font-variant-numeric: tabular-nums;
			color: var(--nimble-medium-text-color);
			white-space: nowrap;
		}
	}
</style>
