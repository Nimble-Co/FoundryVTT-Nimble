import './scss/main.scss';

import canvasInit from './hooks/canvasInit';
import { hotbarDrop } from './hooks/hotBarDrop';
import i18nInit from './hooks/i18nInit';
import init from './hooks/init';
import ready from './hooks/ready';
import renderChatMessageHTML from './hooks/renderChatMessage';
import renderNimbleTokenHUD from './hooks/renderNimbleTokenHUD';
import setup from './hooks/setup';

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
