const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'votre-secret-jwt-' + Math.random().toString(36);

app.use(express.json());
app.use(express.static('public'));

const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS foods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        calories REAL NOT NULL,
        proteins REAL DEFAULT 0,
        carbs REAL DEFAULT 0,
        fats REAL DEFAULT 0,
        user_id INTEGER,
        is_public BOOLEAN DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS diary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        food_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        date DATE NOT NULL,
        meal_type TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (food_id) REFERENCES foods (id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS user_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        daily_calories REAL,
        daily_proteins REAL,
        daily_carbs REAL,
        daily_fats REAL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
});

function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: 'Token requis' });

    jwt.verify(token.replace('Bearer ', ''), JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token invalide' });
        req.user = user;
        next();
    });
}

app.post('/api/register', async (req, res) => {
    const { username, password, email } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run(
            'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
            [username, hashedPassword, email],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Nom d\'utilisateur déjà pris' });
                    }
                    return res.status(500).json({ error: 'Erreur lors de l\'inscription' });
                }
                
                const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET);
                res.json({ token, userId: this.lastID, username });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Identifiants invalides' });
        }
        
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Identifiants invalides' });
        }
        
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
        res.json({ token, userId: user.id, username: user.username });
    });
});

app.get('/api/foods', authenticateToken, (req, res) => {
    const query = `
        SELECT * FROM foods 
        WHERE user_id = ? OR is_public = 1
        ORDER BY name
    `;
    
    db.all(query, [req.user.id], (err, foods) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        res.json(foods);
    });
});

app.post('/api/foods', authenticateToken, (req, res) => {
    const { name, calories, proteins, carbs, fats, is_public } = req.body;
    
    if (!name || calories === undefined) {
        return res.status(400).json({ error: 'Nom et calories requis' });
    }
    
    db.run(
        'INSERT INTO foods (name, calories, proteins, carbs, fats, user_id, is_public) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, calories, proteins || 0, carbs || 0, fats || 0, req.user.id, is_public || 0],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erreur lors de l\'ajout' });
            res.json({ id: this.lastID, name, calories, proteins, carbs, fats });
        }
    );
});

app.get('/api/diary/:date', authenticateToken, (req, res) => {
    const { date } = req.params;
    
    const query = `
        SELECT d.*, f.name, f.calories, f.proteins, f.carbs, f.fats
        FROM diary d
        JOIN foods f ON d.food_id = f.id
        WHERE d.user_id = ? AND d.date = ?
        ORDER BY d.id
    `;
    
    db.all(query, [req.user.id, date], (err, entries) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        res.json(entries);
    });
});

app.post('/api/diary', authenticateToken, (req, res) => {
    const { food_id, quantity, date, meal_type } = req.body;
    
    if (!food_id || !quantity || !date) {
        return res.status(400).json({ error: 'Données manquantes' });
    }
    
    db.run(
        'INSERT INTO diary (user_id, food_id, quantity, date, meal_type) VALUES (?, ?, ?, ?, ?)',
        [req.user.id, food_id, quantity, date, meal_type],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erreur lors de l\'ajout' });
            res.json({ id: this.lastID, success: true });
        }
    );
});

app.delete('/api/diary/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    db.run(
        'DELETE FROM diary WHERE id = ? AND user_id = ?',
        [id, req.user.id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erreur lors de la suppression' });
            res.json({ success: true });
        }
    );
});

app.delete('/api/foods/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    db.run(
        'DELETE FROM foods WHERE id = ? AND user_id = ?',
        [id, req.user.id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Erreur lors de la suppression' });
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Aliment non trouvé ou vous n\'êtes pas autorisé à le supprimer' });
            }
            res.json({ success: true });
        }
    );
});

app.get('/api/goals', authenticateToken, (req, res) => {
    db.get('SELECT * FROM user_goals WHERE user_id = ?', [req.user.id], (err, goals) => {
        if (err) return res.status(500).json({ error: 'Erreur serveur' });
        res.json(goals || {});
    });
});

app.post('/api/goals', authenticateToken, (req, res) => {
    const { daily_calories, daily_proteins, daily_carbs, daily_fats } = req.body;
    
    db.get('SELECT * FROM user_goals WHERE user_id = ?', [req.user.id], (err, existing) => {
        if (existing) {
            db.run(
                'UPDATE user_goals SET daily_calories = ?, daily_proteins = ?, daily_carbs = ?, daily_fats = ? WHERE user_id = ?',
                [daily_calories, daily_proteins, daily_carbs, daily_fats, req.user.id],
                (err) => {
                    if (err) return res.status(500).json({ error: 'Erreur lors de la mise à jour' });
                    res.json({ success: true });
                }
            );
        } else {
            db.run(
                'INSERT INTO user_goals (user_id, daily_calories, daily_proteins, daily_carbs, daily_fats) VALUES (?, ?, ?, ?, ?)',
                [req.user.id, daily_calories, daily_proteins, daily_carbs, daily_fats],
                (err) => {
                    if (err) return res.status(500).json({ error: 'Erreur lors de l\'ajout' });
                    res.json({ success: true });
                }
            );
        }
    });
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});