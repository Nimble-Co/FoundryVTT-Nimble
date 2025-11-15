import { prelocalize } from '../utils/prelocalize';

export default function i18nInit() {
	CONFIG.NIMBLE = prelocalize(CONFIG.NIMBLE) as typeof CONFIG.NIMBLE;
}
