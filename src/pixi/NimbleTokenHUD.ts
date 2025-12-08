import { unmount } from 'svelte';

export class NimbleTokenHUD extends foundry.applications.hud.TokenHUD {
	declare _svelteComponent: object | null;

	clear() {
		const baseClass = Object.getPrototypeOf(Object.getPrototypeOf(this));
		if (baseClass.clear) baseClass.clear.call(this);

		if (this._svelteComponent) {
			unmount(this._svelteComponent);
			this._svelteComponent = null;
		}
	}
}
