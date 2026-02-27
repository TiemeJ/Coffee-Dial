export const DEFAULT_INTEGRATION_PREFERENCES = {
    removeBg: {
        enabled: false,
        apiKey: ''
    }
};

export const normalizeIntegrationPreferences = (value = null) => {
    const source = (value && typeof value === 'object') ? value : {};
    const removeBgSource = (source.removeBg && typeof source.removeBg === 'object') ? source.removeBg : {};
    return {
        removeBg: {
            enabled: !!removeBgSource.enabled,
            apiKey: `${removeBgSource.apiKey || ''}`.trim()
        }
    };
};
