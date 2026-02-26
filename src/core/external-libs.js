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

const resolveAppBasePath = () => {
    try {
        const moduleUrl = new URL(import.meta.url);
        const pathname = moduleUrl.pathname || '/';
        const markers = ['/assets/', '/src/'];
        for (const marker of markers) {
            const markerIndex = pathname.indexOf(marker);
            if (markerIndex >= 0) {
                const basePath = pathname.slice(0, markerIndex);
                return basePath === '/' ? '' : basePath;
            }
        }
    } catch (_) {
        // Fall through to location-based fallback.
    }

    const pathname = window.location?.pathname || '/';
    const isGithubPages = (window.location?.hostname || '').endsWith('github.io');
    if (pathname === '/Coffee-Dial' || pathname.startsWith('/Coffee-Dial/') || isGithubPages) {
        return '/Coffee-Dial';
    }
    return '';
};

const resolveVendorScriptUrl = (filename) => {
    const basePath = resolveAppBasePath();
    const path = `${basePath}/vendor/js/${filename}`.replace(/\/{2,}/g, '/');
    return new URL(path, window.location.origin).href;
};

const chartJsSrc = resolveVendorScriptUrl('chart.js');
const html2canvasSrc = resolveVendorScriptUrl('html2canvas.min.js');

export const ensureChartJs = async () => loadClassicScript({
    src: chartJsSrc,
    globalName: 'Chart'
});

export const ensureHtml2Canvas = async () => loadClassicScript({
    src: html2canvasSrc,
    globalName: 'html2canvas'
});
