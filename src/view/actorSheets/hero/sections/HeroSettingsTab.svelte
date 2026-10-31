<!--
@component
The Settings tab: you change a setting only in edit mode, and the export buttons work in all modes.
At the bottom, "Needs a place" holds system data that has no place on the sheet yet, with its control.
-->
<script lang="ts">
	import type { HeroSettingsTabProps } from '#types/components/actorSheets/HeroSettingsTab.d.ts';
	import GroupHeading from '../../parts/GroupHeading.svelte';
	import SettingLine from '../../parts/SettingLine.svelte';
	import type { HeroIntent } from '../heroIntent.ts';

	let { view, ui, perform }: HeroSettingsTabProps = $props();

	const uid = $props.id();

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
					{#if setting.kind === 'button'}
						<button
							type="button"
							class="nimble-u-reset-button button"
							disabled={!setting.always && !ui.editing}
							onclick={() => perform(setting.intent)}
						>
							<i class={setting.icon}></i>{setting.label}
						</button>
					{:else}
						{@const id = `${uid}-${setting.id}`}
						{@const described = setting.hint ? `${id}-hint` : undefined}
						<SettingLine {id} label={setting.label} hint={setting.hint}>
							{#if setting.kind === 'check'}
								<input
									{id}
									type="checkbox"
									role="switch"
									checked={setting.on}
									disabled={!ui.editing}
									aria-describedby={described}
									onchange={(event) => perform(setting.intent(event.currentTarget.checked))}
								/>
							{:else if setting.kind === 'number'}
								<input
									{id}
									type="number"
									class="value"
									value={setting.value}
									min={setting.min}
									step="1"
									disabled={!ui.editing}
									aria-describedby={described}
									onchange={(event) =>
										setNumber(setting.intent, event.currentTarget.value, setting.min)}
								/>
							{:else}
								<input
									{id}
									type="text"
									class="value wide"
									value={setting.value}
									disabled={!ui.editing}
									aria-describedby={described}
									onchange={(event) => perform(setting.intent(event.currentTarget.value))}
								/>
							{/if}
						</SettingLine>
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
		gap: 2px;
	}
	.button {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 32px;
		padding: 0 12px;
		border: 1px solid var(--nimble-ui-line);
		border-radius: 4px;
		font: 700 0.781rem/1 var(--nimble-primary-font);
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
		margin: 0 4px 2px;
		font-size: 0.703rem;
		color: var(--nimble-ui-ink-muted);
	}
</style>
