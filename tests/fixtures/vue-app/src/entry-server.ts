import { createApp } from './entry-base';

export default (context: { url: string }) => {
  const { app, router } = createApp();
  router.push(context.url);
  return new Promise((resolve) => router.onReady(() => resolve(app)));
};
