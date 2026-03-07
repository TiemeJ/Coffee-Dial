export const createScalesController = ({
    appCommands,
    ensureScalesFeature,
    getCoffeeScale
}) => {
    if (!appCommands?.registerCommand) {
        throw new Error('createScalesController requires appCommands.registerCommand');
    }

    console.log('[ScalesController] registering scales.renderGraph command');
    appCommands.registerCommand(
        'scales.renderGraph',
        async ({ canvasId, graphData = null } = {}) => {
            console.log('[scales.renderGraph] invoked, canvasId:', canvasId, 'hasGraphData:', !!graphData);
            if (!canvasId || typeof canvasId !== 'string') {
                console.warn('[scales.renderGraph] missing canvasId');
                return false;
            }

            if (typeof ensureScalesFeature === 'function') {
                console.log('[scales.renderGraph] calling ensureScalesFeature...');
                await ensureScalesFeature();
                console.log('[scales.renderGraph] ensureScalesFeature done');
            }

            const canvas = document.getElementById(canvasId);
            // Prefer the injected getCoffeeScale, but fall back to the module-level
            // singleton (getCoffeeScale export from scales.js) in case of closure issues.
            let coffeeScale = getCoffeeScale?.();
            if (!coffeeScale?.renderGraphTo) {
                const scalesModule = await import('../scales/scales.js');
                coffeeScale = scalesModule.getCoffeeScale?.();
                console.log('[scales.renderGraph] used module getCoffeeScale, renderGraphTo:', typeof coffeeScale?.renderGraphTo);
            }
            console.log('[scales.renderGraph] canvas:', canvas, 'coffeeScale:', coffeeScale, 'renderGraphTo:', coffeeScale?.renderGraphTo);
            if (!canvas || !coffeeScale?.renderGraphTo) {
                console.warn('[scales.renderGraph] missing canvas or renderGraphTo, canvas:', canvas, 'coffeeScale:', coffeeScale);
                return false;
            }

            coffeeScale.renderGraphTo(canvas, graphData);
            console.log('[scales.renderGraph] renderGraphTo called successfully');
            return true;
        },
        {
            owner: 'scales',
            schema: {
                canvasId: 'string',
                graphData: 'object|null?'
            }
        }
    );
};
