import { normalizeIntegrationPreferences } from '../../core/integration-preferences.js';

const REMOVE_BG_URL = 'https://api.remove.bg/v1.0/removebg';

const toPngFileName = (inputName = 'coffee-image') => {
    const normalized = `${inputName}`.trim() || 'coffee-image';
    const lastDot = normalized.lastIndexOf('.');
    const stem = lastDot > 0 ? normalized.slice(0, lastDot) : normalized;
    return `${stem}.png`;
};

const buildRemoveBgErrorMessage = (status, text = '') => {
    const trimmed = `${text || ''}`.trim();
    if (!trimmed) return `remove.bg request failed (${status}).`;
    if (trimmed.length <= 220) return `remove.bg request failed (${status}): ${trimmed}`;
    return `remove.bg request failed (${status}): ${trimmed.slice(0, 220)}...`;
};

export const createBgRemovalModule = ({
    getIntegrationPreferences,
    fetchFn = (...args) => fetch(...args)
} = {}) => {
    const resolveRemoveBgPrefs = () =>
        normalizeIntegrationPreferences(getIntegrationPreferences?.()).removeBg;

    const removeCoffeeImageBackground = async (
        file,
        { source = 'unknown', force = false } = {}
    ) => {
        if (!file) return file;

        const removeBgPrefs = resolveRemoveBgPrefs();
        if (!force && !removeBgPrefs.enabled) return file;

        const apiKey = `${removeBgPrefs.apiKey || ''}`.trim();
        if (!apiKey) {
            throw new Error('Enter your remove.bg API key in Preferences > Integrations.');
        }

        const formData = new FormData();
        formData.append('image_file', file, file?.name || 'coffee-image');
        formData.append('size', 'auto');
        formData.append('format', 'png');

        const response = await fetchFn(REMOVE_BG_URL, {
            method: 'POST',
            headers: {
                'X-Api-Key': apiKey
            },
            body: formData
        });
        if (!response.ok) {
            const bodyText = await response.text().catch(() => '');
            throw new Error(buildRemoveBgErrorMessage(response.status, bodyText));
        }

        const outputBlob = await response.blob();
        if (!outputBlob || !outputBlob.size) {
            throw new Error(`remove.bg returned an empty image (${source}).`);
        }

        return new File(
            [outputBlob],
            toPngFileName(file?.name || 'coffee-image'),
            { type: 'image/png', lastModified: Date.now() }
        );
    };

    return {
        removeCoffeeImageBackground
    };
};
