import { genesis, app } from './genesis';

async function start() {
  const renderer = await genesis.createRenderer();
  app.use(renderer.renderMiddleware);
  app.listen(3000);
}

start();
