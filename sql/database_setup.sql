-- This script creates the database and all required tables,
-- and pre-populates it with sample data.

-- Create the database if it doesn't exist
CREATE DATABASE IF NOT EXISTS my_app_db;

-- Use the newly created database
USE my_app_db;

-- Table Creation --

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    account_type VARCHAR(20) NOT NULL DEFAULT 'user',
    account_status VARCHAR(20) NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS recipes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    serving_size VARCHAR(50),
    prep_time INT,
    cuisine_type VARCHAR(100),
    image_url VARCHAR(2083),
    ingredients TEXT,
    steps TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    avg_rating DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
    rating_count INT NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recipe_id INT NOT NULL,
    user_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    recipe_name VARCHAR(255) NOT NULL,
    total_cost DECIMAL(10, 2) NOT NULL,
    order_status VARCHAR(50) DEFAULT 'Processing',
    estimated_arrival VARCHAR(100),
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    ingredient_name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);


-- Data Seeding --

-- Clear existing data to prevent duplicates on re-run
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE order_items;
TRUNCATE TABLE orders;
TRUNCATE TABLE reviews;
TRUNCATE TABLE recipes;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- Insert your users
-- NOTE: I've made 'Calvin' a restaurant account to own the recipes.
INSERT INTO users (id, username, email, password, account_type, account_status) VALUES
(3, 'admin', 'admin@example.com', 'adminpass', 'admin', 'active'),
(4, 'Calvin', 'calvin.guna@binus.ac.id', '123', 'restaurant', 'active'),
(5, 'Husein', 'husein.baraqbah@binus.ac.id', '123', 'user', 'active');

-- Insert some sample recipes owned by Calvin (user_id 4)
-- FIXED: Removed avg_rating and rating_count from the INSERT statement as they are calculated later.
INSERT INTO recipes (id, user_id, name, serving_size, prep_time, cuisine_type, image_url, ingredients, steps) VALUES
(1, 4, 'Thai Basil Chicken', '2 people', 20, 'Thai', 'https://healthyfitnessmeals.com/wp-content/uploads/2020/09/THAI-BASIL-CHICKEN-6.jpg', '2 tbsp vegetable oil\n3 cloves garlic (minced)\n2 Thai bird''s eye chilies (sliced, or to taste)\n300g (10 oz) ground chicken\n1 tbsp soy sauce\n1 tbsp oyster sauce\n1 tsp fish sauce\n1 tsp sugar\n1/4 cup water\n1 cup Thai basil leaves', '1. Heat oil in a wok or skillet over medium-high heat.\n2. Add garlic and chilies; stir-fry for 15-20 seconds until fragrant.\n3. Add ground chicken. Break it apart and cook until no longer pink.\n4. Stir in soy sauce, oyster sauce, fish sauce, sugar, and water. Cook for 2-3 minutes.\n5. Toss in basil leaves. Stir until wilted, about 30 seconds.'),
(2, 4, 'Crispy Chickpea Tacos', '4 people', 15, 'Mexican', 'https://rainbowplantlife.com/wp-content/uploads/2022/06/spiced-chickpea-tacos-1-of-2-scaled.jpg', '1 can (15 ounces) chickpeas, rinsed and drained\n1 tbsp olive oil\n1 tsp chili powder\n1/2 tsp cumin\n8 small corn tortillas\nLime Crema\nShredded Cabbage', '1. Pat chickpeas dry. Toss with olive oil and spices.\n2. Roast at 400°F (200°C) for 15-20 minutes until crispy.\n3. Serve in warm tortillas with toppings.'),
(3, 4, 'One-Pot Creamy Garlic Pasta', '3 people', 25, 'Italian', 'https://makeitdairyfree.com/wp-content/uploads/2020/10/vegan-one-pot-creamy-garlic-parmesan-pasta-5-500x500.jpg', '8 oz fettuccine\n4 cloves garlic, minced\n2 tbsp butter\n2 cups chicken broth\n1 cup heavy cream\n1/2 cup grated Parmesan cheese\nSalt and pepper to taste', '1. In a large pot, melt butter over medium heat. Add garlic and cook until fragrant.\n2. Add chicken broth, heavy cream, and uncooked pasta. Bring to a boil.\n3. Reduce heat and simmer, stirring occasionally, until pasta is cooked through, about 15-20 minutes.\n4. Stir in Parmesan cheese until melted and creamy. Season with salt and pepper.');

-- Insert some sample reviews (Husein reviewing Calvin's recipes)
INSERT INTO reviews (recipe_id, user_id, rating, comment) VALUES
(1, 5, 5, 'Absolutely delicious! Tasted just like the one from my favorite restaurant.'),
(1, 3, 4, 'Great recipe, very easy to follow.'),
(2, 5, 4, 'A new favorite for taco night. So simple and tasty.');

-- Update the recipe ratings based on the reviews we just added
UPDATE recipes SET rating_count = 2, avg_rating = 4.50 WHERE id = 1;
UPDATE recipes SET rating_count = 1, avg_rating = 4.00 WHERE id = 2;


-- Insert a sample order for Husein (user_id 5)
INSERT INTO orders (id, user_id, recipe_name, total_cost, order_status, estimated_arrival) VALUES
(1, 5, 'Thai Basil Chicken', 25.50, 'Out for Delivery', '5 minutes');

-- Insert the items for that order
INSERT INTO order_items (order_id, ingredient_name, price) VALUES
(1, '300g (10 oz) ground chicken', 10.00),
(1, '1 cup Thai basil leaves', 4.00),
(1, '1 tbsp soy sauce', 2.25),
(1, 'Cooked jasmine rice (for serving)', 5.50),
(1, 'Optional: Fried egg', 1.25);