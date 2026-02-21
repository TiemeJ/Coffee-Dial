export const createMediaModalsModule = ({ getCoffeeScale }) => {
    let zoomState = { scale: 1, x: 0, y: 0 };
    let panStart = { x: 0, y: 0 };
    let isPanning = false;
    let zoomListenersInitialized = false;
    let lightboxListenersInitialized = false;
    let lightboxItems = [];
    let lightboxIndex = 0;
    let lightboxZoom = { scale: 1, x: 0, y: 0 };
    let lightboxPanStart = { x: 0, y: 0 };
    let lightboxPanning = false;

    const ensureOverlayLayering = () => {
        const imageOverlay = document.getElementById('imageModalOverlay');
        const lightboxOverlay = document.getElementById('lightboxOverlay');
        if (imageOverlay) {
            if (imageOverlay.parentElement !== document.body) document.body.appendChild(imageOverlay);
            imageOverlay.style.zIndex = '2147482000';
        }
        if (lightboxOverlay) {
            if (lightboxOverlay.parentElement !== document.body) document.body.appendChild(lightboxOverlay);
            lightboxOverlay.style.zIndex = '2147483000';
        }
    };

    const updateImage = () => {
        const img = document.getElementById('zoomableImage');
        if (img) img.style.transform = `translate(${zoomState.x}px, ${zoomState.y}px) scale(${zoomState.scale})`;
    };

    const resetZoom = () => {
        zoomState = { scale: 1, x: 0, y: 0 };
        const img = document.getElementById('zoomableImage');
        if (img) {
            img.style.transform = 'translate(0px, 0px) scale(1)';
            img.style.cursor = 'grab';
        }
    };

    const openImageModal = () => {
        ensureOverlayLayering();
        document.getElementById('imageModalOverlay')?.classList.remove('hidden');
        resetZoom();
    };

    const closeImageModal = (e) => {
        if (!e || e.target.id === 'imageModalOverlay' || e.target.closest('button')) {
            document.getElementById('imageModalOverlay')?.classList.add('hidden');
        }
    };

    const openGraphModal = () => {
        const modal = document.getElementById('graphModal');
        if (!modal) return;
        modal.classList.remove('hidden');
        requestAnimationFrame(() => {
            const coffeeScale = getCoffeeScale?.();
            if (coffeeScale?.renderGraphTo) {
                coffeeScale.renderGraphTo(document.getElementById('graph'));
            }
        });
    };

    const closeGraphModal = () => {
        document.getElementById('graphModal')?.classList.add('hidden');
    };

    const initZoomListeners = () => {
        if (zoomListenersInitialized) return;
        const container = document.getElementById('imageContainer');
        const img = document.getElementById('zoomableImage');
        if (!container || !img) return;

        zoomListenersInitialized = true;

        container.addEventListener(
            'wheel',
            (e) => {
                e.preventDefault();
                const delta = e.deltaY * -0.002;
                const newScale = Math.min(Math.max(0.5, zoomState.scale + delta), 5);
                zoomState.scale = newScale;
                updateImage();
            },
            { passive: false }
        );

        container.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isPanning = true;
            panStart = { x: e.clientX - zoomState.x, y: e.clientY - zoomState.y };
            img.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isPanning) return;
            e.preventDefault();
            zoomState.x = e.clientX - panStart.x;
            zoomState.y = e.clientY - panStart.y;
            updateImage();
        });

        document.addEventListener('mouseup', () => {
            if (isPanning) {
                isPanning = false;
                img.style.cursor = 'grab';
            }
        });

        container.addEventListener('dblclick', (e) => {
            e.preventDefault();
            resetZoom();
        });

        let initialDist = 0;
        let initialScale = 1;

        container.addEventListener(
            'touchstart',
            (e) => {
                if (e.touches.length === 2) {
                    e.preventDefault();
                    initialDist = Math.hypot(
                        e.touches[0].pageX - e.touches[1].pageX,
                        e.touches[0].pageY - e.touches[1].pageY
                    );
                    initialScale = zoomState.scale;
                } else if (e.touches.length === 1) {
                    isPanning = true;
                    panStart = {
                        x: e.touches[0].pageX - zoomState.x,
                        y: e.touches[0].pageY - zoomState.y
                    };
                }
            },
            { passive: false }
        );

        container.addEventListener(
            'touchmove',
            (e) => {
                if (e.touches.length === 2) {
                    e.preventDefault();
                    const dist = Math.hypot(
                        e.touches[0].pageX - e.touches[1].pageX,
                        e.touches[0].pageY - e.touches[1].pageY
                    );
                    if (initialDist > 0) {
                        zoomState.scale = Math.min(Math.max(0.5, initialScale * (dist / initialDist)), 5);
                        updateImage();
                    }
                } else if (e.touches.length === 1 && isPanning) {
                    e.preventDefault();
                    zoomState.x = e.touches[0].pageX - panStart.x;
                    zoomState.y = e.touches[0].pageY - panStart.y;
                    updateImage();
                }
            },
            { passive: false }
        );

        container.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) initialDist = 0;
            if (e.touches.length === 0) isPanning = false;
        });

        initLightboxListeners();
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

    const openLightbox = ({ items = [], startIndex = 0 } = {}) => {
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
        openImageModal,
        closeImageModal,
        openLightbox,
        openLightboxAtUrl,
        closeLightbox,
        showPrevLightboxImage,
        showNextLightboxImage,
        resetZoom,
        initZoomListeners
    };
};
