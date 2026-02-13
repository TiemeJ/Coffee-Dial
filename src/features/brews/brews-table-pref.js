export const createBrewsTablePrefModule = ({
    columnDefs,
    getColumnPreferences,
    setColumnPreferences,
    renderTable
}) => {
    const columnPreferencesKey = 'columnPreferences';

    const loadColumnPreferencesFromStorage = () => {
        const raw = localStorage.getItem(columnPreferencesKey);
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                setColumnPreferences({ ...getColumnPreferences(), ...parsed });
            }
        } catch (err) {
            console.error('Failed to parse column preferences', err);
        }
    };

    const saveColumnPreferencesToStorage = (prefs) => {
        localStorage.setItem(columnPreferencesKey, JSON.stringify(prefs));
    };

    const renderBrewsTablePrefsList = () => {
        const list = document.getElementById('brewsTablePrefsList');
        if (!list) return;

        list.innerHTML = '';
        const columnPreferences = getColumnPreferences();
        columnDefs.forEach((col) => {
            const isChecked = columnPreferences[col.id] !== false;
            const row = document.createElement('div');
            row.className =
                'flex items-center justify-between p-2 rounded bg-coffee-50 dark:bg-[#1c1917] border border-coffee-100 dark:border-[#44403c]';
            row.innerHTML = `<span class="text-sm font-medium text-coffee-800 dark:text-[#d6ccc2]">${col.label}</span><div class="relative inline-block w-10 align-middle select-none"><input type="checkbox" id="brew_pref_${col.id}" ${isChecked ? 'checked' : ''} class="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300 dark:border-gray-600"/><label for="brew_pref_${col.id}" class="toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 dark:bg-gray-700 cursor-pointer"></label></div>`;
            list.appendChild(row);
        });
    };

    const openBrewsTablePrefs = () => {
        renderBrewsTablePrefsList();
        document.getElementById('brewsTablePrefsModal')?.classList.remove('hidden');
    };

    const hideBrewsTablePrefsModal = () => {
        document.getElementById('brewsTablePrefsModal')?.classList.add('hidden');
    };

    const saveBrewsTablePrefs = () => {
        const newPrefs = {};
        columnDefs.forEach((col) => {
            const cb = document.getElementById(`brew_pref_${col.id}`);
            newPrefs[col.id] = !!cb?.checked;
        });

        setColumnPreferences(newPrefs);
        saveColumnPreferencesToStorage(newPrefs);
        hideBrewsTablePrefsModal();
        renderTable();
    };

    return {
        columnPreferencesKey,
        loadColumnPreferencesFromStorage,
        saveColumnPreferencesToStorage,
        openBrewsTablePrefs,
        hideBrewsTablePrefsModal,
        saveBrewsTablePrefs
    };
};
