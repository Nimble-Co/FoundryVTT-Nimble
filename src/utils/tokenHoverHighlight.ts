import { getCombatTrackerHoverColor } from '../settings/combatTrackerSettings.js';

const HOVER_RING_NAME = 'nimble-token-hover-ring';
const DEFAULT_HOVER_RING_COLOR = 0x33bc4e;

function getHoverRingColor(): number {
	try {
		const hex = getCombatTrackerHoverColor().replace('#', '');
		const parsed = parseInt(hex, 16);
		return Number.isFinite(parsed) ? parsed : DEFAULT_HOVER_RING_COLOR;
	} catch {
		return DEFAULT_HOVER_RING_COLOR;
	}
}

let ringToken: unknown = null;

type TokenWithHover = {
	isVisible?: boolean;
	w?: number;
	h?: number;
	addChild(child: unknown): unknown;
	removeChild(child: unknown): void;
	children?: Array<{ name?: string }>;
};

function removeRing(): void {
	if (!ringToken) return;
	const t = ringToken as TokenWithHover;
	ringToken = null;
	if (!Array.isArray(t.children)) return;
	const ring = t.children.find((c) => c.name === HOVER_RING_NAME);
	if (ring) t.removeChild(ring);
}

function addRing(token: TokenWithHover): void {
	removeRing();
	if (typeof token.addChild !== 'function') return;
	const PIXI = (
		globalThis as unknown as {
			PIXI?: {
				Graphics: new () => {
					name: string;
					lineStyle(width: number, color: number, alpha: number): void;
					drawCircle(x: number, y: number, radius: number): void;
				};
			};
		}
	).PIXI;
	if (!PIXI?.Graphics) return;
	const g = new PIXI.Graphics();
	g.name = HOVER_RING_NAME;
	const w = (token.w as number | undefined) ?? 100;
	const h = (token.h as number | undefined) ?? 100;
	g.lineStyle(4, getHoverRingColor(), 1);
	g.drawCircle(w / 2, h / 2, Math.max(w, h) / 2 + 8);
	token.addChild(g);
	ringToken = token;
}

export function tokenHoverIn(token: unknown, _event: MouseEvent): void {
	const t = token as TokenWithHover;
	if (!t || t.isVisible === false) return;
	addRing(t);
}

export function tokenHoverOut(token: unknown, _event: MouseEvent): void {
	const t = token as TokenWithHover;
	if (!t || t.isVisible === false) return;
	removeRing();
}
