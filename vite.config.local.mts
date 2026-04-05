import path from 'node:path';
import { mergeConfig } from 'vite';
import baseConfig from './vite.config.mts';

export default mergeConfig(baseConfig, {
	build: {
		outDir: path.resolve(__dirname),
		emptyOutDir: false,
	},
	server: {
		open: 'https://devbox.goblinhorde.net/',
		hmr: {
			protocol: 'wss',
			host: 'devbox.goblinhorde.net',
			clientPort: 443,
		},
	},
});
