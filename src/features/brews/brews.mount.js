const mountView = async (mountId, viewPath) => {
    const mount = document.getElementById(mountId);
    if (!mount) return;

    const response = await fetch(viewPath, { cache: 'no-cache' });
    if (!response.ok) {
        throw new Error(`Failed to load view ${viewPath}: ${response.status}`);
    }

    mount.innerHTML = await response.text();
};

export const mountBrewsFormView = async () => {
    await mountView('brewsFormMount', './src/features/brews/brews-form.view.html');
};

export const mountBrewsTableView = async () => {
    await mountView('brewsTableMount', './src/features/brews/brews-table.view.html');
};

export const mountBrewsCardView = async () => {
    await mountView('brewsCardMount', './src/features/brews/brews-card.view.html');
};
