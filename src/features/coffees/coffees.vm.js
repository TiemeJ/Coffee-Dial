export const createCoffeesVmModule = () => {
    const toTableRow = (type = {}) => {
        const roaster = type.roaster || 'Unknown';
        const farmer = type.farmer || '-';
        const origin = type.origin || '-';
        const processing = type.processing || '-';
        const variety = type.variety || '-';
        const roast = type.roast || type.roastType || '-';
        const rating = parseInt(type.rating, 10) || 0;
        const createdAt = type.createdAt ? new Date(type.createdAt).toLocaleDateString() : '-';
        const decaf = !!type.decaf;
        return { createdAt, decaf, farmer, origin, processing, rating, roast, roaster, variety };
    };

    const toCardView = (type = {}) => {
        return {
            createdAt: type.createdAt ? new Date(type.createdAt).toLocaleDateString() : '-',
            farmer: type.farmer || 'Unknown',
            imageUrl: type.imageUrl || type.imageURL || '',
            origin: type.origin || '-',
            processing: type.processing || '-',
            rating: parseInt(type.rating, 10) || 0,
            roast: type.roast || type.roastType || '-',
            roaster: type.roaster || '',
            decaf: !!type.decaf,
            shopUrl: type.webshopUrl || type.shopUrl || '',
            tasteNotes: (type.tasteNotes || '').trim(),
            variety: type.variety || '-'
        };
    };

    return {
        toCardView,
        toTableRow
    };
};
