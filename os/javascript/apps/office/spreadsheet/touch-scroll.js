// touch-scroll.js
// ズーム制御・ホイール横スクロール・1本指タッチパン＆慣性スクロール・2本指ピンチズーム

export function createTouchScrollModule(ctx) {
    const {
        appRoot,
        container,
        spreadsheetContent,
        zoomSlider,
        zoomDisplay,
        signal,
        refreshVisibleRows,
        syncCellDropdownButtonPosition,
        syncCopyAntsBoxPosition,
        scheduleTextOverflowUpdate,
        refreshFormulaRefOverlay,
        setDirtyState,
        debouncedSaveState
    } = ctx;

    let zoomValue = 100;

    function getZoom() {
        return zoomValue;
    }

    function setZoom(nextZoom, { silent = false } = {}) {
        const normalizedZoom = Math.min(200, Math.max(20, Math.round(nextZoom / 5) * 5));
        const changed = zoomValue !== normalizedZoom;
        zoomValue = normalizedZoom;
        spreadsheetContent.style.zoom = String(zoomValue / 100);
        zoomSlider.value = String(zoomValue);
        zoomDisplay.textContent = `${zoomValue}%`;
        refreshVisibleRows();
        syncCellDropdownButtonPosition();
        syncCopyAntsBoxPosition?.();
        scheduleTextOverflowUpdate?.();
        refreshFormulaRefOverlay();
        if (changed && !silent) {
            setDirtyState(true);
            debouncedSaveState();
        }
    }

    zoomSlider.addEventListener("input", () => {
        setZoom(parseInt(zoomSlider.value, 10));
    }, { signal });

    function applyHorizontalScrollDelta(deltaX) {
        if (!deltaX) return;
        container.scrollLeft = Math.max(0, container.scrollLeft + deltaX);
    }

    // Ctrl+ホイール（ズーム）と Shift+縦ホイール（Windows用横スクロール）だけJS処理し、
    // 通常の2本指横スワイプ（deltaX）はブラウザ標準のGPUスクロールに任せる
    appRoot.addEventListener("wheel", (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoom(zoomValue + (e.deltaY < 0 ? 5 : -5));
            return;
        }
        if (e.shiftKey && e.deltaX === 0 && e.deltaY !== 0) {
            if (e.target.closest(".pulldown_menu, .ss-sheet-tabs-scroll")) return;
            e.preventDefault();
            applyHorizontalScrollDelta(e.deltaY);
        }
    }, { passive: false, signal });

    // タッチ操作（1本指ドラッグによる縦横パン＋慣性スクロール / 2本指ピンチズーム）
    let initialPinchDist = null;
    let initialPinchZoom = 100;
    let pendingPinchZoom = 100;
    const pinchSensitivity = 0.03;
    const pinchMinRatioChange = 0.005;
    const pinchMinPxChange = 2;

    let isTouchPanning = false;
    let touchPanStartX = 0;
    let touchPanStartY = 0;
    let touchLastX = 0;
    let touchLastY = 0;
    let touchLastTime = 0;
    let touchVelocityX = 0;
    let touchVelocityY = 0;
    let inertiaRafId = null;

    function stopTouchInertia() {
        if (inertiaRafId !== null) {
            cancelAnimationFrame(inertiaRafId);
            inertiaRafId = null;
        }
    }

    function startTouchInertia() {
        stopTouchInertia();
        const friction = 0.92;
        const step = () => {
            if (Math.abs(touchVelocityX) < 0.4 && Math.abs(touchVelocityY) < 0.4) {
                inertiaRafId = null;
                return;
            }
            container.scrollTop = Math.max(0, container.scrollTop - touchVelocityY);
            applyHorizontalScrollDelta(-touchVelocityX);
            touchVelocityX *= friction;
            touchVelocityY *= friction;
            inertiaRafId = requestAnimationFrame(step);
        };
        inertiaRafId = requestAnimationFrame(step);
    }

    appRoot.addEventListener("touchstart", (e) => {
        stopTouchInertia();
        if (e.touches.length === 2) {
            isTouchPanning = false;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            initialPinchDist = Math.hypot(dx, dy);
            initialPinchZoom = zoomValue;
            pendingPinchZoom = zoomValue;
            return;
        }
        if (e.touches.length === 1 && container.contains(e.target)) {
            if (e.target.closest(".fill-handle, .col-resize-handle, .row-resize-handle, .floating-textbox, .floating-slicer")) return;
            const t = e.touches[0];
            isTouchPanning = true;
            touchPanStartX = touchLastX = t.clientX;
            touchPanStartY = touchLastY = t.clientY;
            touchLastTime = performance.now();
            touchVelocityX = 0;
            touchVelocityY = 0;
        }
    }, { passive: true, signal });

    appRoot.addEventListener("touchmove", (e) => {
        if (e.touches.length === 2 && initialPinchDist && initialPinchDist > 0) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            const ratio = dist / initialPinchDist;
            if (Math.abs(ratio - 1) < pinchMinRatioChange && Math.abs(dist - initialPinchDist) < pinchMinPxChange) return;
            pendingPinchZoom = initialPinchZoom * Math.pow(ratio, pinchSensitivity);
            setZoom(pendingPinchZoom);
            return;
        }

        if (e.touches.length === 1 && isTouchPanning) {
            const t = e.touches[0];
            const now = performance.now();
            const dt = Math.max(1, now - touchLastTime);
            const moveX = t.clientX - touchLastX;
            const moveY = t.clientY - touchLastY;

            // 微小なタップ揺れはセル選択として通すため閾値判定
            if (Math.hypot(t.clientX - touchPanStartX, t.clientY - touchPanStartY) > 6) {
                e.preventDefault();
                container.scrollTop = Math.max(0, container.scrollTop - moveY);
                applyHorizontalScrollDelta(-moveX);
                touchVelocityX = (moveX / dt) * 16;
                touchVelocityY = (moveY / dt) * 16;
            }
            touchLastX = t.clientX;
            touchLastY = t.clientY;
            touchLastTime = now;
        }
    }, { passive: false, signal });

    appRoot.addEventListener("touchend", (e) => {
        if (e.touches.length < 2) {
            initialPinchDist = null;
        }
        if (e.touches.length === 0 && isTouchPanning) {
            isTouchPanning = false;
            if (Math.hypot(touchVelocityX, touchVelocityY) > 1.2) {
                startTouchInertia();
            }
        }
    }, { passive: true, signal });

    return {
        getZoom,
        setZoom,
        stopTouchInertia
    };
}