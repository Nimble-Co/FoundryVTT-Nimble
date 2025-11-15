import getTooltipPermissions from './getTooltipPermissions';
import prepareRollTooltipFormula from './prepareRollTooltipFormula';
import prepareRollTooltipRollParts from './prepareRollTooltipParts';

export default function prepareRollTooltip(actorType, permissions, roll) {
	if (!getTooltipPermissions(actorType, permissions)) return null;
	return [prepareRollTooltipRollParts(roll), prepareRollTooltipFormula(roll)].join('');
}
