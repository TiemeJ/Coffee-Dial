export const createScaleModalsModule = ({ getCoffeeScale }) => {
    const openCoffeeScaleModal = () => {
        document.getElementById('coffeeScaleModal')?.classList.remove('hidden');
        const coffeeScale = getCoffeeScale?.();
        if (coffeeScale?.autoConnect) coffeeScale.autoConnect();
    };

    const closeCoffeeScaleModal = () => {
        document.getElementById('coffeeScaleModal')?.classList.add('hidden');
    };

    const openConnectScaleModal = () => {
        document.getElementById('connectScaleModal')?.classList.remove('hidden');
        const coffeeScale = getCoffeeScale?.();
        if (coffeeScale?.autoConnect) coffeeScale.autoConnect();
    };

    const closeConnectScaleModal = () => {
        document.getElementById('connectScaleModal')?.classList.add('hidden');
    };

    return {
        openCoffeeScaleModal,
        closeCoffeeScaleModal,
        openConnectScaleModal,
        closeConnectScaleModal
    };
};
