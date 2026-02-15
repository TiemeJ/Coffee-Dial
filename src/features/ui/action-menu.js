export const createActionMenuModule = () => {
    const toggleActionMenu = (menuId, e) => {
        const eventObj = e;
        if (eventObj?.stopPropagation) eventObj.stopPropagation();
        document.querySelectorAll('.action-menu').forEach((el) => {
            if (el.id !== menuId) el.classList.add('hidden');
        });
        const menu = document.getElementById(menuId);
        if (!menu) return;

        menu.classList.toggle('hidden');
        if (menu.classList.contains('hidden')) return;

        menu.style.top = '';
        menu.style.bottom = '';
        menu.style.left = '';
        menu.style.right = '';
        menu.style.marginTop = '';
        menu.style.marginBottom = '';

        setTimeout(() => {
            const rect = menu.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const headerHeight = 70;
            const isTableMenu = menuId.startsWith('action-menu-');

            if (isTableMenu) {
                menu.style.top = '100%';
                menu.style.bottom = 'auto';
                menu.style.marginTop = '0.25rem';
                menu.style.marginBottom = '0';
                menu.classList.remove('origin-bottom-right');
                menu.classList.add('origin-top-right');
            } else {
                const overflowsBottom = rect.bottom > viewportHeight - 20;
                const wouldOverflowTop = rect.top - rect.height < headerHeight;
                if (overflowsBottom && !wouldOverflowTop) {
                    menu.style.top = 'auto';
                    menu.style.bottom = '100%';
                    menu.style.marginTop = '0';
                    menu.style.marginBottom = '0.5rem';
                    menu.classList.remove('origin-top-right');
                    menu.classList.add('origin-bottom-right');
                } else {
                    menu.style.top = '100%';
                    menu.style.bottom = 'auto';
                    menu.style.marginTop = '0.5rem';
                    menu.style.marginBottom = '0';
                    menu.classList.remove('origin-bottom-right');
                    menu.classList.add('origin-top-right');
                }
            }

            const menuWidth = rect.width;
            const menuLeft = rect.left;
            if (menuLeft < 10) {
                menu.style.right = 'auto';
                menu.style.left = '0';
                menu.classList.remove('origin-top-right', 'origin-bottom-right');
                menu.classList.add(menu.style.bottom === '100%' ? 'origin-bottom-left' : 'origin-top-left');
            } else if (menuLeft + menuWidth > viewportWidth - 10) {
                menu.style.left = 'auto';
                menu.style.right = '0';
            }
        }, 0);
    };

    return { toggleActionMenu };
};
