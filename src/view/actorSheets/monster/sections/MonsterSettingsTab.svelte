<!--
@component
The Settings tab of the NPC sheet: what the monster is (read only; you change it in the metadata window), the image
settings, the item macros and the coins (in all modes).
-->
<script lang="ts">
	import type { MonsterSettingsTabProps } from '#types/components/actorSheets/MonsterSettingsTab.d.ts';
	import GroupHeading from '../../parts/GroupHeading.svelte';
	import SettingLine from '../../parts/SettingLine.svelte';
	import type { MonsterIntent } from '../monsterIntent.ts';

	let { view, perform }: MonsterSettingsTabProps = $props();

	const uid = $props.id();

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
			{#if group.hint}<p class="hint">{group.hint}</p>{/if}
			<div class="list">
				{#each group.settings as setting (setting.id)}
					{#if setting.kind === 'value'}
						<SettingLine label={setting.label}>
							<span class="value">{setting.value}</span>
						</SettingLine>
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
							{:else}
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
	.hint {
		margin: 0 4px 2px;
		font-size: 0.703rem;
		color: var(--nimble-ui-ink-muted);
	}
</style>
