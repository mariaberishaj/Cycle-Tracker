let selectedDate = new Date();
selectedDate.setHours(0,0,0,0);
let userData = JSON.parse(localStorage.getItem('cycleData')) || { dailyLogs: {} };

function saveData() {
    localStorage.setItem('cycleData', JSON.stringify(userData));
}

// --- CYCLE ANALYSIS LOGIC ---
function getPeriodStarts() {
    const dates = Object.keys(userData.dailyLogs)
        .filter(date => userData.dailyLogs[date].period === 'yes')
        .sort();
    return dates.filter((date, i) => {
        const prev = new Date(date);
        prev.setDate(prev.getDate() - 1);
        return !dates.includes(prev.toISOString().split('T')[0]);
    });
}

function getCycleAnalysis() {
    const starts = getPeriodStarts();
    const defaults = { avgLength: 28, shortest: 28, lastStart: starts[starts.length - 1] || null };
    
    if (starts.length < 2) return defaults;

    let lengths = [];
    for (let i = 1; i < starts.length; i++) {
        const diff = (new Date(starts[i]) - new Date(starts[i-1])) / 86400000;
        lengths.push(diff);
    }

    return {
        avgLength: Math.round(lengths.slice(-12).reduce((a,b) => a+b, 0) / Math.min(lengths.length, 12)) || 28,
        shortest: Math.min(...lengths.slice(-6)) || 28,
        lastStart: starts[starts.length - 1]
    };
}

// --- UI UPDATES ---
function changeWeek(direction) {
    selectedDate.setDate(selectedDate.getDate() + (direction * 7));
    renderWeek();
    updateStatus();
}

function logVal(key, val) {
    const dateStr = selectedDate.toISOString().split('T')[0];
    if (!userData.dailyLogs[dateStr]) userData.dailyLogs[dateStr] = {};

    if (userData.dailyLogs[dateStr][key] === val) {
        delete userData.dailyLogs[dateStr][key];
    } else {
        userData.dailyLogs[dateStr][key] = val;
    }
    saveData();
    renderWeek();
    updateStatus();
}

function renderWeek() {
    const grid = document.getElementById('week-grid');
    if (!grid) return; // Safety check
    grid.innerHTML = '';
    
    const analysis = getCycleAnalysis();
    const today = new Date(); 
    today.setHours(0,0,0,0);

    // --- FIND THE ONE OVULATION DAY ---
    let actualOvu = null;
    if (analysis.lastStart) {
        // Base Prediction
        let nextP = new Date(analysis.lastStart);
        nextP.setDate(nextP.getDate() + analysis.avgLength);
        actualOvu = new Date(nextP);
        actualOvu.setDate(actualOvu.getDate() - 14);

        // Rule 4: LH+ Lock
        let hasLH = false;
        Object.keys(userData.dailyLogs).forEach(day => {
            if (day >= analysis.lastStart && userData.dailyLogs[day].lh === 'pos') {
                actualOvu = new Date(day);
                actualOvu.setDate(actualOvu.getDate() + 1);
                hasLH = true;
            }
        });

        // Rule 3: Push to Today if passed
        if (!hasLH && actualOvu < today) {
            actualOvu = new Date(today);
        }

        // Rule 5: Period Back-calculate
        const nextPStart = getPeriodStarts().find(s => s > analysis.lastStart);
        if (nextPStart && !hasLH) {
            actualOvu = new Date(nextPStart);
            actualOvu.setDate(actualOvu.getDate() - 14);
        }
    }

    // --- DRAW THE 7 DAYS ---
    for (let i = -3; i <= 3; i++) {
        let d = new Date(selectedDate);
        d.setDate(d.getDate() + i);
        const dStr = d.toISOString().split('T')[0];
        const log = userData.dailyLogs[dStr] || {};

        const isOvuDay = actualOvu && d.toDateString() === actualOvu.toDateString();
        const isConfirmed = log.pdg === 'pos';

        // Rule 2: Fertile Window
        let isFertile = false;
        if (analysis.lastStart && actualOvu) {
            const cd = Math.floor((d - new Date(analysis.lastStart)) / 86400000) + 1;
            const fertEnd = new Date(actualOvu); 
            fertEnd.setDate(fertEnd.getDate() + 2);
            if (cd >= (analysis.shortest - 20) && d <= fertEnd) isFertile = true;
        }

        // Build HTML Elements
        let cell = document.createElement('div');
        cell.className = 'day-cell';
        if (d.toDateString() === selectedDate.toDateString()) cell.classList.add('selected');
        if (isFertile) cell.classList.add('post-ovulation');

        let numberSpan = document.createElement('div');
        numberSpan.className = 'day-number';
        if (d.toDateString() === today.toDateString()) numberSpan.classList.add('today-bold');
        
        // Apply the Circle logic
        if (isOvuDay) {
            numberSpan.classList.add('ovulation-day');
            if (isConfirmed) numberSpan.classList.add('confirmed');
        }

        numberSpan.innerText = d.getDate();
        cell.appendChild(numberSpan);

        if (analysis.lastStart) {
            let cdLabel = document.createElement('div');
            cdLabel.className = 'cycle-day';
            cdLabel.innerText = `CD${Math.floor((d - new Date(analysis.lastStart))/
