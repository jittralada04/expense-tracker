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
let monthlyBudgetLimit = parseFloat(localStorage.getItem('monthlyBudgetLimit')) || 15000;
let monthlySavingsGoal = parseFloat(localStorage.getItem('monthlySavingsGoal')) || 5000;
let reminderSettings = JSON.parse(localStorage.getItem('reminderSettings')) || { enabled: false, time: "20:00" };

// Bank Display Mapping
const BANK_MAP = {
    'KBANK': { name: 'กสิกรไทย', color: '#059669', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    'SCB': { name: 'ไทยพาณิชย์', color: '#7c3aed', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
    'DIME': { name: 'Dime! (KKP)', color: '#10b981', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    'BBL': { name: 'กรุงเทพ', color: '#2563eb', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
    'KTB': { name: 'กรุงไทย', color: '#0891b2', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    'GSB': { name: 'ออมสิน', color: '#db2777', badge: 'bg-pink-50 text-pink-700 border-pink-200' },
    'TRUE_MONEY': { name: 'TrueMoney', color: '#ea580c', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
    'CREDIT_CARD': { name: 'บัตรเครดิต', color: '#475569', badge: 'bg-slate-100 text-slate-700 border-slate-200' },
    'CASH': { name: 'เงินสด', color: '#16a34a', badge: 'bg-green-50 text-green-700 border-green-200' },
    'OTHER': { name: 'อื่นๆ', color: '#64748b', badge: 'bg-slate-100 text-slate-600 border-slate-200' }
};

// Category Display Mapping
const CATEGORY_MAP = {
    'food': { name: 'อาหาร & เครื่องดื่ม', color: '#e11d48' },
    'travel': { name: 'เดินทาง & น้ำมัน', color: '#d97706' },
    'shopping': { name: 'ช้อปปิ้ง', color: '#c026d3' },
    'bills_utility': { name: 'ค่าน้ำ & ค่าไฟ', color: '#2563eb' },
    'bills_internet': { name: 'ค่าเน็ต & โทรศัพท์', color: '#0284c7' },
    'entertainment': { name: 'ความบันเทิง', color: '#7c3aed' },
    'health': { name: 'สุขภาพ & ยา', color: '#059669' },
    'salary': { name: 'เงินเดือนหลัก', color: '#10b981' },
    'extra_income': { name: 'รายได้พิเศษ & โบนัส', color: '#8b5cf6' },
    'savings_goal': { name: 'เงินออม & การลงทุน', color: '#f59e0b' },
    'transfer': { name: 'โอนระหว่างบัญชี', color: '#64748b' },
    'other': { name: 'อื่นๆ / รายจ่ายทั่วไป', color: '#94a3b8' },
    'other_expense': { name: 'รายจ่ายอื่นๆ / แอปจ่ายเงิน', color: '#94a3b8' }
};

// Chart Instances
let bankChartInstance = null;
let categoryChartInstance = null;
let trendChartInstance = null;

// Tab Switching Logic
function switchTab(tabName) {
    // Save current active tab to localStorage
    localStorage.setItem('activeExpenseTab', tabName);

    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    
    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) targetTab.classList.remove('hidden');

    document.querySelectorAll('.tab-nav-btn').forEach(btn => {
        btn.classList.remove('active-tab', 'text-slate-900', 'font-bold');
        btn.classList.add('text-slate-600', 'font-semibold');
    });
    const activeDesktopBtn = document.getElementById(`nav-btn-${tabName}`);
    if (activeDesktopBtn) {
        activeDesktopBtn.classList.add('active-tab', 'text-slate-900', 'font-bold');
        activeDesktopBtn.classList.remove('text-slate-600', 'font-semibold');
    }

    document.querySelectorAll('.mobile-tab-btn').forEach(btn => {
        btn.classList.remove('active-tab', 'text-slate-900', 'font-bold');
        btn.classList.add('text-slate-600', 'font-semibold');
    });
    const activeMobileBtn = document.getElementById(`mobile-nav-btn-${tabName}`);
    if (activeMobileBtn) {
        activeMobileBtn.classList.add('active-tab', 'text-slate-900', 'font-bold');
        activeMobileBtn.classList.remove('text-slate-600', 'font-semibold');
    }

    if (tabName === 'dashboard') {
        setTimeout(() => {
            const periodExpenses = getFilteredExpensesByPeriod();
            renderCharts(periodExpenses);
            renderTrendChart(periodExpenses);
        }, 50);
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Restore active tab from localStorage
    const savedTab = localStorage.getItem('activeExpenseTab') || 'dashboard';
    switchTab(savedTab);
    const dateInput = document.getElementById('date');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    
    const budgetInput = document.getElementById('monthly-budget-input');
    if (budgetInput) budgetInput.value = monthlyBudgetLimit;
    
    const savingsInput = document.getElementById('monthly-savings-input');
    if (savingsInput) savingsInput.value = monthlySavingsGoal;
    
    const reminderToggle = document.getElementById('reminder-toggle');
    if (reminderToggle) reminderToggle.checked = reminderSettings.enabled;
    
    const reminderTime = document.getElementById('reminder-time');
    if (reminderTime) reminderTime.value = reminderSettings.time;

    // Load Local Data from window.INITIAL_STATEMENT_DATA (Guarantees instant rendering under file://)
    if (window.INITIAL_STATEMENT_DATA && Array.isArray(window.INITIAL_STATEMENT_DATA) && window.INITIAL_STATEMENT_DATA.length > 0) {
        allExpenses = window.INITIAL_STATEMENT_DATA.map((item, idx) => {
            let cat = item.category;
            if (item.note && item.note.toUpperCase().includes('TRUE MONEY')) {
                cat = 'food';
            }
            return {
                id: item.id || `local-${idx}`,
                type: item.type || 'EXPENSE',
                ...item,
                category: cat
            };
        });
        allExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
        updateUI();
        checkDailyStatus();
    }

    // ☁️ Real-time Firestore Listener
    try {
        db.collection("expenses").onSnapshot((snapshot) => {
            if (snapshot.docs && snapshot.docs.length > 0) {
                allExpenses = snapshot.docs.map(doc => {
                    const d = doc.data();
                    let cat = d.category;
                    if (d.note && d.note.toUpperCase().includes('TRUE MONEY')) {
                        cat = 'food';
                    }
                    return {
                        id: doc.id,
                        type: d.type || 'EXPENSE',
                        ...d,
                        category: cat
                    };
                });
                allExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
                updateUI();
                checkDailyStatus();
            }
        }, (error) => {
            console.error("Firestore Listen Error: ", error);
        });
    } catch (e) {
        console.warn("Firestore init warning:", e);
    }

    startReminderChecker();
});

// Income / Expense / Transfer Type Selector
function setTxType(type) {
    document.getElementById('tx-type').value = type;
    const expBtn = document.getElementById('txtype-expense-btn');
    const incBtn = document.getElementById('txtype-income-btn');
    const trsBtn = document.getElementById('txtype-transfer-btn');

    if (expBtn) expBtn.className = "py-2.5 rounded-xl font-semibold text-xs text-slate-600 transition flex items-center justify-center space-x-1.5";
    if (incBtn) incBtn.className = "py-2.5 rounded-xl font-semibold text-xs text-slate-600 transition flex items-center justify-center space-x-1.5";
    if (trsBtn) trsBtn.className = "py-2.5 rounded-xl font-semibold text-xs text-slate-600 transition flex items-center justify-center space-x-1.5";

    if (type === 'EXPENSE' && expBtn) {
        expBtn.className = "py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center space-x-1.5 bg-rose-600 text-white shadow-md";
    } else if (type === 'INCOME' && incBtn) {
        incBtn.className = "py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center space-x-1.5 bg-emerald-600 text-white shadow-md";
    } else if (type === 'TRANSFER' && trsBtn) {
        trsBtn.className = "py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center space-x-1.5 bg-sky-600 text-white shadow-md";
    }
}

function setQuickTxType(type) {
    document.getElementById('quick-tx-type').value = type;
    const expBtn = document.getElementById('quick-txtype-expense-btn');
    const incBtn = document.getElementById('quick-txtype-income-btn');
    const trsBtn = document.getElementById('quick-txtype-transfer-btn');

    if (expBtn) expBtn.className = "py-2 rounded-lg transition text-slate-600 font-semibold";
    if (incBtn) incBtn.className = "py-2 rounded-lg transition text-slate-600 font-semibold";
    if (trsBtn) trsBtn.className = "py-2 rounded-lg transition text-slate-600 font-semibold";

    if (type === 'EXPENSE' && expBtn) {
        expBtn.className = "py-2 rounded-lg transition bg-rose-600 text-white font-bold";
    } else if (type === 'INCOME' && incBtn) {
        incBtn.className = "py-2 rounded-lg transition bg-emerald-600 text-white font-bold";
    } else if (type === 'TRANSFER' && trsBtn) {
        trsBtn.className = "py-2 rounded-lg transition bg-sky-600 text-white font-bold";
    }
}

// Client-Side Image Compression
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

// Form Submit Handler
function handleFormSubmit(e) {
    e.preventDefault();
    
    const type = document.getElementById('tx-type').value;
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
        type: type, // INCOME or EXPENSE
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
            setTxType('EXPENSE');
            removeSlipPreview();
            alert('บันทึกข้อมูลเรียบร้อยแล้ว!');
            switchTab('history');
        })
        .catch((error) => {
            alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i><span>บันทึกข้อมูลเข้า Cloud</span>`;
        });
}

// Quick Form Submit Handler
function handleQuickFormSubmit(e) {
    e.preventDefault();
    
    const type = document.getElementById('quick-tx-type').value;
    const amount = parseFloat(document.getElementById('quick-amount').value);
    const bank = document.getElementById('quick-bank').value;
    const category = document.getElementById('quick-category').value;
    const note = document.getElementById('quick-note').value.trim();
    const date = new Date().toISOString().split('T')[0];

    if (isNaN(amount) || amount <= 0) {
        alert('กรุณากรอกจำนวนเงินให้ถูกต้อง');
        return;
    }

    const newExpense = {
        type: type,
        amount: amount,
        bank: bank,
        category: category,
        date: date,
        note: note,
        slipUrl: null,
        createdAt: new Date().toISOString()
    };

    db.collection("expenses").add(newExpense)
        .then(() => {
            document.getElementById('quick-expense-form').reset();
            closeQuickAddModal();
            alert('บันทึกข้อมูลด่วนเรียบร้อยแล้ว!');
        })
        .catch((error) => {
            alert('เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
        });
}

// Quick Add Modal Handlers
function openQuickAddModal() {
    document.getElementById('quick-add-modal').classList.remove('hidden');
}

function closeQuickAddModal() {
    document.getElementById('quick-add-modal').classList.add('hidden');
}

// Delete Expense
function deleteExpense(id) {
    if (confirm('คุณต้องการลบรายการนี้ใช่หรือไม่?')) {
        db.collection("expenses").doc(id).delete()
            .catch((error) => {
                alert('เกิดข้อผิดพลาดในการลบ: ' + error.message);
            });
    }
}

// Edit Expense Functions
function openEditModal(id) {
    const item = allExpenses.find(e => e.id === id);
    if (!item) return;

    document.getElementById('edit-doc-id').value = item.id;
    
    // Format date for datetime-local input (YYYY-MM-DDTHH:mm)
    if (item.date) {
        let dateObj;
        if (typeof item.date.toDate === 'function') {
            dateObj = item.date.toDate();
        } else {
            dateObj = new Date(item.date);
        }
        if (!isNaN(dateObj.getTime())) {
            const tzOffset = dateObj.getTimezoneOffset() * 60000;
            const localISOTime = (new Date(dateObj.getTime() - tzOffset)).toISOString().slice(0, 16);
            document.getElementById('edit-date').value = localISOTime;
        }
    }

    document.getElementById('edit-type').value = item.type || 'EXPENSE';
    document.getElementById('edit-amount').value = item.amount !== undefined ? item.amount : 0;
    document.getElementById('edit-category').value = item.category || 'other_expense';
    document.getElementById('edit-bank').value = item.bank || 'other';
    document.getElementById('edit-note').value = item.note || '';

    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

function saveEditedExpense(event) {
    event.preventDefault();
    const docId = document.getElementById('edit-doc-id').value;
    if (!docId) return;

    const dateVal = document.getElementById('edit-date').value;
    const typeVal = document.getElementById('edit-type').value;
    const amountVal = parseFloat(document.getElementById('edit-amount').value);
    const categoryVal = document.getElementById('edit-category').value;
    const bankVal = document.getElementById('edit-bank').value;
    const noteVal = document.getElementById('edit-note').value.trim();

    if (!dateVal || isNaN(amountVal) || amountVal < 0) {
        alert('กรุณากรอกข้อมูลให้ครบถ้วนและถูกต้อง');
        return;
    }

    const updatedData = {
        date: new Date(dateVal),
        type: typeVal,
        amount: amountVal,
        category: categoryVal,
        bank: bankVal,
        note: noteVal,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    db.collection("expenses").doc(docId).update(updatedData)
        .then(() => {
            closeEditModal();
            // Local state update for instant UI feedback
            const localIndex = allExpenses.findIndex(e => e.id === docId);
            if (localIndex !== -1) {
                allExpenses[localIndex] = { ...allExpenses[localIndex], ...updatedData };
                filterAndRender();
            }
        })
        .catch((error) => {
            alert('เกิดข้อผิดพลาดในการบันทึกการแก้ไข: ' + error.message);
        });
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

function saveBudgetSetting() {
    const budgetVal = parseFloat(document.getElementById('monthly-budget-input').value);
    const savingsGoalVal = parseFloat(document.getElementById('monthly-savings-input').value);

    if (isNaN(budgetVal) || budgetVal < 0) {
        alert('กรุณากรอกงบประมาณให้ถูกต้อง');
        return;
    }
    if (!isNaN(savingsGoalVal) && savingsGoalVal >= 0) {
        monthlySavingsGoal = savingsGoalVal;
        localStorage.setItem('monthlySavingsGoal', monthlySavingsGoal);
    }

    monthlyBudgetLimit = budgetVal;
    localStorage.setItem('monthlyBudgetLimit', monthlyBudgetLimit);

    alert('บันทึกเป้าหมายงบประมาณและเงินออมเรียบร้อยแล้ว!');
    updateUI();
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

    // Filter Income vs Expense vs Self-Transfers
    const incomeItems = filteredList.filter(item => item.type === 'INCOME');
    const expenseItems = filteredList.filter(item => item.type === 'EXPENSE');
    const transferItems = filteredList.filter(item => item.type === 'TRANSFER');

    // Salary vs Extra Income
    const salaryTotal = incomeItems.filter(item => item.category === 'salary').reduce((sum, item) => sum + item.amount, 0);
    const extraIncomeTotal = incomeItems.filter(item => item.category === 'extra_income').reduce((sum, item) => sum + item.amount, 0);

    const totalIncome = incomeItems.reduce((sum, item) => sum + item.amount, 0);
    const totalExpense = expenseItems.reduce((sum, item) => sum + item.amount, 0);
    const totalTransfer = transferItems.reduce((sum, item) => sum + item.amount, 0);
    const netBalance = totalIncome - totalExpense;

    const todayAmount = allExpenses
        .filter(item => item.date === todayStr && item.type === 'EXPENSE')
        .reduce((sum, item) => sum + item.amount, 0);

    const uniqueDates = [...new Set(expenseItems.map(item => item.date))];
    const activeDaysCount = uniqueDates.length || 1;
    const dailyAvg = totalExpense / activeDaysCount;

    // Top Category Calculation
    const catTotals = {};
    expenseItems.forEach(item => {
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
    const topCatPercent = totalExpense > 0 ? ((topCatMax / totalExpense) * 100).toFixed(0) : 0;

    // Top Bank Calculation
    const bankTotals = {};
    expenseItems.forEach(item => {
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

    // Update Budget Progress Bar (Current Month - Only Real Expenses)
    const currentMonthStr = todayStr.substring(0, 7);
    const monthExpenseTotal = allExpenses
        .filter(item => item.date && item.date.startsWith(currentMonthStr) && item.type === 'EXPENSE')
        .reduce((sum, item) => sum + item.amount, 0);

    const budgetRemaining = Math.max(0, monthlyBudgetLimit - monthExpenseTotal);
    const budgetPercent = monthlyBudgetLimit > 0 ? Math.min(100, Math.round((monthExpenseTotal / monthlyBudgetLimit) * 100)) : 0;

    const budgetRemElem = document.getElementById('budget-remaining-text');
    if (budgetRemElem) budgetRemElem.innerText = `฿${budgetRemaining.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
    const budgetLimitElem = document.getElementById('budget-limit-text');
    if (budgetLimitElem) budgetLimitElem.innerText = `฿${monthlyBudgetLimit.toLocaleString('th-TH')}`;
    const budgetPercentElem = document.getElementById('budget-percent-text');
    if (budgetPercentElem) budgetPercentElem.innerText = `ใช้ไปแล้ว ${budgetPercent}%`;
    const budgetProgressBar = document.getElementById('budget-progress-bar');
    if (budgetProgressBar) budgetProgressBar.style.width = `${budgetPercent}%`;

    // Update Savings Goal Progress Bar
    const monthSavingsTotal = allExpenses
        .filter(item => item.date && item.date.startsWith(currentMonthStr) && item.category === 'savings_goal')
        .reduce((sum, item) => sum + item.amount, 0);
    const savingsPercent = monthlySavingsGoal > 0 ? Math.min(100, Math.round((monthSavingsTotal / monthlySavingsGoal) * 100)) : 0;

    const savingsCurrentElem = document.getElementById('savings-current-text');
    if (savingsCurrentElem) savingsCurrentElem.innerText = `฿${monthSavingsTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
    const savingsGoalElem = document.getElementById('savings-goal-text');
    if (savingsGoalElem) savingsGoalElem.innerText = `฿${monthlySavingsGoal.toLocaleString('th-TH')}`;
    const savingsPercentElem = document.getElementById('savings-percent-text');
    if (savingsPercentElem) savingsPercentElem.innerText = `สำเร็จ ${savingsPercent}%`;
    const savingsProgressBar = document.getElementById('savings-progress-bar');
    if (savingsProgressBar) savingsProgressBar.style.width = `${savingsPercent}%`;

    // Render Metric Cards with safety null checks
    const elemIncome = document.getElementById('stat-total-income');
    if (elemIncome) elemIncome.innerText = `฿${totalIncome.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;

    const elemIncomeCount = document.getElementById('stat-income-count');
    if (elemIncomeCount) elemIncomeCount.innerText = `เงินเดือน: ฿${salaryTotal.toLocaleString('th-TH')} | พิเศษ: ฿${extraIncomeTotal.toLocaleString('th-TH')}`;

    const elemExpense = document.getElementById('stat-total-expense');
    if (elemExpense) elemExpense.innerText = `฿${totalExpense.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;

    const elemToday = document.getElementById('stat-today-small');
    if (elemToday) elemToday.innerText = `฿${todayAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
    
    const elemNet = document.getElementById('stat-net-balance');
    if (elemNet) elemNet.innerText = `฿${netBalance.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;

    const elemDailyAvg = document.getElementById('stat-daily-avg');
    if (elemDailyAvg) elemDailyAvg.innerText = `฿${dailyAvg.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;

    const elemTopCat = document.getElementById('stat-top-cat-name');
    if (elemTopCat) elemTopCat.innerText = topCatName;

    const elemTopCatPct = document.getElementById('stat-top-cat-percent');
    if (elemTopCatPct) elemTopCatPct.innerText = `${topCatPercent}%`;

    const elemTopBank = document.getElementById('stat-top-bank-name');
    if (elemTopBank) elemTopBank.innerText = topBankName;

    const elemTotalSlips = document.getElementById('stat-total-slips');
    if (elemTotalSlips) elemTotalSlips.innerText = `${slipsCount} สลิป (${transferItems.length} โอนย้าย)`;
}

let targetAttachDocId = null;

function triggerAttachSlip(docId) {
    targetAttachDocId = docId;
    const fileInput = document.getElementById('attach-slip-file-input');
    if (fileInput) fileInput.click();
}

function handleAttachSlipFile(event) {
    const file = event.target.files[0];
    if (!file || !targetAttachDocId) return;

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

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.65);

            db.collection("expenses").doc(targetAttachDocId).update({
                slipUrl: compressedBase64
            }).then(() => {
                alert('อัปเดตหลักฐานสลิปเรียบร้อยแล้ว!');
                targetAttachDocId = null;
                event.target.value = '';
                closeSlipModal();
            }).catch(err => {
                alert('เกิดข้อผิดพลาดในการอัปเดตสลิป: ' + err.message);
            });
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function removeSlipFromDoc() {
    if (!targetAttachDocId) return;
    if (confirm('คุณต้องการลบสลิปของรายการนี้ออกใช่หรือไม่?')) {
        db.collection("expenses").doc(targetAttachDocId).update({
            slipUrl: null
        }).then(() => {
            alert('ลบสลิปออกเรียบร้อยแล้ว');
            closeSlipModal();
        }).catch(err => {
            alert('เกิดข้อผิดพลาดในการลบสลิป: ' + err.message);
        });
    }
}

function openSlipModal(slipUrl, docId) {
    if (!slipUrl) return;
    targetAttachDocId = docId || null;
    document.getElementById('modal-slip-img').src = slipUrl;
    
    const actionContainer = document.getElementById('slip-modal-actions');
    if (actionContainer && targetAttachDocId) {
        actionContainer.classList.remove('hidden');
    } else if (actionContainer) {
        actionContainer.classList.add('hidden');
    }

    document.getElementById('slip-modal').classList.remove('hidden');
}

function openSlipModalById(docId) {
    const item = allExpenses.find(e => e.id === docId);
    if (!item || !item.slipUrl) return;
    openSlipModal(item.slipUrl, docId);
}

function closeSlipModal() {
    const slipModal = document.getElementById('slip-modal');
    if (slipModal) slipModal.classList.add('hidden');
    const slipImg = document.getElementById('modal-slip-img');
    if (slipImg) slipImg.src = '';
    targetAttachDocId = null;
}

let currentSortField = 'date'; // 'date' | 'amount'
let currentSortDir = 'desc';   // 'asc' | 'desc'

function toggleSort(field) {
    if (currentSortField === field) {
        currentSortDir = currentSortDir === 'desc' ? 'asc' : 'desc';
    } else {
        currentSortField = field;
        currentSortDir = 'desc'; // Default to desc when changing field
    }
    renderHistoryTable();
}

function updateSortIcons() {
    const dateIcon = document.getElementById('sort-icon-date');
    const amountIcon = document.getElementById('sort-icon-amount');

    if (dateIcon) {
        if (currentSortField === 'date') {
            dateIcon.className = 'text-emerald-600 font-bold';
            dateIcon.innerHTML = currentSortDir === 'desc' 
                ? '<i class="fa-solid fa-arrow-down-wide-short"></i>' 
                : '<i class="fa-solid fa-arrow-up-short-wide"></i>';
        } else {
            dateIcon.className = 'text-slate-400 group-hover:text-slate-700';
            dateIcon.innerHTML = '<i class="fa-solid fa-sort"></i>';
        }
    }

    if (amountIcon) {
        if (currentSortField === 'amount') {
            amountIcon.className = 'text-emerald-600 font-bold';
            amountIcon.innerHTML = currentSortDir === 'desc' 
                ? '<i class="fa-solid fa-arrow-down-wide-short"></i>' 
                : '<i class="fa-solid fa-arrow-up-short-wide"></i>';
        } else {
            amountIcon.className = 'text-slate-400 group-hover:text-slate-700';
            amountIcon.innerHTML = '<i class="fa-solid fa-sort"></i>';
        }
    }
}

function resetHistoryFilters() {
    const ids = ['search-input', 'filter-month', 'filter-start-date', 'filter-end-date'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const selects = ['filter-type', 'filter-category', 'filter-bank'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = 'ALL';
    });
    currentSortField = 'date';
    currentSortDir = 'desc';
    renderHistoryTable();
}

function renderHistoryTable() {
    const tableBody = document.getElementById('history-table-body');
    if (!tableBody) return;

    updateSortIcons();

    const searchKeyword = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
    const filterMonth = document.getElementById('filter-month')?.value || '';
    const filterStartDate = document.getElementById('filter-start-date')?.value || '';
    const filterEndDate = document.getElementById('filter-end-date')?.value || '';
    const filterType = document.getElementById('filter-type')?.value || 'ALL';
    const filterCategory = document.getElementById('filter-category')?.value || 'ALL';
    const filterBank = document.getElementById('filter-bank')?.value || 'ALL';

    let resultList = [...allExpenses];

    // Filter by Search Keyword
    if (searchKeyword !== '') {
        resultList = resultList.filter(item => item && (
            (item.note && item.note.toLowerCase().includes(searchKeyword)) ||
            (item.amount !== undefined && item.amount.toString().includes(searchKeyword))
        ));
    }

    // Filter by Month (YYYY-MM)
    if (filterMonth !== '') {
        resultList = resultList.filter(item => item && item.date && item.date.startsWith(filterMonth));
    }

    // Filter by Start Date
    if (filterStartDate !== '') {
        resultList = resultList.filter(item => item && item.date && item.date >= filterStartDate);
    }

    // Filter by End Date
    if (filterEndDate !== '') {
        resultList = resultList.filter(item => item && item.date && item.date <= filterEndDate);
    }

    // Filter by Type (EXPENSE, INCOME, TRANSFER)
    if (filterType !== 'ALL') {
        resultList = resultList.filter(item => item && item.type === filterType);
    }

    // Filter by Category
    if (filterCategory !== 'ALL') {
        resultList = resultList.filter(item => item && item.category === filterCategory);
    }

    // Filter by Bank
    if (filterBank !== 'ALL') {
        resultList = resultList.filter(item => item && item.bank === filterBank);
    }

    // Sorting Logic based on column header clicks
    resultList.sort((a, b) => {
        if (currentSortField === 'amount') {
            const amountA = a.amount || 0;
            const amountB = b.amount || 0;
            return currentSortDir === 'asc' ? amountA - amountB : amountB - amountA;
        } else {
            // Default: 'date'
            const dateA = new Date(a.date || 0).getTime();
            const dateB = new Date(b.date || 0).getTime();
            return currentSortDir === 'asc' ? dateA - dateB : dateB - dateA;
        }
    });

    if (resultList.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400 font-medium">ไม่พบรายการเงินตามเงื่อนไขที่คุณเลือก</td></tr>`;
        return;
    }

    tableBody.innerHTML = resultList.map(item => {
        if (!item) return '';
        const bankInfo = (item.bank && BANK_MAP[item.bank]) ? BANK_MAP[item.bank] : BANK_MAP['OTHER'];
        const catInfo = (item.category && CATEGORY_MAP[item.category]) ? CATEGORY_MAP[item.category] : CATEGORY_MAP['other'];
        
        const isIncome = item.type === 'INCOME';
        const isTransfer = item.type === 'TRANSFER';
        
        let typeBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700">รายจ่าย (-)</span>`;
        let amountColor = 'text-rose-600 font-bold';
        let amountPrefix = '-฿';

        if (isIncome) {
            typeBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700">รายรับ (+)</span>`;
            amountColor = 'text-emerald-600 font-extrabold';
            amountPrefix = '+฿';
        } else if (isTransfer) {
            typeBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">โอนระหว่างบัญชี (⇄)</span>`;
            amountColor = 'text-sky-700 font-semibold';
            amountPrefix = '⇄ ฿';
        }

        const slipBtn = item.slipUrl 
            ? `<button onclick="openSlipModalById('${item.id}')" class="text-emerald-700 hover:text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg text-xs flex items-center justify-center space-x-1 transition mx-auto font-medium" title="ดูสลิป">
                <i class="fa-solid fa-receipt text-emerald-600"></i><span>ดูสลิป</span>
               </button>`
            : `<button onclick="triggerAttachSlip('${item.id}')" class="text-slate-500 hover:text-slate-800 hover:bg-slate-100 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-[11px] flex items-center justify-center space-x-1 transition mx-auto font-normal" title="เพิ่มสลิปทีหลัง">
                <i class="fa-solid fa-paperclip text-slate-400"></i><span>+ แนบสลิป</span>
               </button>`;
        
        const numAmount = (item.amount !== undefined && item.amount !== null) ? item.amount : 0;
        const formattedAmount = numAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 });

        return `
            <tr class="hover:bg-slate-50/80 transition">
                <td class="p-3.5 text-slate-500 whitespace-nowrap">${formatDateTh(item.date)}</td>
                <td class="p-3.5 whitespace-nowrap">${typeBadge}</td>
                <td class="p-3.5 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${bankInfo.badge}">
                        ${bankInfo.name}
                    </span>
                </td>
                <td class="p-3.5 whitespace-nowrap text-slate-800 font-medium">${catInfo.name}</td>
                <td class="p-3.5 text-slate-600 max-w-md">${escapeHtml(item.note || '-')}</td>
                <td class="p-3.5 text-center whitespace-nowrap">${slipBtn}</td>
                <td class="p-3.5 text-right whitespace-nowrap text-sm ${amountColor}">${amountPrefix}${formattedAmount}</td>
                <td class="p-3.5 text-center whitespace-nowrap">
                    <div class="flex items-center justify-center space-x-1.5">
                        <button onclick="openEditModal('${item.id}')" class="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition" title="แก้ไขรายการ">
                            <i class="fa-solid fa-pen-to-square text-sm"></i>
                        </button>
                        <button onclick="deleteExpense('${item.id}')" class="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition" title="ลบรายการ">
                            <i class="fa-solid fa-trash-can text-sm"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderCharts(filteredList) {
    const bankTotals = {};
    const catTotals = {};

    // Filter only EXPENSE items for spending doughnut charts
    const expenseItems = filteredList.filter(item => item.type === 'EXPENSE');

    expenseItems.forEach(item => {
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
    const expenseItems = filteredList.filter(item => item.type === 'EXPENSE');

    const sorted = [...expenseItems].sort((a, b) => new Date(a.date) - new Date(b.date));

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

let isBannerDismissed = false;

function checkDailyStatus() {
    if (isBannerDismissed) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const hasTodayExpense = allExpenses.some(item => item.date === todayStr);
    const banner = document.getElementById('daily-status-banner');
    if (!hasTodayExpense) banner.classList.remove('hidden');
    else banner.classList.add('hidden');
}

function closeDailyBanner() {
    isBannerDismissed = true;
    const banner = document.getElementById('daily-status-banner');
    if (banner) banner.classList.add('hidden');
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
    let csvContent = "data:text/csv;charset=utf-8,\uFEFFID,Date,Type,Bank,Category,Amount,Note,HasSlip\n";
    allExpenses.forEach(item => {
        const bankName = BANK_MAP[item.bank] ? BANK_MAP[item.bank].name : item.bank;
        const catName = CATEGORY_MAP[item.category] ? CATEGORY_MAP[item.category].name : item.category;
        const typeStr = item.type === 'INCOME' ? "INCOME" : "EXPENSE";
        const hasSlip = item.slipUrl ? "YES" : "NO";
        csvContent += `${item.id},${item.date},${typeStr},${bankName},${catName},${item.amount},"${(item.note || '').replace(/"/g, '""')}",${hasSlip}\n`;
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