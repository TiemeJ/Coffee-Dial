export const mountShellHeader = async (mountId = 'appHeaderMount') => {
    const mount = document.getElementById(mountId);
    if (!mount) return;
    if (mount.querySelector('#appHeader')) return;

    const response = await fetch('./src/features/shell/shell.view.html', { cache: 'no-cache' });
    if (!response.ok) {
        throw new Error(`Failed to load shell view: ${response.status}`);
    }

    mount.innerHTML = await response.text();
};
