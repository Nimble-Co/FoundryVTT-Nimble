/** "Nov 15", with the year when it is not this year. */
function formatShortDate(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	const thisYear = date.getFullYear() === new Date().getFullYear();
	return date.toLocaleDateString(game.i18n.lang, {
		month: 'short',
		day: 'numeric',
		...(thisYear ? {} : { year: 'numeric' }),
	});
}

export { formatShortDate };
