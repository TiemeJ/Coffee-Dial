import { createAppComposition } from './composition/app-composition.js';

export const createAppContainer = (deps = {}) => createAppComposition(deps);
