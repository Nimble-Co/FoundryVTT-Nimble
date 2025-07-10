import { mount } from 'svelte';
import NimbleTokenHUD from '../view/pixi/NimbleTokenHUD.svelte';

export default function renderNimbleTokenHUD(HUD, html, token) {
	const target = html.querySelector('.palette, .status-effects');
	if (!target) return;

	target.innerHTML = '';
	HUD._svelteComponent = mount(NimbleTokenHUD, {
		target,
		props: { HUD, token },
	});
}
