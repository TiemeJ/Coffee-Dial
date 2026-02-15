export const createBrewCsvRecipeModule = ({ getFilteredCoffees, getCoffeeTypeDisplay }) => {
    const exportCSV = () => {
        const brews = getFilteredCoffees();
        if (!brews.length) return alert('No data');

        const esc = (value) => {
            if (value === null || value === undefined) return '';
            const str = String(value);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`;
            return str;
        };

        const header = [
            'Date', 'Roaster', 'Origin', 'Blend/Farmer', 'Variety', 'Process', 'Roast',
            'Method', 'Grinder', 'Grind', 'In(g)', 'Out(g)', 'Time(s)', 'Temp',
            'Drink', 'Rating', 'Notes', 'Improve'
        ];

        const rows = brews.map((brew) => {
            const type = getCoffeeTypeDisplay(brew);
            return [
                brew.createdAt || '',
                esc(type.roaster),
                esc(type.origin),
                esc(type.farmer),
                esc(type.variety),
                esc(type.processing),
                esc(type.roastType),
                esc(brew.method),
                esc(brew.grinder),
                esc(brew.grind),
                esc(brew.weight),
                brew.weight && brew.ratio ? (brew.weight * brew.ratio).toFixed(1) : '',
                esc(brew.time),
                esc(brew.temp),
                esc(brew.drink),
                esc(brew.rating),
                esc(brew.notes),
                esc(brew.improve)
            ];
        });

        const csvContent = `data:text/csv;charset=utf-8,${header.join(',')}\n${rows.map((r) => r.join(',')).join('\n')}`;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'coffee_log.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleRecipeInput = (source) => {
        const weightInput = document.getElementById('inputWeight');
        const ratioInput = document.getElementById('inputRatio');
        const yieldInput = document.getElementById('inputYield');
        if (!weightInput || !ratioInput || !yieldInput) return;

        const weightVal = parseFloat(weightInput.value) || 0;
        const yieldVal = parseFloat(yieldInput.value) || 0;
        if (!weightVal) return;
        if (source === 'weight' && yieldVal > 0) ratioInput.value = (yieldVal / weightVal).toFixed(2);
        if (source === 'yield' && weightVal > 0) ratioInput.value = (yieldVal / weightVal).toFixed(2);
    };

    return {
        exportCSV,
        handleRecipeInput
    };
};
