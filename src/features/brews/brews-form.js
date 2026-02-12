export const createBrewsFormModule = ({ setTempMode, setRating, setNotesMode, getCoffeeScale }) => {
    const populateForm = (c) => {
        document.getElementById('roaster').value = c.roaster || c.name || '';
        document.getElementById('farmer').value = c.farmer || '';
        document.getElementById('origin').value = c.origin || c.beanType || '';
        document.getElementById('variety').value = c.variety || '';
        document.getElementById('processing').value = c.processing || '';
        document.getElementById('roastType').value = c.roastType || '';
        document.getElementById('grinder').value = c.grinder || '';
        document.getElementById('grind').value = c.grind || '';
        document.getElementById('inputWeight').value = c.weight || '';
        document.getElementById('inputRatio').value = c.ratio || '';
        document.getElementById('inputYield').value = c.weight && c.ratio ? (c.weight * c.ratio).toFixed(1) : '';
        document.getElementById('time').value = c.time || '';
        document.getElementById('notes').value = c.notes || '';
        document.getElementById('improve').value = c.improve || '';

        if (!isNaN(parseFloat(c.temp)) && isFinite(c.temp)) {
            setTempMode('numeric');
            document.getElementById('tempNumeric').value = c.temp;
        } else {
            setTempMode('profile');
            document.getElementById('tempProfile').value = c.temp || '';
        }

        const stdDrinks = [
            'Espresso',
            'Lungo',
            'Americano',
            'Cappuccino',
            'Flat White',
            'Macchiato',
            'Latte Macchiato',
            'Filter Coffee',
            'Soup',
            'Soup americano',
            'Soup lungo',
            'Soup flat white'
        ];
        const dValRaw = c.drink || '';
        const dVal = dValRaw === 'Long Soup' || dValRaw === 'Long soup' ? 'Soup lungo' : dValRaw;
        if (stdDrinks.includes(dVal)) {
            document.getElementById('drinkType').value = dVal;
            document.getElementById('drinkOther').classList.add('hidden');
        } else if (dVal) {
            document.getElementById('drinkType').value = 'Other';
            document.getElementById('drinkOther').value = dVal;
            document.getElementById('drinkOther').classList.remove('hidden');
        } else {
            document.getElementById('drinkType').value = '';
            document.getElementById('drinkOther').classList.add('hidden');
        }

        const stdMethods = ['Espresso', 'V60', 'Hario Switch', 'Clever Dripper', 'Aeropress', 'OXO Rapid Brewer', 'French Press', 'Chemex'];
        const mVal = c.method || '';
        if (stdMethods.includes(mVal)) {
            document.getElementById('method').value = mVal;
            document.getElementById('methodOther').classList.add('hidden');
        } else if (mVal) {
            document.getElementById('method').value = 'Other';
            document.getElementById('methodOther').value = mVal;
            document.getElementById('methodOther').classList.remove('hidden');
        } else {
            document.getElementById('method').value = '';
            document.getElementById('methodOther').classList.add('hidden');
        }

        const coffeeScale = getCoffeeScale?.();
        if (coffeeScale?.applyGraphTogglePrefsForMethod) coffeeScale.applyGraphTogglePrefsForMethod(mVal);
        setRating(c.rating || 0);
        setNotesMode('manual');
        document.getElementById('isActiveToggle').checked = c.isActive || false;

        if (c.beanId) {
            document.getElementById('savedBeanSelect').value = c.beanId;
        } else {
            document.getElementById('savedBeanSelect').value = '';
        }

        if (coffeeScale?.setCaptureData) {
            const graphData = c.scaleCapture || c.scaleFlowCapture || c.scaleRawCapture
                ? {
                      capture: c.scaleCapture || { startAt: null, samples: [] },
                      flowCapture: c.scaleFlowCapture || { startAt: (c.scaleCapture && c.scaleCapture.startAt) || null, samples: [] },
                      rawCapture: c.scaleRawCapture || { startAt: (c.scaleCapture && c.scaleCapture.startAt) || null, samples: [] },
                      firstDrip: c.firstDrip
                  }
                : null;
            coffeeScale.setCaptureData(graphData);
        }

        if (coffeeScale?.setRecipeSteps) coffeeScale.setRecipeSteps(c.recipeSteps || []);
        if (coffeeScale?.syncGraphFormFields) coffeeScale.syncGraphFormFields();

        const firstDripEl = document.getElementById('graphFirstDrip');
        const maxFlowEl = document.getElementById('graphMaxFlow');
        const avgFlowEl = document.getElementById('graphAvgFlow');
        if (coffeeScale?.setFirstDripSeconds) coffeeScale.setFirstDripSeconds(c.firstDrip ?? null);
        else if (firstDripEl) firstDripEl.value = c.firstDrip ?? '';
        if (maxFlowEl) maxFlowEl.value = c.maxFlow ?? '';
        if (avgFlowEl) avgFlowEl.value = c.avgFlow ?? '';
    };

    return {
        populateForm
    };
};
