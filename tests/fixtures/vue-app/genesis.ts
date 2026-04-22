import { Genesis } from '@fmfe/genesis-core';
import express from 'express';

export const app = express();

export const genesis = new Genesis({
  name: 'vue-app-fixture',
  rootDir: __dirname,
});
