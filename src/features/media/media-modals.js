export const createMediaModalsModule = ({ getCoffeeScale }) => {
    let zoomState = { scale: 1, x: 0, y: 0 };
    let panStart = { x: 0, y: 0 };
    let isPanning = false;
    let zoomListenersInitialized = false;

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
    };

    return {
        openGraphModal,
        closeGraphModal,
        openImageModal,
        closeImageModal,
        resetZoom,
        initZoomListeners
    };
};
