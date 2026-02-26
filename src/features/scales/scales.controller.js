export const createScalesController = ({
    appCommands,
    ensureScalesFeature,
    getCoffeeScale
}) => {
    if (!appCommands?.registerCommand) {
        throw new Error('createScalesController requires appCommands.registerCommand');
    }

    appCommands.registerCommand(
        'scales.renderGraph',
        async ({ canvasId, graphData = null } = {}) => {
            if (!canvasId || typeof canvasId !== 'string') return false;

            if (typeof ensureScalesFeature === 'function') {
                await ensureScalesFeature();
            }

            const canvas = document.getElementById(canvasId);
            const coffeeScale = getCoffeeScale?.();
            if (!canvas || !coffeeScale?.renderGraphTo) {
                return false;
            }

            coffeeScale.renderGraphTo(canvas, graphData);
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
