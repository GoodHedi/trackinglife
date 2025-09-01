let authToken = localStorage.getItem('authToken');
let currentUser = localStorage.getItem('currentUser');
let currentDate = new Date().toISOString().split('T')[0];
let allFoods = [];
let userGoals = {};

const authContainer = document.getElementById('auth-container');
const mainContainer = document.getElementById('main-container');

function formatDate(date) {
    return new Date(date).toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

async function apiCall(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    try {
        const response = await fetch(`/api${endpoint}`, {
            ...options,
            headers
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Erreur API');
        }
        
        return await response.json();
    } catch (error) {
        showNotification(error.message, 'error');
        throw error;
    }
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`${tab}-form`).classList.add('active');
    });
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    try {
        const data = await apiCall('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        
        authToken = data.token;
        currentUser = data.username;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', currentUser);
        
        showApp();
        showNotification('Connexion réussie!');
    } catch (error) {
        console.error(error);
    }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    try {
        const data = await apiCall('/register', {
            method: 'POST',
            body: JSON.stringify({ username, email, password })
        });
        
        authToken = data.token;
        currentUser = data.username;
        localStorage.setItem('authToken', authToken);
        localStorage.setItem('currentUser', currentUser);
        
        showApp();
        showNotification('Inscription réussie!');
    } catch (error) {
        console.error(error);
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    
    authContainer.classList.remove('hidden');
    mainContainer.classList.add('hidden');
    showNotification('Déconnexion réussie');
});

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`${page}-page`).classList.add('active');
        
        if (page === 'foods') loadFoods();
        if (page === 'goals') {
            loadGoals();
            loadDiary();
        }
        if (page === 'stats') loadStats();
    });
});

document.getElementById('diary-date').addEventListener('change', (e) => {
    currentDate = e.target.value;
    loadDiary();
});

document.getElementById('prev-date').addEventListener('click', () => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() - 1);
    currentDate = date.toISOString().split('T')[0];
    document.getElementById('diary-date').value = currentDate;
    loadDiary();
});

document.getElementById('next-date').addEventListener('click', () => {
    const date = new Date(currentDate);
    date.setDate(date.getDate() + 1);
    currentDate = date.toISOString().split('T')[0];
    document.getElementById('diary-date').value = currentDate;
    loadDiary();
});

async function loadDiary() {
    try {
        const entries = await apiCall(`/diary/${currentDate}`);
        const diaryList = document.getElementById('diary-list');
        
        if (entries.length === 0) {
            diaryList.innerHTML = '<p style="text-align: center; color: #999;">Aucune entrée pour cette date</p>';
        } else {
            diaryList.innerHTML = entries.map(entry => `
                <div class="diary-entry">
                    <div class="entry-info">
                        <div class="entry-name">${entry.name}</div>
                        <div class="entry-details">
                            ${entry.quantity}g - ${(entry.calories * entry.quantity / 100).toFixed(0)} calories
                        </div>
                        <div class="entry-macros">
                            <span>P: ${(entry.proteins * entry.quantity / 100).toFixed(1)}g</span>
                            <span>G: ${(entry.carbs * entry.quantity / 100).toFixed(1)}g</span>
                            <span>L: ${(entry.fats * entry.quantity / 100).toFixed(1)}g</span>
                        </div>
                    </div>
                    <button class="delete-entry" onclick="deleteEntry(${entry.id})">Supprimer</button>
                </div>
            `).join('');
        }
        
        updateDailySummary(entries);
    } catch (error) {
        console.error(error);
    }
}

function updateDailySummary(entries) {
    let totalCalories = 0;
    let totalProteins = 0;
    let totalCarbs = 0;
    let totalFats = 0;
    
    entries.forEach(entry => {
        const factor = entry.quantity / 100;
        totalCalories += entry.calories * factor;
        totalProteins += entry.proteins * factor;
        totalCarbs += entry.carbs * factor;
        totalFats += entry.fats * factor;
    });
    
    document.getElementById('total-calories').textContent = Math.round(totalCalories);
    document.getElementById('total-proteins').textContent = `${totalProteins.toFixed(1)}g`;
    document.getElementById('total-carbs').textContent = `${totalCarbs.toFixed(1)}g`;
    document.getElementById('total-fats').textContent = `${totalFats.toFixed(1)}g`;
    
    if (userGoals.daily_calories) {
        document.getElementById('goal-calories').textContent = `/ ${userGoals.daily_calories}`;
        const progress = Math.min((totalCalories / userGoals.daily_calories) * 100, 100);
        document.getElementById('calories-progress').style.width = `${progress}%`;
    }
    
    if (userGoals.daily_proteins) {
        document.getElementById('goal-proteins').textContent = `/ ${userGoals.daily_proteins}g`;
    }
    
    if (userGoals.daily_carbs) {
        document.getElementById('goal-carbs').textContent = `/ ${userGoals.daily_carbs}g`;
    }
    
    if (userGoals.daily_fats) {
        document.getElementById('goal-fats').textContent = `/ ${userGoals.daily_fats}g`;
    }
    
    updateMacroProgress(totalCalories, totalProteins, totalCarbs, totalFats);
}

function updateMacroProgress(calories, proteins, carbs, fats) {
    const currentCaloriesEl = document.getElementById('current-calories');
    const currentProteinsEl = document.getElementById('current-proteins');
    const currentCarbsEl = document.getElementById('current-carbs');
    const currentFatsEl = document.getElementById('current-fats');
    
    if (currentCaloriesEl) currentCaloriesEl.textContent = Math.round(calories);
    if (currentProteinsEl) currentProteinsEl.textContent = proteins.toFixed(1);
    if (currentCarbsEl) currentCarbsEl.textContent = carbs.toFixed(1);
    if (currentFatsEl) currentFatsEl.textContent = fats.toFixed(1);
    
    if (userGoals.daily_calories) {
        const targetCaloriesEl = document.getElementById('target-calories');
        if (targetCaloriesEl) targetCaloriesEl.textContent = userGoals.daily_calories;
        
        const caloriesPercent = Math.min((calories / userGoals.daily_calories) * 100, 100);
        const progressCaloriesEl = document.getElementById('progress-calories');
        const percentCaloriesEl = document.getElementById('percent-calories');
        if (progressCaloriesEl) progressCaloriesEl.style.width = `${caloriesPercent}%`;
        if (percentCaloriesEl) percentCaloriesEl.textContent = `${Math.round(caloriesPercent)}%`;
    }
    
    if (userGoals.daily_proteins) {
        const targetProteinsEl = document.getElementById('target-proteins');
        if (targetProteinsEl) targetProteinsEl.textContent = userGoals.daily_proteins;
        
        const proteinsPercent = Math.min((proteins / userGoals.daily_proteins) * 100, 100);
        const progressProteinsEl = document.getElementById('progress-proteins');
        const percentProteinsEl = document.getElementById('percent-proteins');
        if (progressProteinsEl) progressProteinsEl.style.width = `${proteinsPercent}%`;
        if (percentProteinsEl) percentProteinsEl.textContent = `${Math.round(proteinsPercent)}%`;
    }
    
    if (userGoals.daily_carbs) {
        const targetCarbsEl = document.getElementById('target-carbs');
        if (targetCarbsEl) targetCarbsEl.textContent = userGoals.daily_carbs;
        
        const carbsPercent = Math.min((carbs / userGoals.daily_carbs) * 100, 100);
        const progressCarbsEl = document.getElementById('progress-carbs');
        const percentCarbsEl = document.getElementById('percent-carbs');
        if (progressCarbsEl) progressCarbsEl.style.width = `${carbsPercent}%`;
        if (percentCarbsEl) percentCarbsEl.textContent = `${Math.round(carbsPercent)}%`;
    }
    
    if (userGoals.daily_fats) {
        const targetFatsEl = document.getElementById('target-fats');
        if (targetFatsEl) targetFatsEl.textContent = userGoals.daily_fats;
        
        const fatsPercent = Math.min((fats / userGoals.daily_fats) * 100, 100);
        const progressFatsEl = document.getElementById('progress-fats');
        const percentFatsEl = document.getElementById('percent-fats');
        if (progressFatsEl) progressFatsEl.style.width = `${fatsPercent}%`;
        if (percentFatsEl) percentFatsEl.textContent = `${Math.round(fatsPercent)}%`;
    }
}

async function loadFoods() {
    try {
        allFoods = await apiCall('/foods');
        displayFoods(allFoods);
        updateFoodSelect();
    } catch (error) {
        console.error(error);
    }
}

function displayFoods(foods) {
    const foodsList = document.getElementById('foods-list');
    foodsList.innerHTML = foods.map(food => `
        <div class="food-card">
            ${food.user_id ? `<button class="delete-food-btn" onclick="deleteFood(${food.id})" title="Supprimer">×</button>` : ''}
            <h4>${food.name}</h4>
            <div class="calories">${food.calories} kcal</div>
            <div class="macros">
                <span>P: ${food.proteins}g</span>
                <span>G: ${food.carbs}g</span>
                <span>L: ${food.fats}g</span>
            </div>
        </div>
    `).join('');
}

function updateFoodSelect() {
    const select = document.getElementById('food-select');
    select.innerHTML = '<option value="">Sélectionner un aliment</option>' +
        allFoods.map(food => `<option value="${food.id}">${food.name}</option>`).join('');
}

document.getElementById('search-foods').addEventListener('input', (e) => {
    const search = e.target.value.toLowerCase();
    const filtered = allFoods.filter(food => 
        food.name.toLowerCase().includes(search)
    );
    displayFoods(filtered);
});

document.getElementById('add-food-btn').addEventListener('click', () => {
    document.getElementById('food-form').classList.toggle('hidden');
});

document.getElementById('cancel-food').addEventListener('click', () => {
    document.getElementById('food-form').classList.add('hidden');
    document.getElementById('food-form').reset();
});

document.getElementById('save-food').addEventListener('click', async () => {
    const name = document.getElementById('food-name').value;
    const calories = parseFloat(document.getElementById('food-calories').value);
    const proteins = parseFloat(document.getElementById('food-proteins').value) || 0;
    const carbs = parseFloat(document.getElementById('food-carbs').value) || 0;
    const fats = parseFloat(document.getElementById('food-fats').value) || 0;
    const is_public = document.getElementById('food-public').checked ? 1 : 0;
    
    if (!name || !calories) {
        showNotification('Nom et calories requis', 'error');
        return;
    }
    
    try {
        await apiCall('/foods', {
            method: 'POST',
            body: JSON.stringify({ name, calories, proteins, carbs, fats, is_public })
        });
        
        showNotification('Aliment ajouté avec succès!');
        document.getElementById('food-form').classList.add('hidden');
        document.getElementById('food-form').reset();
        loadFoods();
    } catch (error) {
        console.error(error);
    }
});

document.getElementById('add-to-diary').addEventListener('click', async () => {
    const foodId = document.getElementById('food-select').value;
    const quantity = parseFloat(document.getElementById('food-quantity').value);
    const mealType = document.getElementById('meal-type').value;
    
    if (!foodId || !quantity) {
        showNotification('Sélectionnez un aliment et une quantité', 'error');
        return;
    }
    
    try {
        await apiCall('/diary', {
            method: 'POST',
            body: JSON.stringify({
                food_id: foodId,
                quantity,
                date: currentDate,
                meal_type: mealType
            })
        });
        
        showNotification('Ajouté au journal!');
        document.getElementById('food-quantity').value = '';
        loadDiary();
    } catch (error) {
        console.error(error);
    }
});

async function deleteEntry(id) {
    if (!confirm('Supprimer cette entrée?')) return;
    
    try {
        await apiCall(`/diary/${id}`, { method: 'DELETE' });
        showNotification('Entrée supprimée');
        loadDiary();
    } catch (error) {
        console.error(error);
    }
}

async function deleteFood(id) {
    if (!confirm('Supprimer cet aliment?')) return;
    
    try {
        await apiCall(`/foods/${id}`, { method: 'DELETE' });
        showNotification('Aliment supprimé');
        loadFoods();
    } catch (error) {
        console.error(error);
    }
}

async function loadGoals() {
    try {
        userGoals = await apiCall('/goals');
        if (userGoals.daily_calories) {
            document.getElementById('goal-daily-calories').value = userGoals.daily_calories;
            document.getElementById('goal-daily-proteins').value = userGoals.daily_proteins || '';
            document.getElementById('goal-daily-carbs').value = userGoals.daily_carbs || '';
            document.getElementById('goal-daily-fats').value = userGoals.daily_fats || '';
        }
    } catch (error) {
        console.error(error);
    }
}

document.getElementById('save-goals').addEventListener('click', async () => {
    const daily_calories = parseFloat(document.getElementById('goal-daily-calories').value) || null;
    const daily_proteins = parseFloat(document.getElementById('goal-daily-proteins').value) || null;
    const daily_carbs = parseFloat(document.getElementById('goal-daily-carbs').value) || null;
    const daily_fats = parseFloat(document.getElementById('goal-daily-fats').value) || null;
    
    try {
        await apiCall('/goals', {
            method: 'POST',
            body: JSON.stringify({ daily_calories, daily_proteins, daily_carbs, daily_fats })
        });
        
        userGoals = { daily_calories, daily_proteins, daily_carbs, daily_fats };
        showNotification('Objectifs enregistrés!');
        loadDiary();
    } catch (error) {
        console.error(error);
    }
});

async function loadStats() {
    document.getElementById('avg-calories').textContent = 'Calcul en cours...';
    document.getElementById('total-entries').textContent = 'Calcul en cours...';
}

document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        loadStats();
    });
});

async function showApp() {
    authContainer.classList.add('hidden');
    mainContainer.classList.remove('hidden');
    document.getElementById('username-display').textContent = currentUser;
    document.getElementById('diary-date').value = currentDate;
    
    await loadFoods();
    await loadGoals();
    await loadDiary();
}

function createBubbles() {
    const bubblesContainer = document.querySelector('.bubbles-container');
    
    function createBubble() {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        
        const size = Math.random() * 60 + 20;
        const left = Math.random() * 100;
        const animationDuration = Math.random() * 10 + 8;
        const animationDelay = Math.random() * 2;
        
        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        bubble.style.left = `${left}%`;
        bubble.style.animationDuration = `${animationDuration}s`;
        bubble.style.animationDelay = `${animationDelay}s`;
        
        bubblesContainer.appendChild(bubble);
        
        setTimeout(() => {
            if (bubble.parentNode) {
                bubble.parentNode.removeChild(bubble);
            }
        }, (animationDuration + animationDelay) * 1000);
    }
    
    setInterval(createBubble, 800);
    
    for (let i = 0; i < 5; i++) {
        setTimeout(createBubble, i * 200);
    }
}

function addFishInteractivity() {
    const fish = document.querySelectorAll('.fish');
    
    fish.forEach(fishElement => {
        fishElement.addEventListener('click', () => {
            fishElement.style.animation = 'none';
            fishElement.style.transform = 'scale(1.5) rotate(360deg)';
            
            setTimeout(() => {
                fishElement.style.animation = '';
                fishElement.style.transform = '';
            }, 1000);
        });
    });
}

if (authToken && currentUser) {
    showApp();
}

createBubbles();
addFishInteractivity();