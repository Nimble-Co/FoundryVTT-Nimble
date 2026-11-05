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

	let optionId = $state(untrack(() => data.options[0]?.id ?? ''));
	const picked = $derived(data.options.find((option) => option.id === optionId));

	function onConfirm() {
		if (!picked) return;
		dialog.submitActivation({
			defend: picked.defend,
			interposeEntryId: picked.interposeEntryId,
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
			<label class="check option" class:option--on={optionId === option.id}>
				<input type="radio" name="defend-option" value={option.id} bind:group={optionId} />
				<span class="option__text">
					<b>{option.title}</b>
					<small>{option.cost}</small>
				</span>
				{#if option.takes !== null}
					<span class="option__takes">
						<strong>
							{#if option.before !== null && option.before !== option.takes}
								<s>{option.before}</s>
							{/if}
							{option.takes}
						</strong>
						<small>{localize('NIMBLE.chat.defend.youTake')}</small>
					</span>
				{/if}
			</label>
		{/each}
	</div>
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
