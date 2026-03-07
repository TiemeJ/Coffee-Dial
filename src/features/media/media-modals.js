export const createMediaModalsModule = ({
    dispatchCommand,
    ensureMediaModalsMounted = null,
    ensureGraphModalsMounted = null,
    ensureGraphScaleBindings = null,
    syncDeviceIndicators = null
}) => {
    let lightboxListenersInitialized = false;
    let lightboxItems = [];
    let lightboxIndex = 0;
    let lightboxZoom = { scale: 1, x: 0, y: 0 };
    let lightboxPanStart = { x: 0, y: 0 };
    let lightboxPanning = false;

    const ensureOverlayLayering = () => {
        const lightboxOverlay = document.getElementById('lightboxOverlay');
        if (lightboxOverlay) {
            if (lightboxOverlay.parentElement !== document.body) document.body.appendChild(lightboxOverlay);
            lightboxOverlay.style.zIndex = '2147483000';
        }
    };

    const openScaWheelLightbox = () => {
        openLightbox({
            items: [{ url: 'img/SCA_wheel.png', alt: 'SCA Flavor Wheel' }],
            startIndex: 0
        });
    };

    const openGraphModal = async () => {
        if (typeof ensureGraphModalsMounted === 'function') {
            await ensureGraphModalsMounted();
        }
        // Sync device indicator state into the freshly-mounted graph modal DOM
        if (typeof syncDeviceIndicators === 'function') {
            await syncDeviceIndicators();
        }
        if (typeof ensureGraphScaleBindings === 'function') {
            await ensureGraphScaleBindings();
        }
        const modal = document.getElementById('graphModal');
        if (!modal) return;
        modal.classList.remove('hidden');
        requestAnimationFrame(async () => {
            try {
                await dispatchCommand?.('scales.renderGraph', { canvasId: 'graph' });
            } catch (error) {
                console.error('Graph modal render command failed:', error);
            }
        });
    };

    const closeGraphModal = () => {
        document.getElementById('graphModal')?.classList.add('hidden');
    };

    const normalizeLightboxItems = (items = []) =>
        items
            .filter((item) => item && typeof item.url === 'string' && item.url.trim())
            .map((item) => ({
                url: item.url.trim(),
                alt: typeof item.alt === 'string' && item.alt.trim() ? item.alt.trim() : 'Image preview'
            }));

    const getLightboxElements = () => ({
        overlay: document.getElementById('lightboxOverlay'),
        viewport: document.getElementById('lightboxViewport'),
        image: document.getElementById('lightboxImage'),
        prevBtn: document.getElementById('lightboxPrevBtn'),
        nextBtn: document.getElementById('lightboxNextBtn'),
        closeBtn: document.getElementById('lightboxCloseBtn'),
        counter: document.getElementById('lightboxCounter')
    });

    const updateLightboxImageTransform = () => {
        const { image } = getLightboxElements();
        if (!image) return;
        image.style.transform = `translate(${lightboxZoom.x}px, ${lightboxZoom.y}px) scale(${lightboxZoom.scale})`;
    };

    const resetLightboxZoom = () => {
        lightboxZoom = { scale: 1, x: 0, y: 0 };
        const { image } = getLightboxElements();
        if (!image) return;
        image.style.transform = 'translate(0px, 0px) scale(1)';
        image.style.cursor = 'grab';
    };

    const updateLightboxUi = () => {
        const { image, prevBtn, nextBtn, counter } = getLightboxElements();
        if (!image) return;
        const item = lightboxItems[lightboxIndex];
        if (!item) return;
        image.src = item.url;
        image.alt = item.alt;
        const hasMultiple = lightboxItems.length > 1;
        if (prevBtn) prevBtn.classList.toggle('hidden', !hasMultiple);
        if (nextBtn) nextBtn.classList.toggle('hidden', !hasMultiple);
        if (counter) {
            counter.classList.toggle('hidden', !hasMultiple);
            counter.textContent = hasMultiple ? `${lightboxIndex + 1} / ${lightboxItems.length}` : '';
        }
        resetLightboxZoom();
    };

    const closeLightbox = (event = null) => {
        const { overlay } = getLightboxElements();
        if (!overlay) return;
        if (event) {
            const target = event.target;
            if (target && target !== overlay && target.id !== 'lightboxViewport') return;
        }
        overlay.classList.add('hidden');
    };

    const openLightbox = async ({ items = [], startIndex = 0 } = {}) => {
        await ensureMediaModalsMounted?.();
        ensureOverlayLayering();
        initLightboxListeners();
        const normalized = normalizeLightboxItems(items);
        if (!normalized.length) return;
        const { overlay } = getLightboxElements();
        if (!overlay) return;
        lightboxItems = normalized;
        lightboxIndex = Math.max(0, Math.min(startIndex, normalized.length - 1));
        overlay.classList.remove('hidden');
        updateLightboxUi();
    };

    const openLightboxAtUrl = ({ url, items = [], alt = 'Image preview' } = {}) => {
        const normalized = normalizeLightboxItems(items);
        const targetUrl = (url || '').toString().trim();
        if (!targetUrl && !normalized.length) return;
        if (!normalized.length) {
            openLightbox({ items: [{ url: targetUrl, alt }], startIndex: 0 });
            return;
        }
        const index = normalized.findIndex((entry) => entry.url === targetUrl);
        openLightbox({
            items: normalized,
            startIndex: index >= 0 ? index : 0
        });
    };

    const showPrevLightboxImage = (event = null) => {
        if (event) event.stopPropagation();
        if (lightboxItems.length <= 1) return;
        lightboxIndex = (lightboxIndex - 1 + lightboxItems.length) % lightboxItems.length;
        updateLightboxUi();
    };

    const showNextLightboxImage = (event = null) => {
        if (event) event.stopPropagation();
        if (lightboxItems.length <= 1) return;
        lightboxIndex = (lightboxIndex + 1) % lightboxItems.length;
        updateLightboxUi();
    };

    const initLightboxListeners = () => {
        if (lightboxListenersInitialized) return;
        const { overlay, viewport, image, prevBtn, nextBtn, closeBtn } = getLightboxElements();
        if (!overlay || !viewport || !image) return;
        lightboxListenersInitialized = true;

        overlay.addEventListener('click', (event) => {
            if (event.target === overlay || event.target === viewport) closeLightbox();
        });
        closeBtn?.addEventListener('click', () => closeLightbox());
        prevBtn?.addEventListener('click', showPrevLightboxImage);
        nextBtn?.addEventListener('click', showNextLightboxImage);

        viewport.addEventListener(
            'wheel',
            (event) => {
                event.preventDefault();
                const delta = event.deltaY * -0.002;
                lightboxZoom.scale = Math.min(Math.max(0.5, lightboxZoom.scale + delta), 5);
                updateLightboxImageTransform();
            },
            { passive: false }
        );

        viewport.addEventListener('mousedown', (event) => {
            event.preventDefault();
            lightboxPanning = true;
            lightboxPanStart = { x: event.clientX - lightboxZoom.x, y: event.clientY - lightboxZoom.y };
            image.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (event) => {
            if (!lightboxPanning) return;
            event.preventDefault();
            lightboxZoom.x = event.clientX - lightboxPanStart.x;
            lightboxZoom.y = event.clientY - lightboxPanStart.y;
            updateLightboxImageTransform();
        });

        document.addEventListener('mouseup', () => {
            if (!lightboxPanning) return;
            lightboxPanning = false;
            image.style.cursor = 'grab';
        });

        viewport.addEventListener('dblclick', (event) => {
            event.preventDefault();
            resetLightboxZoom();
        });

        let touchInitialDist = 0;
        let touchInitialScale = 1;
        viewport.addEventListener(
            'touchstart',
            (event) => {
                if (event.touches.length === 2) {
                    event.preventDefault();
                    touchInitialDist = Math.hypot(
                        event.touches[0].pageX - event.touches[1].pageX,
                        event.touches[0].pageY - event.touches[1].pageY
                    );
                    touchInitialScale = lightboxZoom.scale;
                } else if (event.touches.length === 1) {
                    lightboxPanning = true;
                    lightboxPanStart = {
                        x: event.touches[0].pageX - lightboxZoom.x,
                        y: event.touches[0].pageY - lightboxZoom.y
                    };
                }
            },
            { passive: false }
        );

        viewport.addEventListener(
            'touchmove',
            (event) => {
                if (event.touches.length === 2) {
                    event.preventDefault();
                    const dist = Math.hypot(
                        event.touches[0].pageX - event.touches[1].pageX,
                        event.touches[0].pageY - event.touches[1].pageY
                    );
                    if (touchInitialDist > 0) {
                        lightboxZoom.scale = Math.min(Math.max(0.5, touchInitialScale * (dist / touchInitialDist)), 5);
                        updateLightboxImageTransform();
                    }
                } else if (event.touches.length === 1 && lightboxPanning) {
                    event.preventDefault();
                    lightboxZoom.x = event.touches[0].pageX - lightboxPanStart.x;
                    lightboxZoom.y = event.touches[0].pageY - lightboxPanStart.y;
                    updateLightboxImageTransform();
                }
            },
            { passive: false }
        );

        viewport.addEventListener('touchend', (event) => {
            if (event.touches.length < 2) touchInitialDist = 0;
            if (event.touches.length === 0) lightboxPanning = false;
        });
    };

    return {
        openGraphModal,
        closeGraphModal,
        openScaWheelLightbox,
        openLightbox,
        openLightboxAtUrl,
        closeLightbox,
        showPrevLightboxImage,
        showNextLightboxImage,
        resetLightboxZoom,
        initLightboxListeners
    };
};
