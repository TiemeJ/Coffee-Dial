export const createBeansVmModule = () => {
    const formatCardDate = (value) => {
        if (!value) return '-';
        const dateObj = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
        if (isNaN(dateObj)) return '-';
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const yy = String(dateObj.getFullYear()).slice(-2);
        return `${dd}/${mm}/${yy}`;
    };

    const buildBeanCardViewModel = ({ bean, coffeeDisplay, stockLeft }) => {
        const statusParts = [];
        if (bean.archived) statusParts.push('Archived');
        if (bean.frozen) statusParts.push('Frozen');
        if (!statusParts.length) statusParts.push('Active');

        const stockLeftDisplay = stockLeft === null || isNaN(stockLeft) ? '-' : `${stockLeft.toFixed(1)}g`;
        const stockDisplay = bean.stock === undefined || bean.stock === null || bean.stock === '' ? '-' : `${bean.stock}g`;

        return {
            archivedDate: formatCardDate(bean.archivedDate),
            farmer: coffeeDisplay.farmer,
            frozenDate: formatCardDate(bean.frozenDate),
            openedDate: formatCardDate(bean.openedDate),
            origin: coffeeDisplay.origin,
            process: coffeeDisplay.processing,
            roastDate: formatCardDate(bean.roastDate),
            roastType: coffeeDisplay.roastType,
            roaster: coffeeDisplay.roaster !== '-' ? coffeeDisplay.roaster : 'Unknown Roaster',
            status: statusParts.join(' • '),
            stock: stockDisplay,
            stockLeft: stockLeftDisplay,
            variety: coffeeDisplay.variety
        };
    };

    return {
        buildBeanCardViewModel,
        formatCardDate
    };
};

