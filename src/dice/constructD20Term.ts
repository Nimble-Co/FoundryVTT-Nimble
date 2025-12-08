export type d20TermOptions = {
	actor: NimbleBaseActor;
	minRoll: number;
	rollMode: number;
};

export default function constructD20Term({ actor: _actor, minRoll, rollMode }: d20TermOptions) {
	let d20Term = '1d20';

	if (rollMode > 0) d20Term = `${rollMode + 1}d20`;
	else if (rollMode < 0) d20Term = `${Math.abs(rollMode) + 1}d20`;

	if (minRoll > 1) d20Term += `min${minRoll}`;

	if (rollMode > 0) d20Term += 'kh';
	else if (rollMode < 0) d20Term += 'kl';

	return d20Term;
}
