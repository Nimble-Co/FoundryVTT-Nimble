import type { SkillKeyType } from './skillKey.d.ts';

/** An Assess the player asked for: the option and the skill of its check. */
export interface AssessRequest {
	optionId: string;
	skillKey: SkillKeyType;
	/** No action, and advantage. */
	free?: boolean;
}
