import registerBabeleHooks from './babeleInit.js';
import registerBabeleInstallNotice from './babeleInstallNotice.js';
import registerDiceSoNiceIntegration from './diceSoNice.js';
import registerItemPilesIntegration from './itemPiles.js';

export default function registerModuleIntegrations(): void {
	registerBabeleHooks();
	registerBabeleInstallNotice();
	registerDiceSoNiceIntegration();
	registerItemPilesIntegration();
}
