export const registerBrewsFilterCommands = ({
    appCommands,
    clearSearch,
    clearAllFilters,
    applyFilter,
    renderTable,
    renderActiveFilters,
    getBrewsPerPage,
    setDisplayedBrewsCount
}) => {
    if (!appCommands?.registerCommand) {
        throw new Error('registerBrewsFilterCommands requires appCommands.registerCommand');
    }

    appCommands.registerCommand(
        'brews.showForGear',
        ({ gearId } = {}) => {
            if (!gearId) return;
            clearSearch();
            clearAllFilters();
            applyFilter('gear', gearId);
            setDisplayedBrewsCount(getBrewsPerPage());
            renderTable();
            renderActiveFilters();
            document.getElementById('brewsTableMount')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
        {
            owner: 'brews',
            schema: {
                gearId: 'string'
            }
        }
    );
};
