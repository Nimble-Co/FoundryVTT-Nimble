import { SYSTEM_ID } from '#system';
import {
	DEFAULT_PRIMARY_DIE_COLOR,
	DEFAULT_PRIMARY_DIE_LABEL_COLOR,
	getPrimaryDiePreferences,
} from '../settings/diceSoNiceSettings.js';
import localize from '../utils/localize.js';

/**
 * Name of the Dice So Nice colorset applied to primary dice so they stand
 * out from the rest of the dice pool in 3D rolls.
 *
 * Referenced from term construction via `options.appearance.colorset`, which
 * Dice So Nice reads per die term when rendering a roll. Term options are
 * serialized with the roll, so the appearance travels to all clients.
 */
export const PRIMARY_DIE_COLORSET = `${SYSTEM_ID}-primary`;

/** Gold edge used when the die body is the default color. */
const DEFAULT_PRIMARY_DIE_EDGE_COLOR = '#d4af37';

/** Dark red numeral outline paired with the default crimson body. */
const DEFAULT_PRIMARY_DIE_OUTLINE_COLOR = '#310606';

/**
 * How much of the body color is kept in the numeral outline derived from a
 * custom body, matching how dark the default outline sits against the default
 * crimson body.
 */
const OUTLINE_DARKENING_FACTOR = 0.35;

/**
 * Per-term appearance override read by Dice So Nice. The colorset is
 * resolved first; any explicit color fields are then merged over it.
 */
export interface PrimaryDieAppearance {
	colorset: string;
	background?: string;
	foreground?: string;
	edge?: string;
	outline?: string;
}

/**
 * Die term options that make Dice So Nice render the term as a primary die.
 */
export interface PrimaryDieDiceOptions {
	appearance: PrimaryDieAppearance;
	/**
	 * Stops Dice So Nice deriving a colorset from the term's `type`/`flavor`,
	 * which resolves before `appearance.colorset` and would otherwise let a
	 * damage-type mapping override the primary die styling.
	 */
	dsnDamageTypeManaged: true;
}

/** Darkens an `#rrggbb` color towards black by `factor`. */
function darkenHexColor(color: string, factor: number): string {
	const channels = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
	if (!channels) return color;

	const darkened = channels
		.slice(1)
		.map((channel) =>
			Math.round(Number.parseInt(channel, 16) * factor)
				.toString(16)
				.padStart(2, '0'),
		)
		.join('');
	return `#${darkened}`;
}

/**
 * Builds the Dice So Nice term options for a primary die from the rolling
 * user's preferences, or `undefined` when the user has disabled distinct
 * primary die styling. Called at roll construction, so the roller's own
 * settings determine how their primary die renders on every client.
 */
export function getPrimaryDieDiceOptions(): PrimaryDieDiceOptions | undefined {
	const preferences = getPrimaryDiePreferences();
	if (!preferences.enabled) return undefined;

	const appearance: PrimaryDieAppearance = { colorset: PRIMARY_DIE_COLORSET };

	if (preferences.background !== DEFAULT_PRIMARY_DIE_COLOR) {
		appearance.background = preferences.background;
		// The default gold edge and dark red numeral outline only suit the
		// default body color, so derive both from a custom body instead.
		appearance.edge = preferences.background;
		appearance.outline = darkenHexColor(preferences.background, OUTLINE_DARKENING_FACTOR);
	}

	if (preferences.foreground !== DEFAULT_PRIMARY_DIE_LABEL_COLOR) {
		appearance.foreground = preferences.foreground;
	}

	return { appearance, dsnDamageTypeManaged: true };
}

/**
 * Minimal surface of the Dice So Nice module API used by this integration.
 * The module publishes no type definitions.
 */
interface Dice3D {
	addColorset(colorset: Record<string, string>, mode?: string): Promise<void>;
}

type DieResult = foundry.dice.terms.DiceTerm.Result & { faces?: number };

/** What Dice So Nice reads from the roll it throws. */
export interface Dice3dRoll {
	dice: foundry.dice.terms.DiceTerm[];
	total: number | undefined;
	ghost?: boolean;
	secret?: boolean;
}

/** The context of the `diceSoNiceRollStart` hook. It throws `dsnRoll` when that is set. */
interface Dice3dContext {
	roll: foundry.dice.Roll.Any;
	dsnRoll?: Dice3dRoll;
}

/**
 * Dice So Nice reads the size of a die from its term, so a result of another
 * size needs a term of its own. A term with number 0 starts in a later throw,
 * as an explosion does. Null when each die is the size of its term.
 */
export function rollForDice3d(roll: foundry.dice.Roll.Any): Dice3dRoll | null {
	const dice = roll.dice as foundry.dice.terms.DiceTerm[];
	const sized = (result: DieResult) => !!result.faces;
	if (!dice.some((term) => (term.results as DieResult[]).some(sized))) return null;

	const split = dice.flatMap((term) => {
		const results = term.results as DieResult[];
		const at = results.findIndex(sized);
		if (at < 0) return [term];
		const faces = term.faces ?? 6;
		const part = (number: number, size: number, part: DieResult[]) =>
			Object.assign(
				new foundry.dice.terms.Die({
					number,
					faces: size,
					modifiers: [...term.modifiers] as never,
					options: term.options,
				}),
				{ results: part, _evaluated: true },
			);
		const parts = [part(0, results[at].faces as number, [results[at]])];
		if (at > 0) parts.unshift(part(term.number ?? 1, faces, results.slice(0, at)));
		if (at + 1 < results.length) parts.push(part(0, faces, results.slice(at + 1)));
		return parts;
	});
	const { total, ghost, secret } = roll as foundry.dice.Roll.Any & Dice3dRoll;
	return { dice: split, total, ghost, secret };
}

/**
 * Registers the system's Dice So Nice colorsets.
 *
 * The `diceSoNiceReady` hook only fires when the module is installed and
 * active, so no module guard is needed: without the module the colorset is
 * never registered, and the per-term `appearance` options set during roll
 * construction are inert.
 */
export default function registerDiceSoNiceIntegration() {
	(Hooks.on as (event: string, fn: (id: string, context: Dice3dContext) => void) => number)(
		'diceSoNiceRollStart',
		(_messageId, context) => {
			const split = rollForDice3d(context.roll);
			if (split) context.dsnRoll = split;
		},
	);
	(Hooks.once as (event: string, fn: (dice3d: Dice3D) => Promise<void>) => number)(
		'diceSoNiceReady',
		async (dice3d) => {
			try {
				await dice3d.addColorset(
					{
						name: PRIMARY_DIE_COLORSET,
						description: localize('NIMBLE.diceSoNice.primaryDieColorset'),
						category: localize('NIMBLE.diceSoNice.category'),
						foreground: DEFAULT_PRIMARY_DIE_LABEL_COLOR,
						background: DEFAULT_PRIMARY_DIE_COLOR,
						outline: DEFAULT_PRIMARY_DIE_OUTLINE_COLOR,
						edge: DEFAULT_PRIMARY_DIE_EDGE_COLOR,
						material: 'metal',
						// Keeps the colorset out of the player-facing theme list;
						// it is only meant to be applied per term by the system.
						visibility: 'hidden',
					},
					'default',
				);
			} catch (error) {
				console.error(`${SYSTEM_ID} | Failed to register the primary die colorset`, error);
			}
		},
	);
}
