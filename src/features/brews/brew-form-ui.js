export const createBrewFormUiModule = ({
    getScaData,
    getScaState,
    setScaState,
    getRefreshManualPinningVisibility,
    getCoffeeScale
}) => {
    const setNotesMode = (mode) => {
        const btnMan = document.getElementById('btnNotesManual');
        const btnSca = document.getElementById('btnNotesSCA');
        const conMan = document.getElementById('notesManualContainer');
        const conSca = document.getElementById('notesSCAContainer');
        const hidden = document.getElementById('notesMode');
        if (!btnMan || !btnSca || !conMan || !conSca || !hidden) return;

        hidden.value = mode;
        if (mode === 'manual') {
            conMan.classList.remove('hidden');
            conSca.classList.add('hidden');
            btnMan.className = 'px-2 py-0.5 text-[10px] rounded font-bold transition-all bg-white dark:bg-[#1c1917] shadow-sm text-coffee-800 dark:text-white';
            btnSca.className = 'px-2 py-0.5 text-[10px] rounded font-bold transition-all text-coffee-500 dark:text-[#78716c] hover:text-coffee-700';
        } else {
            conSca.classList.remove('hidden');
            conMan.classList.remove('hidden');
            btnSca.className = 'px-2 py-0.5 text-[10px] rounded font-bold transition-all bg-white dark:bg-[#1c1917] shadow-sm text-coffee-800 dark:text-white';
            btnMan.className = 'px-2 py-0.5 text-[10px] rounded font-bold transition-all text-coffee-500 dark:text-[#78716c] hover:text-coffee-700';
            const scaState = getScaState();
            if (scaState.level === 0 && scaState.path.length === 0) renderScaWheel();
        }
    };

    const renderScaWheel = () => {
        const container = document.getElementById('scaButtonsContainer');
        const display = document.getElementById('scaSelectionDisplay');
        if (!container || !display) return;
        container.innerHTML = '';
        const scaState = getScaState();
        const scaData = getScaData();
        const pathString = scaState.path.join(' > ');
        const leafNode = scaState.path.length > 0 ? scaState.path[scaState.path.length - 1] : null;

        if (leafNode) {
            display.innerHTML = `<div class="flex flex-col sm:flex-row justify-between items-center gap-2 bg-coffee-100 dark:bg-[#292524] p-2 rounded"><span class="text-xs text-coffee-500 italic">${pathString}</span><div class="flex gap-2"><button data-action-click="resetSca()" class="text-xs text-coffee-600 dark:text-[#a8a29e] hover:text-red-500 underline">Reset</button><button type="button" data-action-click="addScaToNotes()" class="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-1 rounded shadow-sm transition-colors"><i class="fa-solid fa-plus mr-1"></i> Add "${leafNode}"</button></div></div>`;
        } else {
            display.innerHTML = '<span class="text-coffee-400 font-normal italic text-xs">Tap categories below to build a flavor...</span>';
        }

        if (scaState.level === 0) {
            Object.keys(scaData).forEach((key) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `sca-btn px-3 py-2 rounded text-xs font-bold shadow-sm ${scaData[key].c}`;
                btn.textContent = key;
                btn.onclick = () => {
                    const nextState = getScaState();
                    nextState.path = [key];
                    nextState.level = 1;
                    nextState.currentNode = scaData[key];
                    setScaState(nextState);
                    renderScaWheel();
                };
                container.appendChild(btn);
            });
        } else if (scaState.level === 1) {
            const subs = scaState.currentNode.s;
            const parentColor = scaState.currentNode.c;
            const backBtn = document.createElement('button');
            backBtn.type = 'button';
            backBtn.className = "sca-btn px-3 py-2 rounded text-xs font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200";
            backBtn.innerHTML = "<i class='fa-solid fa-arrow-left'></i>";
            backBtn.onclick = () => {
                setScaState({ level: 0, path: [], currentNode: null });
                renderScaWheel();
            };
            container.appendChild(backBtn);
            Object.keys(subs).forEach((key) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `sca-btn px-3 py-2 rounded text-xs font-bold shadow-sm opacity-90 hover:opacity-100 ${parentColor}`;
                btn.textContent = key;
                btn.onclick = () => {
                    const nextState = getScaState();
                    nextState.path.push(key);
                    nextState.level = 2;
                    setScaState(nextState);
                    renderScaWheel();
                };
                container.appendChild(btn);
            });
        } else if (scaState.level === 2) {
            const parentKey = scaState.path[0];
            const subKey = scaState.path[1];
            const notes = scaData[parentKey].s[subKey];
            const parentColor = scaData[parentKey].c;
            const backBtn = document.createElement('button');
            backBtn.type = 'button';
            backBtn.className = "sca-btn px-3 py-2 rounded text-xs font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200";
            backBtn.innerHTML = "<i class='fa-solid fa-arrow-left'></i>";
            backBtn.onclick = () => {
                const nextState = getScaState();
                nextState.path.pop();
                nextState.level = 1;
                setScaState(nextState);
                renderScaWheel();
            };
            container.appendChild(backBtn);

            if (notes.length === 0) {
                container.innerHTML += `<div class="flex-1 text-xs text-coffee-500 italic ml-2 flex items-center">Use 'Add' above to confirm selection.</div>`;
            } else {
                notes.forEach((note) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = `sca-btn px-3 py-2 rounded text-xs font-bold shadow-sm opacity-80 hover:opacity-100 ${parentColor}`;
                    btn.textContent = note;
                    btn.onclick = () => {
                        const nextState = getScaState();
                        if (nextState.path.length === 3) nextState.path.pop();
                        nextState.path.push(note);
                        setScaState(nextState);
                        renderScaWheel();
                    };
                    container.appendChild(btn);
                });
            }
        }
    };

    const resetSca = () => {
        setScaState({ level: 0, path: [], currentNode: null });
        renderScaWheel();
    };

    const addScaToNotes = () => {
        const scaState = getScaState();
        if (scaState.path.length === 0) return;
        const flavorToAdd = scaState.path[scaState.path.length - 1];
        const input = document.getElementById('notes');
        if (!input) return;
        let currentText = input.value.trim();
        if (currentText.length > 0) {
            if (currentText.endsWith(',')) currentText = currentText.slice(0, -1);
            input.value = `${currentText}, ${flavorToAdd}`;
        } else {
            input.value = flavorToAdd;
        }
        resetSca();
    };

    const setTempMode = (m) => {
        const mode = document.getElementById('tempMode');
        const btnNum = document.getElementById('btnTempNumeric');
        const btnProf = document.getElementById('btnTempProfile');
        const conNum = document.getElementById('tempNumericContainer');
        const conProf = document.getElementById('tempProfileContainer');
        if (!mode || !btnNum || !btnProf || !conNum || !conProf) return;
        mode.value = m;
        const activeClass = 'px-2 py-0.5 text-[10px] rounded font-bold transition-all bg-white dark:bg-[#1c1917] shadow-sm text-coffee-800 dark:text-white';
        const inactiveClass = 'px-2 py-0.5 text-[10px] rounded font-bold transition-all text-coffee-500 dark:text-[#a8a29e] hover:text-coffee-700';
        if (m === 'numeric') {
            conNum.classList.remove('hidden');
            conProf.classList.add('hidden');
            btnNum.className = activeClass;
            btnProf.className = inactiveClass;
        } else {
            conProf.classList.remove('hidden');
            conNum.classList.add('hidden');
            btnProf.className = activeClass;
            btnNum.className = inactiveClass;
        }
    };

    const updateCoffeeDetailsTitle = () => {
        const titleEl = document.getElementById('coffeeDetailsTitle');
        const body = document.getElementById('coffeeDetailsBody');
        const farmerEl = document.getElementById('farmer');
        if (!titleEl || !body || !farmerEl) return;
        const isCollapsed = body.classList.contains('hidden');
        const farmerValue = (farmerEl.value || '').trim();
        const roasterEl = document.getElementById('roaster');
        const roasterValue = (roasterEl?.value || '').trim();
        if (isCollapsed && (farmerValue || roasterValue)) titleEl.textContent = farmerValue || roasterValue;
        else titleEl.textContent = 'Coffee Details';
    };

    const setCoffeeDetailsCollapsed = (collapsed) => {
        const body = document.getElementById('coffeeDetailsBody');
        const icon = document.getElementById('coffeeDetailsToggleIcon');
        const header = document.getElementById('coffeeDetailsHeader');
        if (!body || !icon) return;
        body.classList.toggle('hidden', collapsed);
        icon.classList.toggle('rotate-180', collapsed);
        if (header) {
            header.classList.toggle('mb-4', !collapsed);
            header.classList.toggle('pb-2', !collapsed);
            header.classList.toggle('border-b', !collapsed);
            header.classList.toggle('border-coffee-200', !collapsed);
            header.classList.toggle('dark:border-[#44403c]', !collapsed);
            header.classList.toggle('mb-0', collapsed);
            header.classList.toggle('pb-0', collapsed);
        }
        updateCoffeeDetailsTitle();
    };

    const toggleCoffeeDetails = (e) => {
        if (e) e.stopPropagation();
        const body = document.getElementById('coffeeDetailsBody');
        if (!body) return;
        const isHidden = body.classList.contains('hidden');
        setCoffeeDetailsCollapsed(!isHidden);
    };

    const initCoffeeDetailsUi = () => {
        setCoffeeDetailsCollapsed(false);
        ['farmer', 'roaster'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', updateCoffeeDetailsTitle);
            el.addEventListener('change', updateCoffeeDetailsTitle);
        });
    };

    const toggleForm = (f = null) => {
        const c = document.getElementById('formContainer');
        const o = document.getElementById('formContent');
        if (!c || !o) return;
        const e = c.getAttribute('aria-expanded') === 'true';
        const s = f !== null ? f : !e;
        c.setAttribute('aria-expanded', s ? 'true' : 'false');
        if (s) {
            o.classList.remove('hidden');
            getRefreshManualPinningVisibility()?.();
            if (document.getElementById('notesMode')?.value === 'sca') renderScaWheel();
            const coffeeScale = getCoffeeScale();
            if (coffeeScale?.autoConnect) coffeeScale.autoConnect();
            const isEditing = c.classList.contains('editing-mode') || !!document.getElementById('editId')?.value;
            if (!isEditing) {
                setCoffeeDetailsCollapsed(false);
                if (coffeeScale?.applyGraphTogglePrefsForMethod) coffeeScale.applyGraphTogglePrefsForMethod();
            }
        } else {
            o.classList.add('hidden');
        }
    };

    return {
        setNotesMode,
        renderScaWheel,
        addScaToNotes,
        resetSca,
        setTempMode,
        updateCoffeeDetailsTitle,
        setCoffeeDetailsCollapsed,
        toggleCoffeeDetails,
        initCoffeeDetailsUi,
        toggleForm
    };
};
