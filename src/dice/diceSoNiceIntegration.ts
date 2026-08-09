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

/**
 * Per-term appearance override read by Dice So Nice. The colorset is
 * resolved first; any explicit color fields are then merged over it.
 */
export interface PrimaryDieAppearance {
	colorset: string;
	background?: string;
	foreground?: string;
	edge?: string;
}

/**
 * Builds the appearance override for a primary die from the rolling user's
 * preferences, or `undefined` when the user has disabled distinct primary
 * die styling. Called at roll construction, so the roller's own settings
 * determine how their primary die renders on every client.
 */
export function getPrimaryDieAppearance(): PrimaryDieAppearance | undefined {
	const preferences = getPrimaryDiePreferences();
	if (!preferences.enabled) return undefined;

	const appearance: PrimaryDieAppearance = { colorset: PRIMARY_DIE_COLORSET };

	if (preferences.background !== DEFAULT_PRIMARY_DIE_COLOR) {
		appearance.background = preferences.background;
		// The default gold edge only suits the default body color; a custom
		// body looks best with a matching edge.
		appearance.edge = preferences.background;
	}

	if (preferences.foreground !== DEFAULT_PRIMARY_DIE_LABEL_COLOR) {
		appearance.foreground = preferences.foreground;
	}

	return appearance;
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
	(Hooks.once as (event: string, fn: (dice3d: Dice3D) => void) => number)(
		'diceSoNiceReady',
		(dice3d) => {
			dice3d.addColorset(
				{
					name: PRIMARY_DIE_COLORSET,
					description: localize('NIMBLE.diceSoNice.primaryDieColorset'),
					category: localize('NIMBLE.diceSoNice.category'),
					foreground: DEFAULT_PRIMARY_DIE_LABEL_COLOR,
					background: DEFAULT_PRIMARY_DIE_COLOR,
					outline: '#310606',
					edge: DEFAULT_PRIMARY_DIE_EDGE_COLOR,
					material: 'metal',
				},
				'default',
			);
		},
	);
}
