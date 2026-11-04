<!--
@component
The Defend window: the ways a hero can Defend or Interpose against one attack,
and the damage the hero takes with each choice.
-->
<script lang="ts">
	import type { DefendDialogProps } from '#types/components/DefendDialog.d.ts';
	import { untrack } from 'svelte';
	import localize from '#utils/localize.js';
	import RollWindow from './components/RollWindow.svelte';

	let { dialog, data }: DefendDialogProps = $props();

	const TEXT = 'NIMBLE.chat.defend';
	const NONE = '';

	let wayId = $state(untrack(() => (data.isTarget ? (data.ways[0]?.id ?? NONE) : NONE)));
	let interposeId = $state(NONE);

	const canDefend = $derived(data.isTarget || interposeId !== NONE);
	const defending = $derived(canDefend && wayId !== NONE);
	const takes = $derived(data.takes[`${defending ? 1 : 0}:${interposeId}`]);
	const showsTakes = $derived(
		(data.isTarget || interposeId !== NONE) && takes !== null && takes !== undefined,
	);

	const confirmLabel = $derived.by(() => {
		if (defending && interposeId !== NONE) return localize(`${TEXT}.confirmBoth`);
		if (interposeId !== NONE) return localize(`${TEXT}.confirmInterpose`);
		return localize(`${TEXT}.confirmDefend`);
	});
	const disabledReason = $derived(
		defending || interposeId !== NONE ? '' : localize(`${TEXT}.pickOne`),
	);

	function onConfirm() {
		if (disabledReason) return;
		dialog.submitActivation({
			defend: defending,
			wayId: defending ? wayId : NONE,
			interposeEntryId: interposeId === NONE ? null : interposeId,
		});
	}
</script>

<RollWindow
	title={data.heading}
	icon="fa-solid fa-shield-halved"
	rollIcon="fa-solid fa-shield-halved"
	rollLabel={confirmLabel}
	rollDisabledReason={disabledReason}
	oncancel={() => dialog.close()}
	onroll={onConfirm}
>
	<div>
		<div class="lb">{localize(`${TEXT}.defendGroup`)}</div>
		{#if data.blockedNote}<p class="note">{data.blockedNote}</p>{/if}
		{#if !canDefend}<p class="note">{localize(`${TEXT}.defendNeedsInterpose`)}</p>{/if}
		<div class="options">
			{#if data.interposes.length > 0}
				<label class="check option" class:option--on={wayId === NONE}>
					<input type="radio" name="defend-way" value={NONE} bind:group={wayId} />
					<span><b>{localize(`${TEXT}.noDefend`)}</b></span>
				</label>
			{/if}
			{#each data.ways as way (way.id)}
				<label class="check option" class:option--on={defending && wayId === way.id}>
					<input
						type="radio"
						name="defend-way"
						value={way.id}
						disabled={!canDefend}
						bind:group={wayId}
					/>
					<span>
						<b>{way.name}</b>
						<small>{way.note}</small>
					</span>
				</label>
			{/each}
		</div>
	</div>

	{#if data.interposes.length > 0}
		<div>
			<div class="lb">{localize(`${TEXT}.interposeGroup`)}</div>
			<div class="options">
				<label class="check option" class:option--on={interposeId === NONE}>
					<input type="radio" name="interpose" value={NONE} bind:group={interposeId} />
					<span><b>{localize(`${TEXT}.noInterpose`)}</b></span>
				</label>
				{#each data.interposes as interpose (interpose.entryId)}
					<label class="check option" class:option--on={interposeId === interpose.entryId}>
						<input
							type="radio"
							name="interpose"
							value={interpose.entryId}
							bind:group={interposeId}
						/>
						<span>
							<b>{interpose.label}</b>
							<small>{interpose.note}</small>
						</span>
					</label>
				{/each}
			</div>
		</div>
	{/if}

	{#if showsTakes}
		<div class="frm takes">
			{localize(`${TEXT}.takes`, { name: data.heroName, damage: String(takes) })}
		</div>
	{/if}
</RollWindow>

<style lang="scss">
	.options {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.option {
		align-items: flex-start;
		padding: 6px 8px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;

		input {
			margin-top: 1px;
		}

		span {
			display: flex;
			flex-direction: column;
			gap: 2px;
		}

		small {
			font-size: 0.75rem;
			font-weight: 500;
			line-height: 1.25;
			color: var(--nimble-ui-ink-muted);
		}

		&--on {
			border-color: var(--nimble-ui-highlight);
			background: var(--nimble-ui-well);
		}

		&:has(input:disabled) {
			opacity: 0.6;
		}
	}

	.note {
		margin: 0 0 5px;
		font-size: 0.781rem;
		font-weight: 600;
		color: var(--nimble-ui-ink-muted);
	}

	.frm.takes {
		font-family: var(--nimble-primary-font);
	}
</style>
