const DECAF_FIELDS = [
    'roaster',
    'farmer',
    'origin',
    'variety',
    'processing',
    'roast',
    'roastType',
    'tasteNotes',
    'notes',
    'name'
];

export const isDecafCoffeeData = (source = {}) => {
    return DECAF_FIELDS.some((field) => (source?.[field] || '').toString().toLowerCase().includes('decaf'));
};

export const withDetectedDecaf = (source = {}) => ({
    ...source,
    decaf: source?.decaf === true || isDecafCoffeeData(source)
});
