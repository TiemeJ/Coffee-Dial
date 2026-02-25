const renderSignedOutHelpCard = () => {
    const mount = document.getElementById('signedOutHelpCardMount');
    const helpPanel = document.querySelector('#helpModal > div');
    if (!mount || !helpPanel) return false;

    const panelClone = helpPanel.cloneNode(true);
    panelClone.firstElementChild?.remove();
    panelClone.lastElementChild?.remove();
    panelClone.classList.remove('max-h-[90vh]', 'overflow-hidden', 'flex', 'flex-col');
    panelClone.querySelector('.overflow-y-auto')?.classList.remove('overflow-y-auto');

    mount.innerHTML = '';
    mount.appendChild(panelClone);
    return true;
};

const mountSignedOutHelpCard = () => {
    if (renderSignedOutHelpCard()) return;
    if (!document.body) return;

    const observer = new MutationObserver(() => {
        if (renderSignedOutHelpCard()) {
            observer.disconnect();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
};

export const mountSignedOutAuth = async (mountId = 'authCardMount') => {
    const mount = document.getElementById(mountId);
    if (!mount) return;

    const response = await fetch('./src/features/auth/auth.view.html', { cache: 'no-cache' });
    if (!response.ok) {
        throw new Error(`Failed to load auth view: ${response.status}`);
    }

    mount.innerHTML = await response.text();
    mountSignedOutHelpCard();
};
