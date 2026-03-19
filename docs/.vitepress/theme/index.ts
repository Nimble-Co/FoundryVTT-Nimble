import DefaultTheme from 'vitepress/theme';
import FullscreenIframe from './components/FullscreenIframe.vue';
import './style.css';

export default {
	extends: DefaultTheme,
	enhanceApp({ app }) {
		app.component('FullscreenIframe', FullscreenIframe);
	},
};
