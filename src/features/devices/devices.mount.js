const mountView = async (mountId, viewPath) => {
    const mount = document.getElementById(mountId);
    if (!mount) return;

    const response = await fetch(viewPath, { cache: 'no-cache' });
    if (!response.ok) {
        throw new Error(`Failed to load view: ${viewPath}`);
    }

    mount.innerHTML = await response.text();
};

export const mountDevicesView = async () => {
    await mountView('devicesModalMount', './src/features/devices/devices.view.html');
};
