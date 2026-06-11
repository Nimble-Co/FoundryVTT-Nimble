<script lang="ts">
	import type { CharacterJsonExportButtonProps } from '#types/components/CharacterJsonExportButton.js';

	import localize from '#utils/localize.ts';

	const { actor }: CharacterJsonExportButtonProps = $props();

	let isExporting = $state(false);

	async function handleExport() {
		if (isExporting) return;

		isExporting = true;

		try {
			// Mirrors Foundry core's exportToJSON, which hardcodes its filename
			// (fvtt-Actor-<name>-<id>); we serialize the same way but name the
			// file fvtt-<system>-<character>-<classes> instead. Note exportSource
			// lives under _stats in v13 (flags.exportSource is a read-only
			// deprecation shim).
			const data = actor.toCompendium(null, { clearSource: false });
			const stats = (data._stats ?? {}) as Record<string, unknown>;
			stats.exportSource = {
				worldId: game.world.id,
				uuid: actor.uuid,
				coreVersion: game.version,
				systemId: game.system.id,
				systemVersion: game.system.version,
			};
			(data as Record<string, unknown>)._stats = stats;

			const classNames = Object.values(actor.classes ?? {}).map((cls) => cls.name);
			const filename = ['fvtt', game.system.id, actor.name, ...classNames]
				.map((part) => part?.slugify({ strict: true }))
				.filterJoin('-');

			foundry.utils.saveDataToFile(JSON.stringify(data, null, 2), 'text/json', `${filename}.json`);
			ui.notifications?.info(localize('NIMBLE.jsonExport.success'));
		} catch (error) {
			console.error('Character JSON export failed:', error);
			ui.notifications?.error(localize('NIMBLE.jsonExport.error'));
		} finally {
			isExporting = false;
		}
	}
</script>

<button
	class="nimble-button"
	data-button-variant="full-width"
	type="button"
	disabled={isExporting}
	onclick={handleExport}
>
	{#if isExporting}
		<i class="fa-solid fa-spinner fa-spin"></i>
		{localize('NIMBLE.jsonExport.exporting')}
	{:else}
		<i class="fa-solid fa-file-export"></i>
		{localize('NIMBLE.jsonExport.exportButton')}
	{/if}
</button>
