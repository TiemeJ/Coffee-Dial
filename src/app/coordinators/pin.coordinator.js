import { createPinControllerModule } from '../../features/pin/pin.controller.js';

export const createPinCoordinator = (deps) => {
    const { renderPinnedTiles, togglePinnedTiles } = createPinControllerModule(deps);
    return {
        renderPinnedTiles,
        togglePinnedTiles
    };
};
