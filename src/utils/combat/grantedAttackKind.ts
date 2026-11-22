/** What a granted attack line spends. It names the card section of the line. */
export type GrantedAttackKind = 'free' | 'action' | 'reaction' | 'freeOpportunity';

/** The kind of a line. A line that spends the reaction and is also free is a free opportunity attack. */
export function grantedAttackKind(line: {
	free: boolean;
	spendsReaction: boolean;
}): GrantedAttackKind {
	if (line.spendsReaction) return line.free ? 'freeOpportunity' : 'reaction';
	return line.free ? 'free' : 'action';
}
