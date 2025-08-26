// Reemplaza esto con la URL de tu web app de Google Apps Script
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby_Tq0fKS-LyIraC_Dzvz5qZ4q5N0sJ-n4WGxtSw_dQ4KMEd-PyqBe1SvZx4gXrsEVXMw/exec';

// Variables globales
let transactions = [];
let budgets = {};
let debts = [];
let savingsGoal = 0;
let recurring = [];
let categories = ['Comida', 'Transporte', 'Vivienda', 'Entretenimiento', 'Salud'];
let theme = 'light'; // claro u oscuro
const exchangeRate = { USD: 1, BTC: 60000 }; // Ejemplo estático; para dinámico, usa una API externa

// Cargar datos desde Google Sheets via Apps Script
async function loadData() {
    try {
        const response = await fetch(`${SCRIPT_URL}?action=load`);
        const data = await response.json();
        transactions = data.transactions || [];
        budgets = data.budgets || {};
        debts = data.debts || [];
        savingsGoal = data.savingsGoal || 0;
        recurring = data.recurring || [];
        categories = data.categories || categories;
        updateUI();
    } catch (error) {
        console.error('Error cargando datos:', error);
        // Fallback a localStorage
        transactions = JSON.parse(localStorage.getItem('transactions')) || [];
        // Similar para otros
        updateUI();
    }
}

// Guardar datos en Google Sheets via Apps Script
async function saveData() {
    const payload = { transactions, budgets, debts, savingsGoal, recurring, categories };
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'save', data: payload }),
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Error guardando datos:', error);
        // Fallback a localStorage
        localStorage.setItem('transactions', JSON.stringify(transactions));
        // Similar para otros
    }
}

// Actualizar UI (mismo que antes, pero sin charts avanzados para simplicidad)
function updateUI() {
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('es-SV');
    updateSummary();
    updateTransactionList();
    updateBudgetList();
    updateDebtList();
    updateSavingsProgress();
    updateCategoryOptions();
    applyTheme();
    checkBudgetsForAlerts();
}

// Resumen (simplificado)
function updateSummary() {
    let income = 0,
        expenses = 0,
        savings = 0,
        balance = 0,
        totalDebts = 0;
    transactions.forEach(t => {
        let amount = t.amount * exchangeRate[t.currency || 'USD'];
        if (t.type === 'income') income += amount;
        else if (t.type === 'expense') expenses += amount;
        else if (t.type === 'saving') savings += amount;
    });
    debts.forEach(d => totalDebts += d.remaining || d.amount);
    balance = income - expenses - totalDebts + savings;
    document.getElementById('total-income').textContent = income.toFixed(2);
    document.getElementById('total-expenses').textContent = expenses.toFixed(2);
    document.getElementById('total-savings').textContent = savings.toFixed(2);
    document.getElementById('balance').textContent = balance.toFixed(2);
    document.getElementById('total-debts').textContent = totalDebts.toFixed(2);
}

// Añadir transacción
async function addTransaction() {
    const type = document.getElementById('transaction-type').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const currency = document.getElementById('currency').value;
    const date = document.getElementById('transaction-date').value || new Date().toISOString().split('T')[0];
    let category = document.getElementById('category').value || document.getElementById('custom-category').value;
    const expenseType = document.getElementById('expense-type').value;
    const notes = document.getElementById('notes').value;
    let receipt = null;
    const receiptFile = document.getElementById('receipt').files[0];

    if (receiptFile) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            receipt = e.target.result; // base64
            transactions.push({ type, amount, currency, date, category, expenseType, notes, receipt });
            if (!categories.includes(category) && category) categories.push(category);
            if (type === 'income' && document.getElementById('auto-save').checked) {
                const percent = parseFloat(document.getElementById('auto-save-percent').value) || 10;
                const saveAmount = amount * (percent / 100);
                transactions.push({ type: 'saving', amount: saveAmount, currency, date, category: 'Ahorro Automático', notes: 'Ahorro de ingreso' });
            }
            await saveData();
            updateUI();
        };
        reader.readAsDataURL(receiptFile);
    } else {
        transactions.push({ type, amount, currency, date, category, expenseType, notes, receipt });
        if (!categories.includes(category) && category) categories.push(category);
        if (type === 'income' && document.getElementById('auto-save').checked) {
            const percent = parseFloat(document.getElementById('auto-save-percent').value) || 10;
            const saveAmount = amount * (percent / 100);
            transactions.push({ type: 'saving', amount: saveAmount, currency, date, category: 'Ahorro Automático', notes: 'Ahorro de ingreso' });
        }
        await saveData();
        updateUI();
    }
}

// Funciones similares para addRecurring, setBudget, addDebt, payDebt, etc.
// Por brevedad, asumo similares a versiones anteriores, pero usando saveData() después de cambios

// Notificaciones (simples, sin push para basic)
function checkBudgetsForAlerts() {
    Object.keys(budgets).forEach(cat => {
        const spent = getSpentByCategory(cat);
        const limit = budgets[cat];
        if (spent / limit > 0.8) {
            alert(`Alerta: Estás cerca de exceder el presupuesto en ${cat} (${(spent / limit * 100).toFixed(0)}%)`);
        }
    });
}

// Exportar a CSV
function exportToCSV() {
    let csv = 'Tipo,Monto,Moneda,Fecha,Categoría,Notas\n';
    transactions.forEach(t => {
        csv += `${t.type},${t.amount},${t.currency},${t.date},${t.category},${t.notes}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reporte.csv';
    a.click();
}

// Otras funciones: updateTransactionList (lista UL con li), updateBudgetList, updateDebtList, updateSavingsProgress, updateCategoryOptions (agregar options), applyTheme (class 'dark'), generateMonthlyReport (filtra y muestra/exporta), processRecurring (al load, agregar si nuevo mes)

// Init
window.addEventListener('load', async() => {
    await loadData();
    document.getElementById('toggle-theme').addEventListener('click', () => {
        theme = theme === 'light' ? 'dark' : 'light';
        applyTheme();
    });
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js');
    }
});

function applyTheme() {
    document.body.classList.toggle('dark', theme === 'dark');
}

// Funciones auxiliares como getSpentByCategory
function getSpentByCategory(cat) {
    return transactions.reduce((sum, t) => t.category === cat && t.type === 'expense' ? sum + t.amount * exchangeRate[t.currency] : sum, 0);
}

// Similar para otras