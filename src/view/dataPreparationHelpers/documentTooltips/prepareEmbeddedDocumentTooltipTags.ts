import localize from '../../../utils/localize';

export default function prepareEmbeddedDocumentTooltipTags(tags: TooltipTag[]): string | null {
	if (!tags.length) return null;

	const components: string[] = ["<section class='nimble-tooltip__tag-group'>"];

	tags
		.sort((a, b) => localize(a?.label ?? '').localeCompare(localize(b?.label ?? '')))
		.forEach((tag) => {
			if (!tag || !tag.label) return;

			const { label, icon } = tag;
			const tagComponents: string[] = [
				'<span class="nimble-tooltip__tag nimble-tooltip__tag--item">',
			];

			if (icon) tagComponents.push(`<i class="${icon}"></i>`);

			tagComponents.push(`${localize(label)}</span>`);
			components.push(tagComponents.join(''));
		});

	components.push('</section>');

	return components.join('');
}
