export const getStarDisplay = (r) => {
    if (!r) return '-';
    let html = '';
    for (let i = 0; i < r; i++) html += '<i class="fa-solid fa-star text-xs text-yellow-400"></i>';
    return html;
};

export const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return '-';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
};

export const getRoastBadge = (roast) => {
    if (!roast) return '';
    const map = {
        Light: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800',
        Medium: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-200 dark:border-orange-800',
        'Medium-Dark': 'bg-[#d6ccc2] text-[#5e4b41] border-[#c0b4aa] dark:bg-[#57534e]/50 dark:text-gray-200 dark:border-[#57534e]',
        Dark: 'bg-gray-800 text-gray-100 border-gray-700 dark:bg-black dark:text-gray-300 dark:border-gray-800'
    };
    return `<span class="${map[roast] || 'bg-gray-100 dark:bg-gray-800'} text-xs font-medium px-2 py-0.5 rounded-full border pointer-events-none select-none">${roast}</span>`;
};

export const formatBeanOpenedDate = (value) => {
    if (!value) return '';
    const dateObj = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    if (isNaN(dateObj)) return '';
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
};
