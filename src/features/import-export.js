export const createImportExportModule = ({
    getCurrentUser,
    getPendingImportBrews,
    setPendingImportBrews,
    parseBeanconquerorCSV,
    mapBeanconquerorBrews,
    db,
    collection,
    doc,
    writeBatch,
    getFilteredCoffees,
    getBeans,
    getCoffeeTypes,
    getCoffeeTypeDisplay,
    getCoffeeTypeForBrew,
    openAppConfirm
}) => {
    const resetImportState = () => {
        setPendingImportBrews([]);
        const summaryEl = document.getElementById('importSummary');
        if (summaryEl) summaryEl.textContent = 'Select a CSV file to preview the import.';
        const confirmBtn = document.getElementById('importConfirmBtn');
        if (confirmBtn) confirmBtn.disabled = true;
        const input = document.getElementById('importFileInput');
        if (input) input.value = '';
        const previewEl = document.getElementById('importPreview');
        if (previewEl) previewEl.classList.add('hidden');
        const previewBody = document.getElementById('importPreviewBody');
        if (previewBody) previewBody.innerHTML = '';
    };

    const renderImportPreview = (brews) => {
        const previewEl = document.getElementById('importPreview');
        const previewBody = document.getElementById('importPreviewBody');
        if (!previewEl || !previewBody) return;

        if (!brews.length) {
            previewEl.classList.add('hidden');
            previewBody.innerHTML = '';
            return;
        }

        const rows = brews.slice(0, 10);
        previewBody.innerHTML = rows.map((brew) => {
            const date = brew.createdAt ? new Date(brew.createdAt).toLocaleString() : '';
            const grind = brew.grind ?? '';
            const weight = brew.weight ?? '';
            const ratio = brew.ratio ?? '';
            const time = brew.time ?? '';
            const temp = brew.temp ?? '';
            const rating = brew.rating ?? '';
            return `
                <tr class="border-t border-coffee-100 dark:border-[#44403c]">
                    <td class="px-2 py-2 whitespace-nowrap">${date}</td>
                    <td class="px-2 py-2">${brew.method || ''}</td>
                    <td class="px-2 py-2">${brew.farmer || ''}</td>
                    <td class="px-2 py-2">${brew.grinder || ''}</td>
                    <td class="px-2 py-2 text-right">${grind}</td>
                    <td class="px-2 py-2 text-right">${weight}</td>
                    <td class="px-2 py-2 text-right">${ratio}</td>
                    <td class="px-2 py-2 text-right">${time}</td>
                    <td class="px-2 py-2 text-right">${temp}</td>
                    <td class="px-2 py-2">${brew.drink || ''}</td>
                    <td class="px-2 py-2 text-right">${rating}</td>
                </tr>
            `;
        }).join('');

        previewEl.classList.remove('hidden');
    };

    const openImportModal = () => {
        if (!getCurrentUser()) return alert('Please sign in.');
        resetImportState();
        document.getElementById('importModal')?.classList.remove('hidden');
    };

    const closeImportModal = () => {
        document.getElementById('importModal')?.classList.add('hidden');
    };

    const handleImportFileChange = async (event) => {
        const file = event.target.files[0];
        const summaryEl = document.getElementById('importSummary');
        const confirmBtn = document.getElementById('importConfirmBtn');

        if (!file) {
            resetImportState();
            return;
        }

        try {
            const text = await file.text();
            const { records } = parseBeanconquerorCSV(text);
            const brews = mapBeanconquerorBrews(records, { nowIso: new Date().toISOString() });
            setPendingImportBrews(brews);

            if (summaryEl) {
                summaryEl.textContent = brews.length
                    ? `${brews.length} brews ready to import from ${file.name}.`
                    : 'No importable brews found in this file.';
            }
            renderImportPreview(brews);
            if (confirmBtn) confirmBtn.disabled = brews.length === 0;
        } catch (err) {
            console.error('CSV import failed', err);
            setPendingImportBrews([]);
            if (summaryEl) summaryEl.textContent = 'Failed to read CSV file.';
            renderImportPreview([]);
            if (confirmBtn) confirmBtn.disabled = true;
        }
    };

    const performImport = async () => {
        const user = getCurrentUser();
        if (!user) return alert('Please sign in.');
        if (!getPendingImportBrews().length) return alert('No brews to import.');

        const shouldImport = await openAppConfirm({
            title: 'Import brews?',
            message: `Import ${getPendingImportBrews().length} brews?`,
            confirmLabel: 'Import',
            cancelLabel: 'Cancel',
            danger: false
        });
        if (!shouldImport) return;

        const confirmBtn = document.getElementById('importConfirmBtn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Importing...';
        }

        try {
            const col = collection(db, 'users', user.uid, 'coffees');
            const chunkSize = 400;
            const pending = getPendingImportBrews();
            for (let i = 0; i < pending.length; i += chunkSize) {
                const batch = writeBatch(db);
                const slice = pending.slice(i, i + chunkSize);
                slice.forEach((brew) => {
                    const ref = doc(col);
                    batch.set(ref, brew);
                });
                await batch.commit();
            }

            resetImportState();
            closeImportModal();
            alert('Import complete.');
        } catch (err) {
            console.error('Import failed', err);
            alert('Import failed. Please try again.');
        } finally {
            if (confirmBtn) {
                confirmBtn.disabled = getPendingImportBrews().length === 0;
                confirmBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Import';
            }
        }
    };

    const openExportModal = () => {
        const brews = getFilteredCoffees();
        document.getElementById('exportBrewCount').textContent = brews.length;
        document.getElementById('exportModal')?.classList.remove('hidden');
    };

    const closeExportModal = () => {
        document.getElementById('exportModal')?.classList.add('hidden');
    };

    const performExport = () => {
        const exportType = document.getElementById('exportType').value;
        const format = document.getElementById('exportFormat').value;
        const brews = getFilteredCoffees();

        if (exportType === 'coffees') {
            if (!getBeans().length) return alert('No data to export');
        } else if (!brews.length) return alert('No data to export');

        if (exportType === 'brews') {
            if (format === 'csv') exportBrewsAsCSV(brews);
            else if (format === 'json') exportAsJSON(brews);
        } else if (exportType === 'brews-beanconqueror') {
            if (format === 'csv') exportBrewsAsBeanconquerorCSV(brews);
            else if (format === 'json') exportAsJSON(brews);
        } else if (exportType === 'coffees') {
            if (format === 'csv') exportCoffeesAsCSV(getBeans());
            else if (format === 'json') exportCoffeesAsJSON(getBeans());
        }

        closeExportModal();
    };

    const exportBrewsAsCSV = (brews) => {
        const esc = (t) => {
            if (t === null || t === undefined) return '';
            const str = String(t);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
            return str;
        };
        const h = ['Date', 'Roaster', 'Origin', 'Blend/Farmer', 'Variety', 'Process', 'Roast', 'Method', 'Grinder', 'Grind', 'In(g)', 'Out(g)', 'Time(s)', 'Temp', 'Drink', 'Rating', 'Notes', 'Improve'];
        const r = brews.map((c) => {
            const type = getCoffeeTypeDisplay(c);
            return [
                c.createdAt || '', esc(type.roaster), esc(type.origin), esc(type.farmer), esc(type.variety), esc(type.processing), esc(type.roastType), esc(c.method), esc(c.grinder), esc(c.grind), esc(c.weight),
                c.weight && c.ratio ? (c.weight * c.ratio).toFixed(1) : '', esc(c.time), esc(c.temp), esc(c.drink), esc(c.rating), esc(c.notes), esc(c.improve)
            ];
        });
        const csvContent = `data:text/csv;charset=utf-8,${h.join(',')}\n${r.map((e) => e.join(',')).join('\n')}`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'coffee_log.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportBrewsAsBeanconquerorCSV = (brews) => {
        const headers = ['Grind Setting', 'Ground Coffee (gr)', 'Brew Temperature', 'Preparation method', 'Bean Type', 'Grinder', 'Grind Speed (rpm)', 'Grind Time', 'Profile', 'Preparation tools', 'Temperature Time', 'Time', 'Bloom Time / Pre-infusion', 'First drip time', 'Amount of water', 'Coffee', 'Coffee Concentration', 'Rating', 'Notes', 'Beverage quantity', 'Total dissolved solids %', 'Extraction Yield %', 'Creation Date', 'Brew Ratio', 'Bean Age', 'Archived', 'Bean Id', 'Preparation Id', 'Mill Id'];

        const esc = (t) => {
            if (t === null || t === undefined) return '';
            const str = String(t);
            if (str.includes(';') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
            return str;
        };

        const rows = brews.map((c) => {
            const type = getCoffeeTypeDisplay(c);
            return [
                esc(c.grind || ''), esc(c.weight || ''), esc(c.temp || ''), esc(c.method || ''), esc(type.farmer || ''), esc(c.grinder || ''), '', '', '', '', '', esc(c.time || ''), '', '',
                c.weight && c.ratio ? (c.weight * c.ratio).toFixed(1) : '', '', '', esc(c.rating || ''), esc(c.notes || ''), '', '', '', esc(c.createdAt || ''), esc(c.ratio ? `1 / ${c.ratio.toFixed(2)}` : ''), '', '', '', '', ''
            ];
        });

        const csvContent = `data:text/csv;charset=utf-8,${headers.join(';')}\n${rows.map((e) => e.join(';')).join('\n')}`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'coffee_brews_beanconqueror.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportAsJSON = (brews) => {
        const normalized = brews.map((brew) => {
            const typeDisplay = getCoffeeTypeDisplay(brew);
            const type = getCoffeeTypeForBrew(brew);
            return {
                ...brew,
                roaster: typeDisplay.roaster,
                farmer: typeDisplay.farmer,
                origin: typeDisplay.origin,
                variety: typeDisplay.variety,
                processing: typeDisplay.processing,
                roastType: typeDisplay.roastType,
                coffeeType: {
                    id: type?.id || null,
                    roaster: typeDisplay.roaster,
                    farmer: typeDisplay.farmer,
                    origin: typeDisplay.origin,
                    variety: typeDisplay.variety,
                    processing: typeDisplay.processing,
                    roastType: typeDisplay.roastType
                }
            };
        });
        const jsonContent = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(normalized, null, 2))}`;
        const link = document.createElement('a');
        link.setAttribute('href', jsonContent);
        link.setAttribute('download', 'coffee_log.json');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportCoffeesAsCSV = () => {
        const headers = ['Name', 'Roaster', 'Roast date', 'Roast type', 'Degree of Roast', 'Custom degree of Roast', 'Blend', 'Weight', 'Cost', 'Flavour profile', 'Cupping points', 'Decaffeinated', 'Website', 'EAN / Articlenumber', 'Notes', 'Rating', 'Archived', 'Frozen Date', 'Unfrozen Date', 'Freezing Storage Type', 'Frozen Note', '1. Country', '1. Region', '1. Farm', '1. Farmer', '1. Elevation', '1. Variety', '1. Processing', '1. Harvested', '1. Percentage', '1. Bean certification', '1. Fob Price', '1. Purchasing Price'];
        const sourceBeans = getBeans();
        const esc = (t) => {
            if (t === null || t === undefined) return '';
            const str = String(t);
            if (str.includes(';') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
            return str;
        };
        const rows = sourceBeans.map((coffee) => [
            esc(coffee.farmer || ''), esc(coffee.roaster || ''), '', '', esc(coffee.roastType || ''), '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', esc(coffee.origin || ''), '', '', '', '', esc(coffee.variety || ''), esc(coffee.processing || ''), '', '', '', '', ''
        ]);
        const csvContent = `data:text/csv;charset=utf-8,${headers.join(';')}\n${rows.map((e) => e.join(';')).join('\n')}`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'coffee_beans.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportCoffeesAsJSON = () => {
        const sourceBeans = getBeans().map((bean) => {
            const type = bean.coffeeTypeId ? getCoffeeTypes().find((ct) => ct.id === bean.coffeeTypeId) : null;
            const normalized = {
                roaster: type?.roaster || bean.roaster || null,
                farmer: type?.farmer || bean.farmer || null,
                origin: type?.origin || bean.origin || null,
                variety: type?.variety || bean.variety || null,
                processing: type?.processing || bean.processing || null,
                roastType: type?.roast || type?.roastType || bean.roastType || null
            };
            return {
                ...bean,
                ...normalized,
                coffeeType: {
                    id: type?.id || null,
                    roaster: normalized.roaster,
                    farmer: normalized.farmer,
                    origin: normalized.origin,
                    variety: normalized.variety,
                    processing: normalized.processing,
                    roastType: normalized.roastType
                }
            };
        });
        const jsonContent = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(sourceBeans, null, 2))}`;
        const link = document.createElement('a');
        link.setAttribute('href', jsonContent);
        link.setAttribute('download', 'coffee_beans.json');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return {
        resetImportState,
        renderImportPreview,
        openImportModal,
        closeImportModal,
        handleImportFileChange,
        performImport,
        openExportModal,
        closeExportModal,
        performExport,
        exportBrewsAsCSV,
        exportBrewsAsBeanconquerorCSV,
        exportAsJSON,
        exportCoffeesAsCSV,
        exportCoffeesAsJSON
    };
};
