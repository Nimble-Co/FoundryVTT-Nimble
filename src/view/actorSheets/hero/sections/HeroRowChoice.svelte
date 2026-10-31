<!--
@component
The choice step under a row: the options of a heroic action, a pick and then a skill (Assess), or the dice that a feature spends.
The step keeps its own picks (the first choice of a two-step pick, the toggled dice); they go when the step closes.
-->
<script lang="ts">
	import type { HeroRowChoiceProps } from '#types/components/actorSheets/HeroRowChoice.d.ts';
	import { tick } from 'svelte';
	import Button from '../../parts/Button.svelte';
	import { toggleDie } from '../../shared/diceSelection.ts';
	import type { HeroIntent } from '../heroIntent.ts';
	import { type HeroDiceSpend, spendIntent } from '../heroRows.ts';

	let { step, perform, onclose }: HeroRowChoiceProps = $props();

	let pickedId: string | null = $state(null);
	let selected: Record<string, number[]> = $state({});
	let panel: HTMLElement | undefined = $state();

	const picked = $derived(
		step.kind === 'twoStep' ? step.options.find((option) => option.id === pickedId) : undefined,
	);

	const spendKey = (spend: HeroDiceSpend) => `${spend.itemId}:${spend.ruleId}`;

	function send(intent: HeroIntent) {
		void perform(intent);
		onclose();
	}

	async function pick(id: string | null) {
		pickedId = id;
		await tick();
		panel?.querySelector<HTMLButtonElement>('[data-choice-option]')?.focus();
	}

	function toggle(spend: HeroDiceSpend, index: number) {
		const key = spendKey(spend);
		selected[key] = toggleDie(selected[key] ?? [], index, spend.cap);
	}

	function spend(entry: HeroDiceSpend) {
		const key = spendKey(entry);
		const dice = selected[key] ?? [];
		if (!dice.length) return;
		selected[key] = [];
		send(spendIntent(entry, dice));
	}
</script>

<div class="chp" role="group" aria-label={step.label} bind:this={panel}>
	{#if step.kind === 'options'}
		<div class="chl">{step.label}</div>
		{#each step.lines as line, index (index)}<p class="line">{line}</p>{/each}
		{#each step.options as option, index (index)}
			<button
				type="button"
				class="nimble-u-reset-button cho"
				data-choice-option
				onclick={() => send(option.intent)}
			>
				<b>{option.label}</b>{#if option.description}<span>{option.description}</span>{/if}
			</button>
		{/each}
	{:else if step.kind === 'twoStep'}
		{#if picked}
			<div class="chl">{picked.next.label}</div>
			<p class="line"><b>{picked.label}</b></p>
			<div class="chn">
				{#each picked.next.options as option, index (index)}
					<button
						type="button"
						class="nimble-u-reset-button chnum"
						data-choice-option
						onclick={() => send(option.intent)}
					>
						{option.label}
					</button>
				{/each}
			</div>
			<div class="end">
				<Button
					size="sm"
					icon="fa-solid fa-arrow-left"
					label={step.backLabel}
					onclick={() => pick(null)}
				/>
			</div>
		{:else}
			<div class="chl">{step.label}</div>
			{#each step.options as option (option.id)}
				<button
					type="button"
					class="nimble-u-reset-button cho"
					data-choice-option
					onclick={() => pick(option.id)}
				>
					<b>{option.label}</b><span>{option.description}</span>
				</button>
			{/each}
		{/if}
	{:else}
		<div class="chl">{step.label}</div>
		{#each step.spends as entry, index (spendKey(entry))}
			{@const dice = selected[spendKey(entry)] ?? []}
			{@const last = index === step.spends.length - 1}
			<div class="spend" role="group" aria-label={entry.label}>
				<p class="line"><b>{entry.label}</b></p>
				{#if entry.empty}
					<p class="line">{entry.empty}</p>
				{:else}
					<div class="chn">
						{#each entry.faces as face, faceIndex (faceIndex)}
							<button
								type="button"
								class="nimble-u-reset-button chnum die"
								aria-label={face.label}
								aria-pressed={dice.includes(faceIndex)}
								data-tooltip={face.label}
								disabled={face.disabled}
								onclick={() => toggle(entry, faceIndex)}
							>
								{face.value}
							</button>
						{/each}
					</div>
				{/if}
				{#if !entry.empty || last}
					<div class="end">
						{#if !entry.empty}
							<Button
								size="sm"
								label={entry.spendLabel}
								disabled={!dice.length}
								onclick={() => spend(entry)}
							/>
						{/if}
						{#if last}<Button size="sm" label={step.cancelLabel} onclick={onclose} />{/if}
					</div>
				{/if}
			</div>
		{/each}
	{/if}
</div>

<style>
	.chp {
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding: 2px 8px 10px 46px;
		font-family: var(--nimble-primary-font);
	}
	.chl {
		margin: 2px 0 1px;
		font-size: 0.688rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--nimble-ui-ink-dim);
	}
	.line {
		margin: 0;
		font-size: 0.781rem;
		line-height: 1.35;
		color: var(--nimble-ui-ink-muted);
	}
	.line b {
		font-weight: 700;
		color: var(--nimble-ui-ink);
	}
	.cho {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 3px;
		min-height: 40px;
		padding: 7px 10px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		text-align: left;
		transition:
			border-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
			background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.cho:hover {
		border-color: var(--nimble-ui-highlight);
		background: var(--nimble-ui-hover);
	}
	.cho b {
		font-size: 0.843rem;
		font-weight: 700;
		color: var(--nimble-ui-ink);
	}
	.cho span {
		font-size: 0.781rem;
		line-height: 1.35;
		color: var(--nimble-ui-ink-muted);
	}
	.chn {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.chnum {
		display: grid;
		place-items: center;
		min-width: 40px;
		height: 34px;
		padding: 0 8px;
		border: 1px solid var(--nimble-ui-ring);
		border-radius: 4px;
		font: 700 0.813rem/1 var(--nimble-primary-font);
		color: var(--nimble-ui-ink);
		transition:
			border-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1),
			background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.chnum:hover {
		border-color: var(--nimble-ui-highlight);
		background: var(--nimble-ui-hover);
	}
	.die[aria-pressed='true'] {
		border-color: var(--nimble-pool-dice-color);
		background: var(--nimble-pool-dice-color);
		color: #181821;
	}
	.die:disabled {
		border-style: dashed;
		background: none;
		color: var(--nimble-ui-ink-muted);
		cursor: default;
	}
	.cho:focus-visible,
	.chnum:focus-visible {
		outline: 2px solid var(--nimble-ui-focus);
		outline-offset: 1px;
	}
	.spend {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.end {
		display: flex;
		gap: 6px;
	}
</style>
