let viewDate = new Date(); // Controls which week is shown
viewDate.setHours(0,0,0,0);

let selectedDate = new Date(); // Controls which day is being logged
selectedDate.setHours(0,0,0,0);

let userData = JSON.parse(localStorage.getItem('cycleData')) || { dailyLogs: {} };

function saveData() {
    localStorage.setItem('cycleData', JSON.stringify(userData));
}

function getPeriodStarts() {
    const dates = Object.keys(userData.dailyLogs).filter(d => userData.dailyLogs[d].period === 'yes').sort();
    return dates.filter((d, i) => {
        const prev = new Date(d);
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
        lengths.push((new Date(starts[i]) - new Date(starts[i-1])) / 86400000);
    }
    return {
        avgLength: Math.round(lengths.slice(-12).reduce((a,b) => a+b, 0) / Math.min(lengths.length, 12)),
        shortest: Math.min(...lengths.slice(-6)),
        lastStart: starts[starts.length - 1]
    };
}

function changeWeek(dir) {
    viewDate.setDate(viewDate.getDate() + (dir * 7));
    renderWeek();
}

function selectDay(dateObj) {
    selectedDate = new Date(dateObj);
    renderWeek(); // Refresh colors/highlight
    updateStatus(); // Update the form
}

function logVal(key, val) {
    const dStr = selectedDate.toISOString().split('T')[0];
    if (!userData.dailyLogs[dStr]) userData.dailyLogs[dStr] = {};
    if (userData.dailyLogs[dStr][key] === val) {
        delete userData.dailyLogs[dStr][key];
    } else {
        userData.dailyLogs[dStr][key] = val;
    }
    saveData();
    renderWeek();
    updateStatus();
}

function renderWeek() {
    const grid = document.getElementById('week-grid');
    grid.innerHTML = '';
    const analysis = getCycleAnalysis();
    const today = new Date(); today.setHours(0,0,0,0);

    let actualOvu = null;
    if (analysis.lastStart) {
        let nextP = new Date(analysis.lastStart);
        nextP.setDate(nextP.getDate() + analysis.avgLength);
        actualOvu = new Date(nextP);
        actualOvu.setDate(actualOvu.getDate() - 14);

        let hasLH = false;
        Object.keys(userData.dailyLogs).forEach(day => {
            if (day >= analysis.lastStart && userData.dailyLogs[day].lh === 'pos') {
                actualOvu = new Date(day);
                actualOvu.setDate(actualOvu.getDate() + 1);
                hasLH = true;
            }
        });
        if (!hasLH && actualOvu < today) actualOvu = new Date(today);
    }

    // This creates the stable 7-day view centered on viewDate
    for (let i = -3; i <= 3; i++) {
        let d = new Date(viewDate);
        d.setDate(d.getDate() + i);
        const dStr = d.toISOString().split('T')[0];
        
        const isSelected = d.toDateString() === selectedDate.toDateString();
        const isOvuDay = actualOvu && d.toDateString() === actualOvu.toDateString();

        let cell = document.createElement('div');
        cell.className = 'day-cell';
        if (isSelected) cell.classList.add('selected');

        let num = document.createElement('div');
        num.className = 'day-number';
        if (d.toDateString() === today.toDateString()) num.classList.add('today-bold');
        if (isOvuDay) {
            num.classList.add('ovulation-day');
            if (userData.dailyLogs[dStr]?.pdg === 'pos') num.classList.add('confirmed');
        }
        num.innerText = d.getDate();
        cell.appendChild(num);

        cell.onclick = () => selectDay(d);
        grid.appendChild(cell);
    }
    document.getElementById('month-display').innerText = viewDate.toLocaleDateString('en-US', {month:'long', year:'numeric'});
}

function updateStatus() {
    const dStr = selectedDate.toISOString().split('T')[0];
    const log = userData.dailyLogs[dStr] || {};
    document.getElementById('selected-date-display').innerText = selectedDate.toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'});
    
    document.querySelectorAll('.btn-group button').forEach(b => b.classList.remove('active'));
    Object.keys(log).forEach(k => {
        const btn = document.querySelector(`button[onclick="logVal('${k}', '${log[k]}')"]`);
        if (btn) btn.classList.add('active');
    });

    document.getElementById('temp-input').value = log.temp || '';
    if (document.getElementById('cm-select')) document.getElementById('cm-select').value = log.cm || 'none';
}

renderWeek();
updateStatus();
