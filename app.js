// 🔥 1. Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCxEErq72IR1pHji5Sn1SLHm9YTigMACog",
  authDomain: "expensetracker-gg.firebaseapp.com",
  projectId: "expensetracker-gg",
  storageBucket: "expensetracker-gg.firebasestorage.app",
  messagingSenderId: "1075146026314",
  appId: "1:1075146026314:web:c00684d47720f5dad825b3",
  measurementId: "G-2ZVNCXWCE3"
};

// Initialize Firebase & Firestore
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Global App State
let allExpenses = []; 
let currentPeriodFilter = 'ALL'; 
let currentBase64Slip = null;
let reminderSettings = JSON.parse(localStorage.getItem('reminderSettings')) || { enabled: false, time: "20:00" };

// Bank Display Mapping (Clean Light Theme Badges)
const BANK_MAP = {
    'KBANK': { name: 'กสิกรไทย', color: '#059669', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    'SCB': { name: 'ไทยพาณิชย์', color: '#7c3aed', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
    'BBL': { name: 'กรุงเทพ', color: '#2563eb', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    'KTB': { name: 'กรุงไทย', color: '#0891b2', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    'TTB': { name: 'ttb', color: '#1d4ed8', badge: 'bg-blue-100 text-blue-800 border-blue-200' },
    'BAY': { name: 'กรุงศรี', color: '#d97706', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
    'GSB': { name: 'ออมสิน', color: '#db2777', badge: 'bg-pink-50 text-pink-700 border-pink-200' },
    'TRUE_MONEY': { name: 'TrueMoney', color: '#ea580c', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
    'CREDIT_CARD': { name: 'บัตรเครดิต', color: '#475569', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
    'CASH': { name: 'เงินสด', color: '#16a34a', badge: 'bg-green-50 text-green-700 border-green-200' },
    'OTHER': { name: 'อื่นๆ', color: '#64748b', badge: 'bg-slate-100 text-slate-600 border-slate-200' }
};

// Category Display Mapping
const CATEGORY_MAP = {
    'food': { name: '🍔 อาหาร & เครื่องดื่ม', color: '#e11d48' },
    'travel': { name: '🚗 เดินทาง & น้ำมัน', color: '#d97706' },
    'shopping': { name: '🛍️ ช้อปปิ้ง', color: '#c026d3' },
    'bills': { name: '💡 ค่าน้ำ ค่าไฟ เน็ต', color: '#2563eb' },
    'entertainment': { name: '🎬 ความบันเทิง', color: '#7c3aed' },
    'health': { name: '💊 สุขภาพ & ยา', color: '#059669' },
    'other': { name: '📦 อื่นๆ', color: '#64748b' }
};

// Chart Instances
let bankChartInstance = null;
let categoryChartInstance = null;
let trendChartInstance = null;

// Initialize App & Listen to Firestore Realtime Updates
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('date').value = new Date().toISOString().split('T')[0];
    
    document.getElementById('reminder-toggle').checked = reminderSettings.enabled;
    document.getElementById('reminder-time').value = reminderSettings.time;

    // ☁️ Real-time Firestore Listener
    db.collection("expenses").onSnapshot((snapshot) => {
        allExpenses = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        allExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        updateUI();
        checkDailyStatus();
    }, (error) => {
        console.error("Firestore Listen Error: ", error);
    });

    startReminderChecker();
});

// Client-Side Image Compression to Base64 (~50-80KB max)
function previewSlip(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('กรุณาเลือกไฟล์รูปภาพเท่านั้นครับ');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 600;
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            currentBase64Slip = canvas.toDataURL('image/jpeg', 0.65);

            document.getElementById('slip-preview-container').classList.add('hidden');
            document.getElementById('slip-preview-box').classList.remove('hidden');
            document.getElementById('slip-preview-img').src = currentBase64Slip;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function removeSlipPreview(e) {
    if (e) e.stopPropagation();
    currentBase64Slip = null;
    document.getElementById('slip-input').value = '';
    document.getElementById('slip-preview-container').classList.remove('hidden');
    document.getElementById('slip-preview-box').classList.add('hidden');
    document.getElementById('slip-preview-img').src = '';
}

function setPeriodFilter(period) {
    currentPeriodFilter = period;
    
    document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active-period'));
    const activeBtn = document.getElementById(`filter-btn-${period}`);
    if (activeBtn) activeBtn.classList.add('active-period');

    const subtitleMap = {
        'ALL': 'แสดงข้อมูลทั้งหมดในระบบ',
        'THIS_MONTH': 'แสดงข้อมูลเฉพาะเดือนนี้',
        'THIS_WEEK': 'แสดงข้อมูลเฉพาะสัปดาห์นี้',
        'TODAY': 'แสดงข้อมูลเฉพาะวันนี้'
    };
    document.getElementById('period-subtitle').innerText = subtitleMap[period] || '';

    updateUI();
}

function getFilteredExpensesByPeriod() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (currentPeriodFilter === 'TODAY') {
        return allExpenses.filter(item => item.date === todayStr);
    } else if (currentPeriodFilter === 'THIS_MONTH') {
        const monthStr = todayStr.substring(0, 7);
        return allExpenses.filter(item => item.date && item.date.startsWith(monthStr));
    } else if (currentPeriodFilter === 'THIS_WEEK') {
        const curr = new Date();
        const first = curr.getDate() - curr.getDay();
        const firstDayOfWeek = new Date(curr.setDate(first));
        const firstDayStr = firstDayOfWeek.toISOString().split('T')[0];
        return allExpenses.filter(item => item.date >= firstDayStr && item.date <= todayStr);
    }
    return allExpenses;
}

function handleFormSubmit(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('amount').value);
    const bank = document.getElementById('bank').value;
    const category = document.getElementById('category').value;
    const date = document.getElementById('date').value;
    const note = document.getElementById('note').value.trim();

    if (isNaN(amount) || amount <= 0) {
        alert('กรุณากรอกจำนวนเงินให้ถูกต้อง');
        return;
    }

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i><span>กำลังบันทึก...</span>`;

    const newExpense = {
        amount: amount,
        bank: bank,
        category: category,
        date: date,
        note: note,
        slipUrl: currentBase64Slip || null,
        createdAt: new Date().toISOString()
    };

    db.collection("expenses").add(newExpense)
        .then(() => {
            document.getElementById('expense-form').reset();
            document.getElementById('date').value = new Date().toISOString().split('T')[0];
            removeSlipPreview();
        })
        .catch((error) => {
            alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i><span>บันทึกข้อมูล</span>`;
        });
}

function deleteExpense(id) {
    if (confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) {
        db.collection("expenses").doc(id).delete()
            .catch((error) => {
                alert('เกิดข้อผิดพลาดในการลบ: ' + error.message);
            });
    }
}

function openSlipModal(slipUrl) {
    if (!slipUrl) return;
    document.getElementById('modal-slip-img').src = slipUrl;
    document.getElementById('slip-modal').classList.remove('hidden');
}

function closeSlipModal() {
    document.getElementById('slip-modal').classList.add('hidden');
    document.getElementById('modal-slip-img').src = '';
}

function updateUI() {
    const periodExpenses = getFilteredExpensesByPeriod();
    
    updateAnalyticalCards(periodExpenses);
    renderHistoryTable(periodExpenses);
    renderCharts(periodExpenses);
    renderTrendChart(periodExpenses);
}

function updateAnalyticalCards(filteredList) {
    const todayStr = new Date().toISOString().split('T')[0];

    const totalAmount = filteredList.reduce((sum, item) => sum + item.amount, 0);
    const todayAmount = allExpenses
        .filter(item => item.date === todayStr)
        .reduce((sum, item) => sum + item.amount, 0);

    const uniqueDates = [...new Set(filteredList.map(item => item.date))];
    const activeDaysCount = uniqueDates.length || 1;
    const dailyAvg = totalAmount / activeDaysCount;

    const catTotals = {};
    filteredList.forEach(item => {
        catTotals[item.category] = (catTotals[item.category] || 0) + item.amount;
    });
    let topCatKey = '-';
    let topCatMax = 0;
    Object.entries(catTotals).forEach(([cat, sum]) => {
        if (sum > topCatMax) {
            topCatMax = sum;
            topCatKey = cat;
        }
    });
    const topCatName = CATEGORY_MAP[topCatKey] ? CATEGORY_MAP[topCatKey].name : '-';
    const topCatPercent = totalAmount > 0 ? ((topCatMax / totalAmount) * 100).toFixed(0) : 0;

    const bankTotals = {};
    filteredList.forEach(item => {
        bankTotals[item.bank] = (bankTotals[item.bank] || 0) + item.amount;
    });
    let topBankKey = '-';
    let topBankMax = 0;
    Object.entries(bankTotals).forEach(([bank, sum]) => {
        if (sum > topBankMax) {
            topBankMax = sum;
            topBankKey = bank;
        }
    });
    const topBankName = BANK_MAP[topBankKey] ? BANK_MAP[topBankKey].name : '-';

    const slipsCount = filteredList.filter(item => item.slipUrl).length;

    document.getElementById('stat-total-expense').innerText = `฿${totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('stat-today-small').innerText = `฿${todayAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
    
    document.getElementById('stat-daily-avg').innerText = `฿${dailyAvg.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('stat-active-days').innerText = `${uniqueDates.length} วัน`;

    document.getElementById('stat-top-cat-name').innerText = topCatName;
    document.getElementById('stat-top-cat-percent').innerText = `${topCatPercent}%`;

    document.getElementById('stat-top-bank-name').innerText = topBankName;
    document.getElementById('stat-total-slips').innerText = `${slipsCount} สลิป`;
}

function renderHistoryTable(periodExpenses) {
    const periodList = periodExpenses || getFilteredExpensesByPeriod();
    const tableBody = document.getElementById('history-table-body');
    const filterBank = document.getElementById('filter-bank').value;
    const searchKeyword = document.getElementById('search-input').value.toLowerCase().trim();

    let resultList = periodList;

    if (filterBank !== 'ALL') {
        resultList = resultList.filter(item => item.bank === filterBank);
    }

    if (searchKeyword !== '') {
        resultList = resultList.filter(item => 
            (item.note && item.note.toLowerCase().includes(searchKeyword)) ||
            item.amount.toString().includes(searchKeyword)
        );
    }

    if (resultList.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-slate-400">ไม่พบรายการใช้เงินตามเงื่อนไขที่คุณเลือก</td></tr>`;
        return;
    }

    tableBody.innerHTML = resultList.map(item => {
        const bankInfo = BANK_MAP[item.bank] || BANK_MAP['OTHER'];
        const catInfo = CATEGORY_MAP[item.category] || CATEGORY_MAP['other'];
        const slipBtn = item.slipUrl 
            ? `<button onclick="openSlipModal('${item.slipUrl}')" class="text-emerald-700 hover:text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg text-xs flex items-center justify-center space-x-1 transition mx-auto font-medium" title="ดูสลิป">
                <i class="fa-solid fa-receipt text-emerald-600"></i><span>ดูสลิป</span>
               </button>`
            : `<span class="text-slate-400 text-[11px]">-</span>`;
        
        return `
            <tr class="hover:bg-slate-50/80 transition">
                <td class="p-3.5 text-slate-500 whitespace-nowrap">${formatDateTh(item.date)}</td>
                <td class="p-3.5 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${bankInfo.badge}">
                        ${bankInfo.name}
                    </span>
                </td>
                <td class="p-3.5 whitespace-nowrap text-slate-800 font-medium">${catInfo.name}</td>
                <td class="p-3.5 text-slate-500 max-w-xs truncate">${escapeHtml(item.note || '-')}</td>
                <td class="p-3.5 text-center whitespace-nowrap">${slipBtn}</td>
                <td class="p-3.5 font-bold text-right text-rose-600 whitespace-nowrap text-sm">฿${item.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                <td class="p-3.5 text-center whitespace-nowrap">
                    <button onclick="deleteExpense('${item.id}')" class="text-slate-400 hover:text-rose-600 transition p-1" title="ลบรายการ">
                        <i class="fa-solid fa-trash-can text-sm"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderCharts(filteredList) {
    const bankTotals = {};
    const catTotals = {};

    filteredList.forEach(item => {
        bankTotals[item.bank] = (bankTotals[item.bank] || 0) + item.amount;
        catTotals[item.category] = (catTotals[item.category] || 0) + item.amount;
    });

    Chart.defaults.color = '#64748b';

    const ctxBank = document.getElementById('bank-chart').getContext('2d');
    if (bankChartInstance) bankChartInstance.destroy();
    bankChartInstance = new Chart(ctxBank, {
        type: 'doughnut',
        data: {
            labels: Object.keys(bankTotals).map(k => BANK_MAP[k] ? BANK_MAP[k].name : k),
            datasets: [{
                data: Object.values(bankTotals),
                backgroundColor: Object.keys(bankTotals).map(k => BANK_MAP[k] ? BANK_MAP[k].color : '#94a3b8'),
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10, family: 'Prompt' } } } } }
    });

    const ctxCat = document.getElementById('category-chart').getContext('2d');
    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: Object.keys(catTotals).map(k => CATEGORY_MAP[k] ? CATEGORY_MAP[k].name : k),
            datasets: [{
                data: Object.values(catTotals),
                backgroundColor: Object.keys(catTotals).map(k => CATEGORY_MAP[k] ? CATEGORY_MAP[k].color : '#94a3b8'),
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10, family: 'Prompt' } } } } }
    });
}

function renderTrendChart(filteredList) {
    const dailyMap = {};

    const sorted = [...filteredList].sort((a, b) => new Date(a.date) - new Date(b.date));

    sorted.forEach(item => {
        if (!item.date) return;
        dailyMap[item.date] = (dailyMap[item.date] || 0) + item.amount;
    });

    const labels = Object.keys(dailyMap).map(dateStr => {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}`;
    });
    const dataValues = Object.values(dailyMap);

    const ctxTrend = document.getElementById('trend-chart').getContext('2d');
    if (trendChartInstance) trendChartInstance.destroy();

    const gradient = ctxTrend.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, 'rgba(5, 150, 105, 0.25)');
    gradient.addColorStop(1, 'rgba(5, 150, 105, 0.0)');

    trendChartInstance = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'ยอดใช้จ่าย (บาท)',
                data: dataValues,
                borderColor: '#059669',
                borderWidth: 3,
                backgroundColor: gradient,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: '#059669',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return ` ฿${context.parsed.y.toLocaleString('th-TH')}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(226, 232, 240, 0.8)' },
                    ticks: { font: { size: 10, family: 'Prompt' } }
                },
                y: {
                    grid: { color: 'rgba(226, 232, 240, 0.8)' },
                    ticks: {
                        font: { size: 10, family: 'Prompt' },
                        callback: function(value) { return '฿' + value.toLocaleString('th-TH'); }
                    }
                }
            }
        }
    });
}

function checkDailyStatus() {
    const todayStr = new Date().toISOString().split('T')[0];
    const hasTodayExpense = allExpenses.some(item => item.date === todayStr);
    const banner = document.getElementById('daily-status-banner');
    if (!hasTodayExpense) banner.classList.remove('hidden');
    else banner.classList.add('hidden');
}

function toggleReminderModal() {
    document.getElementById('reminder-modal').classList.toggle('hidden');
}

function saveReminderSettings() {
    const enabled = document.getElementById('reminder-toggle').checked;
    const time = document.getElementById('reminder-time').value;
    reminderSettings = { enabled, time };
    localStorage.setItem('reminderSettings', JSON.stringify(reminderSettings));
    alert('บันทึกตั้งค่าเรียบร้อยแล้ว');
    toggleReminderModal();
}

function startReminderChecker() {
    setInterval(() => {
        if (!reminderSettings.enabled) return;
        const now = new Date();
        const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        if (currentTimeStr === reminderSettings.time && now.getSeconds() === 0) {
            const todayStr = now.toISOString().split('T')[0];
            const hasTodayExpense = allExpenses.some(item => item.date === todayStr);
            if (!hasTodayExpense) {
                alert("🔔 Reminder: วันนี้คุณยังไม่ได้ลงบันทึกการใช้เงินเลย อย่าลืมลงบัญชีประจำวันนะครับ!");
            }
        }
    }, 1000);
}

function exportData() {
    if (allExpenses.length === 0) { alert('ไม่มีข้อมูลสำหรับส่งออก'); return; }
    let csvContent = "data:text/csv;charset=utf-8,\uFEFFID,Date,Bank,Category,Amount,Note,HasSlip\n";
    allExpenses.forEach(item => {
        const bankName = BANK_MAP[item.bank] ? BANK_MAP[item.bank].name : item.bank;
        const catName = CATEGORY_MAP[item.category] ? CATEGORY_MAP[item.category].name : item.category;
        const hasSlip = item.slipUrl ? "YES" : "NO";
        csvContent += `${item.id},${item.date},${bankName},${catName},${item.amount},"${(item.note || '').replace(/"/g, '""')}",${hasSlip}\n`;
    });
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Expense_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function formatDateTh(dateStr) {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${parseInt(year) + 543}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}