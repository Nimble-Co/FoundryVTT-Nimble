/**
 * Determine whether an icon string is an image file path/URL rather than a
 * Font Awesome class. Built-in spell schools use Font Awesome classes (e.g.
 * `fa-solid fa-fire`), while GM-defined custom schools store an image path
 * chosen from Foundry's file picker (e.g. `icons/svg/book.svg`). Render sites
 * use this to decide between an `<img>` and an `<i>` element.
 */
export default function isImageIcon(icon: string | null | undefined): boolean {
	if (typeof icon !== 'string') return false;
	const trimmed = icon.trim();
	if (!trimmed) return false;

	// Font Awesome classes are space-separated `fa-*` tokens with no path
	// separators or file extensions; image paths have one or the other.
	return /[/\\]/.test(trimmed) || /\.[a-z0-9]+$/i.test(trimmed);
}
