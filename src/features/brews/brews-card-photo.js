export const createBrewsCardPhotoModule = () => {
    const resetCardPhotoState = () => {
        const img = document.getElementById('cardDisplayedPhoto');
        const ph = document.getElementById('cardPhotoPlaceholder');
        const input = document.getElementById('cardPhotoInput');
        if (!img || !ph || !input) return;
        img.src = '';
        img.classList.add('hidden');
        ph.classList.remove('hidden');
        input.value = '';
    };

    const triggerCardPhoto = () => {
        document.getElementById('cardPhotoInput')?.click();
    };

    const handleCardPhoto = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.getElementById('cardDisplayedPhoto');
            const ph = document.getElementById('cardPhotoPlaceholder');
            const container = document.getElementById('cardPhotoSection');
            if (!img || !ph || !container) return;

            img.onload = () => {
                const containerW = container.offsetWidth;
                const containerH = container.offsetHeight;
                const imgW = img.naturalWidth;
                const imgH = img.naturalHeight;
                const containerRatio = containerW / containerH;
                const imgRatio = imgW / imgH;
                let finalW;
                let finalH;
                let finalTop;
                let finalLeft;

                if (imgRatio > containerRatio) {
                    finalH = containerH;
                    finalW = imgW * (containerH / imgH);
                    finalTop = 0;
                    finalLeft = (containerW - finalW) / 2;
                } else {
                    finalW = containerW;
                    finalH = imgH * (containerW / imgW);
                    finalLeft = 0;
                    finalTop = (containerH - finalH) / 2;
                }

                img.style.width = `${finalW}px`;
                img.style.height = `${finalH}px`;
                img.style.top = `${finalTop}px`;
                img.style.left = `${finalLeft}px`;
                img.classList.remove('hidden');
                ph.classList.add('hidden');
            };

            img.src = e.target.result;
        };

        reader.readAsDataURL(file);
    };

    return {
        resetCardPhotoState,
        triggerCardPhoto,
        handleCardPhoto
    };
};
