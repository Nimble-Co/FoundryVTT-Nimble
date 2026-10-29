import type { HeroPerform } from '#view/actorSheets/hero/heroIntent.ts';
import type { HeroChoiceStep } from '#view/actorSheets/hero/heroRows.ts';

export interface HeroRowChoiceProps {
	step: HeroChoiceStep;
	perform: HeroPerform;
	/** close the step: a pick, a spend or Cancel ends it */
	onclose: () => void;
}
