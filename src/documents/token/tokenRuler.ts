import { SYSTEM_PATH } from '#system';
import type { MoveBandWaypoint, OfferRulerWaypoint } from '#types/movement.js';
import localize from '#utils/localize.ts';
import { markMoveBands } from '#utils/movement/markMoveBands.js';
import { markWaypointsPastOffer } from '#utils/movement/markWaypointsPastOffer.js';
import { getMoveBandOptions } from '#utils/movement/moveBandOptions.js';
import { movementOfferAction } from '#utils/movement/movementActions.js';
import { findArmedMovementOffer } from '#utils/movement/movementOffers.js';
import { NimbleToken } from './token.js';

type Waypoint = foundry.canvas.placeables.tokens.TokenRuler.Waypoint;
type LabelWaypoint = MoveBandWaypoint & OfferRulerWaypoint & { next?: unknown; userId?: string };

interface KeybindingsLike {
	get(namespace: string, action: string): { key: string; modifiers?: string[] }[] | undefined;
}

/**
 * A hero gets 3 actions a turn, so a turn has at most 3 Moves. The label shows
 * the Move as one of the dice the sheet shows for the actions.
 */
const MOVE_ICONS = ['fa-dice-one', 'fa-dice-two', 'fa-dice-three'];
const MOVES_PER_TURN = MOVE_ICONS.length;

/**
 * The spaces of the second and third Move get a colour of their own and every
 * space past the third Move is red; the first keeps the user's colour.
 */
const MOVE_COLORS: Record<number, number> = { 2: 0xf2c94c, 3: 0xf2994a };
const PAST_LAST_MOVE_COLOR = 0xeb5757;

function moveColor(waypoint: unknown): number | undefined {
	const { unreachable, moveBand } = waypoint as MoveBandWaypoint;
	if (unreachable || !moveBand) return undefined;
	return moveBand > MOVES_PER_TURN ? PAST_LAST_MOVE_COLOR : MOVE_COLORS[moveBand];
}

/** The die of the Move a drag waypoint falls in, and whether that is past the last Move of a turn. */
function moveDie({ moveBand }: LabelWaypoint): { icon: string; over: boolean } | null {
	if (!moveBand) return null;
	return {
		icon: MOVE_ICONS[Math.min(moveBand, MOVES_PER_TURN) - 1],
		over: moveBand > MOVES_PER_TURN,
	};
}

/** Core dashes the line from the first drawn waypoint out of reach, so the last one in reach must be drawn. */
function endsReach(waypoint: unknown): boolean {
	const { unreachable, next } = waypoint as {
		unreachable: boolean;
		next?: { unreachable: boolean } | null;
	};
	return !unreachable && !!next?.unreachable;
}

/** Which offered movement a drag waypoint uses and how many of its spaces. */
function budgetText({ offerBand }: LabelWaypoint): string {
	if (!offerBand) return '';
	return localize(`NIMBLE.movement.ruler.${offerBand.kind}`, {
		spaces: String(offerBand.spaces),
		limit: String(offerBand.limit),
	});
}

/**
 * Shows how far a drag can go: how far a Movement Offer reaches, with the part
 * past it drawn the way core draws an unreachable path, and, on a character's
 * own turn, which Move each space of its own movement falls in. Only the drawing
 * changes.
 */
export class NimbleTokenRuler extends foundry.canvas.placeables.tokens.TokenRuler {
	static override WAYPOINT_LABEL_TEMPLATE = `${SYSTEM_PATH}/templates/hud/waypoint-label.hbs`;

	protected override _preparePath(path: Waypoint[]): void {
		super._preparePath(path);
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
		return super._shouldRenderWaypoint(waypoint) || endsReach(waypoint);
	}

	protected override _getGridHighlightStyle(
		...args: Parameters<foundry.canvas.placeables.tokens.TokenRuler['_getGridHighlightStyle']>
	): ReturnType<foundry.canvas.placeables.tokens.TokenRuler['_getGridHighlightStyle']> {
		const style = super._getGridHighlightStyle(...args);
		const color = moveColor(args[0]);
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

	/** Names the key that switches the user's drag between the offer and the token's own movement. */
	#switchHint(waypoint: LabelWaypoint): string {
		// Recorded waypoints also carry the id of the user who moved the token.
		if (waypoint.stage !== 'planned' || waypoint.userId !== game.user?.id) return '';
		if (!(this.token instanceof NimbleToken)) return '';
		const offer = this.token.switchableDragOffer();
		const binding = (game.keybindings as unknown as KeybindingsLike).get('core', 'cycleView')?.[0];
		if (!offer || !binding) return '';
		const key = foundry.applications.sidebar.apps.ControlsConfig.humanizeBinding(binding as never);
		if (waypoint.action === movementOfferAction(offer.kind)) {
			return localize('NIMBLE.movement.ruler.switchToOwn', { key });
		}
		return localize('NIMBLE.movement.ruler.switchToOffer', {
			key,
			movement: localize(`NIMBLE.movement.actions.${offer.kind}`),
		});
	}
}
