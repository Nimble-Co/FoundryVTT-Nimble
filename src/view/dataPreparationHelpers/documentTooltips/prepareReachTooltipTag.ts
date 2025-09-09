export default function prepareReachTooltipTag(item) {
	const { genericProperties } = CONFIG.NIMBLE;
	const propertyLabel = genericProperties.reach;
	const reachComponents = Object.values(item.system.properties.reach).filter(Boolean).join('–');

	return {
		label: reachComponents ? `${propertyLabel}: ${reachComponents} spaces` : propertyLabel,
	};
}
