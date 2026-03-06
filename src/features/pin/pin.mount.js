export const mountPinnedSection = async (mountId = 'pinnedSectionMount') => {
    const mount = document.getElementById(mountId);
    if (!mount) return;

    // Skip fetch if already inlined in index.html
    if (document.getElementById('pinnedSection')) return;

    const response = await fetch('./src/features/pin/pin.view.html', { cache: 'no-cache' });
    if (!response.ok) {
        throw new Error(`Failed to load pin view: ${response.status}`);
    }

    mount.innerHTML = await response.text();
};
