<script lang="ts">
	import type { CharacterJsonExportButtonProps } from '#types/components/CharacterJsonExportButton.js';

	import localize from '#utils/localize.ts';

	import { exportCharacterToJson } from './CharacterJsonExportButton.utils.ts';

	const { actor }: CharacterJsonExportButtonProps = $props();

	const { jsonExport } = CONFIG.NIMBLE;

	function handleExport() {
		try {
			exportCharacterToJson(actor);
			ui.notifications?.info(localize(jsonExport.success));
		} catch (error) {
			console.error('Character JSON export failed:', error);
			ui.notifications?.error(localize(jsonExport.error));
		}
	}
</script>

<button class="nimble-button" data-button-variant="full-width" type="button" onclick={handleExport}>
	<i class="fa-solid fa-file-export"></i>
	{localize(jsonExport.exportButton)}
</button>
