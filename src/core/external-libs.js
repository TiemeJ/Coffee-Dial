const loaderPromises = new Map();

const loadClassicScript = ({ src, globalName, timeoutMs = 15000 }) => {
    const globalValue = globalName ? window?.[globalName] : null;
    if (globalValue) return Promise.resolve(globalValue);

    const key = `${src}::${globalName || ''}`;
    if (loaderPromises.has(key)) return loaderPromises.get(key);

    const loadPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        const script = existing || document.createElement('script');
        let timedOut = false;

        const cleanup = () => {
            script.removeEventListener('load', onLoad);
            script.removeEventListener('error', onError);
            clearTimeout(timer);
        };

        const onLoad = () => {
            cleanup();
            if (timedOut) return;
            const value = globalName ? window?.[globalName] : true;
            if (!value) {
                reject(new Error(`Loaded script but global "${globalName}" was not found: ${src}`));
                return;
            }
            resolve(value);
        };

        const onError = () => {
            cleanup();
            if (timedOut) return;
            reject(new Error(`Failed to load script: ${src}`));
        };

        const timer = setTimeout(() => {
            timedOut = true;
            cleanup();
            reject(new Error(`Timed out loading script: ${src}`));
        }, timeoutMs);

        script.addEventListener('load', onLoad, { once: true });
        script.addEventListener('error', onError, { once: true });

        if (!existing) {
            script.src = src;
            script.async = true;
            document.head.appendChild(script);
        }
    }).catch((error) => {
        loaderPromises.delete(key);
        throw error;
    });

    loaderPromises.set(key, loadPromise);
    return loadPromise;
};

const chartJsSrc = new URL('../../vendor/js/chart.js', import.meta.url).href;
const html2canvasSrc = new URL('../../vendor/js/html2canvas.min.js', import.meta.url).href;

export const ensureChartJs = async () => loadClassicScript({
    src: chartJsSrc,
    globalName: 'Chart'
});

export const ensureHtml2Canvas = async () => loadClassicScript({
    src: html2canvasSrc,
    globalName: 'html2canvas'
});

