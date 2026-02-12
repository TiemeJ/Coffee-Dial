const mountView = async (mountId, viewPath) => {
    const mount = document.getElementById(mountId);
    if (!mount) return;

    const response = await fetch(viewPath, { cache: 'no-cache' });
    if (!response.ok) {
        throw new Error(`Failed to load view ${viewPath}: ${response.status}`);
    }

    mount.innerHTML = await response.text();
};

export const mountGasTableView = async () => {
    await mountView('gasTableMount', './src/features/gas/gas-table.view.html');
};

export const mountGasCardView = async () => {
    await mountView('gasCardMount', './src/features/gas/gas-card.view.html');
};
