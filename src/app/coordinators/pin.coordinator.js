import { createPinControllerModule } from '../../features/pin/pin.controller.js';
import { selectPinnedBrewOrderIds } from '../stores/brews.selectors.js';
import { selectVisiblePinnedBrewOrderIds } from '../stores/pin.selectors.js';

export const createPinCoordinator = (deps) => {
    const { renderPinnedTiles } = createPinControllerModule({
        ...deps,
        selectPinnedBrewOrderIds,
        selectVisiblePinnedBrewOrderIds
    });
    return {
        renderPinnedTiles
    };
};
