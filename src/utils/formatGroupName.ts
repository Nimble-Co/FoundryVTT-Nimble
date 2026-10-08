/** Turns a kebab-case group key into a title, e.g. "thrill-of-the-hunt" to "Thrill Of The Hunt". */
export default function formatGroupName(groupName: string): string {
	return groupName
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}
