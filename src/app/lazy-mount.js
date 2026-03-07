// Lazy modal mount registry - defers HTML loading until first use

const mountPromises = new Map();

const createLazyMount = (key, mountFn) => {
    return async () => {
        if (!mountPromises.has(key)) {
            mountPromises.set(key, mountFn().catch((error) => {
                mountPromises.delete(key);
                throw error;
            }));
        }
        return mountPromises.get(key);
    };
};

// Brews modals
export const ensureBrewsCardMounted = createLazyMount('brewsCard', async () => {
    const { mountBrewsCardView } = await import('../features/brews/brews.mount.js');
    await mountBrewsCardView();
});

export const ensureBrewsFormModalMounted = createLazyMount('brewsFormModal', async () => {
    const { mountBrewsFormModalView } = await import('../features/brews/brews.mount.js');
    await mountBrewsFormModalView();
});

export const ensureLabResultsModalMounted = createLazyMount('labResultsModal', async () => {
    const { mountLabResultsModalView } = await import('../features/brews/brews.mount.js');
    await mountLabResultsModalView();
});

export const ensureBrewsTablePrefsMounted = createLazyMount('brewsTablePrefs', async () => {
    const { mountBrewsTablePrefsView } = await import('../features/brews/brews.mount.js');
    await mountBrewsTablePrefsView();
});

// Beans modal
export const ensureBeansCardMounted = createLazyMount('beansCard', async () => {
    const { mountBeansCardView } = await import('../features/beans/beans.mount.js');
    await mountBeansCardView();
});

// Coffee type modal
export const ensureCoffeeTypeCardMounted = createLazyMount('coffeeTypeCard', async () => {
    const { mountCoffeeTypeCardView } = await import('../features/coffees/coffee-type-card.mount.js');
    await mountCoffeeTypeCardView();
});

// Gas modal
export const ensureGasCardMounted = createLazyMount('gasCard', async () => {
    const { mountGasCardView } = await import('../features/gas/gas.mount.js');
    await mountGasCardView();
});

// Social modal
export const ensureSocialModalMounted = createLazyMount('socialModal', async () => {
    const { mountSocialModalView } = await import('../features/social/social.mount.js');
    await mountSocialModalView();
});

// Media modals (lightbox)
export const ensureMediaModalsMounted = createLazyMount('mediaModals', async () => {
    const { mountMediaModalsView } = await import('../features/media/media-modals.mount.js');
    await mountMediaModalsView();
});

// Stats modal
export const ensureStatsMounted = createLazyMount('stats', async () => {
    const { mountStatsView } = await import('../features/stats/stats.mount.js');
    await mountStatsView();
});

// Preferences modal
export const ensurePreferencesMounted = createLazyMount('preferences', async () => {
    const { mountPreferencesView } = await import('../features/preferences/preferences.mount.js');
    await mountPreferencesView();
});

// Import/Export modal
export const ensureImportExportMounted = createLazyMount('importExport', async () => {
    const { mountImportExportView } = await import('../features/import-export/import-export.mount.js');
    await mountImportExportView();
});

// Gallery modal
export const ensureGalleryMounted = createLazyMount('gallery', async () => {
    const { mountGalleryView } = await import('../features/gallery/gallery.mount.js');
    await mountGalleryView();
});

// Scales modal
export const ensureScalesMounted = createLazyMount('scales', async () => {
    const { mountScalesView } = await import('../features/scales/scales.mount.js');
    await mountScalesView();
});

// Devices modal
export const ensureDevicesMounted = createLazyMount('devices', async () => {
    const { mountDevicesView } = await import('../features/devices/devices.mount.js');
    await mountDevicesView();
});
