import { unmount } from 'svelte';

export class NimbleTokenHUD extends foundry.applications.hud.TokenHUD {
	declare _svelteComponent: ReturnType<typeof import('svelte').mount> | null;

	/** Clean up Svelte component when clearing the HUD */
	clearSvelteComponent(): void {
		if (this._svelteComponent) {
			unmount(this._svelteComponent);
			this._svelteComponent = null;
		}
	}
}
