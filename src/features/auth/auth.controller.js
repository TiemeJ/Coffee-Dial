export const mountSignedOutAuth = async (mountId = 'authCardMount') => {
    const mount = document.getElementById(mountId);
    if (!mount) return;

    const response = await fetch('./src/features/auth/auth.view.html', { cache: 'no-cache' });
    if (!response.ok) {
        throw new Error(`Failed to load auth view: ${response.status}`);
    }

    mount.innerHTML = await response.text();
};
