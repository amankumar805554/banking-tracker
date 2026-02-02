import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyCXB0Qj3zF0xKkWBML_rr45C60i5QMPNfo",
  authDomain: "build-authentication-5ea25.firebaseapp.com",
  projectId: "build-authentication-5ea25",
  storageBucket: "build-authentication-5ea25.firebasestorage.app",
  messagingSenderId: "65566103819",
  appId: "1:65566103819:web:e7fd8cef0436e044dfea0e",
  measurementId: "G-MBW366G744"
};

// --- SAFE INITIALIZATION ---
let app, auth, db, provider;
let currentUser = null;
let isEditMode = false;
let myBarChart = null;
let myPieChart = null;
let timerInterval = null;
let timeLeft = null;
let timerEndTime = null; 
let currentRank = 'daily';

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    provider = new GoogleAuthProvider();
    console.log("Firebase initialized successfully");
} catch (e) {
    console.error("Firebase Error:", e);
    alert("Database Connection Failed. App running in Offline Mode.");
}

// --- 1. GLOBAL UI FUNCTIONS ---
window.showTab = (t) => {
    localStorage.setItem('currentTab', t);
    document.querySelectorAll('.content-section').forEach(e => e.style.display='none');
    document.getElementById(t+'-tab').style.display='block';
    
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active-tab'));
    const tabMap = { 'routine': 'Home', 'bingo': 'Mission', 'timer': 'Timer', 'analytics': 'Stats', 'about': 'About', 'contact': 'Contact' };
    const targetLabel = tabMap[t];
    const btns = document.querySelectorAll('.tabs button');
    for(let b of btns) {
        if(b.innerText.includes(targetLabel)) { b.classList.add('active-tab'); break; }
    }

    const nav = document.getElementById('main-nav');
    const overlay = document.getElementById('menu-overlay');
    if(nav) nav.classList.remove('open');
    if(overlay) overlay.classList.remove('show');
    
    if(t === 'analytics') window.loadStats(7);
    if(t === 'routine') setTimeout(updateUI, 100);
    if(t === 'bingo') renderMissions(); 
};

window.toggleMobileMenu = () => {
    const nav = document.getElementById('main-nav');
    const overlay = document.getElementById('menu-overlay');
    if (nav && overlay) {
        nav.classList.toggle('open');
        overlay.classList.toggle('show');
    }
};

// FIXED: "Brute Force" Function to paint the background
function updateMobileColor(theme) {
    const meta = document.getElementById('theme-color-meta');
    let color = '#F8F9FE'; // Default Light
    
    if (theme === 'sharingan') {
        color = '#050505'; // Sharingan Black
    } else if (theme === 'dark') {
        color = '#0F172A'; // Dark Mode Blue
    }
    
    // 1. Update Meta Tag (Browser Chrome)
    if (meta) meta.setAttribute('content', color);
    
    // 2. FORCE HTML Background (The White Strip Killer)
    document.documentElement.style.backgroundColor = color;
    document.body.style.backgroundColor = color;
}

window.toggleTheme = () => {
    const body = document.body;
    const btn = document.getElementById('theme-btn');
    
    // Logic: Dark -> Sharingan -> Light -> Dark
    if (body.classList.contains('dark')) {
        body.classList.remove('dark'); 
        body.classList.add('sharingan');
        if(btn) btn.innerText = '🔴'; 
        localStorage.setItem('theme', 'sharingan');
        updateMobileColor('sharingan');
    } else if (body.classList.contains('sharingan')) {
        body.classList.remove('sharingan');
        if(btn) btn.innerText = '☀️'; 
        localStorage.setItem('theme', 'light');
        updateMobileColor('light');
    } else {
        body.classList.add('dark');
        if(btn) btn.innerText = '🌙'; 
        localStorage.setItem('theme', 'dark');
        updateMobileColor('dark');
    }
    
    updateUI(); 
    if(document.getElementById('analytics-tab').style.display === 'block') window.loadStats(7);
};

// --- 2. MISSION BOOK LOGIC ---
window.filterMissions = (rank) => {
    currentRank = rank;
    document.querySelectorAll('.rank-btn').forEach(b => b.classList.remove('active-rank'));
    const activeBtn = document.getElementById(`rank-${rank}`);
    if(activeBtn) activeBtn.classList.add('active-rank');
    renderMissions();
};

function getMissions() {
    try { return JSON.parse(localStorage.getItem('ninjaMissions')) || { daily: [], weekly: [], monthly: [] }; } 
    catch(e) { return { daily: [], weekly: [], monthly: [] }; }
}
function saveMissions(data) { localStorage.setItem('ninjaMissions', JSON.stringify(data)); }

window.renderMissions = () => {
    const allMissions = getMissions();
    const list = document.getElementById('mission-list');
    if(!list) return;
    list.innerHTML = '';
    const missions = allMissions[currentRank] || [];
    if(missions.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:20px; opacity:0.6;">No active missions in this rank.</div>`;
        return;
    }
    missions.forEach((m, index) => {
        const div = document.createElement('div');
        div.className = `mission-item ${m.completed ? 'completed slashed' : ''}`;
        div.innerHTML = `
            <div class="ninja-check" onclick="toggleMission(${index})"></div>
            <span class="mission-text">${m.text}<span class="slash-line"></span></span>
            <button class="delete-btn" onclick="deleteMission(${index})"><ion-icon name="trash"></ion-icon></button>
        `;
        list.appendChild(div);
    });
};

window.addMission = () => {
    const input = document.getElementById('new-mission-input');
    const text = input.value.trim();
    if(!text) { alert("Mission cannot be empty!"); return; }
    const allMissions = getMissions();
    if(!allMissions[currentRank]) allMissions[currentRank] = [];
    allMissions[currentRank].push({ text: text, completed: false });
    saveMissions(allMissions);
    input.value = '';
    renderMissions();
};
window.toggleMission = (index) => {
    const allMissions = getMissions();
    if(allMissions[currentRank] && allMissions[currentRank][index]) {
        allMissions[currentRank][index].completed = !allMissions[currentRank][index].completed;
        saveMissions(allMissions);
        renderMissions();
    }
};
window.deleteMission = (index) => {
    const allMissions = getMissions();
    if(allMissions[currentRank]) {
        allMissions[currentRank].splice(index, 1);
        saveMissions(allMissions);
        renderMissions();
    }
};

// --- 3. TIMER LOGIC ---
window.startTimer = () => {
    const btn = document.getElementById('start-btn');
    const status = document.getElementById('timer-status');
    const circle = document.getElementById('timer-circle');

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        timeLeft = Math.ceil((timerEndTime - Date.now()) / 1000);
        timerEndTime = null;
        btn.innerText = "Resume";
        status.innerText = "Paused";
        circle.classList.remove('running');
        return;
    }

    if (timeLeft === null) {
        let mins = parseInt(document.getElementById('input-min').value) || 0;
        let secs = parseInt(document.getElementById('input-sec').value) || 0;
        timeLeft = (mins * 60) + secs;
    }

    if (timeLeft <= 0) { alert("Please set time first!"); return; }

    timerEndTime = Date.now() + (timeLeft * 1000);
    btn.innerText = "Pause";
    status.innerText = "Focusing...";
    circle.classList.add('running');

    timerInterval = setInterval(() => {
        const now = Date.now();
        const diff = Math.ceil((timerEndTime - now) / 1000);

        if (diff <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            timeLeft = null;
            timerEndTime = null;
            btn.innerText = "Start";
            status.innerText = "Mission Complete";
            circle.classList.remove('running');
            document.getElementById('timer-text').innerText = "00:00";
            return;
        }

        const m = Math.floor(diff / 60);
        const s = diff % 60;
        document.getElementById('timer-text').innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }, 100);
};

window.lapTimer = () => {
    if (timeLeft === null || timeLeft <= 0) return;
    const m = Math.floor(timeLeft / 60); const s = timeLeft % 60;
    const list = document.getElementById('lap-list');
    const div = document.createElement('div');
    div.className = 'lap-item';
    div.innerHTML = `<span>Lap ${list.children.length + 1}</span> <span>${m}:${s} left</span>`;
    list.prepend(div);
};
window.resetTimer = () => {
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = null; timeLeft = null;
    document.getElementById('start-btn').innerText = "Start";
    document.getElementById('timer-status').innerText = "Ready to Focus";
    document.getElementById('timer-circle').classList.remove('running');
    document.getElementById('timer-text').innerText = "00:00";
    document.getElementById('input-min').value = 25; document.getElementById('input-sec').value = 0;
    document.getElementById('lap-list').innerHTML = '';
};

// --- 4. AUTH & DATA LOAD ---
window.handleAuth = () => {
    if(!auth) return;
    if (currentUser) { signOut(auth).then(() => location.reload()); } 
    else { signInWithPopup(auth, provider).catch(error => alert("Login Failed: " + error.message)); }
};

if(auth) {
    onAuthStateChanged(auth, (user) => {
        const authText = document.getElementById('auth-text');
        const googlePhoto = document.getElementById('google-photo');
        if (user) {
            currentUser = user;
            if(authText) authText.innerText = "Logout";
            if(googlePhoto) { googlePhoto.src = user.photoURL; googlePhoto.style.display = 'block'; document.getElementById('default-icon').style.display='none'; }
            loadTodayData();
        } else {
            currentUser = null;
            if(authText) authText.innerText = "Login";
            if(googlePhoto) { googlePhoto.style.display = 'none'; document.getElementById('default-icon').style.display='block'; }
        }
    });
}

// --- 5. INITIALIZATION ---
window.onload = () => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const body = document.body;
    const btn = document.getElementById('theme-btn');
    
    body.classList.remove('dark', 'sharingan');
    
    if(savedTheme === 'dark') { 
        body.classList.add('dark'); 
        if(btn) btn.innerText = '🌙'; 
        updateMobileColor('dark');
    }
    else if(savedTheme === 'sharingan') { 
        body.classList.add('sharingan'); 
        if(btn) btn.innerText = '🔴'; 
        updateMobileColor('sharingan');
    }
    else { 
        if(btn) btn.innerText = '☀️'; 
        updateMobileColor('light');
    }

    const lastTab = localStorage.getItem('currentTab') || 'routine';
    renderRoutine();
    restoreCheckboxes();
    showTab(lastTab); 
    renderMissions();
    loadTodayData();
    setTimeout(updateUI, 500);
    
    // Circular Favicon Logic
    setCircularFavicon();

    const missionInput = document.getElementById('new-mission-input');
    if(missionInput) {
        missionInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                window.addMission();
            }
        });
    }
};

const setCircularFavicon = () => {
    const link = document.querySelector("link[rel~='icon']");
    if (!link) return;
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = link.href;
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, 0, 0);
        link.href = canvas.toDataURL();
    };
};

// --- CORE FUNCTIONS ---
const defaultRoutine = [
    { title: "Morning Focus", time: "09:00 - 11:00", tasks: ["Deep Work"] },
    { title: "Afternoon", time: "14:00 - 16:00", tasks: ["Practice"] },
    { title: "Evening", time: "19:00 - 21:00", tasks: ["Review"] }
];

function getRoutine() { try { return JSON.parse(localStorage.getItem('customRoutine')) || defaultRoutine; } catch(e) { return defaultRoutine; } }
function getDuration(timeStr) {
    try {
        const times = timeStr.split('-').map(t => t.trim());
        let start = parseFloat(times[0].replace(':', '.')); if(times[0].includes('30')) start = Math.floor(start) + 0.5;
        let end = parseFloat(times[1].replace(':', '.')); if(times[1].includes('30')) end = Math.floor(end) + 0.5;
        let diff = end - start; if(diff < 0) diff += 12; return diff > 0 ? diff : 1;
    } catch(e) { return 1; }
}

window.renderRoutine = () => {
    const list = document.getElementById('routine-list');
    list.innerHTML = '';
    const routine = getRoutine();
    routine.forEach((slot, index) => {
        const totalSlotHours = getDuration(slot.time);
        const taskCount = slot.tasks.length || 1;
        const hoursPerTask = (totalSlotHours / taskCount).toFixed(1);
        let tasksHtml = slot.tasks.map((t, tIndex) => 
            `<label class="task">
                <input type="checkbox" id="task-${index}-${tIndex}" data-hours="${hoursPerTask}" onchange="updateUI(); saveCheckboxes();"> 
                <span>${t}</span> 
                <span style="margin-left:auto; font-size:0.7rem; opacity:0.5;">${hoursPerTask}h</span>
            </label>`
        ).join('');
        
        if (isEditMode) tasksHtml = `<div style="padding:15px 0; opacity:0.6; font-size:0.9rem; font-style:italic; text-align:center;">(Tasks are hidden while editing)</div>`;
        
        list.innerHTML += `
        <div class="card ${isEditMode ? 'edit-mode' : ''}" style="position: relative;">
            ${isEditMode ? `<button class="delete-slot-btn" onclick="deleteSlot(${index})"><ion-icon name="close"></ion-icon></button>` : ''}
            <div class="card-header">
                ${isEditMode ? `<input type="text" value="${slot.title}" id="title-${index}" placeholder="Title">` : `<h4>${slot.title}</h4>`}
                ${isEditMode ? `<input type="text" value="${slot.time}" id="time-${index}" placeholder="Time">` : `<span class="time">${slot.time} (${Number(totalSlotHours).toFixed(1).replace('.0','')}h)</span>`}
            </div>
            ${tasksHtml}
        </div>`;
    });
    if (window.ionicons) { window.ionicons.install(); }
};

window.toggleEditMode = () => { 
    isEditMode = true; 
    document.getElementById('edit-btn').style.display = 'none'; 
    document.getElementById('done-btn').style.display = 'flex';
    document.getElementById('add-slot-fab').style.display = 'flex'; 
    renderRoutine(); 
};

window.saveCustomRoutine = () => { 
    const r = getRoutine(); 
    r.forEach((slot, i) => { 
        const t = document.getElementById(`title-${i}`); 
        const tm = document.getElementById(`time-${i}`); 
        if(t) slot.title = t.value; 
        if(tm) slot.time = tm.value; 
    }); 
    localStorage.setItem('customRoutine', JSON.stringify(r)); 
    isEditMode = false;
    document.getElementById('edit-btn').style.display = 'flex'; 
    document.getElementById('done-btn').style.display = 'none';
    document.getElementById('add-slot-fab').style.display = 'none'; 
    renderRoutine(); 
};

window.addNewSlot = () => { 
    const r = getRoutine(); 
    r.push({ title: "New Mission", time: "09:00 - 10:00", tasks: ["New Task"] }); 
    localStorage.setItem('customRoutine', JSON.stringify(r)); 
    renderRoutine(); 
    setTimeout(() => {
        const list = document.getElementById('routine-list');
        list.lastElementChild.scrollIntoView({ behavior: 'smooth' });
    }, 100);
};

window.deleteSlot = (i) => { const r = getRoutine(); r.splice(i, 1); localStorage.setItem('customRoutine', JSON.stringify(r)); renderRoutine(); };

window.saveCheckboxes = () => {
    const state = {};
    const date = new Date().toISOString().split('T')[0];
    document.querySelectorAll('input[type="checkbox"]').forEach(box => {
        if(box.id) state[box.id] = box.checked;
    });
    localStorage.setItem('dailyState_' + date, JSON.stringify(state));
};

function restoreCheckboxes() {
    const date = new Date().toISOString().split('T')[0];
    const saved = localStorage.getItem('dailyState_' + date);
    if(saved) {
        const state = JSON.parse(saved);
        for (const [id, checked] of Object.entries(state)) {
            const el = document.getElementById(id);
            if(el) el.checked = checked;
        }
    }
}

window.updateUI = () => {
    let totalHours = 0;
    const subjectMap = {};
    const routine = getRoutine();
    const cards = document.querySelectorAll('#routine-list .card');
    cards.forEach((card, index) => {
        if(index >= routine.length) return;
        const subjectName = routine[index].title; 
        let subjectHours = 0;
        card.querySelectorAll('.task input').forEach(checkbox => {
            if (checkbox.checked) {
                const h = parseFloat(checkbox.getAttribute('data-hours'));
                totalHours += h;
                subjectHours += h;
            }
        });
        if (subjectHours > 0) subjectMap[subjectName] = (subjectMap[subjectName] || 0) + subjectHours;
    });
    const finalHours = totalHours.toFixed(1).replace('.0','');
    const displayElement = document.getElementById('today-hours');
    if(displayElement) displayElement.innerText = finalHours;
    const staticHours = document.getElementById('today-hours-static');
    if(staticHours) staticHours.innerText = finalHours;
    updatePie(subjectMap);
    updateTextSummary(subjectMap, totalHours);
    return totalHours;
};

function updatePie(dataMap) {
    const ctx = document.getElementById('todayPieChart');
    if (!ctx) return;
    const labels = Object.keys(dataMap);
    const data = Object.values(dataMap);
    let colors = ['#6366F1', '#A855F7', '#EC4899', '#10B981', '#F59E0B'];
    if(document.body.classList.contains('sharingan')) {
        colors = ['#DC2626', '#B91C1C', '#991B1B', '#7F1D1D', '#EF4444'];
    }
    if (myPieChart) myPieChart.destroy();
    if (labels.length === 0) {
        myPieChart = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ["Start"], datasets: [{ data: [1], backgroundColor: ["#E2E8F0"] }] },
            options: { events: [], plugins: { legend: { display: false }, tooltip: { enabled: false } }, cutout: '70%' }
        });
        return;
    }
    myPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, font: { size: 10 } } } } }
    });
}

function updateTextSummary(dataMap, total) {
    const container = document.getElementById('today-summary');
    if(!container) return;
    if (total === 0) {
        container.innerHTML = `<p style="opacity: 0.6; font-size: 0.9rem;">Start checking tasks to see details.</p>`;
        return;
    }
    let html = `<strong>Total: ${total.toFixed(1).replace('.0','')} Hours</strong><br><br>`;
    for (const [sub, hrs] of Object.entries(dataMap)) {
        html += `<span class="summary-tag">${sub}: ${hrs.toFixed(1).replace('.0','')}h</span> `;
    }
    container.innerHTML = html;
}

window.saveDay = async () => {
    const hours = window.updateUI();
    const date = new Date().toISOString().split('T')[0];
    const btns = document.querySelectorAll('#save-btn, .btn-save-static');
    btns.forEach(b => b.innerText = "Processing...");
    window.saveCheckboxes();
    
    if(currentUser) {
        try { await setDoc(doc(db, "users", currentUser.uid, "history", date), { date, hours }); btns.forEach(b => b.innerText = "Saved ☁️"); } 
        catch(e) { saveLocally(date, hours, btns); }
    } else { saveLocally(date, hours, btns); }
    setTimeout(() => btns.forEach(b => b.innerText = "Save Progress"), 2000);
};

function saveLocally(date, hours, btns) {
    let h = JSON.parse(localStorage.getItem('offHistory')) || [];
    h = h.filter(x => x.date !== date);
    h.push({ date, hours });
    localStorage.setItem('offHistory', JSON.stringify(h));
    btns.forEach(b => b.innerText = "Saved 📱");
}

async function loadTodayData() {
    const date = new Date().toISOString().split('T')[0];
    let hours = 0;
    try {
        if(currentUser) {
            const d = await getDoc(doc(db, "users", currentUser.uid, "history", date));
            if(d.exists()) hours = d.data().hours;
        } 
    } catch(e) {} 
}

window.loadStats = async (days) => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active-filter'));
    const btnId = days === 90 ? 'btn-90' : (days === 30 ? 'btn-30' : 'btn-7');
    document.getElementById(btnId).classList.add('active-filter');
    let lbl=[], dat=[];
    try {
        if(currentUser) {
            const s = await getDocs(query(collection(db,"users",currentUser.uid,"history"),orderBy("date","desc"),limit(days)));
            s.forEach(d=>{lbl.unshift(d.data().date.slice(5)); dat.unshift(d.data().hours)});
        } else { throw new Error("Local"); }
    } catch(e) { 
        let h = JSON.parse(localStorage.getItem('offHistory')) || [];
        h.sort((a,b)=>new Date(b.date)-new Date(a.date));
        h.slice(0, days).reverse().forEach(x=>{lbl.push(x.date.slice(5)); dat.push(x.hours)});
    }
    const ctx = document.getElementById('studyChart');
    if(ctx) {
        if (myBarChart) myBarChart.destroy();
        myBarChart = new Chart(ctx, { type: 'bar', data: { labels: lbl, datasets: [{ label: 'Hours', data: dat, backgroundColor: document.body.classList.contains('sharingan') ? '#DC2626' : '#4F46E5', borderRadius: 4 }] }, options: { maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    }
};
