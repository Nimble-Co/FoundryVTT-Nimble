import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import BetaBanner from './components/BetaBanner.vue';
import FullscreenIframe from './components/FullscreenIframe.vue';
import './style.css';

export default {
	extends: DefaultTheme,
	Layout: () => h(DefaultTheme.Layout, null, { 'layout-top': () => h(BetaBanner) }),
	enhanceApp({ app }) {
		app.component('FullscreenIframe', FullscreenIframe);
	},
};
