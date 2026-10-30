<!--
@component
The Settings tab of the NPC sheet: what the monster is (read only; you change it in the metadata window), the image
settings and the item macros (only in edit mode), and the coins (in all modes).
-->
<script lang="ts">
	import type { MonsterSettingsTabProps } from '#types/components/actorSheets/MonsterSettingsTab.d.ts';
	import GroupHeading from '../../parts/GroupHeading.svelte';
	import type { MonsterIntent } from '../monsterIntent.ts';

	let { view, ui, perform }: MonsterSettingsTabProps = $props();

	function setNumber(intent: (value: number) => MonsterIntent, text: string, min?: number) {
		const value = Number(text);
		if (!Number.isFinite(value) || (min !== undefined && value < min)) return;
		void perform(intent(value));
	}
</script>

<div class="settings">
	{#each view.groups as group, index (group.id)}
		<section>
			<GroupHeading label={group.label} flush={index === 0} />
			<div class="list">
				{#each group.settings as setting (setting.id)}
					{#if setting.kind === 'value'}
						<div class="line">
							<span class="label">{setting.label}</span>
							<span class="value read">{setting.value}</span>
						</div>
					{:else if setting.kind === 'check'}
						<label class="line">
							<input
								type="checkbox"
								checked={setting.on}
								disabled={!ui.editing}
								onchange={(event) => perform(setting.intent(event.currentTarget.checked))}
							/>
							<span>{setting.label}</span>
						</label>
					{:else}
						<label class="line">
							<span class="label">{setting.label}</span>
							<input
								type="number"
								class="value"
								value={setting.value}
								min={setting.min}
								step="1"
								disabled={!setting.always && !ui.editing}
								onchange={(event) =>
									setNumber(setting.intent, event.currentTarget.value, setting.min)}
							/>
						</label>
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
		flex: 1;
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
	.value:disabled,
	.read {
		border-color: transparent;
		background: var(--nimble-ui-well);
	}
	.read {
		display: flex;
		align-items: center;
		width: auto;
		min-width: 96px;
		font-weight: 600;
	}
</style>
