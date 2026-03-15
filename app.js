let selectedDate = new Date();
selectedDate.setHours(0,0,0,0);
let userData = JSON.parse(localStorage.getItem('cycleData')) || { dailyLogs: {} };

function saveData() {
    localStorage.setItem('cycleData', JSON.stringify(userData));
}

// Rule 5 & Rule 1: Finding period starts and averages
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
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    const analysis = getCycleAnalysis();
    
    // Header for S M T W T F S
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const headerRow = document.createElement('div');
    headerRow.className = 'days-header';
    days.forEach(day => { headerRow.innerHTML += `<span>${day}</span>`; });
    if (document.querySelector('.days-header')) document.querySelector('.days-header').remove();
    grid.parentElement.insertBefore(headerRow, grid);

    // Baseline Predictions (Rule 1)
    let predOvu = null;
    if (analysis.lastStart) {
        let nextP = new Date(analysis.lastStart);
        nextP.setDate(nextP.getDate() + analysis.avgLength);
        predOvu = new Date(nextP);
        predOvu.setDate(predOvu.getDate() - 14);
    }

    for (let i = -3; i <= 3; i++) {
        let d = new Date(selectedDate);
        d.setDate(d.getDate() + i);
        const dStr = d.toISOString().split('T')[0];
        const log = userData.dailyLogs[dStr] || {};

        let actualOvu = predOvu ? new Date(predOvu) : null;
        let hasLH = false;

        // Rule 4: Lock Ovu to day after LH Pos
        if (analysis.lastStart) {
            Object.keys(userData.dailyLogs).forEach(day => {
                if (day >= analysis.lastStart && userData.dailyLogs[day].lh === 'pos') {
                    actualOvu = new Date(day);
                    actualOvu.setDate(actualOvu.getDate() + 1);
                    hasLH = true;
                }
            });
        }

        // Rule 3: Push Ovu forward if no LH+
        const today = new Date(); today.setHours(0,0,0,0);
        if (!hasLH && actualOvu && today > actualOvu) {
            actualOvu = new Date(today);
        }

        // Rule 5: Adjust if next period started
        const nextP = getPeriodStarts().find(s => s > analysis.lastStart);
        if (nextP && !hasLH) {
            actualOvu = new Date(nextP);
            actualOvu.setDate(actualOvu.getDate() - 14);
        }

        // Rule 2: Fertile Window
        let isFertile = false;
        if (analysis.lastStart && actualOvu) {
            const cd = Math.floor((d - new Date(analysis.lastStart)) / 86400000) + 1;
            const fertStart = analysis.shortest - 20;
            const fertEnd = new Date(actualOvu); fertEnd.setDate(fertEnd.getDate() + 2);
            if (cd >= fertStart && d <= fertEnd) isFertile = true;
        }

        // Build Cell
        const isOvuDay = actualOvu && d.toDateString() === actualOvu.toDateString();
        let cell = document.createElement('div');
        cell.className = `day-cell ${d.toDateString() === today.toDateString() ? 'today' : ''} 
                          ${d.toDateString() === selectedDate.toDateString() ? 'selected' : ''} 
                          ${isOvuDay ? 'ovulation-day' : ''} 
                          ${isOvuDay && log.pdg === 'pos' ? 'confirmed' : ''} 
                          ${isFertile ? 'fertile-window' : ''}`;
        
        cell.innerHTML = `<span class="day-number">${d.getDate()}</span>`;
        cell.onclick = () => { selectedDate = new Date(d); renderWeek(); updateStatus(); };
        grid.appendChild(cell);
    }

    document.getElementById('month-display').innerText = selectedDate.toLocaleDateString('en-US', {month:'long', year:'numeric'});
    document.getElementById('selected-date-display').innerText = selectedDate.toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'});
}

function updateStatus() {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const log = userData.dailyLogs[dateStr] || {};
    document.querySelectorAll('.btn-group button').forEach(btn => btn.classList.remove('active'));

    // Explicit highlight logic
    if (log.period === 'yes') document.querySelector("button[onclick*=\"'period', 'yes'\"]")?.classList.add('active');
    if (log.period === 'no') document.querySelector("button[onclick*=\"'period', 'no'\"]")?.classList.add('active');
    if (log.lh === 'pos') document.querySelector("button[onclick*=\"'lh', 'pos'\"]")?.classList.add('active');
    if (log.lh === 'neg') document.querySelector("button[onclick*=\"'lh', 'neg'\"]")?.classList.add('active');
    if (log.cb === 'none') document.querySelector("button[onclick*=\"'cb', 'none'\"]")?.classList.add('active');
    if (log.cb === 'high') document.querySelector("button[onclick*=\"'cb', 'high'\"]")?.classList.add('active');
    if (log.cb === 'peak') document.querySelector("button[onclick*=\"'cb', 'peak'\"]")?.classList.add('active');
    if (log.pdg === 'pos') document.querySelector("button[onclick*=\"'pdg', 'pos'\"]")?.classList.add('active');
    if (log.pdg === 'neg') document.querySelector("button[onclick*=\"'pdg', 'neg'\"]")?.classList.add('active');
    if (log.cm === 'none') document.querySelector("button[onclick*=\"'cm', 'none'\"]")?.classList.add('active');
    if (log.cm === 'watery') document.querySelector("button[onclick*=\"'cm', 'watery'\"]")?.classList.add('active');
    if (log.cm === 'creamy') document.querySelector("button[onclick*=\"'cm', 'creamy'\"]")?.classList.add('active');
    if (log.cm === 'spotting') document.querySelector("button[onclick*=\"'cm', 'spotting'\"]")?.classList.add('active');

    document.getElementById('temp-input').value = log.temp || '';
}

renderWeek();
updateStatus();
