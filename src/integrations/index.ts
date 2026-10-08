import registerDiceSoNiceIntegration from '../dice/diceSoNiceIntegration.js';
import registerBabeleHooks from '../hooks/babeleInit.js';
import registerBabeleInstallNotice from '../hooks/babeleInstallNotice.js';
import registerItemPilesIntegration from './itemPiles.js';

export default function registerModuleIntegrations(): void {
	registerBabeleHooks();
	registerBabeleInstallNotice();
	registerDiceSoNiceIntegration();
	registerItemPilesIntegration();
}
