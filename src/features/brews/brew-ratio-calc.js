export const createBrewRatioCalcModule = () => {
    // ── helpers ──────────────────────────────────────────────────────────────

    const num = (id) => {
        const v = parseFloat(document.getElementById(id)?.value);
        return Number.isFinite(v) && v > 0 ? v : null;
    };

    const setVal = (id, value, decimals = 2) => {
        const el = document.getElementById(id);
        if (el) el.value = value != null ? value.toFixed(decimals) : '';
    };

    // Apply calc result back to the brew form fields
    const syncFormFrom = () => {
        const inV   = num('ratioCalcIn');
        const ratV  = num('ratioCalcRatio');
        const outV  = num('ratioCalcOut');

        // In
        const inField = document.getElementById('inputWeight');
        if (inField && inV != null) {
            inField.value = inV;
            inField.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Ratio
        if (ratV != null) {
            const span = document.getElementById('inputRatio')?.querySelector('span:last-child');
            if (span) span.textContent = ratV.toFixed(2);
            const hidden = document.getElementById('inputRatioHidden');
            if (hidden) hidden.value = ratV.toFixed(2);
        }

        // Out
        const outField = document.getElementById('inputYield');
        if (outField && outV != null) {
            outField.value = outV.toFixed(1);
            outField.dispatchEvent(new Event('input', { bubbles: true }));
        }
    };

    // ── calculation core ─────────────────────────────────────────────────────
    //
    // Precedence (what "stays" when all three are filled): In > Ratio > Out
    //   change In    → Out changes  (In* Ratio* → Out)
    //   change Ratio → Out changes  (In* Ratio* → Out)
    //   change Out   → Ratio changes (In* Out* → Ratio)
    //
    // When one field is empty: always fill the empty one.

    const recalc = (source) => {
        const inV  = num('ratioCalcIn');
        const ratV = num('ratioCalcRatio');
        const outV = num('ratioCalcOut');

        if (source === 'in') {
            if (inV != null && ratV != null) {
                setVal('ratioCalcOut', inV * ratV, 1);          // Ratio stays → Out changes
            } else if (inV != null && outV != null) {
                setVal('ratioCalcRatio', outV / inV, 2);         // Out stays → Ratio fills
            }
        } else if (source === 'ratio') {
            if (inV != null && ratV != null) {
                setVal('ratioCalcOut', inV * ratV, 1);          // In stays → Out changes
            } else if (ratV != null && outV != null) {
                setVal('ratioCalcIn', outV / ratV, 1);           // Out stays → In fills
            }
        } else if (source === 'out') {
            if (inV != null && outV != null) {
                setVal('ratioCalcRatio', outV / inV, 2);         // In stays → Ratio changes
            } else if (ratV != null && outV != null) {
                setVal('ratioCalcIn', outV / ratV, 1);           // Ratio stays → In fills
            }
        }
    };

    // ── public API ────────────────────────────────────────────────────────────

    const openRatioCalcModal = () => {
        const modal = document.getElementById('ratioCalcModal');
        if (!modal) return;

        // Pre-fill from current form values
        const inV  = parseFloat(document.getElementById('inputWeight')?.value);
        const ratV = parseFloat(document.getElementById('inputRatioHidden')?.value);
        const outV = parseFloat(document.getElementById('inputYield')?.value);

        setVal('ratioCalcIn',    Number.isFinite(inV)  ? inV  : null, 1);
        setVal('ratioCalcRatio', Number.isFinite(ratV) ? ratV : null, 2);
        setVal('ratioCalcOut',   Number.isFinite(outV) ? outV : null, 1);

        modal.classList.remove('hidden');
        document.getElementById('ratioCalcIn')?.focus();
    };

    const closeRatioCalcModal = () => {
        document.getElementById('ratioCalcModal')?.classList.add('hidden');
    };

    const applyRatioCalc = () => {
        syncFormFrom();
        closeRatioCalcModal();
    };

    const handleRatioCalcInput = (source) => {
        recalc(source);
    };

    return {
        openRatioCalcModal,
        closeRatioCalcModal,
        applyRatioCalc,
        handleRatioCalcInput,
    };
};
