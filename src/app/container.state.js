import { DEFAULT_PINNED_BREWS_PREFERENCES } from '../features/preferences.js';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '../features/notification-preferences.js';

export const DEFAULT_BREWS_PER_PAGE = 50;

export const createColumnDefs = () => ([
    { id: 'farmer', label: 'Blend/Farmer' },
    { id: 'roaster', label: 'Roaster' },
    { id: 'origin', label: 'Origin' },
    { id: 'variety', label: 'Variety' },
    { id: 'processing', label: 'Process' },
    { id: 'decaf', label: 'Decaf' },
    { id: 'roastType', label: 'Roast' },
    { id: 'method', label: 'Method' },
    { id: 'grinder', label: 'Grinder' },
    { id: 'grind', label: 'Grind' },
    { id: 'recipe', label: 'Recipe' },
    { id: 'time', label: 'Time' },
    { id: 'temp', label: 'Temp' },
    { id: 'drink', label: 'Drink' },
    { id: 'notes', label: 'Notes' },
    { id: 'improve', label: 'Improve' },
    { id: 'rating', label: 'Rating' },
    { id: 'date', label: 'Date' }
]);

export const createScaData = () => ({
    Fruity: { c: 'bg-red-400 text-white', s: { Berry: ['Blackberry', 'Raspberry', 'Blueberry', 'Strawberry'], 'Dried Fruit': ['Raisin', 'Prune'], 'Other Fruit': ['Coconut', 'Cherry', 'Pomegranate', 'Pineapple', 'Grape', 'Apple', 'Peach', 'Pear'], 'Citrus Fruit': ['Grapefruit', 'Orange', 'Lemon', 'Lime'] } },
    'Sour/Fermented': { c: 'bg-yellow-400 text-black', s: { Sour: ['Sour Aromatics', 'Acetic Acid', 'Butyric Acid', 'Isovaleric Acid', 'Citric Acid', 'Malic Acid'], 'Alcohol/Fermented': ['Winey', 'Whiskey', 'Fermented', 'Overripe'] } },
    'Green/Vegetative': { c: 'bg-green-500 text-white', s: { 'Olive Oil': [], Raw: [], 'Green/Vegetative': ['Under-ripe', 'Peapod', 'Fresh', 'Dark Green', 'Vegetative', 'Hay-like', 'Herb-like'] } },
    Floral: { c: 'bg-pink-400 text-white', s: { Floral: ['Chamomile', 'Rose', 'Jasmine'] } },
    Sweet: { c: 'bg-orange-300 text-black', s: { 'Overall Sweet': ['Sweet Aromatics'], Vanilla: [], Vanillin: [], 'Brown Sugar': ['Molasses', 'Maple Syrup', 'Caramel', 'Honey'] } },
    'Nutty/Cocoa': { c: 'bg-amber-600 text-white', s: { Nutty: ['Peanuts', 'Hazelnut', 'Almond'], Cocoa: ['Chocolate', 'Dark Chocolate'] } },
    Spices: { c: 'bg-red-700 text-white', s: { 'Brown Spice': ['Nutmeg', 'Clove', 'Cinnamon', 'Anise'], Pepper: [], Pungent: [] } },
    Roasted: { c: 'bg-orange-800 text-white', s: { Tobacco: ['Pipe Tobacco'], Burnt: ['Acrid', 'Ashy', 'Smoky', 'Brown Roast'], Cereal: ['Grain', 'Malt', 'Toast'] } },
    Other: { c: 'bg-gray-400 text-black', s: { Chemical: ['Rubber', 'Skunky', 'Petroleum', 'Medicinal', 'Salty', 'Bitter'], 'Papery/Musty': ['Phenolic', 'Meaty', 'Brothy', 'Animalic', 'Musty/Earthy', 'Musty/Dusty', 'Moldy/Damp', 'Woody', 'Papery/Stale', 'Cardboard', 'Stale'] } }
});

export const createInitialAppState = () => {
    const columnDefs = createColumnDefs();
    return {
        currentUser: null,
        currentView: 'mine',
        coffees: [],
        beans: [],
        hasLoadedBrews: false,
        hasLoadedBeans: false,
        coffeeTypes: [],
        gasItems: [],
        following: [],
        followers: [],
        unsubscribeData: null,
        unsubscribeBeans: null,
        unsubscribeCoffeeTypes: null,
        unsubscribeGas: null,
        unsubscribeNotifications: null,
        isPublic: false,
        currentUploadCoffeeId: null,
        currentShareMode: 'stats',
        currentCardCoffee: null,
        currentCoffeeCardId: null,
        currentCardGraphData: null,
        pendingImportBrews: [],
        currentCoffeeTypeId: null,
        currentGasId: null,
        coffeeTypesSortKey: 'createdAt',
        coffeeTypesSortDir: 'desc',
        coffeeTypesSearch: '',
        coffeeTypesFilters: { roaster: null, farmer: null, origin: null, processing: null, decaf: null, variety: null, roast: null },
        gasSortKey: 'purchasedDate',
        gasSortDir: 'desc',
        gasSearch: '',
        gasFilters: { archived: null, type: null, method: null },
        currentStatsData: [],
        currentBeanMeterPeriod: 'day',
        lastGalleryDoc: null,
        lastGalleryVisit: null,
        currentGalleryMode: 'mine',
        isGalleryLoading: false,
        BREWS_PER_PAGE: DEFAULT_BREWS_PER_PAGE,
        displayedBrewsCount: DEFAULT_BREWS_PER_PAGE,
        columnDefs,
        columnPreferences: columnDefs.reduce((acc, col) => ({ ...acc, [col.id]: true }), {}),
        pinnedBrewsPreferences: { ...DEFAULT_PINNED_BREWS_PREFERENCES },
        scaData: createScaData(),
        scaState: { level: 0, path: [], currentNode: null },
        currentBeanCardId: null,
        beansSearch: '',
        beansFilters: { coffeeType: null, decaf: null },
        notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFERENCES },
        beansSortKey: 'createdAt',
        beansSortDir: 'desc',
        currentSort: [{ key: 'createdAt', direction: 'desc' }],
        activeFilters: { bean: null, coffeeType: null, gear: null, hasGraph: null, method: null, temp: null, roastType: null, roaster: null, origin: null, farmer: null, variety: null, processing: null, decaf: null, drink: null, grinder: null }
    };
};
