import { createApp } from './entry-base';

const { app, router } = createApp();
router.onReady(() => app.$mount('#app'));
