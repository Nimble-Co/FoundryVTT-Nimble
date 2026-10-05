import { SYSTEM_PATH } from '#system';
import type { MoveBandWaypoint, OfferRulerWaypoint } from '#types/movement.js';
import localize from '#utils/localize.ts';
import { markMoveBands } from '#utils/movement/markMoveBands.js';
import { markWaypointsPastOffer } from '#utils/movement/markWaypointsPastOffer.js';
import { getMoveBandOptions } from '#utils/movement/moveBandOptions.js';
import { movementOfferAction } from '#utils/movement/movementActions.js';
import { findArmedMovementOffer } from '#utils/movement/movementOffers.js';
import {
	budgetText,
	endsReach,
	type MoveColors,
	moveColor,
	moveDie,
	readMoveColors,
} from '#utils/movement/rulerDisplay.js';
import { NimbleToken } from './token.js';

type Waypoint = foundry.canvas.placeables.tokens.TokenRuler.Waypoint;
type LabelWaypoint = MoveBandWaypoint & OfferRulerWaypoint & { next?: unknown; userId?: string };

interface KeybindingsLike {
	get(namespace: string, action: string): { key: string; modifiers?: string[] }[] | undefined;
}

/**
 * Shows how far a drag can go: how far a Movement Offer reaches, with the part
 * past it drawn the way core draws an unreachable path, and, on a character's
 * own turn, which Move each space of its own movement falls in. Only the drawing
 * changes.
 */
export class NimbleTokenRuler extends foundry.canvas.placeables.tokens.TokenRuler {
	static override WAYPOINT_LABEL_TEMPLATE = `${SYSTEM_PATH}/templates/hud/waypoint-label.hbs`;

	/** The colours of the Moves, read from the style sheet once for each draw. */
	#moveColors: MoveColors | null = null;

	protected override _preparePath(path: Waypoint[]): void {
		super._preparePath(path);
		this.#moveColors = null;
		const document = this.token.document;
		const gridDistance = document.parent?.grid?.distance ?? 0;
		if (!gridDistance) return;
		const offer = document.uuid ? findArmedMovementOffer(document.uuid) : null;
		if (offer) markWaypointsPastOffer(path as unknown as OfferRulerWaypoint[], offer, gridDistance);
		const moves = getMoveBandOptions(document);
		if (moves) markMoveBands(path as unknown as MoveBandWaypoint[], { ...moves, gridDistance });
	}

	protected override _shouldRenderWaypoint(
		waypoint: Parameters<foundry.canvas.placeables.tokens.TokenRuler['_shouldRenderWaypoint']>[0],
	): boolean {
		return super._shouldRenderWaypoint(waypoint) || endsReach(waypoint as never);
	}

	protected override _getGridHighlightStyle(
		...args: Parameters<foundry.canvas.placeables.tokens.TokenRuler['_getGridHighlightStyle']>
	): ReturnType<foundry.canvas.placeables.tokens.TokenRuler['_getGridHighlightStyle']> {
		const style = super._getGridHighlightStyle(...args);
		this.#moveColors ??= readMoveColors(globalThis.getComputedStyle(document.documentElement));
		const color = moveColor(args[0] as unknown as MoveBandWaypoint, this.#moveColors);
		return color === undefined || style.alpha === 0 ? style : { ...style, color };
	}

	protected override _getWaypointLabelContext(
		...args: Parameters<foundry.canvas.placeables.tokens.TokenRuler['_getWaypointLabelContext']>
	): ReturnType<foundry.canvas.placeables.tokens.TokenRuler['_getWaypointLabelContext']> {
		const context = super._getWaypointLabelContext(...args);
		if (!context) return context;
		const waypoint = args[0] as unknown as LabelWaypoint;
		const die = moveDie(waypoint);
		const budget = budgetText(waypoint);
		const switchHint = waypoint.next ? '' : this.#switchHint(waypoint);
		if (!die && !budget && !switchHint) return context;
		return Object.assign(context, { moveDie: die, budget, switchHint });
	}

	/** Names the cycle key and the movement it switches the user's drag to. */
	#switchHint(waypoint: LabelWaypoint): string {
		// Recorded waypoints also carry the id of the user who moved the token.
		if (waypoint.stage !== 'planned' || waypoint.userId !== game.user?.id) return '';
		if (!(this.token instanceof NimbleToken)) return '';
		const offer = this.token.switchableDragOffer();
		const next = this.token.nextDragAction();
		const binding = (game.keybindings as unknown as KeybindingsLike).get('core', 'cycleView')?.[0];
		if (!offer || next === undefined || !binding) return '';
		const actions = CONFIG.Token.movement.actions as unknown as Record<string, { label: string }>;
		const label = actions[next ?? movementOfferAction(offer.kind)]?.label;
		if (!label) return '';
		const key = foundry.applications.sidebar.apps.ControlsConfig.humanizeBinding(binding as never);
		return localize('NIMBLE.movement.ruler.switchTo', { key, movement: localize(label) });
	}
}
