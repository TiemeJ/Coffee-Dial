export const sortPinnedBrewsByOrder = (coffees = []) => {
    return [...(Array.isArray(coffees) ? coffees : [])]
        .filter((brew) => brew?.isActive)
        .sort((a, b) => {
            const orderDelta = (a.customOrder || 0) - (b.customOrder || 0);
            if (orderDelta !== 0) return orderDelta;
            return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        });
};

export const selectPinnedBrewOrderIds = (coffees = []) => {
    return sortPinnedBrewsByOrder(coffees).map((brew) => brew.id);
};
