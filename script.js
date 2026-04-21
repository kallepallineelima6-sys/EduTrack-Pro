/**
 * EduTrack Pro - Application Logic
 */

// --- Global State ---
let students = [];
let filteredStudents = [];
let subjectChart;
let activeStudentId = null;
let isSignUpMode = false;
let currentUser = null;
let adminFilter = 'all';

// --- Geofencing Constants ---
const CLASSROOM_LOC = { lat: 17.3850, lng: 78.4867 }; // Example: Hyderabad, India
const GEOFENCE_RADIUS = 100; // meters
const CLASS_START_TIME = "09:00";

// ==========================================
// 1. DEMO AUTHENTICATION
// ==========================================
window.toggleAuthMode = function() {
    isSignUpMode = !isSignUpMode;
    const desc = document.getElementById('auth-desc');
    const btnText = document.getElementById('login-btn-text');
    const toggleBtn = document.getElementById('auth-toggle-btn');

    if (isSignUpMode) {
        desc.innerText = "Create a demo account";
        btnText.innerText = "Create Account";
        toggleBtn.innerText = "Already have an account? Sign In";
    } else {
        desc.innerText = "Sign in with neelima@gmail.com / 1234";
        btnText.innerText = "Sign In";
        toggleBtn.innerText = "Don't have an account? Sign Up";
    }
};

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        const btnText = document.getElementById('login-btn-text');
        const btn = document.getElementById('btn-login');

        errorDiv.classList.add('hidden');
        btn.disabled = true;
        btn.classList.add('loading-pulse');
        const originalText = btnText.innerText;
        btnText.innerText = "Authenticating...";

        setTimeout(() => {
            // Demo Credentials: neelima@gmail.com / 1234
            if (email === "neelima@gmail.com" && pass === "1234") {
                currentUser = { email, name: "Neelima" };
                handleSuccessfulLogin();
                
                // Success message
                const toast = document.getElementById('demo-toast');
                toast.querySelector('span').innerText = "Login Success!";
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 3000);
            } else {
                errorDiv.innerText = "Invalid login details";
                errorDiv.classList.remove('hidden');
            }
            
            btnText.innerText = originalText;
            btn.disabled = false;
            btn.classList.remove('loading-pulse');
        }, 800);
    });
}

window.handleLogout = function() {
    currentUser = null;
    window.location.reload();
};

// --- Core App Logic ---
function init() {
    lucide.createIcons();
    initCharts();
    loadLocalData();
}

function handleSuccessfulLogin() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-container').classList.remove('hidden');
    renderStudentsGrid();
    updateAttendanceUI();
}

// ==========================================
// 2. GEOLOCATION & GEOFENCING
// ==========================================
window.handleMarkAttendance = function() {
    const btn = document.getElementById('btn-mark-attendance');
    const originalHtml = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Finding Location...`;
    lucide.createIcons();

    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        return;
    }

    navigator.geolocation.getCurrentPosition((pos) => {
        const { latitude, longitude } = pos.coords;
        const distance = calculateDistance(latitude, longitude, CLASSROOM_LOC.lat, CLASSROOM_LOC.lng);
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isLate = timeStr > CLASS_START_TIME;
        const inClass = distance <= GEOFENCE_RADIUS;

        // Update current student data
        const student = students.find(s => s.email === currentUser.email) || students[0]; 
        student.attendance_data = {
            lat: latitude.toFixed(4),
            lng: longitude.toFixed(4),
            distance: Math.round(distance),
            status: inClass ? 'In Class' : 'Outside',
            timestamp: now.toLocaleString(),
            isLate: isLate
        };

        saveLocalData();
        updateAttendanceUI();
        
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        lucide.createIcons();

        const toast = document.getElementById('demo-toast');
        toast.querySelector('span').innerText = inClass ? "Attendance Marked! ✅" : "Warning: You are outside classroom! 🚨";
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);

    }, (err) => {
        alert("Error capturing location: " + err.message);
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        lucide.createIcons();
    });
};

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

function updateAttendanceUI() {
    const student = students.find(s => s.email === currentUser.email) || students[0];
    const card = document.getElementById('attendance-status-card');
    const badge = document.getElementById('attendance-badge');
    const time = document.getElementById('attendance-time');
    const loc = document.getElementById('attendance-loc');

    if (student && student.attendance_data) {
        card.classList.remove('hidden');
        const data = student.attendance_data;
        const isIn = data.status === 'In Class';
        
        badge.className = `inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest ${isIn ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`;
        badge.innerHTML = `<i data-lucide="${isIn ? 'check-circle' : 'alert-circle'}"></i> ${data.status} ${data.isLate ? '(Late)' : ''}`;
        time.innerText = `Last Updated: ${data.timestamp}`;
        loc.innerText = `GPS: ${data.lat}, ${data.lng} (${data.distance}m from class)`;
    }
    lucide.createIcons();
}

// ==========================================
// 3. TEACHER ADMIN PANEL
// ==========================================
window.filterAttendance = function(type) {
    adminFilter = type;
    renderAdminTable();
};

function renderAdminTable() {
    const tbody = document.getElementById('admin-attendance-table');
    if (!tbody) return;

    let data = students;
    if (adminFilter === 'outside') {
        data = students.filter(s => s.attendance_data && s.attendance_data.status === 'Outside');
    }

    tbody.innerHTML = data.map(s => {
        const att = s.attendance_data || { status: 'No Data', distance: '-', timestamp: '-' };
        const isIn = att.status === 'In Class';
        const color = isIn ? 'emerald' : att.status === 'Outside' ? 'rose' : 'slate';
        
        return `
            <tr class="hover:bg-white/5 transition-colors group">
                <td class="px-8 py-5">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-${color}-500/10 text-${color}-400 rounded-lg flex items-center justify-center font-bold text-xs">
                            ${s.name.split(' ').map(n=>n[0]).join('')}
                        </div>
                        <div>
                            <p class="text-sm font-bold text-white">${s.name}</p>
                            <p class="text-[10px] text-slate-500">${s.email}</p>
                        </div>
                    </div>
                </td>
                <td class="px-8 py-5">
                    <span class="px-3 py-1 bg-${color}-500/10 text-${color}-400 text-[8px] font-black uppercase rounded-full border border-${color}-500/20">
                        ${att.status} ${att.isLate ? '⏰' : ''}
                    </span>
                </td>
                <td class="px-8 py-5 text-xs font-mono text-slate-400">
                    ${att.distance === '-' ? '-' : att.distance + 'm'}
                </td>
                <td class="px-8 py-5 text-xs text-slate-500 font-bold">
                    ${att.timestamp}
                </td>
            </tr>
        `;
    }).join('');
    lucide.createIcons();
}

// ==========================================
// 4. LOCAL DATA STORAGE
// ==========================================
function loadLocalData() {
    const saved = localStorage.getItem('edu_students');
    if (saved) {
        students = JSON.parse(saved);
    } else {
        // Initial Sample Data
        students = [
            { id: '1', name: 'Alex Harrison', email: 'neelima@gmail.com', marks: { math: 88, science: 92, english: 85 }, attendance: 96 },
            { id: '2', name: 'Maya Sharma', email: 'maya@edu.com', marks: { math: 42, science: 55, english: 48 }, attendance: 78 },
            { id: '3', name: 'Leo Brooks', email: 'leo@edu.com', marks: { math: 25, science: 32, english: 38 }, attendance: 64 }
        ];
        saveLocalData();
    }
    filteredStudents = [...students];
}

function saveLocalData() {
    localStorage.setItem('edu_students', JSON.stringify(students));
}

// ==========================================
// 5. AUTOMATIC AI-BASED ANALYSIS
// ==========================================
function analyzeStudentData(s) {
    const avg = getAvg(s);
    const health = getHealth(s);
    
    // Prediction Logic
    let prediction = "Good";
    let predictionColor = "emerald";
    if (avg < 40) { prediction = "High Risk"; predictionColor = "rose"; }
    else if (avg <= 70) { prediction = "Moderate"; predictionColor = "amber"; }

    // Performance Trend
    let trend = "";
    if (s.previousAvg !== undefined) {
        if (avg > s.previousAvg) trend = "Improving 📈";
        else if (avg < s.previousAvg) trend = "Declining 📉";
        else trend = "Stable ➡️";
    }

    // Weak Subject Detection
    const weakSubjects = Object.entries(s.marks).filter(([sub, mark]) => mark < 40);

    // Personalized AI Message
    let aiMessage = `Hi ${s.name}, your overall performance is ${prediction}. `;
    if (weakSubjects.length > 0) {
        aiMessage += `Focus on improving in ${weakSubjects.map(w => w[0]).join(', ')}. Practice daily and focus on fundamentals.`;
    } else {
        aiMessage += "Maintain this excellent standing for scholarship opportunities.";
    }

    // Alerts
    const alerts = [];
    if (s.attendance < 75) {
        alerts.push({ 
            icon: 'clock', 
            color: 'rose', 
            title: 'Low Attendance Warning', 
            msg: `Attendance is only ${s.attendance}%. This significantly increases risk of falling behind.`
        });
    }
    if (weakSubjects.length > 0) {
        alerts.push({ 
            icon: 'alert-triangle', 
            color: 'amber', 
            title: 'Low Marks Detected', 
            msg: `You scored below 40% in ${weakSubjects.length} subject(s).`
        });
    }

    return { avg, health, prediction, predictionColor, weakSubjects, aiMessage, alerts, trend };
}

// --- UI Rendering ---
window.handleSearch = function() {
    const queryText = document.getElementById('student-search').value.toLowerCase();
    filteredStudents = students.filter(s => s.name.toLowerCase().includes(queryText));
    renderStudentsGrid();
};

function renderStudentsGrid() {
    const grid = document.getElementById('students-grid');
    if (!grid) return;
    
    grid.innerHTML = filteredStudents.map(s => {
        const analysis = analyzeStudentData(s);
        const color = analysis.health >= 75 ? 'emerald' : analysis.health >= 45 ? 'amber' : 'rose';
        const statusLabel = analysis.health >= 75 ? 'Good' : analysis.health >= 45 ? 'Average' : 'Risk';
        
        return `
            <div onclick="handleStudentSelect('${s.id}')" class="glass-card p-6 space-y-4 cursor-pointer hover:scale-[1.05] active:scale-95 transition-all ${activeStudentId === s.id ? 'selected' : ''}">
                <div class="flex justify-between items-start">
                    <div class="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center font-black text-indigo-400">
                        ${s.name.split(' ').map(n=>n[0]).join('')}
                    </div>
                    <span class="px-3 py-1 bg-${color}-500/10 text-${color}-400 text-[8px] font-black uppercase rounded-full border border-${color}-500/20">${statusLabel}</span>
                </div>
                <div>
                    <h4 class="font-bold text-white">${s.name}</h4>
                    <p class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 truncate">${s.email || 'No Email'}</p>
                </div>
                <div class="space-y-2">
                    <div class="flex justify-between text-[10px] font-black uppercase tracking-tighter text-slate-400">
                        <span>Health Score</span>
                        <span>${analysis.health}/100</span>
                    </div>
                    <div class="progress-container"><div class="progress-fill bg-${color}-500" style="width: ${analysis.health}%"></div></div>
                </div>
            </div>
        `;
    }).join('');
    lucide.createIcons();
}

window.handleStudentSelect = function(id) {
    activeStudentId = id;
    const s = students.find(item => item.id === id);
    if(!s) return;

    document.getElementById('no-selection-msg').classList.add('hidden');
    document.getElementById('selected-student-view').classList.remove('hidden');
    
    const analysis = analyzeStudentData(s);
    
    document.getElementById('dash-attendance').innerText = s.attendance + '%';
    document.getElementById('dash-percentage').innerText = analysis.avg + '%';
    document.getElementById('dash-health').innerText = analysis.health;
    document.getElementById('dash-health-bar').style.width = analysis.health + '%';
    
    document.getElementById('dash-status-badge').innerHTML = `
        <span class="status-badge bg-${analysis.predictionColor}-500/10 text-${analysis.predictionColor}-400 border border-${analysis.predictionColor}-500/20">
            ${analysis.prediction}
        </span>
    `;
    
    updateCharts(s);
    renderAIInsights(s, analysis);
    updateStudyReminders(s, analysis);
    updateGamification(s, analysis);
    checkEmailAlert(s, analysis);
    
    // Reset Chat for new student
    const chatBox = document.getElementById('chat-box');
    if (chatBox) {
        chatBox.innerHTML = `<div class="chat-bubble bot">Hello ${s.name}! I'm your AI Academic Assistant. How can I help you today?</div>`;
    }
    
    showSection('dashboard');
    document.getElementById('header-title').innerText = s.name + "'s Profile";
};

function renderAIInsights(s, analysis) {
    const container = document.getElementById('ai-insights-container');
    
    let html = `
        <div class="glass-card p-6 bg-indigo-500/5 border-l-4 border-l-indigo-500 space-y-4">
            <div class="flex justify-between items-center">
                <h4 class="font-bold text-white text-sm flex items-center gap-2">
                    <i data-lucide="brain" class="w-4 h-4 text-indigo-400"></i> AI Analysis Message
                </h4>
                ${analysis.trend ? `<span class="text-[10px] font-black uppercase text-indigo-300 tracking-widest">${analysis.trend}</span>` : ''}
            </div>
            <p class="text-xs text-slate-400 leading-relaxed">${analysis.aiMessage}</p>
        </div>
    `;

    if (analysis.alerts.length > 0) {
        html += analysis.alerts.map(a => `
            <div class="glass-card p-6 flex gap-4 border-l-4 border-l-${a.color}-500">
                <div class="w-12 h-12 bg-${a.color}-500/10 text-${a.color}-400 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <i data-lucide="${a.icon}"></i>
                </div>
                <div>
                    <h4 class="font-bold text-white text-sm mb-1">${a.title}</h4>
                    <p class="text-xs text-slate-500 leading-relaxed">${a.msg}</p>
                </div>
            </div>
        `).join('');
    } else {
        html += `
            <div class="glass-card p-6 flex gap-4 border-l-4 border-l-emerald-500">
                <div class="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <i data-lucide="award"></i>
                </div>
                <div>
                    <h4 class="font-bold text-white text-sm mb-1">Excellent Standing</h4>
                    <p class="text-xs text-slate-500 leading-relaxed">No critical risks detected in performance or attendance.</p>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
    lucide.createIcons();
}

// ==========================================
// 6. AI ASSISTANT, REMINDERS & GAMIFICATION
// ==========================================
window.handleChatQuery = function() {
    const input = document.getElementById('chat-input');
    const chatBox = document.getElementById('chat-box');
    const query = input.value.trim().toLowerCase();
    if (!query || !activeStudentId) return;

    const s = students.find(item => item.id === activeStudentId);
    if (!s) return;

    // Add user message
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-bubble user';
    userMsg.innerText = input.value;
    chatBox.appendChild(userMsg);
    input.value = '';

    // Generate bot response
    setTimeout(() => {
        let response = "I'm not sure how to answer that, but I can help with your academic performance!";
        const analysis = analyzeStudentData(s);

        if (query.includes('marks') || query.includes('performance') || query.includes('low')) {
            if (analysis.prediction === 'High Risk') {
                response = `Your current performance is at high risk. I recommend focusing on ${analysis.weakSubjects.map(w => w[0]).join(' and ')} immediately.`;
            } else {
                response = `Your performance is ${analysis.prediction}. Keep up the good work, but there's always room to improve!`;
            }
        } else if (query.includes('math') || query.includes('science') || query.includes('english')) {
            const subject = query.includes('math') ? 'math' : query.includes('science') ? 'science' : 'english';
            const score = s.marks[subject];
            if (score < 40) {
                response = `Your ${subject} score is ${score}%. You should practice fundamental concepts for at least 45 minutes daily.`;
            } else {
                response = `Your ${subject} score is ${score}%. You're doing well, try solving advanced problems to excel further!`;
            }
        } else if (query.includes('improve')) {
            response = "To improve, I suggest: 1. Regular attendance, 2. Daily practice of weak subjects, and 3. Taking mock tests every weekend.";
        }

        const botMsg = document.createElement('div');
        botMsg.className = 'chat-bubble bot';
        botMsg.innerText = response;
        chatBox.appendChild(botMsg);
        chatBox.scrollTop = chatBox.scrollHeight;
        lucide.createIcons();
    }, 500);
};

function updateStudyReminders(s, analysis) {
    const container = document.getElementById('study-reminders-container');
    if (!container) return;

    const reminders = [];
    const weakSubjects = analysis.weakSubjects;

    if (weakSubjects.length > 0) {
        weakSubjects.forEach(sub => {
            reminders.push({
                icon: 'book-open',
                color: 'rose',
                text: `Revise ${sub[0]} today - current score is ${sub[1]}%`
            });
        });
    } else {
        reminders.push({
            icon: 'star',
            color: 'emerald', 
            text: "All subjects looking good! Review Math formulas for 15 mins."
        });
    }

    if (s.attendance < 75) {
        reminders.push({
            icon: 'clock',
            color: 'amber',
            text: "Don't miss the next class! Attendance is below 75%."
        });
    }

    container.innerHTML = reminders.map(r => `
        <div class="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all">
            <div class="p-2 bg-${r.color}-500/10 text-${r.color}-400 rounded-lg"><i data-lucide="${r.icon}" class="w-4 h-4"></i></div>
            <p class="text-xs text-slate-300 font-medium">${r.text}</p>
        </div>
    `).join('');
    lucide.createIcons();
}

function updateGamification(s, analysis) {
    const badgesContainer = document.getElementById('badges-container');
    const pointsDisplay = document.getElementById('total-points');
    if (!badgesContainer || !pointsDisplay) return;

    let points = 0;
    const badges = [];

    // Point calculation
    points += s.attendance >= 90 ? 20 : s.attendance >= 75 ? 10 : 0;
    const avg = analysis.avg;
    points += avg >= 80 ? 30 : avg >= 60 ? 15 : 0;

    // Badge assignment
    if (avg >= 85) badges.push({ icon: 'award', color: 'yellow', name: 'Academic Topper' });
    if (analysis.trend === 'Improving 📈') badges.push({ icon: 'trending-up', color: 'indigo', name: 'Fast Learner' });
    if (s.attendance >= 95) badges.push({ icon: 'shield-check', color: 'emerald', name: 'Perfect Presence' });
    if (badges.length === 0) badges.push({ icon: 'zap', color: 'slate', name: 'Rising Star' });

    pointsDisplay.innerText = points;
    badgesContainer.innerHTML = badges.map(b => `
        <div class="badge-item p-4 glass-card flex flex-col items-center text-center gap-2">
            <div class="p-3 bg-${b.color}-500/10 text-${b.color}-400 rounded-xl"><i data-lucide="${b.icon}"></i></div>
            <p class="text-[10px] font-black text-white uppercase tracking-tighter">${b.name}</p>
        </div>
    `).join('');
    lucide.createIcons();
}

function checkEmailAlert(s, analysis) {
    const alertCard = document.getElementById('email-alert-card');
    if (!alertCard) return;

    if (analysis.prediction === 'High Risk') {
        alertCard.classList.remove('hidden');
        // Auto notification popup logic could go here
    } else {
        alertCard.classList.add('hidden');
    }
}

// ==========================================
// 7. MANAGEMENT & CRUD (SAVE TO LOCAL)
// ==========================================
const studentForm = document.getElementById('student-form');
if (studentForm) {
    studentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('student-id').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        const data = {
            name: document.getElementById('m-name').value,
            email: document.getElementById('m-email').value,
            attendance: parseInt(document.getElementById('m-att').value),
            marks: {
                math: parseInt(document.getElementById('m-math').value),
                science: parseInt(document.getElementById('m-science').value),
                english: parseInt(document.getElementById('m-english').value)
            },
            updatedAt: new Date().toISOString()
        };

        submitBtn.disabled = true;
        submitBtn.innerText = "Saving Data...";

        setTimeout(() => {
            if (id) {
                const idx = students.findIndex(s => s.id === id);
                if (idx !== -1) {
                    data.id = id;
                    data.previousAvg = getAvg(students[idx]);
                    students[idx] = data;
                }
            } else {
                data.id = Date.now().toString();
                students.push(data);
            }
            
            saveLocalData();
            showSection('students-list');
            resetMgmtForm();
            
            // Success Message
            const toast = document.getElementById('demo-toast');
            toast.querySelector('span').innerText = "Data saved successfully (Demo Mode) ✅";
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
            
            submitBtn.disabled = false;
            submitBtn.innerText = "Save Student Profile";
        }, 600);
    });
}

window.editStudent = function(id) {
    const s = students.find(item => item.id === id);
    if(!s) return;
    document.getElementById('student-id').value = s.id;
    document.getElementById('m-name').value = s.name;
    document.getElementById('m-email').value = s.email || '';
    document.getElementById('m-att').value = s.attendance;
    document.getElementById('m-math').value = s.marks.math;
    document.getElementById('m-science').value = s.marks.science;
    document.getElementById('m-english').value = s.marks.english;
    document.getElementById('mgmt-title').innerText = "Edit Student Profile";
    showSection('management');
};

window.resetMgmtForm = function() {
    const form = document.getElementById('student-form');
    if (form) form.reset();
    document.getElementById('student-id').value = '';
    document.getElementById('mgmt-title').innerText = "Add New Student Profile";
};

// --- Navigation ---
window.showSection = function(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    const navBtn = document.getElementById('nav-' + id);
    if (navBtn) navBtn.classList.add('active');
    
    if(id === 'dashboard' && !activeStudentId) {
        document.getElementById('header-title').innerText = "Performance Overview";
    } else if(id === 'students-list') {
        document.getElementById('header-title').innerText = "Student Directory";
        renderStudentsGrid();
    } else if(id === 'management') {
        document.getElementById('header-title').innerText = "Admin Management";
    } else if(id === 'attendance') {
        document.getElementById('header-title').innerText = "Attendance Verification";
        updateAttendanceUI();
    } else if(id === 'admin-panel') {
        document.getElementById('header-title').innerText = "Teacher Dashboard";
        renderAdminTable();
    }
    
    lucide.createIcons();
};

// --- Charts ---
function initCharts() {
    Chart.defaults.color = 'rgba(255,255,255,0.3)';
    Chart.defaults.font.family = "'Plus Jakarta Sans'";
    
    const subCanvas = document.getElementById('subjectChart');
    if (!subCanvas) return;

    const subCtx = subCanvas.getContext('2d');
    subjectChart = new Chart(subCtx, {
        type: 'bar',
        data: { 
            labels: ['Math', 'Science', 'English'], 
            datasets: [{ 
                data: [0, 0, 0], 
                backgroundColor: ['#4f46e5', '#8b5cf6', '#10b981'], 
                borderRadius: 15 
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } },
            scales: { 
                y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function updateCharts(s) {
    if(!subjectChart) return;
    subjectChart.data.datasets[0].data = [s.marks.math, s.marks.science, s.marks.english];
    subjectChart.update();
}

// --- Helpers ---
function getAvg(s) { return Math.round((s.marks.math + s.marks.science + s.marks.english) / 3); }
function getHealth(s) { return Math.round((getAvg(s) * 0.7) + (s.attendance * 0.3)); }

window.sendSimReport = function() {
    const emailInput = document.getElementById('report-email');
    if (!emailInput) return;
    const email = emailInput.value;
    if(!email) return;
    const successMsg = document.getElementById('report-success');
    if (successMsg) {
        successMsg.classList.remove('hidden');
        setTimeout(() => successMsg.classList.add('hidden'), 3000);
    }
    emailInput.value = '';
};

// Bootstrap
document.addEventListener('DOMContentLoaded', init);
