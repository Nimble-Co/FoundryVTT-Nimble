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

/**
 * Registers the system's Dice So Nice colorsets.
 *
 * The `diceSoNiceReady` hook only fires when the module is installed and
 * active, so no module guard is needed: without the module the colorset is
 * never registered, and the per-term `appearance` options set during roll
 * construction are inert.
 */
export default function registerDiceSoNiceIntegration() {
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
