interface RgbColor {
	r: number;
	g: number;
	b: number;
}

/**
 * Pick a readable header text colour for a card's author colour.
 *
 * Callers read the colour off `message.author`, which is null for a message
 * whose author has since been deleted, so the colour is treated as optional
 * here rather than at fifteen call sites. Missing resolves to black, i.e. the
 * light text that suits the unset header background.
 */
export default function calculateHeaderTextColor(
	backgroundColor: RgbColor | null | undefined,
): string {
	const { r, g, b } = backgroundColor ?? { r: 0, g: 0, b: 0 };

	// NOTE: The RGB values provided by Foundry are divided by 255 to give a percentage.
	const perceivedLightness = r * 0.2126 + g * 0.7152 + b * 0.0722;

	return perceivedLightness >= 0.6 ? 'hsl(50, 14%, 9%)' : 'hsl(38, 38%, 94%)';
}
