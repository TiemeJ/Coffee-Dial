export const createAppLifecycleModule = ({
    setCurrentUser,
    authStateChangedHandler,
    setDisplayedBrewsCount,
    renderTable,
    brewsPerPage
}) => {
    if (typeof setCurrentUser !== 'function') {
        throw new Error('createAppLifecycleModule requires setCurrentUser');
    }
    if (typeof authStateChangedHandler !== 'function') {
        throw new Error('createAppLifecycleModule requires authStateChangedHandler');
    }
    if (typeof setDisplayedBrewsCount !== 'function') {
        throw new Error('createAppLifecycleModule requires setDisplayedBrewsCount');
    }
    if (typeof renderTable !== 'function') {
        throw new Error('createAppLifecycleModule requires renderTable');
    }

    const handleAuthStateChanged = async (user) => {
        setCurrentUser(user);
        await authStateChangedHandler(user);
    };

    const bindGlobalSearchInput = () => {
        const searchInput = document.getElementById('globalSearch');
        if (!searchInput) return;
        searchInput.addEventListener('input', (event) => {
            const clearBtn = document.getElementById('searchClearBtn');
            if (event.target.value.length > 0) clearBtn?.classList.remove('hidden');
            else clearBtn?.classList.add('hidden');
            setDisplayedBrewsCount(brewsPerPage);
            renderTable();
        });
    };

    return {
        bindGlobalSearchInput,
        handleAuthStateChanged
    };
};
