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

let ringTokens: unknown[] = [];

type TokenWithHover = {
	isVisible?: boolean;
	w?: number;
	h?: number;
	addChild(child: unknown): unknown;
	removeChild(child: unknown): void;
	children?: Array<{ name?: string }>;
};

function removeAllRings(): void {
	for (const raw of ringTokens) {
		const t = raw as TokenWithHover;
		if (!Array.isArray(t.children)) continue;
		const ring = t.children.find((c) => c.name === HOVER_RING_NAME);
		if (ring) t.removeChild(ring);
	}
	ringTokens = [];
}

function addRingToToken(token: TokenWithHover): void {
	if (typeof token.addChild !== 'function') return;
	const g = new PIXI.Graphics();
	g.name = HOVER_RING_NAME;
	const w = (token.w as number | undefined) ?? 100;
	const h = (token.h as number | undefined) ?? 100;
	g.lineStyle(4, getHoverRingColor(), 1);
	g.drawCircle(w / 2, h / 2, Math.max(w, h) / 2 + 8);
	token.addChild(g);
	ringTokens.push(token);
}

export function tokenHoverIn(token: unknown, _event: MouseEvent): void {
	removeAllRings();
	const t = token as TokenWithHover;
	if (!t || t.isVisible === false) return;
	addRingToToken(t);
}

export function tokenGroupHoverIn(tokens: unknown[], _event: MouseEvent): void {
	removeAllRings();
	for (const token of tokens) {
		const t = token as TokenWithHover;
		if (!t || t.isVisible === false) continue;
		addRingToToken(t);
	}
}

export function tokenHoverOut(_token: unknown, _event: MouseEvent): void {
	removeAllRings();
}
