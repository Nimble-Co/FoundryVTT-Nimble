import { unmount } from 'svelte';

export class NimbleTokenHUD extends TokenHUD {
	declare _svelteComponent;

	override clear() {
		super.clear();

		if (this._svelteComponent) {
			unmount(this._svelteComponent);
			this._svelteComponent = null;
		}
	}
}
