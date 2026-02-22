export const createOpenAddBrewFromPinned = ({
    openBrewFormModal
}) => {
    return (event = null) => {
        openBrewFormModal(event, { reset: true, title: 'Add new brew' });
    };
};
