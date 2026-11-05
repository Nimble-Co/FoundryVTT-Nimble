<!--
@component
The Defend window: what a hero can do against one attack, what each costs, and
the damage the hero takes with it.
-->
<script lang="ts">
	import type { DefendDialogProps } from '#types/components/DefendDialog.d.ts';
	import { untrack } from 'svelte';
	import localize from '#utils/localize.js';
	import RollWindow from './components/RollWindow.svelte';

	let { dialog, data }: DefendDialogProps = $props();

	let optionId = $state(untrack(() => data.picked ?? data.options[0]?.id ?? ''));
	let tickIds = $state<string[]>([]);
	const picked = $derived(data.options.find((option) => option.id === optionId));
	const ticksOn = $derived(picked?.takesTicks === true);

	function takesFor(option: (typeof data.options)[number]): number | null {
		return option.takesTicks ? data.takesWith(option.id, tickIds) : option.takes;
	}

	function onConfirm() {
		if (!picked) return;
		dialog.submitActivation({
			optionId: picked.id,
			defend: picked.defend,
			interposeEntryId: picked.interposeEntryId,
			ticks: ticksOn ? [...tickIds] : [],
		});
	}
</script>

<RollWindow
	title={data.heading}
	icon="fa-solid fa-shield-halved"
	rollIcon="fa-solid fa-shield-halved"
	rollLabel={picked?.confirm ?? ''}
	rollDisabledReason=""
	oncancel={() => dialog.close()}
	onroll={onConfirm}
>
	<div class="options">
		{#each data.options as option (option.id)}
			{@const takes = takesFor(option)}
			<label class="check option" class:option--on={optionId === option.id}>
				<input type="radio" name="defend-option" value={option.id} bind:group={optionId} />
				<span class="option__text">
					<b>{option.title}</b>
					<small>{option.cost}</small>
					{#if option.note}
						<small class="option__note">{option.note}</small>
					{/if}
				</span>
				{#if takes !== null}
					<span class="option__takes">
						<strong>
							{#if option.before !== null && option.before !== takes}
								<s>{option.before}</s>
							{/if}
							{takes}
						</strong>
						<small>{localize('NIMBLE.chat.defend.youTake')}</small>
					</span>
				{/if}
			</label>
		{/each}
	</div>

	{#if data.ticks.length > 0}
		<section class="ticks">
			<h5 class="lb">{localize('NIMBLE.chat.defend.whenYouDefend')}</h5>
			{#each data.ticks as tick (tick.id)}
				<label
					class="check tick"
					class:tick--off={!ticksOn}
					data-tooltip={ticksOn ? null : localize('NIMBLE.chat.defend.tickNeedsDefend')}
				>
					<input type="checkbox" value={tick.id} disabled={!ticksOn} bind:group={tickIds} />
					<span class="tick__text">
						<b>{tick.label}</b>
						{#if tick.detail}
							<small>{tick.detail}</small>
						{/if}
					</span>
				</label>
			{/each}
		</section>
	{/if}
</RollWindow>

<style lang="scss">
	.options {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.options .option {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 10px;
		margin: 0;
		padding: 8px 10px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		cursor: pointer;

		&--on {
			border-color: var(--nimble-ui-highlight);
			background: var(--nimble-ui-well);
		}
	}

	.option__text,
	.option__takes {
		display: flex;
		flex-direction: column;
		gap: 2px;
		line-height: 1.2;

		small {
			font-size: 0.75rem;
			font-weight: 500;
			color: var(--nimble-ui-ink-muted);
		}
	}

	.option__note {
		color: var(--nimble-ui-highlight);
	}

	.ticks {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: 10px;

		h5 {
			margin: 0 0 4px;
		}
	}

	.ticks .tick {
		align-items: flex-start;
		padding: 4px 0;

		input {
			margin-top: 1px;
		}

		&--off {
			cursor: default;
			opacity: 0.55;
		}
	}

	.tick__text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		line-height: 1.2;

		b {
			font-size: 0.812rem;
			font-weight: 700;
		}

		small {
			font-size: 0.75rem;
			font-weight: 500;
			color: var(--nimble-ui-ink-muted);
		}
	}

	.option__text b {
		font-size: 0.875rem;
		font-weight: 800;
	}

	.option__takes {
		align-items: flex-end;
		white-space: nowrap;

		strong {
			font-size: 1.25rem;
			font-weight: 800;
			line-height: 1;
			font-variant-numeric: tabular-nums;
		}

		s {
			margin-right: 0.2em;
			font-size: 0.875rem;
			font-weight: 600;
			color: var(--nimble-ui-ink-muted);
		}

		small {
			font-size: 0.688rem;
			font-weight: 600;
		}
	}
</style>
