<!--
@component
The Settings tab: every setting and button works in all modes.
-->
<script lang="ts">
	import type { HeroSettingsTabProps } from '#types/components/actorSheets/HeroSettingsTab.d.ts';
	import GroupHeading from '../../parts/GroupHeading.svelte';
	import SettingLine from '../../parts/SettingLine.svelte';
	import type { HeroIntent } from '../heroIntent.ts';

	let { view, perform }: HeroSettingsTabProps = $props();

	const uid = $props.id();

	function setNumber(intent: (value: number) => HeroIntent, text: string, min?: number) {
		const value = Number(text);
		if (!Number.isFinite(value) || (min !== undefined && value < min)) return;
		void perform(intent(value));
	}
</script>

<div class="settings">
	{#each view.groups as group (group.id)}
		<section>
			<GroupHeading label={group.label} flush={group.id === view.groups[0].id} />
			<div class="list">
				{#each group.settings as setting (setting.id)}
					{#if setting.kind === 'button'}
						<button
							type="button"
							class="nimble-u-reset-button button"
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
</style>
