<!--
@component
The Settings tab: you change a setting only in edit mode, and the export buttons work in all modes.
At the bottom, "Needs a place" holds system data that has no place on the sheet yet, with its control.
-->
<script lang="ts">
	import type { HeroSettingsTabProps } from '#types/components/actorSheets/HeroSettingsTab.d.ts';
	import GroupHeading from '../../parts/GroupHeading.svelte';
	import type { HeroIntent } from '../heroIntent.ts';

	let { view, ui, perform }: HeroSettingsTabProps = $props();

	const groups = $derived(
		view.needsAPlace.settings.length ? [...view.groups, view.needsAPlace] : view.groups,
	);

	function setNumber(intent: (value: number) => HeroIntent, text: string, min?: number) {
		const value = Number(text);
		if (!Number.isFinite(value) || (min !== undefined && value < min)) return;
		void perform(intent(value));
	}
</script>

<div class="settings">
	{#each groups as group (group.id)}
		<section>
			<GroupHeading label={group.label} flush={group.id === groups[0].id} />
			{#if group.hint}<p class="hint">{group.hint}</p>{/if}
			<div class="list">
				{#each group.settings as setting (setting.id)}
					{#if setting.kind === 'check'}
						<label class="line">
							<input
								type="checkbox"
								checked={setting.on}
								disabled={!ui.editing}
								onchange={(event) => perform(setting.intent(event.currentTarget.checked))}
							/>
							<span>{setting.label}</span>
						</label>
					{:else if setting.kind === 'number'}
						<label class="line">
							<span class="label">
								{setting.label}
								{#if setting.hint}<small>{setting.hint}</small>{/if}
							</span>
							<input
								type="number"
								class="value"
								value={setting.value}
								min={setting.min}
								step="1"
								disabled={!ui.editing}
								onchange={(event) =>
									setNumber(setting.intent, event.currentTarget.value, setting.min)}
							/>
						</label>
					{:else if setting.kind === 'text'}
						<label class="line">
							<span class="label">{setting.label}</span>
							<input
								type="text"
								class="value"
								value={setting.value}
								disabled={!ui.editing}
								onchange={(event) => perform(setting.intent(event.currentTarget.value))}
							/>
						</label>
					{:else}
						<button
							type="button"
							class="nimble-u-reset-button button"
							disabled={!setting.always && !ui.editing}
							onclick={() => perform(setting.intent)}
						>
							<i class={setting.icon}></i>{setting.label}
						</button>
					{/if}
				{/each}
			</div>
		</section>
	{/each}
</div>

<style>
	.settings {
		display: flex;
		flex-direction: column;
		gap: 10px;
		max-width: 540px;
	}
	.list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.line {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 32px;
		padding: 2px 4px;
		font-size: 0.929rem;
		color: var(--nimble-ui-ink);
	}
	.label {
		display: flex;
		flex: 1;
		flex-direction: column;
	}
	.label small {
		font-size: 0.786rem;
		color: var(--nimble-ui-ink-muted);
	}
	.value {
		width: 96px;
		height: 28px;
		padding: 0 7px;
		border: 1px solid var(--nimble-ui-line);
		border-radius: 4px;
		background: transparent;
		font: inherit;
		color: var(--nimble-ui-ink);
	}
	.value:disabled {
		border-color: transparent;
		background: var(--nimble-ui-well);
	}
	.button {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 32px;
		padding: 0 12px;
		border: 1px solid var(--nimble-ui-line);
		border-radius: 4px;
		font: 700 0.893rem/1 var(--nimble-primary-font);
		color: var(--nimble-ui-ink);
	}
	.button:hover:not(:disabled),
	.button:focus-visible {
		border-color: var(--nimble-ui-own);
		background: var(--nimble-ui-own-background);
		outline: none;
	}
	.button:disabled {
		opacity: 0.5;
	}
	.hint {
		margin: 0 4px 4px;
		font-size: 0.857rem;
		color: var(--nimble-ui-ink-muted);
	}
</style>
