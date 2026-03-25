export default function scrollIntoView(href: string): void {
	if (!href) return;

	const element = document.querySelector(`#${href}`);

	if (!element) return;

	element.scrollIntoView({ behavior: 'smooth' });
}
