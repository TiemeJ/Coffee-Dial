export const createBrewsCardShareModule = ({
    getCoffees,
    setCurrentCoffeeCardId,
    getCurrentCardCoffee,
    getCoffeeTypeDisplay,
    setCurrentShareMode,
    cancelBrewQuickEditMode,
    resetCardPhotoState,
    populateCardData,
    updateCoffeeCardNav,
    html2canvas
}) => {
    const toggleCardMode = (mode) => {
        setCurrentShareMode(mode);
        const btnStats = document.getElementById('btnCardStats');
        const btnPhoto = document.getElementById('btnCardPhoto');
        const btnUpload = document.getElementById('btnUploadCardPhoto');
        const statsSection = document.getElementById('cardStatsSection');
        const photoSection = document.getElementById('cardPhotoSection');

        if (!btnStats || !btnPhoto || !btnUpload || !statsSection || !photoSection) return;

        if (mode === 'stats') {
            btnStats.className = 'px-3 py-1.5 text-xs font-bold rounded shadow-sm bg-white dark:bg-[#292524] text-coffee-800 dark:text-white transition-all';
            btnPhoto.className = 'px-3 py-1.5 text-xs font-bold rounded text-coffee-500 dark:text-[#78716c] hover:text-coffee-700 dark:hover:text-[#d6ccc2] transition-all';
            statsSection.classList.remove('hidden');
            photoSection.classList.add('hidden');
            btnUpload.classList.add('hidden');
        } else {
            btnPhoto.className = 'px-3 py-1.5 text-xs font-bold rounded shadow-sm bg-white dark:bg-[#292524] text-coffee-800 dark:text-white transition-all';
            btnStats.className = 'px-3 py-1.5 text-xs font-bold rounded text-coffee-500 dark:text-[#78716c] hover:text-coffee-700 dark:hover:text-[#d6ccc2] transition-all';
            photoSection.classList.remove('hidden');
            statsSection.classList.add('hidden');
            btnUpload.classList.remove('hidden');
        }
    };

    const shareCoffeeCard = (id, e) => {
        if (e) e.stopPropagation();
        const c = getCoffees().find((x) => x.id === id);
        if (!c) return;

        setCurrentCoffeeCardId(id);
        cancelBrewQuickEditMode();
        document.querySelectorAll('.action-menu').forEach((el) => el.classList.add('hidden'));
        resetCardPhotoState();
        toggleCardMode('stats');
        document.getElementById('shareControls')?.classList.remove('hidden');
        populateCardData(c);
        document.getElementById('coffeeCardOverlay')?.classList.remove('hidden');
        updateCoffeeCardNav();
    };

    const generateShareImage = async () => {
        const c = getCurrentCardCoffee();
        const content = document.getElementById('coffeeCardContent');
        const shareControls = document.getElementById('shareControls');
        const closeBtn = document.getElementById('cardCloseBtn');
        const bottomBar = document.getElementById('cardBottomBar');
        const improveContainer = document.getElementById('cardImproveContainer');
        if (!content || !shareControls || !closeBtn || !bottomBar || !improveContainer) return;

        shareControls.classList.add('hidden');
        closeBtn.classList.add('hidden');
        bottomBar.style.display = 'none';
        const wasImproveVisible = !improveContainer.classList.contains('hidden');
        if (wasImproveVisible) improveContainer.classList.add('hidden');

        const originalTransform = content.style.transform;
        content.style.transform = 'none';

        try {
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const canvas = await html2canvas(content, {
                scale: 2,
                backgroundColor: getComputedStyle(content).backgroundColor,
                useCORS: true,
                logging: false,
                allowTaint: false
            });

            shareControls.classList.remove('hidden');
            closeBtn.classList.remove('hidden');
            bottomBar.style.display = '';
            content.style.transform = originalTransform;
            if (wasImproveVisible) improveContainer.classList.remove('hidden');

            canvas.toBlob(async (blob) => {
                if (!blob) return alert('Failed to generate image data');
                const shareType = getCoffeeTypeDisplay(c || {});
                const fileName = `brew_${(shareType.roaster !== '-' ? shareType.roaster : 'coffee').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.png`;
                const file = new File([blob], fileName, { type: 'image/png' });

                if (navigator.share) {
                    try {
                        if (navigator.canShare && navigator.canShare({ files: [file] })) {
                            await navigator.share({
                                files: [file],
                                title: 'Coffee Dial Brew',
                                text: `Check out this brew of ${shareType.roaster !== '-' ? shareType.roaster : 'coffee'}!`
                            });
                        } else {
                            throw new Error('Device does not support file sharing.');
                        }
                    } catch (err) {
                        if (err.name !== 'AbortError') {
                            console.error('Share failed:', err);
                            const dataUrl = canvas.toDataURL();
                            const win = window.open();
                            if (win) {
                                win.document.write(`<img src="${dataUrl}" style="width:100%"/>`);
                                win.document.write('<h3 style="font-family:sans-serif; text-align:center;">Long press image to Share</h3>');
                            } else {
                                alert('Sharing failed and pop-up blocked. Please screenshot instead.');
                            }
                        }
                    }
                } else {
                    const link = document.createElement('a');
                    link.download = fileName;
                    link.href = canvas.toDataURL();
                    link.click();
                }
            }, 'image/png', 0.9);
        } catch (err) {
            console.error('Card generation failed', err);
            shareControls.classList.remove('hidden');
            closeBtn.classList.remove('hidden');
            bottomBar.style.display = '';
            content.style.transform = originalTransform;
            if (wasImproveVisible) improveContainer.classList.remove('hidden');
            alert('Could not generate card image. Please try taking a screenshot.');
        }
    };

    return {
        toggleCardMode,
        shareCoffeeCard,
        generateShareImage
    };
};
