const mountView = async (mountId, viewPath) => {
    const mount = document.getElementById(mountId);
    if (!mount) return;

    const response = await fetch(viewPath, { cache: 'no-cache' });
    if (!response.ok) {
        throw new Error(`Failed to load view ${viewPath}: ${response.status}`);
    }

    mount.innerHTML = await response.text();
};

export const mountCoffeeTypeCardView = async () => {
    await mountView('coffeeTypeCardMount', './src/features/coffees/coffee-type-card.view.html');
};
