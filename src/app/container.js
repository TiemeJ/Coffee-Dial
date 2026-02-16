import { createAppContainerModules } from './container.modules.js';

export const createAppContainer = (deps = {}) => createAppContainerModules(deps);
