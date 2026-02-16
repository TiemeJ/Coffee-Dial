export const createCoffeeDisplayModule = ({ getBeans, getCoffeeTypes }) => {
    const getCoffeeTypeForBrew = (brew) => {
        if (!brew || !brew.beanId) return null;
        const bean = getBeans().find((b) => b.id === brew.beanId);
        if (!bean || !bean.coffeeTypeId) return null;
        return getCoffeeTypes().find((ct) => ct.id === bean.coffeeTypeId) || null;
    };

    const getCoffeeTypeDisplay = (brew) => {
        const type = getCoffeeTypeForBrew(brew);
        return {
            roaster: type?.roaster || brew?.roaster || '-',
            farmer: type?.farmer || brew?.farmer || '-',
            origin: type?.origin || brew?.origin || '-',
            processing: type?.processing || brew?.processing || '-',
            variety: type?.variety || brew?.variety || '-',
            roastType: type?.roast || type?.roastType || brew?.roastType || '-',
            decaf: !!(type?.decaf || brew?.decaf)
        };
    };

    const getCoffeeTypeForBean = (bean) => {
        if (!bean || !bean.coffeeTypeId) return null;
        return getCoffeeTypes().find((ct) => ct.id === bean.coffeeTypeId) || null;
    };

    const getBeanCoffeeTypeDisplay = (bean) => {
        const type = getCoffeeTypeForBean(bean);
        return {
            roaster: type?.roaster || bean?.roaster || '-',
            farmer: type?.farmer || bean?.farmer || '-',
            origin: type?.origin || bean?.origin || '-',
            processing: type?.processing || bean?.processing || '-',
            variety: type?.variety || bean?.variety || '-',
            roastType: type?.roast || type?.roastType || bean?.roastType || '-',
            decaf: !!(type?.decaf || bean?.decaf)
        };
    };

    return {
        getCoffeeTypeForBrew,
        getCoffeeTypeDisplay,
        getCoffeeTypeForBean,
        getBeanCoffeeTypeDisplay
    };
};
