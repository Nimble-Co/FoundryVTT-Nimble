import './scss/main.scss';

import canvasInit from './hooks/canvasInit';
import init from './hooks/init';
import i18nInit from './hooks/i18nInit';
import setup from './hooks/setup';
import ready from './hooks/ready';
import renderChatMessageHTML from './hooks/renderChatMessage';
import renderNimbleTokenHUD from './hooks/renderNimbleTokenHUD';

import { hotbarDrop } from './hooks/hotBarDrop.ts';

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

Hooks.on('hotbarDrop', hotbarDrop);
