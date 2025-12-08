import { NimbleTokenHUD } from '../pixi/NimbleTokenHUD.js';

export default function canvasInit() {
	if (game.canvas.hud) {
		game.canvas.hud.token = new NimbleTokenHUD();
	}
}
