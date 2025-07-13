import './scss/main.scss';

import canvasInit from './hooks/canvasInit.js';
import init from './hooks/init.js';
import i18nInit from './hooks/i18nInit.js';
import setup from './hooks/setup.js';
import ready from './hooks/ready.js';
import renderChatMessage from './hooks/renderChatMessage.js';
import renderNimbleTokenHUD from './hooks/renderNimbleTokenHUD.js';

import { hotbarDrop } from './hooks/hotBarDrop.ts';

/** ----------------------------------- */
//                Hooks
/** ----------------------------------- */
Hooks.once('init', init);
Hooks.once('setup', setup);
Hooks.once('ready', ready);
Hooks.once('i18nInit', i18nInit);

Hooks.on('canvasInit', canvasInit);
Hooks.on('renderChatMessage', renderChatMessage);
Hooks.on('renderNimbleTokenHUD', renderNimbleTokenHUD);

Hooks.on('hotbarDrop', hotbarDrop);
