// --- Backend Server (server.js) ---
// This file contains all API routes for the application.

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
const port = 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Serve Static Files ---
// This tells Express to serve your HTML, CSS, and client-side JS files
// from the 'public' directory.
app.use(express.static(path.join(__dirname, 'public')));

// --- MySQL Database Connection Configuration ---
const dbPool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'your_password_here', // <-- REPLACE WITH YOUR ACTUAL PASSWORD
    database: 'my_app_db',
    waitForConnections: true,
    connectionLimit: 10,
    multipleStatements: true
});


// --- Simple Auth Check Middleware (Placeholder) ---
const isAuthenticated = (req, res, next) => {
    console.log("Auth check middleware called.");
    next();
};

const isAdmin = (req, res, next) => {
    console.log("Admin check middleware called.");
    next(); 
};


// --- PUBLIC API ROUTES ---

// Route for user signup
app.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Please enter all fields.' });
    }
    try {
        const connection = await dbPool.getConnection();
        const sql = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
        await connection.execute(sql, [username, email, password]);
        connection.release();
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        console.error('Signup error:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Username or email already exists.' });
        }
        res.status(500).json({ message: 'Server error.' });
    }
});

// Route for user login
app.post('/login', async (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
        return res.status(400).json({ message: 'Please provide credentials.' });
    }
    try {
        const connection = await dbPool.getConnection();
        const findUserSql = 'SELECT * FROM users WHERE username = ? OR email = ?';
        const [rows] = await connection.execute(findUserSql, [identifier, identifier]);
        
        if (rows.length === 0) {
            connection.release();
            return res.status(401).json({ message: 'User not found.' }); 
        }

        const user = rows[0];

        if (user.account_status !== 'active') {
            connection.release();
            return res.status(403).json({ message: 'Account is suspended or not active.' });
        }

        if (password !== user.password) {
            connection.release();
            return res.status(401).json({ message: 'Incorrect password.' });
        }
        
        connection.release();
        res.status(200).json({ message: 'Login successful!', user: { id: user.id, username: user.username, email: user.email, type: user.account_type } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error.' });
    }
});

// NEW: Route for resetting password
app.put('/api/password-reset', async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
        return res.status(400).json({ message: 'Email and new password are required.' });
    }
    try {
        const connection = await dbPool.getConnection();
        const sql = "UPDATE users SET password = ? WHERE email = ?";
        const [result] = await connection.execute(sql, [newPassword, email]);
        connection.release();

        if (result.affectedRows === 0) {
            // No user found with that email
            return res.status(404).json({ message: 'No account found with that email address.' });
        }

        res.status(200).json({ message: 'Password has been reset successfully.' });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ message: 'An error occurred while resetting the password.' });
    }
});

// GET ALL recipes for the public home page
app.get('/api/recipes', async (req, res) => {
    try {
        const connection = await dbPool.getConnection();
        const popularSql = `SELECT r.*, u.username as restaurant_name FROM recipes r JOIN users u ON r.user_id = u.id WHERE u.account_status = 'active' ORDER BY r.avg_rating DESC, r.rating_count DESC LIMIT 5`;
        const [popular] = await connection.execute(popularSql);
        const popularIds = popular.map(p => p.id);
        const recommendedSql = `SELECT r.*, u.username as restaurant_name FROM recipes r JOIN users u ON r.user_id = u.id WHERE u.account_status = 'active' AND r.id NOT IN (?) ORDER BY RAND() LIMIT 10`;
        const [recommended] = await connection.execute(recommendedSql, [popularIds.length > 0 ? popularIds : [0]]);
        connection.release();
        res.status(200).json({ popular, recommended });
    } catch (error) {
        console.error('Get all recipes error:', error);
        res.status(500).json({ message: 'Failed to fetch recipes.' });
    }
});

// POST a review for a recipe
app.post('/api/reviews', isAuthenticated, async (req, res) => {
    const { recipe_id, user_id, rating, comment } = req.body;
    if (!recipe_id || !user_id || !rating) {
        return res.status(400).json({ message: 'Missing required review fields.' });
    }
    const connection = await dbPool.getConnection();
    try {
        await connection.beginTransaction();
        const insertReviewSql = "INSERT INTO reviews (recipe_id, user_id, rating, comment) VALUES (?, ?, ?, ?)";
        await connection.execute(insertReviewSql, [recipe_id, user_id, rating, comment]);
        const updateRatingSql = `UPDATE recipes SET rating_count = (SELECT COUNT(*) FROM reviews WHERE recipe_id = ?), avg_rating = (SELECT AVG(rating) FROM reviews WHERE recipe_id = ?) WHERE id = ?`;
        await connection.execute(updateRatingSql, [recipe_id, recipe_id, recipe_id]);
        await connection.commit();
        connection.release();
        res.status(201).json({ message: "Review added successfully!" });
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Post review error:', error);
        res.status(500).json({ message: "Failed to add review." });
    }
});

// --- ORDERING ROUTES ---
app.post('/api/orders', isAuthenticated, async (req, res) => {
    const { user_id, recipe_name, total_cost, items } = req.body;
    if (!user_id || !recipe_name || !total_cost || !items || items.length === 0) {
        return res.status(400).json({ message: "Missing required order fields." });
    }
    const connection = await dbPool.getConnection();
    try {
        await connection.beginTransaction();
        const eta = `${Math.floor(Math.random() * (45 - 20 + 1)) + 20} minutes`;
        const orderSql = "INSERT INTO orders (user_id, recipe_name, total_cost, estimated_arrival) VALUES (?, ?, ?, ?)";
        const [orderResult] = await connection.execute(orderSql, [user_id, recipe_name, total_cost, eta]);
        const orderId = orderResult.insertId;
        const itemSql = "INSERT INTO order_items (order_id, ingredient_name, price) VALUES ?";
        const itemValues = items.map(item => [orderId, item.name, item.price]);
        await connection.query(itemSql, [itemValues]);
        await connection.commit();
        connection.release();
        res.status(201).json({ message: "Order placed successfully!", orderId: orderId });
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('Place order error:', error);
        res.status(500).json({ message: "Failed to place order." });
    }
});

// GET a user's order history
app.get('/api/orders/:userId', isAuthenticated, async (req, res) => {
    const { userId } = req.params;
    console.log(`[SERVER] Fetching orders for user ID: ${userId}`);
    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log("[SERVER] Database connection successful for fetching orders.");
        
        const sql = "SELECT * FROM orders WHERE user_id = ? ORDER BY order_date DESC";
        const [orders] = await connection.execute(sql, [userId]);
        console.log(`[SERVER] Found ${orders.length} orders for user.`);
        
        for (let order of orders) {
            const itemsSql = "SELECT * FROM order_items WHERE order_id = ?";
            const [items] = await connection.execute(itemsSql, [order.id]);
            order.items = items;
        }
        
        console.log("[SERVER] Successfully fetched all orders and their items.");
        connection.release();
        res.status(200).json(orders);

    } catch (error) {
        console.error('[SERVER] Get orders error:', error); // This will now log the detailed error
        if (connection) connection.release();
        res.status(500).json({ message: 'Failed to fetch order history.' });
    }
});


// --- ADMIN-ONLY ROUTES ---

app.get('/admin/users', isAdmin, async (req, res) => {
    try {
        const connection = await dbPool.getConnection();
        const sql = "SELECT id, username, email, account_type, account_status FROM users WHERE account_type != 'admin'";
        const [rows] = await connection.execute(sql);
        connection.release();
        res.status(200).json(rows);
    } catch (error) {
        console.error('Admin GET users error:', error);
        res.status(500).json({ message: 'Failed to fetch users.' });
    }
});

app.delete('/admin/users/:id', isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const connection = await dbPool.getConnection();
        const sql = "DELETE FROM users WHERE id = ?";
        const [result] = await connection.execute(sql, [id]);
        connection.release();
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(200).json({ message: 'User deleted successfully.' });
    } catch (error) {
        console.error('Admin DELETE user error:', error);
        res.status(500).json({ message: 'Failed to delete user.' });
    }
});

app.put('/admin/users/:id/status', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; 
    if (!['active', 'suspended'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status provided.' });
    }
    try {
        const connection = await dbPool.getConnection();
        const sql = "UPDATE users SET account_status = ? WHERE id = ?";
        const [result] = await connection.execute(sql, [status, id]);
        connection.release();
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(200).json({ message: 'User status updated successfully.' });
    } catch (error) {
        console.error('Admin UPDATE status error:', error);
        res.status(500).json({ message: 'Failed to update user status.' });
    }
});

app.put('/admin/users/:id/type', isAdmin, async (req, res) => {
    const { id } = req.params;
    const { type } = req.body; 
    if (type !== 'restaurant') {
        return res.status(400).json({ message: 'Invalid type provided.' });
    }
    try {
        const connection = await dbPool.getConnection();
        const sql = "UPDATE users SET account_type = ? WHERE id = ?";
        const [result] = await connection.execute(sql, [type, id]);
        connection.release();
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(200).json({ message: 'User type updated successfully.' });
    } catch (error) {
        console.error('Admin UPDATE type error:', error);
        res.status(500).json({ message: 'Failed to update user type.' });
    }
});


// --- RESTAURANT-SPECIFIC RECIPE MANAGEMENT ROUTES ---

app.get('/recipes/:userId', isAuthenticated, async (req, res) => {
    const { userId } = req.params;
    try {
        const connection = await dbPool.getConnection();
        const sql = "SELECT * FROM recipes WHERE user_id = ?";
        const [recipes] = await connection.execute(sql, [userId]);
        connection.release();
        res.status(200).json(recipes);
    } catch (error) {
        console.error('Get recipes error:', error);
        res.status(500).json({ message: 'Failed to fetch recipes.' });
    }
});

app.post('/recipes', isAuthenticated, async (req, res) => {
    const { userId, name, servingSize, prepTime, cuisineType, imageUrl, ingredients, steps } = req.body;
    if (!userId || !name || !ingredients || !steps) {
        return res.status(400).json({ message: 'Missing required recipe fields.' });
    }
    try {
        const connection = await dbPool.getConnection();
        const sql = "INSERT INTO recipes (user_id, name, serving_size, prep_time, cuisine_type, image_url, ingredients, steps) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        const [result] = await connection.execute(sql, [userId, name, servingSize, prepTime, cuisineType, imageUrl, ingredients, steps]);
        connection.release();
        res.status(201).json({ message: 'Recipe created successfully!', recipeId: result.insertId });
    } catch (error) {
        console.error('Create recipe error:', error);
        res.status(500).json({ message: 'Failed to create recipe.' });
    }
});

app.put('/recipes/:recipeId', isAuthenticated, async (req, res) => {
    const { recipeId } = req.params;
    const { imageUrl, ingredients, steps } = req.body;
    if (imageUrl === undefined && ingredients === undefined && steps === undefined) {
        return res.status(400).json({ message: 'No fields provided to update.' });
    }
    try {
        const connection = await dbPool.getConnection();
        const fieldsToUpdate = [];
        const values = [];
        if (imageUrl !== undefined) {
            fieldsToUpdate.push("image_url = ?");
            values.push(imageUrl);
        }
        if (ingredients !== undefined) {
            fieldsToUpdate.push("ingredients = ?");
            values.push(ingredients);
        }
        if (steps !== undefined) {
            fieldsToUpdate.push("steps = ?");
            values.push(steps);
        }
        values.push(recipeId);
        const sql = `UPDATE recipes SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
        const [result] = await connection.execute(sql, values);
        connection.release();
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Recipe not found.' });
        }
        res.status(200).json({ message: 'Recipe updated successfully.' });
    } catch (error) {
        console.error('Update recipe error:', error);
        res.status(500).json({ message: 'Failed to update recipe.' });
    }
});

app.delete('/recipes/:recipeId', isAuthenticated, async (req, res) => {
    const { recipeId } = req.params;
    try {
        const connection = await dbPool.getConnection();
        const sql = "DELETE FROM recipes WHERE id = ?";
        const [result] = await connection.execute(sql, [recipeId]);
        connection.release();
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Recipe not found.' });
        }
        res.status(200).json({ message: 'Recipe deleted successfully.' });
    } catch (error) {
        console.error('Delete recipe error:', error);
        res.status(500).json({ message: 'Failed to delete recipe.' });
    }
});


// --- Start the Server ---
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
    console.log('Access the app at http://localhost:3000/login.html');
});