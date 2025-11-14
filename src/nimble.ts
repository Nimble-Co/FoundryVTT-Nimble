import './scss/main.scss';

import { handleAutomaticConditionApplication } from './hooks/automaticConditions.js';
import canvasInit from './hooks/canvasInit.js';
import { hotbarDrop } from './hooks/hotBarDrop.ts';
import i18nInit from './hooks/i18nInit.js';
import init from './hooks/init.js';
import ready from './hooks/ready.js';
import renderChatMessageHTML from './hooks/renderChatMessage.js';
import renderNimbleTokenHUD from './hooks/renderNimbleTokenHUD.js';
import setup from './hooks/setup.js';

/** ----------------------------------- */
//                Hooks
/** ----------------------------------- */
Hooks.once('init', init);
Hooks.once('setup', setup);
Hooks.once('ready', ready);
Hooks.once('i18nInit', i18nInit);

Hooks.on('canvasInit', canvasInit);
Hooks.on('renderChatMessageHTML', renderChatMessageHTML);
Hooks.on('renderNimbleTokenHUD', renderNimbleTokenHUD);

// Automatic condition application hooks
Hooks.on('preCreateActiveEffect', handleAutomaticConditionApplication.preCreate);
Hooks.on('preDeleteActiveEffect', handleAutomaticConditionApplication.preDelete);
Hooks.on('createActiveEffect', handleAutomaticConditionApplication.postCreate);
Hooks.on('deleteActiveEffect', handleAutomaticConditionApplication.postDelete);

Hooks.on('hotbarDrop', hotbarDrop);
