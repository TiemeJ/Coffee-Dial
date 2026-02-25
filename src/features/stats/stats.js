export const createStatsModule = ({
    getCurrentUser,
    getCurrentView,
    getFollowing,
    dataService,
    getCoffeeTypeDisplay,
    getCoffeeTypeForBrew,
    dispatchCommand,
    setCurrentStatsData,
    getCurrentStatsData,
    setCurrentBeanMeterPeriod,
    getCurrentBeanMeterPeriod,
    getChart
}) => {
    const { db, collection, getDocs } = dataService || {};
    if (!db || !collection || !getDocs) {
        throw new Error('createStatsModule requires dataService { db, collection, getDocs }');
    }
    const chartInstances = {};
    let currentStatsUid = 'mine';
    const getChartCtor = async () => {
        try {
            if (typeof getChart === 'function') {
                const ctor = await getChart();
                if (typeof ctor === 'function') return ctor;
            }
        } catch (error) {
            console.error('Chart.js lazy-load failed:', error);
        }
        if (typeof window !== 'undefined' && typeof window.Chart === 'function') {
            return window.Chart;
        }
        return null;
    };
    const formatCurrencyEur = (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return 'EUR 0.00';
        return `EUR ${num.toFixed(2)}`;
    };
    const renderGasAlert = (totalSpent = 0) => {
        const totalEl = document.getElementById('statGasTotal');
        const funnyEl = document.getElementById('statGasFunny');
        if (totalEl) totalEl.textContent = formatCurrencyEur(totalSpent);
        if (funnyEl) {
            if (totalSpent <= 0) funnyEl.textContent = 'Your wallet is still in pre-infusion mode.';
            else if (totalSpent < 250) funnyEl.textContent = 'Mild GAS symptoms detected. Your bank app is calm... for now.';
            else if (totalSpent < 1000) funnyEl.textContent = 'Classic GAS phase: one more grinder away from financial enlightenment.';
            else funnyEl.textContent = 'Full GAS syndrome. Your espresso is dialed in, your budget is not.';
        }
    };

    const closeStats = () => {
        document.getElementById('statsModal')?.classList.add('hidden');
        document.getElementById('aiProfileContainer')?.classList.add('hidden');
    };

    const toggleStatsUniqueTable = (show) => {
        const gen = document.getElementById('statsGeneralView');
        const uni = document.getElementById('statsUniqueTableView');
        if (!gen || !uni) return;
        if (show) {
            gen.classList.add('hidden');
            uni.classList.remove('hidden');
        } else {
            uni.classList.add('hidden');
            gen.classList.remove('hidden');
        }
    };

    const openStats = () => {
        const user = getCurrentUser();
        if (!user) return alert('Please sign in first.');
        document.getElementById('statsModal')?.classList.remove('hidden');
        const sl = document.getElementById('statsViewSelect');
        if (!sl) return;
        const following = Array.isArray(getFollowing?.()) ? getFollowing() : [];
        const hasFriendOptions = following.length > 0;
        sl.innerHTML = '<option value="mine">My brews</option>';
        following.forEach((f) => {
            const o = document.createElement('option');
            o.value = f.uid;
            o.text = f.name || `Friend (${f.uid.substr(0, 5)}...)`;
            sl.appendChild(o);
        });
        sl.value = hasFriendOptions ? getCurrentView() : 'mine';
        sl.classList.toggle('hidden', !hasFriendOptions);
        toggleStatsUniqueTable(false);
        changeStatsView(hasFriendOptions ? getCurrentView() : 'mine');
    };

    const changeStatsView = async (uid) => {
        currentStatsUid = uid;
        document.getElementById('aiProfileContainer')?.classList.add('hidden');
        const user = getCurrentUser();
        let dataToUse = [];
        let gearToUse = [];
        let beansToUse = [];
        if (uid === 'mine') {
            const brewsQ = collection(db, 'users', user.uid, 'coffees');
            const brewsSnap = await getDocs(brewsQ);
            brewsSnap.forEach((d) => dataToUse.push({ id: d.id, ...d.data() }));
            const gearQ = collection(db, 'users', user.uid, 'gear');
            const gearSnap = await getDocs(gearQ);
            gearSnap.forEach((d) => gearToUse.push({ id: d.id, ...d.data() }));
            const beansQ = collection(db, 'users', user.uid, 'beans');
            const beansSnap = await getDocs(beansQ);
            beansSnap.forEach((d) => beansToUse.push({ id: d.id, ...d.data() }));
        } else {
            const brewsQ = collection(db, 'users', uid, 'coffees');
            const brewsSnap = await getDocs(brewsQ);
            brewsSnap.forEach((d) => dataToUse.push({ id: d.id, ...d.data() }));
            const gearQ = collection(db, 'users', uid, 'gear');
            const gearSnap = await getDocs(gearQ);
            gearSnap.forEach((d) => gearToUse.push({ id: d.id, ...d.data() }));
            const beansQ = collection(db, 'users', uid, 'beans');
            const beansSnap = await getDocs(beansQ);
            beansSnap.forEach((d) => beansToUse.push({ id: d.id, ...d.data() }));
        }
        await calculateStats(dataToUse, gearToUse, beansToUse);
    };

    const renderCharts = async (roast, method, drink, stars) => {
        const chartCtor = await getChartCtor();
        if (!chartCtor) return;
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#e7e5e4' : '#4a3b32';
        const gridColor = isDark ? '#44403c' : '#e5e7eb';

        const createPie = (ctxId, dataObj, colors) => {
            if (chartInstances[ctxId]) chartInstances[ctxId].destroy();
            const ctx = document.getElementById(ctxId).getContext('2d');
            chartInstances[ctxId] = new chartCtor(ctx, {
                type: 'doughnut',
                data: { labels: Object.keys(dataObj), datasets: [{ data: Object.values(dataObj), backgroundColor: colors, borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: textColor, font: { size: 10, family: "'Outfit', sans-serif" }, boxWidth: 10 } } } }
            });
        };

        const roastColors = ['#fcd34d', '#f97316', '#78350f', '#000000', '#9ca3af'];
        const methodColors = ['#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fbbf24', '#9ca3af', '#f87171', '#2dd4bf'];
        const drinkColors = ['#fb923c', '#c084fc', '#22d3ee', '#4ade80', '#e879f9', '#9ca3af'];
        createPie('chartRoast', roast, roastColors);
        createPie('chartMethod', method, methodColors);
        createPie('chartDrink', drink, drinkColors);

        if (chartInstances.chartStars) chartInstances.chartStars.destroy();
        const ctxStars = document.getElementById('chartStars').getContext('2d');
        const starCounts = [1, 2, 3, 4, 5].map((i) => stars[i] || 0);
        chartInstances.chartStars = new chartCtor(ctxStars, {
            type: 'bar',
            data: { labels: ['1★', '2★', '3★', '4★', '5★'], datasets: [{ label: 'Count', data: starCounts, backgroundColor: '#fbbf24', borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: textColor, precision: 0 }, grid: { color: gridColor } }, x: { ticks: { color: textColor }, grid: { display: false } } } }
        });
    };

    const calculateStats = async (dataToUse, gearToUse = [], beansToUse = []) => {
        setCurrentStatsData(dataToUse);
        const gasTotalSpent = gearToUse.reduce((sum, item) => {
            const price = Number(item?.price);
            return Number.isFinite(price) ? sum + price : sum;
        }, 0);
        renderGasAlert(gasTotalSpent);
        const oneDay = 24 * 60 * 60 * 1000;
        const toMs = (value) => {
            if (!value) return NaN;
            const dateObj = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
            return dateObj instanceof Date ? dateObj.getTime() : NaN;
        };
        const beanName = (bean) => {
            const roaster = (bean?.roaster || '').toString().trim();
            const farmer = (bean?.farmer || '').toString().trim();
            return farmer && roaster ? `${farmer} - ${roaster}` : farmer || roaster || 'Unnamed bean';
        };
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };
        const formatDuration = (ms) => {
            if (!Number.isFinite(ms) || ms < 0) return '-';
            const days = ms / oneDay;
            if (days < 1) return '< 1 day open';
            if (days < 10) return `${days.toFixed(1)} days open`;
            return `${Math.round(days)} days open`;
        };
        const openDurations = (beansToUse || [])
            .map((bean) => {
                const openedMs = toMs(bean?.openedDate);
                if (!Number.isFinite(openedMs)) return null;
                const archivedMs = toMs(bean?.archivedDate);
                const isArchived = !!bean?.archived;
                if (isArchived && !Number.isFinite(archivedMs)) return null;
                const endMs = isArchived && Number.isFinite(archivedMs) ? archivedMs : Date.now();
                const bagWeightGr = Number(bean?.stock);
                return {
                    id: bean.id,
                    name: beanName(bean),
                    isArchived,
                    bagWeightGr: Number.isFinite(bagWeightGr) && bagWeightGr > 0 ? bagWeightGr : null,
                    durationMs: Math.max(0, endMs - openedMs)
                };
            })
            .filter(Boolean);
        const shortestCandidates = openDurations
            .filter((item) => item.isArchived && Number.isFinite(item.bagWeightGr) && item.bagWeightGr > 0)
            .map((item) => ({
                ...item,
                durationMsPerGram: item.durationMs / item.bagWeightGr
            }));
        const longestCandidates = openDurations;
        const shortestCardEl = document.getElementById('statBeanShortestCard');
        const longestCardEl = document.getElementById('statBeanLongestCard');
        const wireCard = (el, beanId) => {
            if (!el) return;
            if (!beanId || currentStatsUid !== 'mine') {
                el.onclick = null;
                return;
            }
            el.onclick = () => {
                dispatchCommand?.('beans.openCard', { beanId, event: null, keepNavigationOrder: false });
            };
        };

        if (!shortestCandidates.length) {
            setText('statBeanShortestName', '-');
            setText('statBeanShortestTime', 'No archived beans with opened date and bag weight');
            wireCard(shortestCardEl, null);
        } else {
            const shortest = [...shortestCandidates].sort((a, b) => a.durationMsPerGram - b.durationMsPerGram)[0];
            setText('statBeanShortestName', shortest.name);
            setText('statBeanShortestTime', formatDuration(shortest.durationMs));
            wireCard(shortestCardEl, shortest.id);
        }

        if (!longestCandidates.length) {
            setText('statBeanLongestName', '-');
            setText('statBeanLongestTime', 'No opened date found');
            wireCard(longestCardEl, null);
        } else {
            const longest = [...longestCandidates].sort((a, b) => b.durationMs - a.durationMs)[0];
            setText('statBeanLongestName', longest.name);
            setText('statBeanLongestTime', formatDuration(longest.durationMs));
            wireCard(longestCardEl, longest.id);
        }

        const total = dataToUse.length;
        if (total === 0) {
            document.getElementById('statTotalBrews').innerText = '0';
            document.getElementById('statMonthBrews').innerText = '∞';
            document.getElementById('statWeekBrews').innerText = '0';
            document.getElementById('statAvgBrews').innerText = '0';
            document.getElementById('statUniqueCoffees').innerText = '0';
            document.getElementById('mostBrewedName').innerText = '-';
            document.getElementById('mostBrewedCount').innerText = '0 brews';
            document.getElementById('topCoffeesList').innerHTML = '<p class="text-sm text-gray-400 italic">No brews found.</p>';
            document.getElementById('uniqueLeaderboardBody').innerHTML = "<tr><td colspan='4' class='text-center py-4 italic text-coffee-400'>No data.</td></tr>";
            document.getElementById('grinderStatsList').innerHTML = '<p class="text-sm text-gray-400 italic">No grinder data.</p>';
            await renderCharts({}, {}, {}, {});
            return;
        }

        const now = new Date();
        const last7 = dataToUse.filter((c) => now - new Date(c.createdAt) < 7 * oneDay).length;
        const firstDate = new Date(Math.min(...dataToUse.map((c) => new Date(c.createdAt || now))));
        const diffDays = Math.max(1, Math.round(Math.abs((now - firstDate) / oneDay)));
        const avg = (total / diffDays).toFixed(1);
        const lastBrewDate = new Date(Math.max(...dataToUse.map((c) => new Date(c.createdAt || now))));
        const hoursSinceLastBrew = Math.round((now - lastBrewDate) / (60 * 60 * 1000));

        document.getElementById('statTotalBrews').innerText = total;
        document.getElementById('statMonthBrews').innerText = hoursSinceLastBrew;
        document.getElementById('statWeekBrews').innerText = last7;
        document.getElementById('statAvgBrews').innerText = avg;

        const agg = (key, getValue) => dataToUse.reduce((acc, c) => {
            const val = (getValue ? getValue(c) : c[key]) || 'Unknown';
            acc[val] = (acc[val] || 0) + 1;
            return acc;
        }, {});

        const roastData = agg(null, (c) => getCoffeeTypeDisplay(c).roastType);
        const methodData = agg('method');
        const drinkData = agg('drink');
        const ratingData = dataToUse.reduce((acc, c) => {
            const r = c.rating || 0;
            if (r > 0) acc[r] = (acc[r] || 0) + 1;
            return acc;
        }, {});
        await renderCharts(roastData, methodData, drinkData, ratingData);
        await updateBeanMeterInternal('day');

        const uniqueMap = {};
        dataToUse.forEach((c) => {
            const type = getCoffeeTypeForBrew(c);
            const typeKey = type?.id || c.beanId || '-';
            const typeDisplay = getCoffeeTypeDisplay(c);
            if (!uniqueMap[typeKey]) uniqueMap[typeKey] = { count: 0, roaster: typeDisplay.roaster, origin: typeDisplay.origin, farmer: typeDisplay.farmer, totalRating: 0, ratingCount: 0 };
            uniqueMap[typeKey].count++;
            if (c.rating > 0) {
                uniqueMap[typeKey].totalRating += c.rating;
                uniqueMap[typeKey].ratingCount++;
            }
        });

        document.getElementById('statUniqueCoffees').innerText = Object.keys(uniqueMap).length;
        let maxKey = null;
        Object.keys(uniqueMap).forEach((k) => { if (!maxKey || uniqueMap[k].count > uniqueMap[maxKey].count) maxKey = k; });
        if (maxKey) {
            const d = uniqueMap[maxKey];
            document.getElementById('mostBrewedName').innerText = `${d.roaster} - ${d.origin} ${d.farmer !== '-' ? `(${d.farmer})` : ''}`;
            document.getElementById('mostBrewedCount').innerText = `${d.count} brews`;
        }

        const topMap = {};
        dataToUse.filter((c) => c.rating === 5).forEach((c) => {
            const typeDisplay = getCoffeeTypeDisplay(c);
            const key = `${typeDisplay.roaster}|${typeDisplay.origin}|${typeDisplay.farmer}`;
            if (!topMap[key]) topMap[key] = { count: 0, data: typeDisplay };
            topMap[key].count++;
        });

        const sortedTopList = Object.values(topMap).sort((a, b) => b.count - a.count);
        const listEl = document.getElementById('topCoffeesList');
        listEl.innerHTML = '';
        if (!sortedTopList.length) listEl.innerHTML = '<p class="text-sm text-gray-400 italic">No 5-star brews yet.</p>';
        else sortedTopList.forEach((item) => {
            const c = item.data;
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center bg-coffee-50 dark:bg-[#1c1917] p-2 rounded border border-coffee-100 dark:border-[#44403c]';
            div.innerHTML = `<div class="truncate pr-2"><span class="font-bold text-coffee-800 dark:text-white text-sm block truncate">${c.roaster || 'Unknown'}</span><span class="text-xs text-coffee-500 dark:text-[#78716c] truncate">${c.origin || ''} ${c.farmer ? `• ${c.farmer}` : ''}</span></div><span class="text-xs font-bold bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full whitespace-nowrap">${item.count} <i class="fa-solid fa-mug-hot ml-1"></i></span>`;
            listEl.appendChild(div);
        });

        const leaderboardData = Object.values(uniqueMap).map((u) => ({ ...u, avg: u.ratingCount > 0 ? (u.totalRating / u.ratingCount).toFixed(1) : '0.0' })).sort((a, b) => b.avg - a.avg);
        const lbBody = document.getElementById('uniqueLeaderboardBody');
        lbBody.innerHTML = leaderboardData.length ? '' : "<tr><td colspan='4' class='text-center py-4 italic text-coffee-400'>No data.</td></tr>";
        leaderboardData.forEach((item) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="px-4 py-3 font-bold">${item.roaster}</td><td class="px-4 py-3">${item.origin}</td><td class="px-4 py-3">${item.farmer}</td><td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-bold">${item.avg} ★</span></td>`;
            lbBody.appendChild(tr);
        });

        const grinderTotals = {};
        dataToUse.forEach((c) => {
            const grinder = (c.grinder || 'Unknown').toString().trim() || 'Unknown';
            const weight = parseFloat(c.weight);
            if (!isNaN(weight) && weight > 0) grinderTotals[grinder] = (grinderTotals[grinder] || 0) + weight;
        });

        const grinderList = Object.entries(grinderTotals).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
        const grinderEl = document.getElementById('grinderStatsList');
        grinderEl.innerHTML = '';
        if (!grinderList.length) grinderEl.innerHTML = '<p class="text-sm text-gray-400 italic">No grinder data.</p>';
        else grinderList.forEach((item) => {
            const kg = (item.total / 1000).toFixed(2);
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between bg-coffee-50 dark:bg-[#1c1917] p-2 rounded border border-coffee-100 dark:border-[#44403c]';
            row.innerHTML = `<span class="text-sm font-semibold text-coffee-800 dark:text-white truncate pr-2">${item.name}</span><span class="text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-1 rounded-full whitespace-nowrap">${kg} kg</span>`;
            grinderEl.appendChild(row);
        });
    };

    const updateBeanMeterInternal = async (period) => {
        const chartCtor = await getChartCtor();
        if (!chartCtor) return;
        if (period) setCurrentBeanMeterPeriod(period);
        const currentBeanMeterPeriod = getCurrentBeanMeterPeriod();

        const btns = document.querySelectorAll('.bean-meter-btn');
        btns.forEach((btn) => {
            if (btn.textContent.toLowerCase() === currentBeanMeterPeriod) {
                btn.className = 'bean-meter-btn px-2 py-0.5 text-[10px] rounded font-bold transition-all bg-white dark:bg-[#292524] shadow-sm text-coffee-800 dark:text-white';
            } else {
                btn.className = 'bean-meter-btn px-2 py-0.5 text-[10px] rounded font-bold transition-all text-coffee-500 dark:text-[#a8a29e]';
            }
        });

        const currentStatsData = getCurrentStatsData();
        if (!currentStatsData || !currentStatsData.length) return;
        const data = currentStatsData.filter((c) => c.weight && c.createdAt);
        if (!data.length) return;

        const groupedData = {};
        data.forEach((brew) => {
            const date = new Date(brew.createdAt);
            let key;
            if (currentBeanMeterPeriod === 'day') key = date.toISOString().split('T')[0];
            else if (currentBeanMeterPeriod === 'week') {
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1));
                key = weekStart.toISOString().split('T')[0];
            } else if (currentBeanMeterPeriod === 'month') key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            else if (currentBeanMeterPeriod === 'year') key = date.getFullYear().toString();

            if (key) {
                if (!groupedData[key]) groupedData[key] = 0;
                groupedData[key] += (brew.weight || 0) * 10;
            }
        });

        const sortedKeys = Object.keys(groupedData).sort();
        if (!sortedKeys.length) return;

        const labels = sortedKeys;
        const values = sortedKeys.map((key) => groupedData[key]);
        const canvas = document.getElementById('chartBeanMeter');
        if (!canvas) return;
        if (chartInstances.chartBeanMeter) chartInstances.chartBeanMeter.destroy();

        const ctx = canvas.getContext('2d');
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#e7e5e4' : '#4a3b32';
        const gridColor = isDark ? '#44403c' : '#e5e7eb';
        const barColor = '#8c7365';

        chartInstances.chartBeanMeter = new chartCtor(ctx, {
            type: 'bar',
            data: { labels, datasets: [{ label: 'Beans Consumed', data: values, backgroundColor: barColor, borderRadius: 4 }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (context) => ` ${context.parsed.y.toLocaleString()} beans` } }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { color: textColor, precision: 0 }, grid: { color: gridColor } },
                    x: { ticks: { color: textColor }, grid: { display: false } }
                }
            }
        });
    };

    return {
        openStats,
        closeStats,
        toggleStatsUniqueTable,
        changeStatsView,
        calculateStats,
        updateBeanMeter: updateBeanMeterInternal,
        renderCharts
    };
};
