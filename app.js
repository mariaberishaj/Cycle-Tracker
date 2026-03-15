let selectedDate = new Date();
selectedDate.setHours(0,0,0,0);
let userData = JSON.parse(localStorage.getItem('cycleData')) || { dailyLogs: {} };

function saveData() {
    localStorage.setItem('cycleData', JSON.stringify(userData));
}

// Data Analysis Helpers
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
        lengths.push((new Date(starts[i]) - new Date(starts[i-1])) / 86400000);
    }
    return {
        avgLength: Math.round(lengths.slice(-12).reduce((a,b) => a+b, 0) / Math.min(lengths.length, 12)) || 28,
        shortest: Math.min(...lengths.slice(-6)) || 28,
        lastStart: starts[starts.length - 1]
    };
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

function changeWeek(direction) {
    selectedDate.setDate(selectedDate.getDate() + (direction * 7));
    renderWeek();
    updateStatus();
}

function renderWeek() {
    const grid = document.getElementById('week-grid');
    grid.innerHTML = '';
    const analysis = getCycleAnalysis();
    const today = new Date(); today.setHours(0,0,0,0);

    // Baseline Prediction logic
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

        // Rule 4: LH+ Lock
        if (analysis.lastStart) {
            Object.keys(userData.dailyLogs).forEach(day => {
                if (day >= analysis.lastStart && userData.dailyLogs[day].lh === 'pos') {
                    actualOvu = new Date(day);
                    actualOvu.setDate(actualOvu.getDate() + 1);
                    hasLH = true;
                }
            });
        }

        // Rule 3: Push Forward
        if (!hasLH && actualOvu && today > actualOvu) actualOvu = new Date(today);

        // Rule 5: Period Back-calculate
        const nextPStart = getPeriodStarts().find(s => s > analysis.lastStart);
        if (nextPStart && !hasLH) {
            actualOvu = new Date(nextPStart);
            actualOvu.setDate(actualOvu.getDate() - 14);
        }

        // Rule 2: Fertile Window
        let isFertile = false;
        if (analysis.lastStart && actualOvu) {
            const cd = Math.floor((d - new Date(analysis.lastStart)) / 86400000) + 1;
            const fertEnd = new Date(actualOvu); fertEnd.setDate(fertEnd.getDate() + 2);
            if (cd >= (analysis.shortest - 20) && d <= fertEnd) isFertile = true;
        }

        const isOvuDay = actualOvu && d.toDateString() === actualOvu.toDateString();
        
        let cell = document.createElement('div');
        cell.className = `day-cell ${d.toDateString() === today.toDateString() ? 'today' : ''} 
                          ${d.toDateString() === selectedDate.toDateString() ? 'selected' : ''} 
                          ${isOvuDay ? 'ovulation-day' : ''} 
                          ${isOvuDay && log.pdg === 'pos' ? 'confirmed' : ''} 
                          ${isFertile ? 'fertile-window' : ''}`;
        
        cell.innerHTML = `<span>${d.getDate()}</span>`;
        cell.onclick = () => { selectedDate = new Date(d); renderWeek(); updateStatus(); };
        grid.appendChild(cell);
    }

    document.getElementById('month-display').innerText = selectedDate.toLocaleDateString('en-US', {month:'long', year:'numeric'});
}

function updateStatus() {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const log = userData.dailyLogs[dateStr] || {};
    
    // Update Display Text
    document.getElementById('selected-date-display').innerText = selectedDate.toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'});
    
    // Prediction logic for the Action Card
    const analysis = getCycleAnalysis();
    let cdText = analysis.lastStart ? `CD ${Math.floor((selectedDate - new Date(analysis.lastStart))/86400000)+1}` : "--";
    document.getElementById('prediction-text').innerText = cdText;

    // Reset buttons
    document.querySelectorAll('.btn-group button').forEach(btn => btn.classList.remove('active'));

    // Highlight active logs
    Object.keys(log).forEach(key => {
        const val = log[key];
        const btn = document.querySelector(`button[onclick="logVal('${key}', '${val}')"]`);
        if (btn) btn.classList.add('active');
    });

    // Update select and input
    document.getElementById('cm-select').value = log.cm || 'none';
    document.getElementById('temp-input').value = log.temp || '';
}

// Backup functions
function downloadBackup() {
    const blob = new Blob([JSON.stringify(userData)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cycle_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

renderWeek();
updateStatus();
