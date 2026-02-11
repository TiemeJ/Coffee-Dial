export const createStatsAiProfileModule = ({
    STATS_AI_URL,
    getCurrentStatsData,
    getCurrentUser,
    fetchImpl = fetch
}) => {
    const triggerAIProfile = async () => {
        const currentStatsData = getCurrentStatsData();
        if (!currentStatsData.length) {
            alert('No brews found for this user to analyze.');
            return;
        }

        const btn = document.getElementById('statsAIBtn');
        const container = document.getElementById('aiProfileContainer');
        const textBox = document.getElementById('aiProfileText');
        const statsSelect = document.getElementById('statsViewSelect');
        if (!btn || !container || !textBox || !statsSelect) return;

        const originalContent = btn.innerHTML;
        const selectedValue = statsSelect.value;
        let aiTargetName = statsSelect.options[statsSelect.selectedIndex]?.text || 'Home Brewer';
        if (selectedValue === 'mine') {
            aiTargetName = getCurrentUser()?.displayName || 'Home Brewer';
        }

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reading brews...';
            btn.classList.add('ai-loading-pulse');
            container.classList.add('hidden');

            const dataString = currentStatsData
                .slice(0, 100)
                .map(
                    (c) =>
                        `Roaster: ${c.roaster || c.name || '-'}, Origin: ${c.origin || c.beanType || '-'}, Farmer: ${c.farmer || '-'}, Process: ${c.processing || '-'}, Roast: ${c.roastType || '-'}, Method: ${c.method || '-'}, Drink: ${c.drink || '-'}, Rating: ${c.rating || 0}/5, Notes: ${c.notes || 'None'}`
                )
                .join('\n');

            const response = await fetchImpl(STATS_AI_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brewData: dataString, userName: aiTargetName })
            });

            if (!response.ok) throw new Error('Analysis failed.');
            const data = await response.json();
            textBox.innerText = data.profile;
            container.classList.remove('hidden');
        } catch (err) {
            console.error(err);
            alert(`Error generating profile: ${err.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
            btn.classList.remove('ai-loading-pulse');
        }
    };

    return {
        triggerAIProfile
    };
};
