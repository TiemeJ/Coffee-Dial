const mountView = async (mountId, viewPath) => {
    const mount = document.getElementById(mountId);
    if (!mount) return;

    const response = await fetch(viewPath, { cache: 'no-cache' });
    if (!response.ok) {
        throw new Error(`Failed to load view ${viewPath}: ${response.status}`);
    }

    mount.innerHTML = await response.text();
};

export const mountBeansTableView = async () => {
    await mountView('beansTableMount', './src/features/beans/beans-table.view.html');
};

export const mountBeansCardView = async () => {
    await mountView('beansCardMount', './src/features/beans/beans-card.view.html');
};
