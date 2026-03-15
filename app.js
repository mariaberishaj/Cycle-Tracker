let selectedDate = new Date();
selectedDate.setHours(0,0,0,0);
let userData = JSON.parse(localStorage.getItem('cycleData')) || { dailyLogs: {} };

// Helper to save data
function saveData() {
    localStorage.setItem('cycleData', JSON.stringify(userData));
}

// Get dates where period starts
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

// Calculate cycle metrics
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
    selectedDate.setDate(selectedDate.getDate() + (dir * 7));
    renderWeek();
    updateStatus();
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
    if (!grid) return;
    grid.innerHTML = '';
    
    const analysis = getCycleAnalysis();
    const today = new Date(); today.setHours(0,0,0,0);

    // One persistent Ovulation Day
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

        const nextPStart = getPeriodStarts().find(s => s > analysis.lastStart);
        if (nextPStart && !hasLH) {
            actualOvu = new Date(nextPStart);
            actualOvu.setDate(actualOvu.getDate() - 14);
        }
    }

    for (let i = -3; i <= 3; i++) {
        let d = new Date(selectedDate);
        d.setDate(d.getDate() + i);
        const dStr = d.toISOString().split('T')[0];
        const log = userData.dailyLogs[dStr] || {};

        const isOvuDay = actualOvu && d.toDateString() === actualOvu.toDateString();
        
        let isFertile = false;
        if (analysis.lastStart && actualOvu) {
            const cd = Math.floor((d - new Date(analysis.lastStart)) / 86400000) + 1;
            const fertEnd = new Date(actualOvu); fertEnd.setDate(fertEnd.getDate() + 2);
            if (cd >= (analysis.shortest - 20) && d <= fertEnd) isFertile = true;
        }

        let cell = document.createElement('div');
        cell.className = 'day-cell';
        if (d.toDateString() === selectedDate.toDateString()) cell.classList.add('selected');
        if (isFertile) cell.classList.add('post-ovulation');

        let num = document.createElement('div');
        num.className = 'day-number';
        if (d.toDateString() === today.toDateString()) num.classList.add('today-bold');
        if (isOvuDay) {
            num.classList.add('ovulation-day');
            if (log.pdg === 'pos') num.classList.add('confirmed');
        }
        num.innerText = d.getDate();
        
        cell.appendChild(num);

        if (analysis.lastStart) {
            let cdLabel = document.createElement('div');
            cdLabel.className = 'cycle-day';
            cdLabel.innerText = `CD${Math.floor((d - new Date(analysis.lastStart))/86400000)+1}`;
            cell.appendChild(cdLabel);
        }

        cell.onclick = () => { selectedDate = new Date(d); renderWeek(); updateStatus(); };
        grid.appendChild(cell);
    }
    document.getElementById('month-display').innerText = selectedDate.toLocaleDateString('en-US', {month:'long', year:'numeric'});
}

function updateStatus() {
    const dStr = selectedDate.toISOString().split('T')[0];
    const log = userData.dailyLogs[dStr] || {};
    document.getElementById('selected-date-display').innerText = selectedDate.toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'});
    
    const analysis = getCycleAnalysis();
    document.getElementById('prediction-text').innerText = analysis.lastStart ? 
        `CD ${Math.floor((selectedDate - new Date(analysis.lastStart))/86400000)+1}` : "--";

    document.querySelectorAll('.btn-group button').forEach(b => b.classList.remove('active'));
    Object.keys(log).forEach(k => {
        const btn = document.querySelector(`button[onclick="logVal('${k}', '${log[k]}')"]`);
        if (btn) btn.classList.add('active');
    });

    if (document.getElementById('cm-select')) document.getElementById('cm-select').value = log.cm || 'none';
    document.getElementById('temp-input').value = log.temp || '';
}

function downloadBackup() {
    const blob = new Blob([JSON.stringify(userData)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cycle_backup.json`;
    a.click();
}

function downloadCSV() {
    let csv = "Date,Period,LH,Clearblue,PdG,Temp,CM\n";
    Object.keys(userData.dailyLogs).sort().forEach(d => {
        const l = userData.dailyLogs[d];
        csv += `${d},${l.period||''},${l.lh||''},${l.cb||''},${l.pdg||''},${l.temp||''},${l.cm||''}\n`;
    });
    const blob = new Blob([csv], {type: 'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = "cycle_data.csv";
    a.click();
}

renderWeek();
updateStatus();
