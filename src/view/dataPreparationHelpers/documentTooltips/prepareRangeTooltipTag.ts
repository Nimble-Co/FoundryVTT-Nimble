export default function prepareRangeTooltipTag(item) {
	const { genericProperties } = CONFIG.NIMBLE;
	const propertyLabel = genericProperties.range;
	const rangeComponents = Object.values(item.system.properties.range).filter(Boolean).join('–');

	return {
		label: rangeComponents ? `${propertyLabel}: ${rangeComponents} spaces` : propertyLabel,
	};
}
