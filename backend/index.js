// 📂 File: server.js (CORRECTED & FINAL)

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken'); // 👈 ADD THIS LINE
const path = require('path');
const sharp = require('sharp'); 
// ... after const path = require('path');
const crypto = require('crypto');
const { sendPasswordResetCode } = require('./mailer');
const fs = require('fs'); // Import the file system module at the top of your file
const { Client } = require("@googlemaps/google-maps-services-js");
const googleMapsClient = new Client({});
// const db = require('../db'); // Adjust path to your db connection
// const { galleryUpload, createBulkNotifications } = require('../middleware'); // Adjust path to your middleware
// // const { OpenAI } = require('openai');

// ★★★ NEW IMPORTS FOR REAL-TIME CHAT ★★★
const http = require('http');
const { Server } = require("socket.io");
// ★★★ END NEW IMPORTS ★★★

// Initialize the OpenAI client with your API key from the .env file
// const openai = new OpenAI({
//     apiKey: process.env.OPENAI_API_KEY,
// });



const app = express();

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('/data/uploads'));
app.use('/public', express.static(path.join(__dirname, 'public')));

// ==========================================================
// --- ✨ IMAGE PROXY ROUTE (Your existing code, unchanged) ---
// ==========================================================
app.get('/api/image/:filename', (req, res) => {
    const { filename } = req.params;
    const width = req.query.w ? parseInt(req.query.w, 10) : null;
    const height = req.query.h ? parseInt(req.query.h, 10) : null;
    const quality = req.query.q ? parseInt(req.query.q, 10) : 80;

    if (filename.includes('..')) {
        return res.status(400).send('Invalid filename');
    }
    const filePath = path.join('/data/uploads', filename);

    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error(`Image not found: ${filePath}`);
            return res.status(404).json({ error: 'File not found' });
        }
        if (width || height) {
            res.type('image/jpeg');
            const transformer = sharp(filePath);
            transformer.resize({
                width: width,
                height: height,
                fit: 'inside',
                withoutEnlargement: true
            });
            transformer.jpeg({ quality });
            transformer.on('error', (sharpErr) => {
                console.error('Sharp processing error:', sharpErr);
                res.status(500).send('Error processing image');
            });
            return transformer.pipe(res);
        }
        res.sendFile(filePath, (fileErr) => {
            if (fileErr) {
                console.error(`Error sending original file: ${filePath}`, fileErr);
            }
        });
    });
});

// ==========================================================

// ==========================================================
// --- MULTER & DB SETUP (Your existing code, unchanged) ---
// ==========================================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, '/data/uploads'); }, // <-- FIXED
    filename: (req, file, cb) => {
        cb(null, `profile-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });

const galleryStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, '/data/uploads'); }, // <-- FIXED
    filename: (req, file, cb) => {
        cb(null, `gallery-media-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const galleryUpload = multer({ storage: galleryStorage });

const db = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});



// ==========================================================
// --- MIDDLEWARE FOR SECURE AUTHENTICATION ---
// ★★★ THIS BLOCK MUST COME FIRST ★★★
// ==========================================================
// This function verifies the JWT sent from the app to protect routes.
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Expects "Bearer TOKEN"

    if (!token) {
        return res.status(401).json({ message: 'No token provided, authorization denied.' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'YOUR_SUPER_SECRET_KEY', (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Token is not valid.' });
        }
        // The decoded token payload (id, role, etc.) is attached to the request object.
        req.user = user;
        next();
    });
};

// This function checks if the verified user has the 'admin' role.
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin role required.' });
    }
};


// ==========================================================
// --- NOTIFICATION HELPER FUNCTIONS ---
// (This is also a good place for your helper functions)
// ==========================================================
const createNotification = async (dbOrConnection, recipientId, senderName, title, message, link = null) => {
    try {
        const query = 'INSERT INTO notifications (recipient_id, sender_name, title, message, link) VALUES (?, ?, ?, ?, ?)';
        // Use the passed-in connection or the main db pool
        await dbOrConnection.query(query, [recipientId, senderName, title, message, link]);
        console.log(`>>> Notification created for user ID: ${recipientId}`); // Debug log
    } catch (error) {
        console.error(`[NOTIFICATION ERROR] Failed to create notification for user ${recipientId}:`, error);
        throw error; // Re-throw the error to cause a transaction rollback
    }
};

const createBulkNotifications = async (dbOrConnection, recipientIds, senderName, title, message, link = null) => {
    if (!recipientIds || recipientIds.length === 0) return;
    try {
        const query = 'INSERT INTO notifications (recipient_id, sender_name, title, message, link) VALUES ?';
        const values = recipientIds.map(id => [id, senderName, title, message, link]);
        // Use the passed-in connection or the main db pool
        await dbOrConnection.query(query, [values]);
        console.log(`>>> Bulk notifications created for ${recipientIds.length} users.`); // Debug log
    } catch (error) {
        console.error('[NOTIFICATION ERROR] Failed to create bulk notifications:', error);
        throw error; // Re-throw the error to cause a transaction rollback
    }
};


// ==========================================================
// --- MULTER STORAGE CONFIG FOR THE NEW ADS MODULE ---
// ==========================================================
// This keeps ad-related uploads separate from your other multer configs.
const adsStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // We'll use your existing 'uploads' directory
        cb(null, '/data/uploads')
    },
    filename: (req, file, cb) => {
        // Create a unique filename for ad images and payment proofs
        let prefix = 'ad-image';
        if (file.fieldname === 'payment_screenshot') {
            prefix = 'ad-payment-proof';
        }
        cb(null, `${prefix}-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const adsUpload = multer({ storage: adsStorage });


// 📂 File: backend/server.js (Replace all user, profile, and password reset routes with this block)

// ==========================================================
// --- USER, PROFILE & PASSWORD API ROUTES ---
// ==========================================================

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        const user = rows[0];
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Error: Invalid username or password.' });
        }
        if (user.subjects_taught && typeof user.subjects_taught === 'string') {
            try { user.subjects_taught = JSON.parse(user.subjects_taught); } 
            catch (e) { user.subjects_taught = []; }
        }
        const { password: _, ...userData } = user;
        const tokenPayload = {
            id: user.id,
            username: user.username,
            role: user.role,
            full_name: user.full_name
        };
        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'YOUR_SUPER_SECRET_KEY', { expiresIn: '24h' });
        res.status(200).json({ message: 'Login successful!', user: userData, token: token });
    } catch (error) { 
        console.error("Login Error:", error);
        res.status(500).json({ message: 'Error: Database connection failed.' }); 
    }
});


app.get('/api/users', async (req, res) => {
    try {
        const query = `
            SELECT u.id, u.username, u.full_name, u.role, u.class_group, u.subjects_taught, p.email, p.phone, p.address 
            FROM users u LEFT JOIN user_profiles p ON u.id = p.user_id`;
        const [rows] = await db.query(query);
        const usersWithParsedSubjects = rows.map(user => {
            if (user.subjects_taught && typeof user.subjects_taught === 'string') {
                try { user.subjects_taught = JSON.parse(user.subjects_taught); } catch (e) { user.subjects_taught = []; }
            }
            return user;
        });
        res.status(200).json(usersWithParsedSubjects);
    } catch (error) { res.status(500).json({ message: 'Error: Could not get users.' }); }
});

app.post('/api/users', async (req, res) => {
    const { username, password, full_name, email, role, class_group, subjects_taught } = req.body;
    const subjectsJson = (role === 'teacher' && Array.isArray(subjects_taught)) ? JSON.stringify(subjects_taught) : null;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const hashedPassword = await bcrypt.hash(password, 10);
        const [userResult] = await connection.query(
            'INSERT INTO users (username, password, full_name, role, class_group, subjects_taught) VALUES (?, ?, ?, ?, ?, ?)',
            [username, hashedPassword, full_name, role, class_group, subjectsJson]
        );
        const newUserId = userResult.insertId;
        await connection.query('INSERT INTO user_profiles (user_id, email) VALUES (?, ?)', [newUserId, email || null]);
        await connection.commit();
        res.status(201).json({ message: 'User and profile created successfully!' });
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Error: This username already exists.' });
        res.status(500).json({ message: 'Error: Could not create user.' });
    } finally { connection.release(); }
});


// Add this new route to your backend API file

app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { username, password, full_name, role, class_group, subjects_taught } = req.body;

    // Build the query dynamically based on the fields provided
    let queryFields = [];
    let queryParams = [];

    if (username !== undefined) {
        queryFields.push('username = ?');
        queryParams.push(username);
    }
    if (full_name !== undefined) {
        queryFields.push('full_name = ?');
        queryParams.push(full_name);
    }
    if (role !== undefined) {
        queryFields.push('role = ?');
        queryParams.push(role);
    }
    if (class_group !== undefined) {
        queryFields.push('class_group = ?');
        queryParams.push(class_group);
    }
    // Only update subjects if the role is teacher and subjects are provided
    if (role === 'teacher' && subjects_taught !== undefined) {
        const subjectsJson = Array.isArray(subjects_taught) ? JSON.stringify(subjects_taught) : null;
        queryFields.push('subjects_taught = ?');
        queryParams.push(subjectsJson);
    }

    // CRITICAL: Only hash and update the password if a new one was provided
    if (password) {
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            queryFields.push('password = ?');
            queryParams.push(hashedPassword);
        } catch (hashError) {
            console.error("Password Hashing Error:", hashError);
            return res.status(500).json({ message: 'Error processing password.' });
        }
    }

    // If no fields are being updated, return an error
    if (queryFields.length === 0) {
        return res.status(400).json({ message: 'No valid fields provided for update.' });
    }

    // Add the user ID to the end of the parameters for the WHERE clause
    queryParams.push(id);

    const sql = `UPDATE users SET ${queryFields.join(', ')} WHERE id = ?`;

    try {
        const [result] = await db.query(sql, queryParams);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(200).json({ message: 'User updated successfully!' });
    } catch (error) {
        console.error("User Update Error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Error: This username already exists.' });
        }
        res.status(500).json({ message: 'Error: Could not update user.' });
    }
});


app.get('/api/profiles/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const sql = `SELECT u.*, p.email, p.dob, p.gender, p.phone, p.address, p.profile_image_url, p.admission_date, p.roll_no FROM users u LEFT JOIN user_profiles p ON u.id = p.user_id WHERE u.id = ?`;
        const [rows] = await db.query(sql, [userId]);
        if (rows.length === 0) return res.status(404).json({ message: 'User not found' });
        res.json(rows[0]);
    } catch (error) { res.status(500).json({ message: 'Database error fetching profile' }); }
});

app.put('/api/profiles/:userId', upload.single('profileImage'), async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    const { full_name, class_group, email, dob, gender, phone, address, roll_no, admission_date } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        if (full_name !== undefined || class_group !== undefined) {
            await connection.query('UPDATE users SET full_name = ?, class_group = ? WHERE id = ?', [full_name, class_group, userId]);
        }
        let profile_image_url = req.body.profile_image_url === 'null' ? null : req.body.profile_image_url;
        if (req.file) profile_image_url = `/uploads/${req.file.filename}`;
        const profileSql = `INSERT INTO user_profiles (user_id, email, dob, gender, phone, address, profile_image_url, admission_date, roll_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE email = VALUES(email), dob = VALUES(dob), gender = VALUES(gender), phone = VALUES(phone), address = VALUES(address), profile_image_url = VALUES(profile_image_url), admission_date = VALUES(admission_date), roll_no = VALUES(roll_no)`;
        await connection.query(profileSql, [userId, email, dob, gender, phone, address, profile_image_url, admission_date, roll_no]);
        await connection.commit();
        res.status(200).json({ message: 'Profile updated successfully!', profile_image_url: profile_image_url });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: 'An error occurred while updating the profile.' });
    } finally { connection.release(); }
});

app.patch('/api/users/:id/reset-password', async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ message: 'New password cannot be empty.' });
    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const [result] = await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found.' });
        res.status(200).json({ message: 'Password has been reset successfully!' });
    } catch (error) { res.status(500).json({ message: 'Could not reset password.' }); }
});

app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'User not found.' });
        res.status(200).json({ message: 'User deleted successfully.' });
    } catch (error) { res.status(500).json({ message: 'Error: Could not delete user.' }); }
});

// --- SELF-SERVICE PASSWORD RESET API ROUTES (OTP/CODE METHOD) ---

// This route now generates and sends a 6-digit code.
app.post('/api/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        if (!email) {
            return res.status(400).json({ message: 'Email address is required.' });
        }
        const [profileRows] = await db.query('SELECT user_id FROM user_profiles WHERE email = ?', [email]);
        if (profileRows.length === 0) {
            return res.status(200).json({ message: 'If an account with that email exists, a reset code has been sent.' });
        }
        const user_id = profileRows[0].user_id;
        const [userRows] = await db.query('SELECT role FROM users WHERE id = ?', [user_id]);
        if (userRows.length === 0 || userRows[0].role !== 'donor') {
            return res.status(200).json({ message: 'If a Donor account with that email exists, a reset code has been sent.' });
        }
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const tokenExpiry = new Date(Date.now() + 600000); // 10 minutes
        await db.query('UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?', [resetCode, tokenExpiry, user_id]);
        await sendPasswordResetCode(email, resetCode);
        res.status(200).json({ message: 'A 6-digit reset code has been sent to your email.' });
    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
});

// ✅ --- STEP 2: USE THE CORRECT RESET PASSWORD ROUTE --- ✅
// This is the correct route for the OTP/code method.
app.post('/api/reset-password', async (req, res) => {
    const { email, token, newPassword } = req.body;
    try {
        if (!email || !token || !newPassword) {
            return res.status(400).json({ message: 'Email, reset code, and new password are required.' });
        }
        const [rows] = await db.query(
            'SELECT u.id FROM users u JOIN user_profiles p ON u.id = p.user_id WHERE p.email = ? AND u.reset_password_token = ? AND u.reset_password_expires > NOW()',
            [email, token]
        );
        const user = rows[0];
        if (!user) {
            return res.status(400).json({ message: 'Reset code is invalid or has expired.' });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?', [hashedPassword, user.id]);
        res.status(200).json({ message: 'Password has been successfully reset. You can now log in.' });
    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ message: 'An error occurred while resetting the password.' });
    }
});

// ==========================================================
// --- ✨ NEW: SELF-SERVICE PASSWORD CHANGE API ROUTE ---
// ==========================================================
// This route should be protected by your JWT authentication middleware.
// The middleware should verify the token and attach the user payload to req.user.
// Example: app.post('/api/auth/change-password', verifyToken, async (req, res) => { ... });

app.post('/api/auth/change-password', async (req, res) => {
    // In a real app, req.user.id would be populated by your authentication middleware.
    // For demonstration, we'll assume it's there.
    // const { id } = req.user; 
    
    // If you don't have middleware yet, you'd have to decode the token here.
    // This is a basic example of how to do it without dedicated middleware:
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Access Denied. No token provided.' });

    let userId;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'YOUR_SUPER_SECRET_KEY');
        userId = decoded.id;
    } catch (err) {
        return res.status(403).json({ message: 'Invalid Token.' });
    }
    // End of token verification example

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new passwords are required.' });
    }

    try {
        // 1. Fetch the user from the database
        const [rows] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
        const user = rows[0];

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // 2. Verify the current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Incorrect current password.' });
        }

        // 3. Hash the new password and update the database
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId]);

        res.status(200).json({ message: 'Password changed successfully.' });

    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
});





// --- CALENDAR API ROUTES ---
app.get('/api/calendar', async (req, res) => { try { const [rows] = await db.query('SELECT *, DATE_FORMAT(event_date, "%Y-%m-%d") AS event_date FROM calendar_events ORDER BY event_date ASC, time ASC'); const groupedEvents = rows.reduce((acc, event) => { const dateKey = event.event_date; if (!acc[dateKey]) { acc[dateKey] = []; } acc[dateKey].push(event); return acc; }, {}); res.status(200).json(groupedEvents); } catch (error) { console.error(error); res.status(500).json({ message: 'Error: Could not get calendar events.' }); }});
// 📂 File: server.js (REPLACE THIS ROUTE)

app.post('/api/calendar', async (req, res) => {
    // 1. ADD adminId to the request body. The frontend must send this.
    const { event_date, name, type, time, description, adminId } = req.body; 
    
    if (!adminId) {
        return res.status(400).json({ message: "Admin ID is required to create a calendar event." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 2. Insert the new event
        await connection.query('INSERT INTO calendar_events (event_date, name, type, time, description) VALUES (?, ?, ?, ?, ?)', [event_date, name, type, time, description]);

        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★
        
        // 3. Find all users except the creating admin
        const [usersToNotify] = await connection.query("SELECT id FROM users WHERE id != ?", [adminId]);
        
        if (usersToNotify.length > 0) {
            // 4. Get the admin's name for the notification
            const [[admin]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [adminId]);
            const senderName = admin.full_name || "School Administration";

            // 5. Prepare and send notifications
            const recipientIds = usersToNotify.map(u => u.id);
            const notificationTitle = `New Calendar Event: ${type}`;
            const eventDate = new Date(event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
            const notificationMessage = `A new event, "${name}", has been added to the calendar for ${eventDate}.`;

            await createBulkNotifications(
                connection,
                recipientIds,
                senderName,
                notificationTitle,
                notificationMessage,
                '/calendar' // A generic link to the calendar screen
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★
        
        await connection.commit();
        res.status(201).json({ message: 'Event created and users notified successfully!' });

    } catch (error) {
        await connection.rollback();
        console.error("Error creating calendar event:", error);
        res.status(500).json({ message: 'Error: Could not create event.' });
    } finally {
        connection.release();
    }
});
// 📂 File: server.js (REPLACE THIS ROUTE)

app.put('/api/calendar/:id', async (req, res) => {
    const { id } = req.params;
    // 1. ADD adminId to the request body. The frontend must send this.
    const { event_date, name, type, time, description, adminId } = req.body;

    if (!adminId) {
        return res.status(400).json({ message: "Admin ID is required to update a calendar event." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // 2. Update the event
        const [result] = await connection.query('UPDATE calendar_events SET event_date = ?, name = ?, type = ?, time = ?, description = ? WHERE id = ?', [event_date, name, type, time, description, id]);
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Event not found.' });
        }

        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★

        // 3. Find all users except the editing admin
        const [usersToNotify] = await connection.query("SELECT id FROM users WHERE id != ?", [adminId]);
        
        if (usersToNotify.length > 0) {
            // 4. Get the admin's name
            const [[admin]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [adminId]);
            const senderName = admin.full_name || "School Administration";

            // 5. Prepare and send notifications
            const recipientIds = usersToNotify.map(u => u.id);
            const notificationTitle = `Calendar Event Updated`;
            const notificationMessage = `The event "${name}" has been updated. Please check the calendar for the latest details.`;

            await createBulkNotifications(
                connection,
                recipientIds,
                senderName,
                notificationTitle,
                notificationMessage,
                '/calendar'
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★

        await connection.commit();
        res.status(200).json({ message: 'Event updated and users notified successfully!' });

    } catch (error) {
        await connection.rollback();
        console.error("Error updating calendar event:", error);
        res.status(500).json({ message: 'Error: Could not update event.' });
    } finally {
        connection.release();
    }
});
app.delete('/api/calendar/:id', async (req, res) => { const { id } = req.params; try { const [result] = await db.query('DELETE FROM calendar_events WHERE id = ?', [id]); if (result.affectedRows === 0) { return res.status(404).json({ message: 'Event not found.' }); } res.status(200).json({ message: 'Event deleted successfully.' }); } catch (error) { console.error(error); res.status(500).json({ message: 'Error: Could not delete event.' }); }});

// --- PROFILE API ROUTES ---
app.get('/api/profiles/:userId', async (req, res) => { try { const { userId } = req.params; const sql = ` SELECT u.id, u.username, u.full_name, u.role, u.class_group, p.email, p.dob, p.gender, p.phone, p.address, p.profile_image_url, p.admission_date, p.roll_no FROM users u LEFT JOIN user_profiles p ON u.id = p.user_id WHERE u.id = ? `; const [rows] = await db.query(sql, [userId]); if (rows.length === 0) { return res.status(404).json({ message: 'User not found' }); } res.json(rows[0]); } catch (error) { console.error("GET Profile Error:", error); res.status(500).json({ message: 'Database error fetching profile' }); }});
app.put('/api/profiles/:userId', upload.single('profileImage'), async (req, res) => { try { const userId = parseInt(req.params.userId, 10); if (isNaN(userId) || userId <= 0) { return res.status(400).json({ message: 'Invalid User ID provided.' }); } const { full_name, class_group, email, dob, gender, phone, address, admission_date, roll_no } = req.body; const [userCheck] = await db.query('SELECT id FROM users WHERE id = ?', [userId]); if (userCheck.length === 0) { return res.status(404).json({ message: `User with ID ${userId} not found.` }); } let new_profile_image_url = null; if (req.file) { new_profile_image_url = `/uploads/${req.file.filename}`; } else { const [existingProfile] = await db.query('SELECT profile_image_url FROM user_profiles WHERE user_id = ?', [userId]); if (existingProfile.length > 0) { new_profile_image_url = existingProfile[0].profile_image_url; } } if (full_name !== undefined || class_group !== undefined) { await db.query('UPDATE users SET full_name = ?, class_group = ? WHERE id = ?', [full_name, class_group, userId]); } const profileSql = ` INSERT INTO user_profiles ( user_id, email, dob, gender, phone, address, profile_image_url, admission_date, roll_no ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE email = VALUES(email), dob = VALUES(dob), gender = VALUES(gender), phone = VALUES(phone), address = VALUES(address), profile_image_url = VALUES(profile_image_url), admission_date = VALUES(admission_date), roll_no = VALUES(roll_no) `; const profileParams = [userId, email || null, dob || null, gender || null, phone || null, address || null, new_profile_image_url, admission_date || null, roll_no || null]; await db.query(profileSql, profileParams); res.status(200).json({ message: 'Profile updated successfully!', profile_image_url: new_profile_image_url }); } catch (error) { console.error("!!! SERVER ERROR IN PUT /api/profiles/:userId:", error); res.status(500).json({ message: 'An error occurred while updating the profile.' }); }});

// ==========================================================
// --- Timetable API ROUTES ---
// ==========================================================
// --- TIMETABLE API ROUTES ---
app.get('/api/teachers', async (req, res) => { try { const [teachers] = await db.query("SELECT id, full_name, subjects_taught FROM users WHERE role = 'teacher'"); res.status(200).json(teachers); } catch (error) { console.error("GET /api/teachers Error:", error); res.status(500).json({ message: 'Could not fetch teachers.' }); }});
app.get('/api/timetable/:class_group', async (req, res) => { try { const { class_group } = req.params; if (!class_group) { return res.status(400).json({ message: 'Class group is required.' }); } const query = `SELECT t.*, u.full_name as teacher_name FROM timetables t LEFT JOIN users u ON t.teacher_id = u.id WHERE t.class_group = ?`; const [slots] = await db.query(query, [class_group]); res.status(200).json(slots); } catch (error) { console.error("GET /api/timetable/:class_group Error:", error); res.status(500).json({ message: 'Could not fetch timetable.' }); }});
app.get('/api/timetable/teacher/:teacherId', async (req, res) => { try { const { teacherId } = req.params; if (!teacherId || isNaN(parseInt(teacherId))) { return res.status(400).json({ message: 'A valid Teacher ID is required.' }); } const query = `SELECT t.class_group, t.day_of_week, t.period_number, t.subject_name, t.teacher_id, u.full_name as teacher_name FROM timetables t JOIN users u ON t.teacher_id = u.id WHERE t.teacher_id = ? ORDER BY day_of_week, period_number`; const [slots] = await db.query(query, [teacherId]); res.status(200).json(slots); } catch (error) { console.error("GET /api/timetable/teacher/:teacherId Error:", error); res.status(500).json({ message: 'Could not fetch teacher timetable.' }); }});
app.post('/api/timetable', async (req, res) => { const { class_group, day_of_week, period_number, subject_name, teacher_id } = req.body; const connection = await db.getConnection(); try { await connection.beginTransaction(); await connection.execute('DELETE FROM timetables WHERE class_group = ? AND day_of_week = ? AND period_number = ?', [class_group, day_of_week, period_number] ); if (teacher_id && subject_name) { await connection.execute( 'INSERT INTO timetables (class_group, day_of_week, period_number, subject_name, teacher_id) VALUES (?, ?, ?, ?, ?)', [class_group, day_of_week, period_number, subject_name, teacher_id] ); } 
// ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★

        // Only send notifications if a new class was actually assigned (not just cleared)
        if (teacher_id && subject_name) {
            
            // 1. Find all students in the affected class group
            const [students] = await connection.query("SELECT id FROM users WHERE role = 'student' AND class_group = ?", [class_group]);

            // 2. Prepare the list of all recipients (the teacher + all students)
            const studentIds = students.map(s => s.id);
            const allRecipientIds = [teacher_id, ...studentIds]; 

            // 3. Construct an informative notification message
            const notificationTitle = `Timetable Updated for ${class_group}`;
            const notificationMessage = `Your schedule has been updated. You now have ${subject_name} on ${day_of_week} during Period ${period_number}.`;
            const senderName = "School Administration"; // Generic sender for admin actions

            // 4. Send the notifications to everyone in the list
            if (allRecipientIds.length > 0) {
                await createBulkNotifications(
                    connection, // Use the transaction connection
                    allRecipientIds,
                    senderName,
                    notificationTitle,
                    notificationMessage,
                    '/timetable' // Generic link to the timetable screen
                );
            }
        }
        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★
    await connection.commit(); res.status(201).json({ message: 'Timetable updated successfully!' }); } catch (error) { await connection.rollback(); console.error("POST /api/timetable Error:", error); res.status(500).json({ message: error.message || 'Error updating timetable.' }); } finally { connection.release(); }});



// ==========================================================
// --- ATTENDANCE API ROUTES ---
// ==========================================================
app.get('/api/subjects/:class_group', async (req, res) => { try { const { class_group } = req.params; if (!class_group) { return res.status(400).json({ message: 'Class group is required.' }); } const query = `SELECT DISTINCT subject_name FROM timetables WHERE class_group = ? ORDER BY subject_name;`; const [subjects] = await db.query(query, [class_group]); res.status(200).json(subjects.map(s => s.subject_name)); } catch (error) { console.error("GET /api/subjects/:class_group Error:", error); res.status(500).json({ message: 'Could not fetch subjects for the class.' }); }});
app.get('/api/teacher-assignments/:teacherId', async (req, res) => { try { const { teacherId } = req.params; if (!teacherId) { return res.status(400).json({ message: 'Teacher ID is required.' }); } const query = `SELECT DISTINCT class_group, subject_name FROM timetables WHERE teacher_id = ? ORDER BY class_group, subject_name;`; const [assignments] = await db.query(query, [teacherId]); res.status(200).json(assignments); } catch (error) { console.error("GET /api/teacher-assignments/:teacherId Error:", error); res.status(500).json({ message: 'Could not fetch teacher assignments.' }); }});

const getAttendanceSummary = async (filters) => {
    let dateFilter = '';
    const { viewMode, date } = filters;
    let queryDateParams = [];

    if (date) {
        dateFilter = 'AND ar.attendance_date = ?';
        queryDateParams.push(date);
    } else if (viewMode === 'daily') {
        dateFilter = 'AND ar.attendance_date = CURDATE()';
    } else if (viewMode === 'monthly') {
        dateFilter = 'AND MONTH(ar.attendance_date) = MONTH(CURDATE()) AND YEAR(ar.attendance_date) = YEAR(CURDATE())';
    }

    let whereClause = 'ar.class_group = ?';
    let queryParams = [filters.classGroup];
    
    if (filters.subjectName) {
        whereClause += ' AND ar.subject_name = ?';
        queryParams.push(filters.subjectName);
    }
    if (filters.teacherId) {
        whereClause += ' AND ar.teacher_id = ?';
        queryParams.push(filters.teacherId);
    }

    const baseQuery = `FROM attendance_records ar WHERE ${whereClause} ${dateFilter}`;
    const fullQueryParams = [...queryParams, ...queryDateParams];

    let overallSummary;
    if (viewMode === 'daily') {
        const summaryQuery = `
            SELECT
                COALESCE((SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) * 100 / NULLIF(COUNT(id), 0)), 0) as overall_percentage,
                COUNT(DISTINCT CASE WHEN status = 'Present' THEN student_id END) as students_present,
                COUNT(DISTINCT CASE WHEN status = 'Absent' THEN student_id END) as students_absent
            ${baseQuery}
        `;
        [[overallSummary]] = await db.query(summaryQuery, fullQueryParams);
    } else {
        const summaryQuery = `
            WITH StudentStats AS (
                SELECT 
                    student_id,
                    (SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) * 100.0 / COUNT(id)) as percentage
                ${baseQuery}
                GROUP BY student_id
            )
            SELECT
                (SELECT COALESCE(AVG(percentage), 0) FROM StudentStats) as avg_daily_attendance,
                (SELECT COUNT(*) FROM StudentStats WHERE percentage < 75) AS students_below_threshold,
                (SELECT COALESCE(SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) * 100.0 / COUNT(id), 0) ${baseQuery}) as overall_percentage
        `;
         [[overallSummary]] = await db.query(summaryQuery, [...fullQueryParams, ...fullQueryParams]);
    }

    const studentDetailsQuery = `
        SELECT 
            u.id AS student_id, 
            u.full_name, 
            COALESCE(SUM(CASE WHEN ar.status = 'Present' THEN 1 ELSE 0 END), 0) as present_days, 
            COUNT(ar.id) as total_days
        FROM users u 
        LEFT JOIN attendance_records ar ON u.id = ar.student_id AND ${whereClause} ${dateFilter}
        WHERE u.role = 'student' AND u.class_group = ?
        GROUP BY u.id, u.full_name 
        ORDER BY u.full_name;
    `;
    const studentDetailsParams = [...fullQueryParams, filters.classGroup];
    const [studentDetails] = await db.query(studentDetailsQuery, studentDetailsParams);
    return { overallSummary, studentDetails };
};

app.get('/api/attendance/teacher-summary', async (req, res) => {
    try {
        const { teacherId, classGroup, subjectName, viewMode, date } = req.query;
        if (!teacherId || !classGroup || !subjectName) {
            return res.status(400).json({ message: 'Teacher ID, Class Group, and Subject are required.' });
        }
        const summary = await getAttendanceSummary({ teacherId, classGroup, subjectName, viewMode, date });
        res.status(200).json(summary);
    } catch (error) {
        console.error("GET /api/attendance/teacher-summary Error:", error);
        res.status(500).json({ message: 'Could not fetch teacher attendance summary.' });
    }
});

app.get('/api/attendance/admin-summary', async (req, res) => {
    try {
        const { classGroup, subjectName, viewMode, date } = req.query;
        if (!classGroup || !subjectName) {
            return res.status(400).json({ message: 'Class Group and Subject Name are required.' });
        }
        const summary = await getAttendanceSummary({ classGroup, subjectName, viewMode, date });
        res.status(200).json(summary);
    } catch (error) {
        console.error("GET /api/attendance/admin-summary Error:", error);
        res.status(500).json({ message: 'Could not fetch admin attendance summary.' });
    }
});

app.get('/api/attendance/sheet', async (req, res) => { 
    const { class_group, date, period_number } = req.query; 
    try { 
        if (!class_group || !date || !period_number) { 
            return res.status(400).json({ message: 'Class group, date, and period number are required.' }); 
        } 
        const query = `SELECT u.id, u.full_name, ar.status FROM users u LEFT JOIN attendance_records ar ON u.id = ar.student_id AND ar.attendance_date = ? AND ar.period_number = ? WHERE u.role = 'student' AND u.class_group = ? ORDER BY u.full_name;`; 
        const [students] = await db.query(query, [date, period_number, class_group]); 
        res.status(200).json(students); 
    } catch (error) { 
        console.error("GET /api/attendance/sheet Error:", error); 
        res.status(500).json({ message: 'Error fetching attendance sheet.' }); 
    }
});

app.post('/api/attendance', async (req, res) => {
    const { class_group, subject_name, period_number, date, teacher_id, attendanceData } = req.body;
    const connection = await db.getConnection();
    try {
        if (!class_group || !subject_name || !period_number || !date || !teacher_id || !Array.isArray(attendanceData)) {
            return res.status(400).json({ message: 'All fields are required, and attendanceData must be an array.' });
        }
        
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayOfWeek = days[new Date(date).getDay()];
        
        const [timetableSlot] = await connection.query(
            'SELECT teacher_id FROM timetables WHERE class_group = ? AND day_of_week = ? AND period_number = ?',
            [class_group, dayOfWeek, period_number]
        );

        if (!timetableSlot.length || timetableSlot[0].teacher_id !== parseInt(teacher_id, 10)) {
            return res.status(403).json({ message: `You are not assigned to the first period for this class on ${dayOfWeek}.` });
        }
        
        if (attendanceData.length === 0) {
            return res.status(200).json({ message: 'No attendance data to save.' });
        }

        await connection.beginTransaction();

        const query = `
            INSERT INTO attendance_records 
                (student_id, teacher_id, class_group, subject_name, attendance_date, period_number, status) 
            VALUES ? 
            ON DUPLICATE KEY UPDATE 
                status = VALUES(status), 
                teacher_id = VALUES(teacher_id), 
                subject_name = VALUES(subject_name);
        `;

        const valuesToInsert = attendanceData.map(record => [
            record.student_id, teacher_id, class_group, subject_name, date, period_number, record.status
        ]);
        
        await connection.query(query, [valuesToInsert]);
        
        await connection.commit();
        res.status(201).json({ message: 'Attendance saved successfully!' });

    } catch (error) {
        await connection.rollback();
        console.error("POST /api/attendance Error:", error);
        res.status(500).json({ message: 'An internal server error occurred while saving attendance.' });
    } finally {
        connection.release();
    }
});

const getStudentHistory = async (studentId, viewMode, date) => {
    let dateFilter = '';
    let queryDateParams = [];
    
    if (date) {
        dateFilter = 'AND attendance_date = ?';
        queryDateParams.push(date);
    } else if (viewMode === 'daily') {
        dateFilter = 'AND attendance_date = CURDATE()';
    } else if (viewMode === 'monthly') {
        dateFilter = 'AND MONTH(attendance_date) = MONTH(CURDATE()) AND YEAR(attendance_date) = YEAR(CURDATE())';
    }
    
    const queryBase = `FROM attendance_records WHERE student_id = ? ${dateFilter}`;
    const fullQueryParams = [studentId, ...queryDateParams];
    
    const summaryQuery = `
        SELECT 
            COALESCE(SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END), 0) as present_days, 
            COUNT(*) as total_days 
        ${queryBase}`;
    const [[summary]] = await db.query(summaryQuery, fullQueryParams);
    
    const historyQuery = `SELECT attendance_date, status, subject_name, period_number ${queryBase} ORDER BY attendance_date DESC`;
    const [history] = await db.query(historyQuery, fullQueryParams);
    
    return {
        summary: {
            present_days: summary.present_days || 0,
            absent_days: (summary.total_days || 0) - (summary.present_days || 0),
            total_days: summary.total_days || 0,
        },
        history
    };
};

app.get('/api/attendance/my-history/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { viewMode, date } = req.query;
        const data = await getStudentHistory(studentId, viewMode, date);
        res.status(200).json(data);
    } catch (error) {
        console.error("GET /api/attendance/my-history Error:", error);
        res.status(500).json({ message: 'Could not fetch student history.' });
    }
});

app.get('/api/attendance/student-history-admin/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { viewMode, date } = req.query;
        const data = await getStudentHistory(studentId, viewMode, date);
        res.status(200).json(data);
    } catch (error) {
        console.error("GET /api/attendance/student-history-admin Error:", error);
        res.status(500).json({ message: 'Could not fetch student history for admin.' });
    }
});



// 📂 File: backend/server.js  (Paste this code before the app.listen() call)

// ==========================================================
// --- HEALTH API ROUTES (NEW) ---
// ==========================================================

// Endpoint for a student to get their own record
app.get('/api/health/my-record/:userId', async (req, res) => {
    const { userId } = req.params;
    const query = `
        SELECT hr.*, u.full_name 
        FROM users u
        LEFT JOIN health_records hr ON u.id = hr.user_id 
        WHERE u.id = ?`;
    try {
        const [results] = await db.query(query, [userId]);
        // If no record exists, send back an object with the user's full name.
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            const [userRows] = await db.query('SELECT full_name FROM users WHERE id = ?', [userId]);
            const userName = userRows.length > 0 ? userRows[0].full_name : 'Student';
            res.json({ full_name: userName, user_id: userId });
        }
    } catch (error) {
        console.error("GET /api/health/my-record Error:", error);
        res.status(500).json({ message: "Error fetching health record." });
    }
});

// Endpoint for Teachers/Admins to get a list of all class groups
app.get('/api/health/classes', async (req, res) => {
    const query = "SELECT DISTINCT class_group FROM users WHERE role = 'student' AND class_group IS NOT NULL AND class_group <> '' ORDER BY class_group";
    try {
        const [results] = await db.query(query);
        res.json(results.map(r => r.class_group));
    } catch (error) {
        console.error("GET /api/health/classes Error:", error);
        res.status(500).json({ message: "Error fetching classes." });
    }
});

// Endpoint for Teachers/Admins to get students by class
app.get('/api/health/students/:class_group', async (req, res) => {
    const { class_group } = req.params;
    const query = "SELECT id, full_name, username FROM users WHERE role = 'student' AND class_group = ?";
    try {
        const [results] = await db.query(query, [class_group]);
        res.json(results);
    } catch (error) {
        console.error("GET /api/health/students/:class_group Error:", error);
        res.status(500).json({ message: "Error fetching students." });
    }
});

// Endpoint for Teachers/Admins to get a specific student's health record
app.get('/api/health/record/:userId', async (req, res) => {
    const { userId } = req.params;
    const query = `SELECT hr.*, u.full_name FROM users u LEFT JOIN health_records hr ON u.id = hr.user_id WHERE u.id = ?`;
    try {
        const [results] = await db.query(query, [userId]);
        if (results.length === 0) return res.status(404).json({ message: "Student not found." });
        
        const record = results[0];
        // If the student has no health record yet, some fields will be null. Ensure user_id and full_name are present.
        if (!record.user_id) record.user_id = userId;

        res.json(record);
    } catch (error) {
        console.error("GET /api/health/record/:userId Error:", error);
        res.status(500).json({ message: "Error fetching health record." });
    }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// Endpoint for Teachers/Admins to create or update a health record
app.post('/api/health/record/:userId', async (req, res) => {
    const studentUserId = req.params.userId;
    const { editorId, blood_group, height_cm, weight_kg, last_checkup_date, allergies, medical_conditions, medications } = req.body;
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Insert or update the health record
        const query = `
            INSERT INTO health_records (user_id, blood_group, height_cm, weight_kg, last_checkup_date, allergies, medical_conditions, medications, last_updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            blood_group = VALUES(blood_group), height_cm = VALUES(height_cm), weight_kg = VALUES(weight_kg), last_checkup_date = VALUES(last_checkup_date),
            allergies = VALUES(allergies), medical_conditions = VALUES(medical_conditions), medications = VALUES(medications), last_updated_by = VALUES(last_updated_by);
        `;
        const values = [studentUserId, blood_group, height_cm, weight_kg, last_checkup_date || null, allergies, medical_conditions, medications, editorId];
        await connection.query(query, values);

        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★
        
        // 1. Get the name of the teacher/admin who made the change
        const [[editor]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [editorId]);
        const senderName = editor.full_name || "School Health Department";

        // 2. Prepare the notification details
        const notificationTitle = "Health Record Updated";
        const notificationMessage = `Your health information has been updated. Please review the details in the Health Info section.`;
        
        // 3. Send a single notification to the affected student
        await createNotification(
            connection,
            studentUserId,
            senderName,
            notificationTitle,
            notificationMessage,
            '/health-info' // A generic link to the health info screen
        );

        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★
        
        await connection.commit();
        res.status(200).json({ message: "Health record saved and student notified successfully." });

    } catch (error) {
        await connection.rollback();
        console.error("POST /api/health/record/:userId Error:", error);
        res.status(500).json({ message: "Failed to save health record." });
    } finally {
        connection.release();
    }
});

// ==========================================================
// --- SPORTS API ROUTES (NEW) ---
// ==========================================================

// STUDENT: Get a list of activities a specific student is registered for.
app.get('/api/sports/my-registrations/:userId', async (req, res) => {
    const { userId } = req.params;
    const query = `
        SELECT sa.name, sa.team_name, sa.coach_name, sa.schedule_details, ar.achievements
        FROM activity_registrations ar
        JOIN sports_activities sa ON ar.activity_id = sa.id
        WHERE ar.student_id = ? AND ar.status = 'Approved'`;
    try {
        const [registrations] = await db.query(query, [userId]);
        res.json(registrations);
    } catch (error) { res.status(500).json({ message: 'Error fetching registrations.' }); }
});

// STUDENT: Get a list of all available activities they haven't applied for yet.
app.get('/api/sports/available/:userId', async (req, res) => {
    const { userId } = req.params;
    const query = `
        SELECT * FROM sports_activities 
        WHERE is_active = TRUE AND id NOT IN 
        (SELECT activity_id FROM activity_registrations WHERE student_id = ?)`;
    try {
        const [activities] = await db.query(query, [userId]);
        res.json(activities);
    } catch (error) { res.status(500).json({ message: 'Error fetching available activities.' }); }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// STUDENT: Apply for an activity.
app.post('/api/sports/apply', async (req, res) => {
    const { userId, activityId } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Create the registration record
        await connection.query('INSERT INTO activity_registrations (student_id, activity_id) VALUES (?, ?)', [userId, activityId]);
        
        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★
        
        // 1. Find all admins
        const [admins] = await connection.query("SELECT id FROM users WHERE role = 'admin'");
        let recipientIds = admins.map(a => a.id);

        // 2. Find the student and activity details for the message
        const [[student]] = await connection.query("SELECT full_name, class_group FROM users WHERE id = ?", [userId]);
        const [[activity]] = await connection.query("SELECT name, coach_name FROM sports_activities WHERE id = ?", [activityId]);

        // 3. If there's a specific coach, find their ID and add them to the recipients
        if (activity.coach_name) {
            const [[coach]] = await connection.query("SELECT id FROM users WHERE full_name = ? AND role = 'teacher'", [activity.coach_name]);
            if (coach) {
                recipientIds.push(coach.id);
            }
        }
        
        // 4. Prepare and send notifications
        const uniqueRecipientIds = [...new Set(recipientIds)]; // Ensure no duplicate notifications
        if (uniqueRecipientIds.length > 0) {
            const notificationTitle = `New Sports Application`;
            const notificationMessage = `${student.full_name} (${student.class_group}) has applied for ${activity.name}.`;
            
            await createBulkNotifications(
                connection,
                uniqueRecipientIds,
                student.full_name,
                notificationTitle,
                notificationMessage,
                '/admin/sports' // A generic link for admins/teachers
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★
        
        await connection.commit();
        res.status(201).json({ message: 'Successfully applied!' });

    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'You have already applied for this activity.' });
        }
        console.error("Error applying for sport:", error);
        res.status(500).json({ message: 'Error applying for activity.' });
    } finally {
        connection.release();
    }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// ADMIN/TEACHER: Create a new sport/activity.
app.post('/api/sports', async (req, res) => {
    const { name, team_name, coach_name, schedule_details, description, created_by } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Create the sports activity
        const query = 'INSERT INTO sports_activities (name, team_name, coach_name, schedule_details, description, created_by) VALUES (?, ?, ?, ?, ?, ?)';
        await connection.query(query, [name, team_name, coach_name, schedule_details, description, created_by]);

        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★
        
        // 1. Find all students
        const [students] = await connection.query("SELECT id FROM users WHERE role = 'student'");
        
        if (students.length > 0) {
            // 2. Get the creator's name
            const [[creator]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [created_by]);
            const senderName = creator.full_name || "Sports Department";

            // 3. Prepare and send notifications
            const studentIds = students.map(s => s.id);
            const notificationTitle = `New Sport Available: ${name}`;
            const notificationMessage = `Registrations are now open for ${name}. Visit the sports section to apply!`;

            await createBulkNotifications(
                connection,
                studentIds,
                senderName,
                notificationTitle,
                notificationMessage,
                '/sports' // Generic link to the sports screen
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★

        await connection.commit();
        res.status(201).json({ message: 'Activity created and students notified successfully!' });

    } catch (error) {
        await connection.rollback();
        console.error("Error creating sport activity:", error);
        res.status(500).json({ message: 'Error creating activity.' });
    } finally {
        connection.release();
    }
});

// ADMIN/TEACHER: Get all activities for management view.
app.get('/api/sports/all', async (req, res) => {
    const query = `
        SELECT sa.*, COUNT(ar.id) as application_count 
        FROM sports_activities sa 
        LEFT JOIN activity_registrations ar ON sa.id = ar.activity_id AND ar.status = 'Applied'
        GROUP BY sa.id ORDER BY sa.created_at DESC`;
    try {
        const [activities] = await db.query(query);
        res.json(activities);
    } catch (error) { res.status(500).json({ message: 'Error fetching all activities.' }); }
});

// ADMIN/TEACHER: Get all applications (Applied, Approved) for a specific activity.
app.get('/api/sports/applications/:activityId', async (req, res) => {
    const { activityId } = req.params;
    const query = `
        SELECT ar.id as registration_id, ar.status, ar.achievements, ar.remarks, u.id as student_id, u.full_name, ar.registration_date
        FROM activity_registrations ar
        JOIN users u ON ar.student_id = u.id
        WHERE ar.activity_id = ?
        ORDER BY ar.registration_date DESC`; // Order by most recent application first
    try {
        const [applications] = await db.query(query, [activityId]);
        res.json(applications);
    } catch (error) { res.status(500).json({ message: 'Error fetching applications.' }); }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// ADMIN/TEACHER: Update an application's status (Approve/Reject).
app.put('/api/sports/application/status', async (req, res) => {
    const { registrationId, status, adminId } = req.body; // Assuming adminId is sent from the frontend
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Update the application status
        await connection.query('UPDATE activity_registrations SET status = ? WHERE id = ?', [status, registrationId]);
        
        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★

        // 1. Get details about the application for the message
        const [[registration]] = await connection.query(`
            SELECT ar.student_id, sa.name AS activity_name
            FROM activity_registrations ar
            JOIN sports_activities sa ON ar.activity_id = sa.id
            WHERE ar.id = ?
        `, [registrationId]);

        if (registration) {
            // 2. Get the admin's name
            const [[admin]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [adminId]);
            const senderName = admin.full_name || "Sports Department";

            // 3. Prepare notification details
            const notificationTitle = `Application ${status}`;
            const notificationMessage = `Your application for ${registration.activity_name} has been ${status}.`;

            // 4. Send a single notification to the student
            await createNotification(
                connection,
                registration.student_id,
                senderName,
                notificationTitle,
                notificationMessage,
                '/my-registrations' // A hypothetical link to their sports page
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★

        await connection.commit();
        res.status(200).json({ message: `Application status updated to ${status}` });

    } catch (error) {
        await connection.rollback();
        console.error("Error updating application status:", error);
        res.status(500).json({ message: 'Error updating status.' });
    } finally {
        connection.release();
    }
});

// ADMIN/TEACHER: Update a student's achievements for a registration.
app.put('/api/sports/application/achievements', async (req, res) => {
    const { registrationId, achievements } = req.body;
    try {
        await db.query('UPDATE activity_registrations SET achievements = ? WHERE id = ?', [achievements, registrationId]);
        res.status(200).json({ message: 'Achievements updated successfully!' });
    } catch (error) { res.status(500).json({ message: 'Error updating achievements.' }); }
});
// ADMIN/TEACHER: Update an application's remarks.
app.put('/api/sports/application/remarks', async (req, res) => {
    const { registrationId, remarks } = req.body;
    try {
        await db.query('UPDATE activity_registrations SET remarks = ? WHERE id = ?', [remarks, registrationId]);
        res.status(200).json({ message: 'Remarks updated successfully!' });
    } catch (error) { res.status(500).json({ message: 'Error updating remarks.' }); }
});

// ==========================================================
// --- EVENTS API ROUTES (NEW) ---
// ==========================================================

// STUDENT: Get all upcoming events, along with the student's RSVP status for each.
app.get('/api/events/all-for-student/:userId', async (req, res) => {
    const { userId } = req.params;
    const query = `
        SELECT e.*, er.status as rsvp_status
        FROM events e
        LEFT JOIN event_rsvps er ON e.id = er.event_id AND er.student_id = ?
        WHERE e.event_datetime >= CURDATE()
        ORDER BY e.event_datetime ASC`;
    try {
        const [events] = await db.query(query, [userId]);
        res.json(events);
    } catch (error) { console.error(error); res.status(500).json({ message: 'Error fetching events.' }); }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// STUDENT: RSVP for an event.
app.post('/api/events/rsvp', async (req, res) => {
    const { eventId, userId } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Insert the RSVP
        await connection.query('INSERT INTO event_rsvps (event_id, student_id) VALUES (?, ?)', [eventId, userId]);
        
        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★

        // 1. Find all admins
        const [admins] = await connection.query("SELECT id FROM users WHERE role = 'admin'");
        
        if (admins.length > 0) {
            // 2. Get details for the notification message
            const [[student]] = await connection.query("SELECT full_name, class_group FROM users WHERE id = ?", [userId]);
            const [[event]] = await connection.query("SELECT title FROM events WHERE id = ?", [eventId]);

            // 3. Prepare and send notifications
            const adminIds = admins.map(a => a.id);
            const notificationTitle = "New Event RSVP";
            const notificationMessage = `${student.full_name} (${student.class_group}) has RSVP'd for the "${event.title}" event.`;
            
            await createBulkNotifications(
                connection,
                adminIds,
                student.full_name,
                notificationTitle,
                notificationMessage,
                '/admin/events' // A link for admins to see the event list
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★
        
        await connection.commit();
        res.status(201).json({ message: 'RSVP successful! Awaiting approval.' });

    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'You have already RSVP\'d for this event.' });
        }
        console.error("Error processing RSVP:", error);
        res.status(500).json({ message: 'Error processing RSVP.' });
    } finally {
        connection.release();
    }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// ADMIN/TEACHER: Create a new event.
app.post('/api/events', async (req, res) => {
    const { title, category, event_datetime, location, description, rsvp_required, created_by } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Create the event
        const query = 'INSERT INTO events (title, category, event_datetime, location, description, rsvp_required, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)';
        await connection.query(query, [title, category, event_datetime, location, description, rsvp_required, created_by]);

        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★
        
        // 1. Find all students and teachers (excluding the creator)
        const [usersToNotify] = await connection.query("SELECT id FROM users WHERE role IN ('student', 'teacher') AND id != ?", [created_by]);
        
        if (usersToNotify.length > 0) {
            // 2. Get the creator's name
            const [[creator]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [created_by]);
            const senderName = creator.full_name || "School Administration";

            // 3. Prepare and send notifications
            const recipientIds = usersToNotify.map(u => u.id);
            const notificationTitle = `New Event: ${title}`;
            const eventDate = new Date(event_datetime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const notificationMessage = `Join us for the "${title}" event on ${eventDate}. Check the events section for details.`;

            await createBulkNotifications(
                connection,
                recipientIds,
                senderName,
                notificationTitle,
                notificationMessage,
                '/events' // Generic link to the events screen
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★

        await connection.commit();
        res.status(201).json({ message: 'Event created and users notified successfully!' });

    } catch (error) {
        await connection.rollback();
        console.error("Error creating event:", error);
        res.status(500).json({ message: 'Error creating event.' });
    } finally {
        connection.release();
    }
});

// ADMIN/TEACHER: Get all events for the management view.
app.get('/api/events/all-for-admin', async (req, res) => {
    const query = `
        SELECT e.*, COUNT(er.id) as rsvp_count 
        FROM events e
        LEFT JOIN event_rsvps er ON e.id = er.event_id AND er.status = 'Applied'
        GROUP BY e.id ORDER BY e.event_datetime DESC`;
    try {
        const [events] = await db.query(query);
        res.json(events);
    } catch (error) { console.error(error); res.status(500).json({ message: 'Error fetching admin event list.' }); }
});

// ADMIN/TEACHER: Get all RSVPs (all statuses) for a specific event.
app.get('/api/events/rsvps/:eventId', async (req, res) => {
    const { eventId } = req.params;
    const query = `
        SELECT r.id as rsvp_id, r.status, u.id as student_id, u.full_name, r.rsvp_date
        FROM event_rsvps r
        JOIN users u ON r.student_id = u.id
        WHERE r.event_id = ?
        ORDER BY r.rsvp_date DESC`;
    try {
        const [rsvps] = await db.query(query, [eventId]);
        res.json(rsvps);
    } catch (error) { console.error(error); res.status(500).json({ message: 'Error fetching RSVPs.' }); }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// ADMIN/TEACHER: Update an RSVP status (Approve/Reject).
app.put('/api/events/rsvp/status', async (req, res) => {
    const { rsvpId, status, adminId } = req.body; // Expect adminId from the frontend
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Update the RSVP status
        await connection.query('UPDATE event_rsvps SET status = ? WHERE id = ?', [status, rsvpId]);
        
        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★

        // 1. Get details about the RSVP for the message
        const [[rsvpDetails]] = await connection.query(`
            SELECT r.student_id, e.title AS event_title
            FROM event_rsvps r
            JOIN events e ON r.event_id = e.id
            WHERE r.id = ?
        `, [rsvpId]);

        if (rsvpDetails) {
            // 2. Get the admin's name
            const [[admin]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [adminId]);
            const senderName = admin.full_name || "School Administration";

            // 3. Prepare notification details
            const notificationTitle = `RSVP ${status}`;
            const notificationMessage = `Your RSVP for the event "${rsvpDetails.event_title}" has been ${status}.`;

            // 4. Send a single notification to the student
            await createNotification(
                connection,
                rsvpDetails.student_id,
                senderName,
                notificationTitle,
                notificationMessage,
                '/events' // Link to the student's event screen
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★
        
        await connection.commit();
        res.status(200).json({ message: `RSVP status updated.` });

    } catch (error) {
        await connection.rollback();
        console.error("Error updating RSVP status:", error);
        res.status(500).json({ message: 'Error updating RSVP status.' });
    } finally {
        connection.release();
    }
});

// STUDENT: Get full details for a SINGLE event, including their specific RSVP.
app.get('/api/events/details/:eventId/:userId', async (req, res) => {
    const { eventId, userId } = req.params;

    // First query: Get the main event details
    const eventQuery = 'SELECT * FROM events WHERE id = ?';
    
    // Second query: Get the specific student's RSVP for this event
    const rsvpQuery = 'SELECT * FROM event_rsvps WHERE event_id = ? AND student_id = ?';

    try {
        const [eventResult] = await db.query(eventQuery, [eventId]);
        if (eventResult.length === 0) {
            return res.status(404).json({ message: 'Event not found.' });
        }
        
        const [rsvpResult] = await db.query(rsvpQuery, [eventId, userId]);

        const eventDetails = eventResult[0];
        const rsvpDetails = rsvpResult.length > 0 ? rsvpResult[0] : null;

        // Combine the results into a single response object
        res.json({
            event: eventDetails,
            rsvp: rsvpDetails
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching event details.' });
    }
});

// ==========================================================
// --- HELP DESK API ROUTES (NEW) ---
// ==========================================================

// ANY USER: Get all FAQs
app.get('/api/helpdesk/faqs', async (req, res) => {
    try {
        const [faqs] = await db.query('SELECT * FROM faqs ORDER BY id');
        res.json(faqs);
    } catch (error) { res.status(500).json({ message: 'Error fetching FAQs.' }); }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// STUDENT/TEACHER: Submit a new ticket
app.post('/api/helpdesk/submit', async (req, res) => {
    const { userId, subject, description } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Insert the ticket
        await connection.query('INSERT INTO helpdesk_tickets (user_id, subject, description) VALUES (?, ?, ?)', [userId, subject, description]);
        
        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★

        // 1. Find all admins
        const [admins] = await connection.query("SELECT id FROM users WHERE role = 'admin'");
        
        if (admins.length > 0) {
            // 2. Get the submitter's details for the message
            const [[submitter]] = await connection.query("SELECT full_name, role FROM users WHERE id = ?", [userId]);

            // 3. Prepare and send notifications
            const adminIds = admins.map(a => a.id);
            const notificationTitle = `New Help Desk Ticket`;
            const notificationMessage = `${submitter.full_name} (${submitter.role}) has submitted a new ticket: "${subject}"`;
            
            await createBulkNotifications(
                connection,
                adminIds,
                submitter.full_name,
                notificationTitle,
                notificationMessage,
                '/admin/helpdesk' // A link for admins to view the ticket list
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★
        
        await connection.commit();
        res.status(201).json({ message: 'Query submitted successfully! We will get back to you soon.' });

    } catch (error) {
        await connection.rollback();
        console.error("Error submitting help desk ticket:", error);
        res.status(500).json({ message: 'Error submitting query.' });
    } finally {
        connection.release();
    }
});

// STUDENT/TEACHER: Get history of their own tickets
app.get('/api/helpdesk/my-tickets/:userId', async (req, res) => {
    const { userId } = req.params;
    const query = 'SELECT id, subject, status, last_updated_at FROM helpdesk_tickets WHERE user_id = ? ORDER BY last_updated_at DESC';
    try {
        const [tickets] = await db.query(query, [userId]);
        res.json(tickets);
    } catch (error) { res.status(500).json({ message: 'Error fetching your tickets.' }); }
});

// ADMIN: Get all tickets from all users for the management dashboard
app.get('/api/helpdesk/all-tickets', async (req, res) => {
    const { status } = req.query; // Filter by status, e.g., ?status=Open
    let query = `
    SELECT t.id, t.subject, t.status, t.last_updated_at, u.full_name as user_name, u.role, u.class_group
    FROM helpdesk_tickets t
    JOIN users u ON t.user_id = u.id `;
    const params = [];
    if (status) {
        query += 'WHERE t.status = ? ';
        params.push(status);
    }
    query += 'ORDER BY t.last_updated_at DESC';
    try {
        const [tickets] = await db.query(query, params);
        res.json(tickets);
    } catch (error) { res.status(500).json({ message: 'Error fetching all tickets.' }); }
});

// ANY USER: Get full conversation for a single ticket
app.get('/api/helpdesk/ticket/:ticketId', async (req, res) => {
    try {
        const ticketQuery = 'SELECT t.*, u.full_name as user_name, u.role, u.class_group FROM helpdesk_tickets t JOIN users u ON t.user_id = u.id WHERE t.id = ?';
        const repliesQuery = 'SELECT r.*, u.full_name, u.role FROM ticket_replies r JOIN users u ON r.user_id = u.id WHERE r.ticket_id = ? ORDER BY r.created_at ASC';
        
        const [[ticket]] = await db.query(ticketQuery, [req.params.ticketId]);
        const [replies] = await db.query(repliesQuery, [req.params.ticketId]);

        if (!ticket) return res.status(404).json({ message: 'Ticket not found.' });
        res.json({ ticket, replies });
    } catch (error) { res.status(500).json({ message: 'Error fetching ticket details.' }); }
});

// ANY USER: Post a reply to a ticket
// 📂 File: backend/server.js (Replace this route)

// ANY USER: Post a reply to a ticket
// 📂 File: server.js (REPLACE THIS ROUTE)

// ANY USER: Post a reply to a ticket
app.post('/api/helpdesk/reply', async (req, res) => {
    const { ticketId, userId, replyText } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Insert the reply and update the timestamp (no changes here)
        await connection.query('INSERT INTO ticket_replies (ticket_id, user_id, reply_text) VALUES (?, ?, ?)', [ticketId, userId, replyText]);
        await connection.query('UPDATE helpdesk_tickets SET last_updated_at = CURRENT_TIMESTAMP WHERE id = ?', [ticketId]);

        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★
        
        // 1. Get info about the replier and the ticket's original creator
        const [[replier]] = await connection.query("SELECT full_name, role FROM users WHERE id = ?", [userId]);
        const [[ticket]] = await connection.query("SELECT user_id, subject FROM helpdesk_tickets WHERE id = ?", [ticketId]);

        // 2. CASE A: An admin replied. Notify the original ticket creator.
        if (replier.role === 'admin') {
            const originalCreatorId = ticket.user_id;
            // Ensure admin doesn't get notified for their own reply
            if (originalCreatorId !== userId) { 
                const notificationTitle = `Reply on Ticket: "${ticket.subject}"`;
                const notificationMessage = `${replier.full_name} has replied to your help desk ticket.`;
                await createNotification(connection, originalCreatorId, replier.full_name, notificationTitle, notificationMessage, `/helpdesk/ticket/${ticketId}`);
            }
        } 
        // 3. CASE B: A student or teacher replied. Notify all admins.
        else {
            const [admins] = await connection.query("SELECT id FROM users WHERE role = 'admin'");
            if (admins.length > 0) {
                const adminIds = admins.map(a => a.id);
                const notificationTitle = `Reply on Ticket: "${ticket.subject}"`;
                const notificationMessage = `${replier.full_name} has replied to a help desk ticket.`;
                await createBulkNotifications(connection, adminIds, replier.full_name, notificationTitle, notificationMessage, `/admin/helpdesk/ticket/${ticketId}`);
            }
        }
        
        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★

        await connection.commit();
        res.status(201).json({ message: 'Reply posted successfully.' });

    } catch (error) {
        await connection.rollback();
        console.error("Reply Error:", error);
        res.status(500).json({ message: 'Error posting reply.' });
    } finally {
        connection.release();
    }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// ADMIN: Change a ticket's status
app.put('/api/helpdesk/ticket/status', async (req, res) => {
    const { ticketId, status, adminId, adminName } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Update status and add auto-reply (no changes here)
        await connection.query('UPDATE helpdesk_tickets SET status = ? WHERE id = ?', [status, ticketId]);
        const autoReply = `Admin ${adminName} has updated the status to: ${status}.`;
        await connection.query('INSERT INTO ticket_replies (ticket_id, user_id, reply_text) VALUES (?, ?, ?)', [ticketId, adminId, autoReply]);

        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★

        // 1. Get the ticket details to find the original creator
        const [[ticket]] = await connection.query("SELECT user_id, subject FROM helpdesk_tickets WHERE id = ?", [ticketId]);

        if (ticket) {
            // 2. Prepare notification details
            const notificationTitle = `Ticket Status Updated: "${ticket.subject}"`;
            const notificationMessage = `The status of your ticket has been updated to "${status}" by ${adminName}.`;
            
            // 3. Send a notification to the original creator
            await createNotification(
                connection,
                ticket.user_id,
                adminName,
                notificationTitle,
                notificationMessage,
                `/helpdesk/ticket/${ticketId}`
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★

        await connection.commit();
        res.status(200).json({ message: 'Status updated.' });
    } catch (error) {
        await connection.rollback();
        console.error("Error updating ticket status:", error);
        res.status(500).json({ message: 'Error updating status.' });
    } finally {
        connection.release();
    }
});


// ==========================================================
// --- DONOR HELP DESK API ROUTES (NEW - PUBLIC & ADMIN) ---
// ==========================================================

// 📂 File: server.js (REPLACE THIS ROUTE)

// PUBLIC: A donor submits a new query
app.post('/api/donor/submit-query', async (req, res) => {
    const { donor_name, donor_email, subject, description } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Insert the donor's query
        const [result] = await connection.query(
            'INSERT INTO donor_queries (donor_name, donor_email, subject, description) VALUES (?, ?, ?, ?)',
            [donor_name, donor_email, subject, description]
        );
        const newQueryId = result.insertId;

        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★

        // 1. Find all admins to notify them of the new query
        const [admins] = await connection.query("SELECT id FROM users WHERE role = 'admin'");
        
        if (admins.length > 0) {
            // 2. Prepare notification details
            const adminIds = admins.map(a => a.id);
            const notificationTitle = `New Donor Query`;
            const notificationMessage = `A new query has been submitted by ${donor_name} regarding "${subject}".`;
            const senderName = donor_name; // The donor is the sender

            // 3. Send notifications to all admins
            await createBulkNotifications(
                connection,
                adminIds,
                senderName,
                notificationTitle,
                notificationMessage,
                `/admin/donor-queries/${newQueryId}` // A hypothetical link to view the specific query
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★

        await connection.commit();
        res.status(201).json({ 
            message: 'Query submitted! Please save your Ticket ID to check the status later.',
            ticketId: newQueryId
        });

    } catch (error) {
        await connection.rollback();
        console.error("Error submitting donor query:", error);
        res.status(500).json({ message: 'Error submitting query.' });
    } finally {
        connection.release();
    }
});

// PUBLIC: A donor checks the status and history of their query using a Ticket ID
app.get('/api/donor/query-status/:ticketId', async (req, res) => {
    const { ticketId } = req.params;
    try {
        const [[queryDetails]] = await db.query('SELECT * FROM donor_queries WHERE id = ?', [ticketId]);
        if (!queryDetails) return res.status(404).json({ message: 'Ticket ID not found.' });
        
        const [replies] = await db.query('SELECT * FROM donor_query_replies WHERE query_id = ? ORDER BY created_at ASC', [ticketId]);
        res.json({ details: queryDetails, replies });
    } catch (error) { res.status(500).json({ message: 'Error fetching query status.' }); }
});

// ADMIN: Get all donor queries for the management dashboard
app.get('/api/admin/donor-queries', async (req, res) => {
    const { status } = req.query;
    let query = 'SELECT * FROM donor_queries ';
    const params = [];
    if (status) {
        query += 'WHERE status = ? ';
        params.push(status);
    }
    query += 'ORDER BY last_updated_at DESC';
    try {
        const [queries] = await db.query(query, params);
        res.json(queries);
    } catch (error) { res.status(500).json({ message: 'Error fetching donor queries.' }); }
});

// ADMIN: Post a reply to a donor's query
app.post('/api/admin/donor-reply', async (req, res) => {
    const { queryId, replyText } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('INSERT INTO donor_query_replies (query_id, is_admin_reply, reply_text) VALUES (?, TRUE, ?)', [queryId, replyText]);
        // Set status to In Progress when admin replies
        await connection.query("UPDATE donor_queries SET status = 'In Progress', last_updated_at = CURRENT_TIMESTAMP WHERE id = ?", [queryId]);
        await connection.commit();
        res.status(201).json({ message: 'Reply posted.' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: 'Error posting reply.' });
    } finally {
        connection.release();
    }
});

// ADMIN: Change a donor query's status
app.put('/api/admin/donor-query/status', async (req, res) => {
    const { queryId, status } = req.body;
    try {
        await db.query('UPDATE donor_queries SET status = ?, last_updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, queryId]);
        res.status(200).json({ message: `Status updated to ${status}.` });
    } catch (error) { res.status(500).json({ message: 'Error updating status.' }); }
});


// ==========================================================
// --- PARENT-TEACHER MEETING (PTM) API ROUTES (CORRECTED) --
// ==========================================================

// GET meetings (role-aware filtering)
// ★★★ This is the main fix for the student view ★★★
app.get('/api/ptm', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        // Admins and teachers see all meetings
        if (userRole === 'admin' || userRole === 'teacher') {
            const query = `SELECT * FROM ptm_meetings ORDER BY meeting_datetime DESC`;
            const [meetings] = await db.query(query);
            return res.status(200).json(meetings);
        }

        // Students (and parents, if applicable) only see meetings for their class or for 'All' classes
        if (userRole === 'student' || userRole === 'parent') {
            // First, get the student's class_group from the database using their ID from the token
            const [[user]] = await db.query('SELECT class_group FROM users WHERE id = ?', [userId]);
            
            if (!user || !user.class_group) {
                 // If a student has no class, they should still see school-wide meetings
                 const query = `SELECT * FROM ptm_meetings WHERE class_group = 'All' ORDER BY meeting_datetime DESC`;
                 const [meetings] = await db.query(query);
                 return res.status(200).json(meetings);
            }

            const studentClassGroup = user.class_group;
            const query = `
                SELECT * FROM ptm_meetings 
                WHERE class_group = ? OR class_group = 'All' 
                ORDER BY meeting_datetime DESC
            `;
            const [meetings] = await db.query(query, [studentClassGroup]);
            return res.status(200).json(meetings);
        }
        
        // Deny access for any other roles by default
        res.status(403).json({ message: "You do not have permission to view PTM schedules." });

    } catch (error) {
        console.error("GET /api/ptm Error:", error);
        res.status(500).json({ message: 'Error fetching PTM schedules.' });
    }
});

// GET list of all teachers for the form
app.get('/api/ptm/teachers', verifyToken, async (req, res) => {
    try {
        const [teachers] = await db.query("SELECT id, full_name FROM users WHERE role = 'teacher' ORDER BY full_name ASC");
        res.status(200).json(teachers);
    } catch (error) {
        console.error("GET /api/ptm/teachers Error:", error);
        res.status(500).json({ message: 'Could not fetch the list of teachers.' });
    }
});

// GET a unique list of all classes for the form
app.get('/api/ptm/classes', verifyToken, async (req, res) => {
    try {
        const query = "SELECT DISTINCT class_group FROM users WHERE class_group IS NOT NULL AND class_group != '' ORDER BY class_group ASC";
        const [results] = await db.query(query);
        const classes = results.map(item => item.class_group);
        res.status(200).json(classes);
    } catch (error) {
        console.error("GET /api/ptm/classes Error:", error);
        res.status(500).json({ message: 'Could not fetch the list of classes.' });
    }
});


// POST a new meeting
// ★★★ This is the fix for notifications when selecting "All Classes" ★★★
app.post('/api/ptm', verifyToken, async (req, res) => {
    const { meeting_datetime, teacher_id, class_group, subject_focus, notes, meeting_link } = req.body; 
    const created_by = req.user.id; // Get creator's ID securely from the token
    
    if (!meeting_datetime || !teacher_id || !subject_focus || !class_group) {
        return res.status(400).json({ message: 'Meeting Date, Teacher, Class, and Subject are required.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [[teacher]] = await connection.query('SELECT full_name FROM users WHERE id = ?', [teacher_id]);
        if (!teacher) {
            await connection.rollback();
            return res.status(404).json({ message: 'Selected teacher not found.' });
        }
        
        const query = `INSERT INTO ptm_meetings (meeting_datetime, teacher_id, teacher_name, class_group, subject_focus, notes, meeting_link) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        await connection.query(query, [meeting_datetime, teacher_id, teacher.full_name, class_group, subject_focus, notes || null, meeting_link || null]);

        // --- MODIFIED NOTIFICATION LOGIC ---
        
        let studentsQuery = "SELECT id FROM users WHERE role = 'student'";
        const queryParams = [];
        
        if (class_group !== 'All') {
            studentsQuery += " AND class_group = ?";
            queryParams.push(class_group);
        }
        // If class_group is 'All', the query selects all students.

        const [students] = await connection.query(studentsQuery, queryParams);
        
        const studentIds = students.map(s => s.id);
        const allRecipientIds = [...new Set([parseInt(teacher_id, 10), ...studentIds])]; 

        if (allRecipientIds.length > 0) {
            const senderName = req.user.full_name || "School Administration";

            const displayClass = class_group === 'All' ? 'all classes' : class_group;
            const notificationTitle = `New PTM: ${class_group === 'All' ? 'All Classes' : class_group}`;
            const eventDate = new Date(meeting_datetime).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
            const notificationMessage = `A PTM for ${displayClass} regarding "${subject_focus}" with ${teacher.full_name} has been scheduled for ${eventDate}.`;

            await createBulkNotifications(
                connection,
                allRecipientIds,
                senderName,
                notificationTitle,
                notificationMessage,
                '/ptm'
            );
        }
        
        await connection.commit();
        res.status(201).json({ message: 'Meeting scheduled and users notified successfully!' });

    } catch (error) {
        await connection.rollback();
        console.error("POST /api/ptm Error:", error);
        res.status(500).json({ message: 'An error occurred while scheduling the meeting.' });
    } finally {
        connection.release();
    }
});

// PUT (update) an existing meeting
app.put('/api/ptm/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { status, notes, meeting_link } = req.body;

    if (status === undefined) {
         return res.status(400).json({ message: 'Status must be provided for an update.' });
    }

    try {
        const query = 'UPDATE ptm_meetings SET status = ?, notes = ?, meeting_link = ? WHERE id = ?';
        const [result] = await db.query(query, [status, notes || null, meeting_link || null, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Meeting not found.' });
        }
        res.status(200).json({ message: 'Meeting updated successfully!' });
    } catch (error) {
        console.error("PUT /api/ptm/:id Error:", error);
        res.status(500).json({ message: 'An error occurred while updating the meeting.' });
    }
});

// DELETE a meeting
app.delete('/api/ptm/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const query = 'DELETE FROM ptm_meetings WHERE id = ?';
        const [result] = await db.query(query, [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Meeting not found.' });
        }
        res.status(200).json({ message: 'Meeting deleted successfully.' });
    } catch (error) {
        console.error("DELETE /api/ptm/:id Error:", error);
        res.status(500).json({ message: 'An error occurred while deleting the meeting.' });
    }
});


// ==========================================================
// --- DIGITAL LABS API ROUTES (NEW) ---
// ==========================================================
// This section handles creating, fetching, and managing digital lab resources.
// It uses the 'upload' multer instance you already configured.

// GET all digital labs (Publicly accessible for students to view)
// ★ 1. MODIFIED: GET labs for a specific STUDENT's class
app.get('/api/labs/student/:classGroup', async (req, res) => {
    const { classGroup } = req.params;
    try {
        // This query fetches labs assigned to the specific class OR labs assigned to ALL classes (where class_group is NULL)
        const query = `
            SELECT * FROM digital_labs 
            WHERE class_group = ? OR class_group IS NULL OR class_group = ''
            ORDER BY created_at DESC
        `;
        const [labs] = await db.query(query, [classGroup]);
        res.status(200).json(labs);
    } catch (error) {
        console.error("GET /api/labs/student/:classGroup Error:", error);
        res.status(500).json({ message: 'Error fetching digital labs.' });
    }
});

// ★ 2. MODIFIED: GET all labs created by a specific TEACHER (for the manage screen)
app.get('/api/labs/teacher/:teacherId', async (req, res) => {
    const { teacherId } = req.params;
    try {
        const query = `SELECT * FROM digital_labs WHERE created_by = ? ORDER BY created_at DESC`;
        const [labs] = await db.query(query, [teacherId]);
        res.status(200).json(labs);
    } catch (error) {
        console.error("GET /api/labs/teacher/:teacherId Error:", error);
        res.status(500).json({ message: 'Error fetching labs.' });
    }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// ★ 3. MODIFIED: POST a new digital lab (with class_group)
app.post('/api/labs', upload.fields([{ name: 'coverImage', maxCount: 1 }, { name: 'labFile', maxCount: 1 }]), async (req, res) => {
    // Add class_group to the destructured body
    const { title, subject, lab_type, class_group, description, access_url, created_by } = req.body;

    const coverImageFile = req.files['coverImage'] ? req.files['coverImage'][0] : null;
    const labFile = req.files['labFile'] ? req.files['labFile'][0] : null;

    const cover_image_url = coverImageFile ? `/uploads/${coverImageFile.filename}` : null;
    const file_path = labFile ? `/uploads/${labFile.filename}` : null;
    
    if (!access_url && !file_path) {
        return res.status(400).json({ message: 'You must provide either an Access URL or upload a Lab File.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Update INSERT query to include class_group
        const query = `
            INSERT INTO digital_labs (title, subject, lab_type, class_group, description, access_url, file_path, cover_image_url, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await connection.query(query, [title, subject, lab_type, class_group || null, description, access_url || null, file_path, cover_image_url, created_by || null]);
        
        // --- MODIFIED NOTIFICATION LOGIC ---
        let usersToNotifyQuery;
        // If a class is specified, notify only that class. Otherwise, notify all students and teachers.
        if (class_group) {
             usersToNotifyQuery = connection.query("SELECT id FROM users WHERE role = 'student' AND class_group = ? AND id != ?", [class_group, created_by]);
        } else {
             usersToNotifyQuery = connection.query("SELECT id FROM users WHERE role IN ('student', 'teacher') AND id != ?", [created_by]);
        }
        const [usersToNotify] = await usersToNotifyQuery;
        
        if (usersToNotify.length > 0) {
            const [[creator]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [created_by]);
            const senderName = creator.full_name || "School Administration";
            const recipientIds = usersToNotify.map(u => u.id);
            const notificationTitle = `New Digital Lab: ${subject}`;
            const notificationMessage = `A new lab titled "${title}" has been added.`;

            await createBulkNotifications(connection, recipientIds, senderName, notificationTitle, notificationMessage, '/labs');
        }
        
        await connection.commit();
        res.status(201).json({ message: 'Digital lab created and users notified successfully!' });
    } catch (error) {
        await connection.rollback();
        console.error("POST /api/labs Error:", error);
        res.status(500).json({ message: 'Error creating digital lab.' });
    } finally {
        connection.release();
    }
});

// ... inside the DIGITAL LABS API ROUTES section ...


// 📂 File: server.js (REPLACE THIS ROUTE)

// ★ 4. MODIFIED: UPDATE an existing lab (with class_group)
app.put('/api/labs/:id', upload.fields([{ name: 'coverImage', maxCount: 1 }, { name: 'labFile', maxCount: 1 }]), async (req, res) => {
    const { id } = req.params;
    // Add class_group
    const { title, subject, lab_type, class_group, description, access_url, created_by } = req.body;
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [existingLabRows] = await connection.query('SELECT cover_image_url, file_path FROM digital_labs WHERE id = ?', [id]);
        if (existingLabRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Lab not found.' });
        }
        const existingLab = existingLabRows[0];

        const coverImageFile = req.files['coverImage'] ? req.files['coverImage'][0] : null;
        const labFile = req.files['labFile'] ? req.files['labFile'][0] : null;

        let cover_image_url = coverImageFile ? `/uploads/${coverImageFile.filename}` : existingLab.cover_image_url;
        let file_path = labFile ? `/uploads/${labFile.filename}` : existingLab.file_path;

        // Update UPDATE query to include class_group
        const query = `
            UPDATE digital_labs SET 
            title = ?, subject = ?, lab_type = ?, class_group = ?, description = ?, access_url = ?, file_path = ?, cover_image_url = ?
            WHERE id = ?
        `;
        await connection.query(query, [title, subject, lab_type, class_group || null, description, access_url || null, file_path, cover_image_url, id]);
        
        // --- NOTE: Notification on update can be complex (e.g., if class changes). 
        // For simplicity, we can notify the new class or all users again.
        // Let's notify the assigned class (or all if no class is assigned).
        
        let usersToNotifyQuery;
        if (class_group) {
             usersToNotifyQuery = connection.query("SELECT id FROM users WHERE role = 'student' AND class_group = ? AND id != ?", [class_group, created_by]);
        } else {
             usersToNotifyQuery = connection.query("SELECT id FROM users WHERE role IN ('student', 'teacher') AND id != ?", [created_by]);
        }
        const [usersToNotify] = await usersToNotifyQuery;

        if (usersToNotify.length > 0) {
            const [[editor]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [created_by]);
            const senderName = editor.full_name || "School Administration";
            const recipientIds = usersToNotify.map(u => u.id);
            const notificationTitle = `Digital Lab Updated: ${subject}`;
            const notificationMessage = `The lab "${title}" has been updated.`;

            await createBulkNotifications(connection, recipientIds, senderName, notificationTitle, notificationMessage, '/labs');
        }

        await connection.commit();
        res.status(200).json({ message: 'Digital lab updated successfully!' });
    } catch (error) {
        await connection.rollback();
        console.error("PUT /api/labs/:id Error:", error);
        res.status(500).json({ message: 'Error updating digital lab.' });
    } finally {
        connection.release();
    }
});


// ... your existing DELETE route for /api/labs/:id


// DELETE a digital lab (Admin/Teacher only)
app.delete('/api/labs/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // You might want to add logic here to delete the associated image file from the /uploads folder
        const [result] = await db.query('DELETE FROM digital_labs WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Digital lab not found.' });
        }
        res.status(200).json({ message: 'Digital lab deleted successfully.' });
    } catch (error) {
        console.error("DELETE /api/labs/:id Error:", error);
        res.status(500).json({ message: 'Error deleting digital lab.' });
    }
});


// ==========================================================
// --- HOMEWORK & ASSIGNMENTS API ROUTES (CORRECTED & FINAL) ---
// ==========================================================

// --- UTILITY ROUTES (FOR HOMEWORK FORMS) ---

// Get a list of all unique student class groups
app.get('/api/student-classes', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT class_group FROM users 
            WHERE role = 'student' AND class_group IS NOT NULL AND class_group <> '' AND class_group <> 'N/A'
            ORDER BY class_group ASC`;
        const [rows] = await db.query(query);
        res.json(rows.map(r => r.class_group));
    } catch (error) { 
        console.error('Error fetching student classes:', error);
        res.status(500).json({ message: 'Error fetching student classes.' }); 
    }
});

// Get all subjects for a selected class from the timetable
app.get('/api/subjects-for-class/:classGroup', async (req, res) => {
    const { classGroup } = req.params;
    try {
        const query = "SELECT DISTINCT subject_name FROM timetables WHERE class_group = ? ORDER BY subject_name";
        const [rows] = await db.query(query, [classGroup]);
        res.json(rows.map(r => r.subject_name));
    } catch (error) { 
        console.error('Error fetching subjects for class:', error);
        res.status(500).json({ message: 'Error fetching subjects.' }); 
    }
});


// --- TEACHER / ADMIN ROUTES ---

// Get assignment history for a specific teacher
app.get('/api/homework/teacher/:teacherId', async (req, res) => {
    const { teacherId } = req.params;
    try {
        const query = `
            SELECT a.*, (SELECT COUNT(*) FROM homework_submissions s WHERE s.assignment_id = a.id) as submission_count
            FROM homework_assignments a
            WHERE a.teacher_id = ? ORDER BY a.created_at DESC`;
        const [assignments] = await db.query(query, [teacherId]);
        res.json(assignments);
    } catch (error) { 
        console.error('Error fetching teacher assignments:', error);
        res.status(500).json({ message: 'Error fetching created assignments.' }); 
    }
});

// 📂 File: server.js (MODIFY this route)

// Create a new homework assignment
app.post('/api/homework', upload.single('attachment'), async (req, res) => {
    const { title, description, class_group, subject, due_date, teacher_id } = req.body;
    console.log('[HOMEWORK CREATE] Received request:', { title, class_group, subject, teacher_id }); // DEBUG LOG

    const attachment_path = req.file ? `/uploads/${req.file.filename}` : null;
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        // Step 1: Insert the homework
        const query = `INSERT INTO homework_assignments (title, description, class_group, subject, due_date, teacher_id, attachment_path) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const [assignmentResult] = await connection.query(query, [title, description, class_group, subject, due_date, teacher_id, attachment_path]);
        const newAssignmentId = assignmentResult.insertId;
        console.log(`[HOMEWORK CREATE] Homework created with ID: ${newAssignmentId}`);

        // Step 2: Find the teacher and students for the notification
        const [[teacher]] = await connection.query('SELECT full_name FROM users WHERE id = ?', [teacher_id]);
        const [students] = await connection.query('SELECT id FROM users WHERE role = "student" AND class_group = ?', [class_group]);
        
        console.log(`[HOMEWORK CREATE] Found ${students.length} students in class group "${class_group}".`); // DEBUG LOG

        if (students.length > 0) {
            const studentIds = students.map(s => s.id);
            console.log(`[HOMEWORK CREATE] Sending notifications to student IDs:`, studentIds);

            // ★★★ Step 3: CREATE NOTIFICATIONS within the transaction ★★★
            await createBulkNotifications(
                connection, // Pass the transaction connection
                studentIds,
                teacher.full_name,
                `New Homework: ${subject}`,
                title,
                `/homework/${newAssignmentId}`
            );
        }
        
        await connection.commit();
        res.status(201).json({ message: 'Homework created successfully.' });

    } catch (error) { 
        await connection.rollback();
        console.error('[HOMEWORK CREATE ERROR] Transaction rolled back:', error);
        res.status(500).json({ message: 'Error creating homework.' }); 
    } finally {
        connection.release();
    }
});


// Update an existing homework assignment (Note: uses POST for multipart/form-data compatibility)
app.post('/api/homework/:assignmentId', upload.single('attachment'), async (req, res) => {
    const { assignmentId } = req.params;
    const { title, description, class_group, subject, due_date, existing_attachment_path } = req.body;
    
    try {
        // If a new file is uploaded, use its path. Otherwise, use the existing path sent from the client.
        let attachment_path = existing_attachment_path || null;
        if (req.file) { 
            attachment_path = `/uploads/${req.file.filename}`; 
        }

        const query = `UPDATE homework_assignments SET title = ?, description = ?, class_group = ?, subject = ?, due_date = ?, attachment_path = ? WHERE id = ?`;
        await db.query(query, [title, description, class_group, subject, due_date, attachment_path, assignmentId]);
        res.status(200).json({ message: 'Homework updated successfully.' });
    } catch (error) { 
        console.error('Error updating homework:', error);
        res.status(500).json({ message: 'Error updating homework.' }); 
    }
});

// Delete a homework assignment
app.delete('/api/homework/:assignmentId', async (req, res) => {
    const { assignmentId } = req.params;
    try {
        // Note: For a robust system, you'd also delete associated submission files from the /uploads folder.
        // This query also relies on cascading deletes in the DB or deleting submissions first.
        // Assuming `homework_submissions` has an ON DELETE CASCADE for `assignment_id` foreign key.
        await db.query('DELETE FROM homework_assignments WHERE id = ?', [assignmentId]);
        res.status(200).json({ message: 'Homework and all its submissions deleted.' });
    } catch (error) { 
        console.error('Error deleting homework:', error);
        res.status(500).json({ message: 'Error deleting homework.' }); 
    }
});

// Get all submissions for a specific assignment
app.get('/api/homework/submissions/:assignmentId', async (req, res) => {
    const { assignmentId } = req.params;
    try {
        // This powerful query gets all students from the assignment's class group
        // and LEFT JOINs their submission for this specific assignment.
        // Students who haven't submitted will have NULL for submission-related fields.
        const query = `
            SELECT 
                u.id as student_id,
                u.full_name as student_name,
                s.id as submission_id,
                s.submission_path,
                s.submitted_at,
                s.status,
                s.grade,
                s.remarks
            FROM 
                users u
            LEFT JOIN 
                homework_submissions s ON u.id = s.student_id AND s.assignment_id = ?
            WHERE 
                u.role = 'student' AND u.class_group = (
                    SELECT class_group FROM homework_assignments WHERE id = ?
                )
            ORDER BY 
                u.full_name ASC`;
            
        // The assignmentId is used twice in the query
        const [results] = await db.query(query, [assignmentId, assignmentId]);
        res.json(results);
    } catch (error) { 
        console.error('Error fetching submissions roster:', error);
        res.status(500).json({ message: 'Error fetching submissions roster.' }); 
    }
});

// Grade a submission
app.put('/api/homework/grade/:submissionId', async (req, res) => {
    const { submissionId } = req.params;
    const { grade, remarks } = req.body;
    try {
        const query = `UPDATE homework_submissions SET grade = ?, remarks = ?, status = 'Graded' WHERE id = ?`;
        await db.query(query, [grade || null, remarks || null, submissionId]);
        res.status(200).json({ message: 'Submission graded successfully.' });
    } catch (error) { 
        console.error('Error grading submission:', error);
        res.status(500).json({ message: 'Error grading submission.' }); 
    }
});


// --- STUDENT ROUTES ---

// Get all assignments for a student's class (NO CHANGES)
app.get('/api/homework/student/:studentId/:classGroup', async (req, res) => {
    const { studentId, classGroup } = req.params;
    try {
        const query = `
            SELECT 
                a.id, a.title, a.description, a.subject, a.due_date, a.attachment_path,
                s.id as submission_id, 
                s.submitted_at, 
                s.status, 
                s.grade, 
                s.remarks
            FROM homework_assignments a
            LEFT JOIN homework_submissions s ON a.id = s.assignment_id AND s.student_id = ?
            WHERE a.class_group = ? 
            ORDER BY a.due_date DESC, a.id DESC`;
        const [assignments] = await db.query(query, [studentId, classGroup]);
        const processedAssignments = assignments.map(a => ({
            ...a,
            status: a.submission_id ? (a.status || 'Submitted') : 'Pending'
        }));
        res.json(processedAssignments);
    } catch (error) { 
        console.error('Error fetching student assignments:', error);
        res.status(500).json({ message: 'Error fetching assignments.' }); 
    }
});

// Student submits a homework file (NO CHANGES)
app.post('/api/homework/submit/:assignmentId', upload.single('submission'), async (req, res) => {
    const { assignmentId } = req.params;
    const { student_id } = req.body;
    
    if (!req.file) {
        return res.status(400).json({ message: 'No file was uploaded.' });
    }
    
    const submission_path = `/uploads/${req.file.filename}`;
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        const [existing] = await connection.query( 'SELECT id FROM homework_submissions WHERE assignment_id = ? AND student_id = ?', [assignmentId, student_id]);
        if (existing.length > 0) {
            await connection.rollback(); 
            return res.status(409).json({ message: 'You have already submitted this homework.' });
        }

        const query = `INSERT INTO homework_submissions (assignment_id, student_id, submission_path, status) VALUES (?, ?, ?, 'Submitted')`;
        await connection.query(query, [assignmentId, student_id, submission_path]);
        
        const [[assignment]] = await connection.query('SELECT teacher_id, title FROM homework_assignments WHERE id = ?', [assignmentId]);
        const [[student]] = await connection.query('SELECT full_name, class_group FROM users WHERE id = ?', [student_id]);

        if (assignment && student) {
            const notificationMessage = `${student.full_name} (${student.class_group}) has submitted their homework.`;
             await createNotification(
                connection,
                assignment.teacher_id,
                student.full_name,
                `Submission for: ${assignment.title}`,
                notificationMessage,
                `/submissions/${assignmentId}`
            );
        }
        
        await connection.commit();
        res.status(201).json({ message: 'Homework submitted successfully.' });

    } catch (error) {
        await connection.rollback();
        console.error('[HOMEWORK SUBMIT ERROR] Transaction rolled back:', error);
        res.status(500).json({ message: 'Database error during homework submission.' });
    } finally {
        connection.release();
    }
});


// ★★★ 2. ADD THIS NEW ROUTE TO DELETE A SUBMISSION ★★★
app.delete('/api/homework/submission/:submissionId', async (req, res) => {
    const { submissionId } = req.params;
    const { student_id } = req.body; // Sent from frontend to verify ownership

    if (!student_id) {
        return res.status(400).json({ message: 'Student ID is required for verification.' });
    }
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Find the submission and verify the owner
        const [[submission]] = await connection.query(
            'SELECT * FROM homework_submissions WHERE id = ?', [submissionId]
        );

        if (!submission) {
            await connection.rollback();
            return res.status(404).json({ message: 'Submission not found.' });
        }

        // SECURITY CHECK: Ensure the person deleting is the owner
        if (submission.student_id != student_id) {
            await connection.rollback();
            return res.status(403).json({ message: 'You are not authorized to delete this submission.' });
        }

        // Step 2: Delete the database record
        await connection.query('DELETE FROM homework_submissions WHERE id = ?', [submissionId]);

        // Step 3: Delete the physical file from the server
        if (submission.submission_path) {
            const filePath = path.join(__dirname, '..', submission.submission_path); // Adjust path if needed
            fs.unlink(filePath, (err) => {
                if (err) {
                    // Log error but don't fail the request, as the DB entry is more critical
                    console.error(`Failed to delete submission file: ${filePath}`, err);
                } else {
                    console.log(`Successfully deleted file: ${filePath}`);
                }
            });
        }
        
        await connection.commit();
        res.status(200).json({ message: 'Submission deleted successfully.' });

    } catch (error) {
        await connection.rollback();
        console.error('Error deleting submission:', error);
        res.status(500).json({ message: 'Error deleting submission.' });
    } finally {
        connection.release();
    }
});

// ==========================================================
// --- EXAM SCHEDULE API ROUTES ---
// ==========================================================

// --- TEACHER / ADMIN ROUTES ---

// Get all exam schedules created (for the main list view)
app.get('/api/exam-schedules', async (req, res) => {
    try {
        const query = `
            SELECT es.id, es.title, es.class_group, u.full_name as created_by
            FROM exam_schedules es
            JOIN users u ON es.created_by_id = u.id
            ORDER BY es.updated_at DESC
        `;
        const [schedules] = await db.query(query);
        res.json(schedules);
    } catch (error) {
        console.error("Error fetching exam schedules:", error);
        res.status(500).json({ message: "Failed to fetch exam schedules." });
    }
});

// Get a single, detailed exam schedule for editing
app.get('/api/exam-schedules/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `SELECT * FROM exam_schedules WHERE id = ?`;
        const [schedules] = await db.query(query, [id]);
        if (schedules.length === 0) {
            return res.status(404).json({ message: "Schedule not found." });
        }
        res.json(schedules[0]);
    } catch (error) {
        console.error("Error fetching single exam schedule:", error);
        res.status(500).json({ message: "Failed to fetch schedule details." });
    }
});

// Create a new exam schedule
app.post('/api/exam-schedules', async (req, res) => {
    const { class_group, title, subtitle, schedule_data, created_by_id } = req.body;
    if (!class_group || !title || !schedule_data || !created_by_id) {
        return res.status(400).json({ message: "Missing required fields." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Create the exam schedule record
        const query = `
            INSERT INTO exam_schedules (class_group, title, subtitle, schedule_data, created_by_id)
            VALUES (?, ?, ?, ?, ?)
        `;
        await connection.query(query, [class_group, title, subtitle, JSON.stringify(schedule_data), created_by_id]);
        
        // ★★★★★ START: NEW NOTIFICATION LOGIC FOR CREATION ★★★★★

        // 1. Find all students in the affected class group
        const [students] = await connection.query("SELECT id FROM users WHERE role = 'student' AND class_group = ?", [class_group]);
        const studentIds = students.map(s => s.id);

        // 2. Find all unique teachers assigned to that class in the main timetable
        const [teachers] = await connection.query("SELECT DISTINCT teacher_id FROM timetables WHERE class_group = ?", [class_group]);
        const teacherIds = teachers.map(t => t.teacher_id);
        
        // 3. Combine lists, ensuring no duplicates
        const allRecipientIds = [...new Set([...studentIds, ...teacherIds])];

        // 4. Prepare notification details
        const [[admin]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [created_by_id]);
        const senderName = admin.full_name || "School Administration";
        const notificationTitle = `New Exam Schedule Published`;
        const notificationMessage = `The schedule for "${title}" (${class_group}) has been published. Please check the details.`;

        // 5. Send notifications
        if (allRecipientIds.length > 0) {
            await createBulkNotifications(
                connection,
                allRecipientIds,
                senderName,
                notificationTitle,
                notificationMessage,
                '/exam-schedule' // A generic link to the exam schedule screen
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC FOR CREATION ★★★★★

        await connection.commit();
        res.status(201).json({ message: "Exam schedule created and users notified successfully." });

    } catch (error) {
        await connection.rollback();
        console.error("Error creating exam schedule:", error);
        res.status(500).json({ message: "Failed to create exam schedule." });
    } finally {
        connection.release();
    }
});

// Update an existing exam schedule
app.put('/api/exam-schedules/:id', async (req, res) => {
    const { id } = req.params;
    const { class_group, title, subtitle, schedule_data, created_by_id } = req.body; // Assuming created_by_id is passed on update as well for sender info

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Update the schedule record
        const query = `
            UPDATE exam_schedules 
            SET class_group = ?, title = ?, subtitle = ?, schedule_data = ?
            WHERE id = ?
        `;
        await connection.query(query, [class_group, title, subtitle, JSON.stringify(schedule_data), id]);

        // ★★★★★ START: NEW NOTIFICATION LOGIC FOR UPDATE ★★★★★

        // 1. Find all students in the affected class group
        const [students] = await connection.query("SELECT id FROM users WHERE role = 'student' AND class_group = ?", [class_group]);
        const studentIds = students.map(s => s.id);

        // 2. Find all unique teachers assigned to that class in the main timetable
        const [teachers] = await connection.query("SELECT DISTINCT teacher_id FROM timetables WHERE class_group = ?", [class_group]);
        const teacherIds = teachers.map(t => t.teacher_id);
        
        // 3. Combine lists, ensuring no duplicates
        const allRecipientIds = [...new Set([...studentIds, ...teacherIds])];

        // 4. Prepare notification details. We need the admin's name who made the change.
        // For this to work, ensure the `user.id` of the admin is passed from the form as `created_by_id`.
        const [[admin]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [created_by_id]);
        const senderName = admin.full_name || "School Administration";
        const notificationTitle = `Exam Schedule Updated`;
        const notificationMessage = `The schedule for "${title}" (${class_group}) has been modified. Please review the updated details.`;

        // 5. Send notifications
        if (allRecipientIds.length > 0) {
            await createBulkNotifications(
                connection,
                allRecipientIds,
                senderName,
                notificationTitle,
                notificationMessage,
                '/exam-schedule'
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC FOR UPDATE ★★★★★

        await connection.commit();
        res.status(200).json({ message: "Exam schedule updated and users notified successfully." });

    } catch (error) {
        await connection.rollback();
        console.error("Error updating exam schedule:", error);
        res.status(500).json({ message: "Failed to update exam schedule." });
    } finally {
        connection.release();
    }
});

// Delete an exam schedule
app.delete('/api/exam-schedules/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM exam_schedules WHERE id = ?', [id]);
        res.status(200).json({ message: "Exam schedule deleted successfully." });
    } catch (error) {
        console.error("Error deleting exam schedule:", error);
        res.status(500).json({ message: "Failed to delete exam schedule." });
    }
});


// --- STUDENT ROUTE ---
app.get('/api/exam-schedules/class/:classGroup', async (req, res) => {
    const { classGroup } = req.params;
    
    try {
        // 🔍 DEBUG: Log the incoming request
        console.log('🔥 =================================');
        console.log('🔍 API CALLED: /api/exam-schedules/class/' + classGroup);
        console.log('📅 Timestamp:', new Date().toISOString());
        console.log('🔥 =================================');
        
        // 🐛 DEBUG: Log the exact query we're about to execute
        const query = `
            SELECT 
                es.*,
                u.full_name AS created_by
            FROM exam_schedules es
            LEFT JOIN users u ON es.created_by_id = u.id
            WHERE es.class_group = ? 
            ORDER BY es.updated_at DESC
        `;
        
        console.log('📝 SQL Query:', query.trim());
        console.log('🎯 Query Parameters:', [classGroup]);
        
        // Execute the database query
        const [schedules] = await db.query(query, [classGroup]);
        
        // 🐛 DEBUG: Log exactly what the database returned
        console.log('🔥 DATABASE RESPONSE:');
        console.log('📊 Type:', Array.isArray(schedules) ? 'Array' : 'Object');
        console.log('📈 Raw Length:', schedules ? schedules.length : 'null/undefined');
        console.log('🔢 Actual Count:', schedules ? Object.keys(schedules).length : 0);
        
        if (schedules && schedules.length > 0) {
            console.log('📦 Schedule Details:');
            schedules.forEach((schedule, index) => {
                console.log(`  ${index + 1}. ID: ${schedule.id}, Title: "${schedule.title}", Class: "${schedule.class_group}"`);
            });
        } else {
            console.log('❌ No schedules found in database result');
        }
        
        // Check for empty results
        if (!schedules || schedules.length === 0) {
            console.log('❌ Returning 404 - No schedules found');
            return res.status(404).json({ message: "No exam schedules found for your class." });
        }
        
        // 🐛 DEBUG: Log exactly what we're about to return to the client
        console.log('🚀 ABOUT TO SEND RESPONSE:');
        console.log('📊 Response Type:', Array.isArray(schedules) ? 'Array' : 'Object');
        console.log('📈 Response Length:', schedules.length);
        console.log('🎯 Response Preview:', JSON.stringify(schedules).substring(0, 300) + '...');
        console.log('📦 Response Titles:', schedules.map(s => s.title));
        
        // 🔥 CRITICAL: Make sure we're returning the full array
        console.log('✅ Sending full schedules array to client...');
        res.json(schedules); // This MUST be 'schedules', NOT 'schedules[0]'
        
        console.log('🔥 Response sent successfully');
        console.log('🔥 =================================');
        
    } catch (error) {
        console.error('❌ ERROR in exam-schedules API:');
        console.error('❌ Error Message:', error.message);
        console.error('❌ Error Stack:', error.stack);
        console.error('❌ Class Group:', classGroup);
        console.error('🔥 =================================');
        
        res.status(500).json({ message: "Failed to fetch exam schedules." });
    }
});

// ==========================================================
// --- ONLINE EXAMS API ROUTES (ALL MIDDLEWARE REMOVED) ---
// ==========================================================

// --- TEACHER / ADMIN ROUTES ---

// 📂 File: server.js (REPLACE THIS ROUTE)

// CREATE a new exam
app.post('/api/exams', async (req, res) => {
    const { title, description, class_group, time_limit_mins, questions, teacher_id } = req.body;
    if (!teacher_id) return res.status(400).json({ message: "A valid Teacher ID is required." });
    if (!title || !class_group || !questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ message: "Title, class group, and at least one question are required." });
    }
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Create the exam and its questions (no change here)
        const total_marks = questions.reduce((sum, q) => sum + (parseInt(q.marks, 10) || 0), 0);
        const [examResult] = await connection.query('INSERT INTO exams (title, description, class_group, time_limit_mins, created_by, total_marks, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [title, description, class_group, time_limit_mins, teacher_id, total_marks, 'published']);
        const exam_id = examResult.insertId;

        if (questions.length > 0) {
            const questionQuery = 'INSERT INTO exam_questions (exam_id, question_text, question_type, options, correct_answer, marks) VALUES ?';
            const questionValues = questions.map(q => [exam_id, q.question_text, q.question_type, q.question_type === 'multiple_choice' ? JSON.stringify(q.options) : null, q.correct_answer, q.marks]);
            await connection.query(questionQuery, [questionValues]);
        }

        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★
        
        // 1. Find all students in the affected class group
        const [students] = await connection.query("SELECT id FROM users WHERE role = 'student' AND class_group = ?", [class_group]);
        
        if (students.length > 0) {
            // 2. Get the creator's name for the notification
            const [[teacher]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [teacher_id]);
            const senderName = teacher.full_name || "School Administration";
            
            // 3. Prepare notification details
            const studentIds = students.map(s => s.id);
            const notificationTitle = `New Exam Published: ${title}`;
            const notificationMessage = `An exam for your class (${class_group}) has been published. Please check the details.`;

            // 4. Send notifications to all students in the class
            await createBulkNotifications(
                connection,
                studentIds,
                senderName,
                notificationTitle,
                notificationMessage,
                '/exams' // Generic link to the exams screen
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★

        await connection.commit();
        res.status(201).json({ message: 'Exam created successfully and students notified!', exam_id });

    } catch (error) {
        await connection.rollback();
        console.error("Error in POST /api/exams:", error);
        res.status(500).json({ message: 'Failed to create exam.' });
    } finally {
        connection.release();
    }
});

// READ all exams for a specific teacher
app.get('/api/exams/teacher/:teacherId', async (req, res) => {
    try {
        const { teacherId } = req.params;
        const query = `SELECT e.*, (SELECT COUNT(*) FROM student_exam_attempts WHERE exam_id = e.exam_id) as submission_count FROM exams e WHERE e.created_by = ? ORDER BY e.created_at DESC`;
        const [exams] = await db.query(query, [teacherId]);
        res.json(exams);
    } catch (error) {
        console.error("Error in GET /api/exams/teacher/:teacherId:", error);
        res.status(500).json({ message: 'Error fetching exams from database.' });
    }
});

// READ a single exam's full details for editing
app.get('/api/exams/:examId', async (req, res) => {
    try {
        const { examId } = req.params;
        const [[exam]] = await db.query('SELECT * FROM exams WHERE exam_id = ?', [examId]);
        if (!exam) return res.status(404).json({ message: 'Exam not found.' });
        const [questions] = await db.query('SELECT * FROM exam_questions WHERE exam_id = ?', [examId]);
        res.json({ ...exam, questions });
    } catch (error) {
        console.error("Error in GET /api/exams/:examId:", error);
        res.status(500).json({ message: 'Error fetching exam details.' });
    }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// UPDATE an existing exam
app.put('/api/exams/:examId', async (req, res) => {
    const { examId } = req.params;
    const { title, description, class_group, time_limit_mins, questions, teacher_id } = req.body; // Assuming teacher_id is passed for sender info
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Update exam and questions (no change here)
        const total_marks = questions.reduce((sum, q) => sum + (parseInt(q.marks, 10) || 0), 0);
        await connection.query('UPDATE exams SET title = ?, description = ?, class_group = ?, time_limit_mins = ?, total_marks = ? WHERE exam_id = ?', [title, description, class_group, time_limit_mins, total_marks, examId]);
        
        await connection.query('DELETE FROM exam_questions WHERE exam_id = ?', [examId]);
        if (questions.length > 0) {
            const questionQuery = 'INSERT INTO exam_questions (exam_id, question_text, question_type, options, correct_answer, marks) VALUES ?';
            const questionValues = questions.map(q => [examId, q.question_text, q.question_type, q.question_type === 'multiple_choice' ? JSON.stringify(q.options) : null, q.correct_answer, q.marks]);
            await connection.query(questionQuery, [questionValues]);
        }

        // ★★★★★ START: NEW NOTIFICATION LOGIC FOR UPDATE ★★★★★

        // 1. Find all students in the affected class group
        const [students] = await connection.query("SELECT id FROM users WHERE role = 'student' AND class_group = ?", [class_group]);
        
        if (students.length > 0) {
            // 2. Get the creator/editor's name for the notification
            const [[teacher]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [teacher_id]);
            const senderName = teacher.full_name || "School Administration";

            // 3. Prepare notification details
            const studentIds = students.map(s => s.id);
            const notificationTitle = `Exam Updated: ${title}`;
            const notificationMessage = `Details for the exam "${title}" have been updated. Please review the changes.`;

            // 4. Send notifications to all students in the class
            await createBulkNotifications(
                connection,
                studentIds,
                senderName,
                notificationTitle,
                notificationMessage,
                '/exams'
            );
        }
        
        // ★★★★★ END: NEW NOTIFICATION LOGIC FOR UPDATE ★★★★★

        await connection.commit();
        res.status(200).json({ message: 'Exam updated successfully and students notified!' });

    } catch (error) {
        await connection.rollback();
        console.error("Error in PUT /api/exams/:examId:", error);
        res.status(500).json({ message: 'Failed to update exam.' });
    } finally {
        connection.release();
    }
});

// DELETE an exam
app.delete('/api/exams/:examId', async (req, res) => {
    try {
        const { examId } = req.params;
        const [result] = await db.query('DELETE FROM exams WHERE exam_id = ?', [examId]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Exam not found.' });
        res.status(200).json({ message: 'Exam and all related data deleted successfully.' });
    } catch (error) {
        console.error("Error in DELETE /api/exams/:examId:", error);
        res.status(500).json({ message: 'Error deleting exam.' });
    }
});

// --- SUBMISSION & GRADING ROUTES ---

// Get all submissions for a specific exam
app.get('/api/exams/:examId/submissions', async (req, res) => {
    try {
        const { examId } = req.params;
        const query = `SELECT sea.*, u.full_name as student_name FROM student_exam_attempts sea JOIN users u ON sea.student_id = u.id WHERE sea.exam_id = ? AND sea.status IN ('submitted', 'graded') ORDER BY u.full_name ASC`;
        const [submissions] = await db.query(query, [examId]);
        res.json(submissions);
    } catch (error) {
        console.error("Error in GET /api/exams/:examId/submissions:", error);
        res.status(500).json({ message: 'Error fetching submissions.' });
    }
});

// Get a single student's full submission for grading
app.get('/api/submissions/:attemptId', async (req, res) => {
    try {
        const { attemptId } = req.params;
        const query = `SELECT eq.question_id, eq.question_text, eq.question_type, eq.options, eq.correct_answer, eq.marks, sa.answer_text, sa.marks_awarded FROM exam_questions eq LEFT JOIN student_answers sa ON eq.question_id = sa.question_id AND sa.attempt_id = ? WHERE eq.exam_id = (SELECT exam_id FROM student_exam_attempts WHERE attempt_id = ?) ORDER BY eq.question_id ASC`;
        const [details] = await db.query(query, [attemptId, attemptId]);
        res.json(details);
    } catch (error) {
        console.error("Error in GET /api/submissions/:attemptId:", error);
        res.status(500).json({ message: 'Error fetching submission details.' });
    }
});

// Grade a student's submission
app.post('/api/submissions/:attemptId/grade', async (req, res) => {
    const { attemptId } = req.params;
    const { gradedAnswers, teacher_feedback, teacher_id } = req.body; // Added teacher_id for auth
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [[attempt]] = await connection.query('SELECT exam_id, student_id FROM student_exam_attempts WHERE attempt_id = ?', [attemptId]);
        // Simple auth check: does the exam belong to the teacher grading it?
        const [[exam]] = await connection.query('SELECT created_by FROM exams WHERE exam_id = ?', [attempt.exam_id]);
        if (exam.created_by !== parseInt(teacher_id, 10)) {
            await connection.rollback();
            return res.status(403).json({ message: 'You are not authorized to grade this exam.' });
        }
        
        const [questions] = await connection.query('SELECT question_id, marks FROM exam_questions WHERE exam_id = ?', [attempt.exam_id]);
        const marksMap = new Map(questions.map(q => [q.question_id, q.marks]));
        let final_score = 0;
        const updatePromises = gradedAnswers.map(ans => {
            const maxMarks = marksMap.get(parseInt(ans.question_id, 10)) || 0;
            let awardedMarks = parseInt(ans.marks_awarded, 10) || 0;
            if (awardedMarks > maxMarks) { awardedMarks = maxMarks; }
            final_score += awardedMarks;
            return connection.query('UPDATE student_answers SET marks_awarded = ? WHERE attempt_id = ? AND question_id = ?', [awardedMarks, attemptId, ans.question_id]);
        });
        await Promise.all(updatePromises);
        await connection.query('UPDATE student_exam_attempts SET status = "graded", final_score = ?, teacher_feedback = ? WHERE attempt_id = ?', [final_score, teacher_feedback || null, attemptId]);
        await connection.commit();
        res.status(200).json({ message: "Exam graded successfully." });
    } catch (error) {
        await connection.rollback();
        console.error("Error in POST /api/submissions/:attemptId/grade:", error);
        res.status(500).json({ message: 'Failed to grade exam.' });
    } finally {
        connection.release();
    }
});


// --- STUDENT ROUTES ---
// We will also remove middleware from student routes for consistency,
// but they will require a student_id to be passed.

app.get('/api/exams/student/:studentId/:classGroup', async (req, res) => {
    try {
        const { studentId, classGroup } = req.params;
        const query = `SELECT e.exam_id, e.title, e.total_marks, e.time_limit_mins, (SELECT COUNT(*) FROM exam_questions WHERE exam_id = e.exam_id) as question_count, sea.status, sea.attempt_id FROM exams e LEFT JOIN student_exam_attempts sea ON e.exam_id = sea.exam_id AND sea.student_id = ? WHERE e.class_group = ? AND e.status = 'published' ORDER BY e.created_at DESC`;
        const [exams] = await db.query(query, [studentId, classGroup]);
        res.json(exams);
    } catch (error) {
        console.error("Error in GET /api/exams/student:", error);
        res.status(500).json({ message: 'Error fetching available exams.' });
    }
});

app.post('/api/exams/:examId/start', async (req, res) => {
    try {
        const { examId } = req.params;
        const { student_id } = req.body;
        if (!student_id) return res.status(400).json({ message: "Student ID is required." });

        const query = `INSERT INTO student_exam_attempts (exam_id, student_id, status, start_time) VALUES (?, ?, 'in_progress', NOW()) ON DUPLICATE KEY UPDATE attempt_id=LAST_INSERT_ID(attempt_id), status='in_progress'`;
        const [result] = await db.query(query, [examId, student_id]);
        res.status(201).json({ attempt_id: result.insertId });
    } catch (error) {
        console.error("Error in POST /api/exams/:examId/start:", error);
        res.status(500).json({ message: 'Error starting exam.' });
    }
});

app.get('/api/exams/take/:examId', async (req, res) => {
    try {
        const { examId } = req.params;
        const query = `SELECT question_id, question_text, question_type, options, marks FROM exam_questions WHERE exam_id = ? ORDER BY question_id ASC`;
        const [questions] = await db.query(query, [examId]);
        res.json(questions);
    } catch (error) {
        console.error("Error in GET /api/exams/take/:examId:", error);
        res.status(500).json({ message: 'Error fetching exam questions.' });
    }
});

app.post('/api/attempts/:attemptId/submit', async (req, res) => {
    const { attemptId } = req.params;
    const { answers, student_id } = req.body;
    if (!student_id) return res.status(400).json({ message: "Student ID is required." });
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [[attempt]] = await connection.query('SELECT status, student_id FROM student_exam_attempts WHERE attempt_id = ?', [attemptId]);
        
        if (attempt.student_id !== parseInt(student_id, 10)) {
            await connection.rollback();
            return res.status(403).json({ message: 'Unauthorized submission.' });
        }
        if (!attempt || attempt.status !== 'in_progress') {
            await connection.rollback();
            return res.status(409).json({ message: 'This exam has already been submitted.' });
        }
        
        const answerQuery = 'INSERT INTO student_answers (attempt_id, question_id, answer_text) VALUES ?';
        const answerValues = Object.entries(answers).map(([qid, atext]) => [attemptId, qid, atext]);
        if (answerValues.length > 0) { await connection.query(answerQuery, [answerValues]); }
        await connection.query('UPDATE student_exam_attempts SET status = "submitted", end_time = NOW() WHERE attempt_id = ?', [attemptId]);
        await connection.commit();
        res.status(200).json({ message: "Exam submitted successfully." });
    } catch (error) {
        await connection.rollback();
        console.error("Error in POST /api/attempts/:attemptId/submit:", error);
        res.status(500).json({ message: 'Failed to submit exam.' });
    } finally {
        connection.release();
    }
});

app.get('/api/attempts/:attemptId/result', async (req, res) => {
    try {
        const { attemptId } = req.params;
        const { student_id } = req.query;
        if (!student_id) return res.status(400).json({ message: "Student ID is required." });

        const [[attemptDetails]] = await db.query('SELECT * FROM student_exam_attempts WHERE attempt_id = ? AND student_id = ?', [attemptId, student_id]);
        if (!attemptDetails) { return res.status(404).json({ message: "Result not found or access denied." }); }
        
        const [[examDetails]] = await db.query('SELECT title, total_marks FROM exams WHERE exam_id = ?', [attemptDetails.exam_id]);
        const [qnaDetails] = await db.query(`SELECT eq.question_id, eq.question_text, eq.question_type, eq.options, eq.correct_answer, eq.marks, sa.answer_text, sa.marks_awarded FROM exam_questions eq LEFT JOIN student_answers sa ON eq.question_id = sa.question_id AND sa.attempt_id = ? WHERE eq.exam_id = ? ORDER BY eq.question_id ASC`, [attemptId, attemptDetails.exam_id]);
        res.json({ attempt: attemptDetails, exam: examDetails, details: qnaDetails });
    } catch (error) {
        console.error("Error in GET /api/attempts/:attemptId/result:", error);
        res.status(500).json({ message: 'Error fetching result.' });
    }
});


// ==========================================================
// --- STUDY MATERIALS API ROUTES ---
// ==========================================================

// --- TEACHER / ADMIN ROUTES ---

// 📂 File: server.js (REPLACE THIS ROUTE)

// CREATE: Upload a new study material
app.post('/api/study-materials', upload.single('materialFile'), async (req, res) => {
    const { title, description, class_group, subject, material_type, external_link, uploaded_by } = req.body;
    const file_path = req.file ? `/uploads/${req.file.filename}` : null;

    if (!title || !class_group || !material_type || !uploaded_by) {
        return res.status(400).json({ message: "Title, class group, type, and uploader ID are required." });
    }
    if (!file_path && !external_link) {
        return res.status(400).json({ message: "You must provide either a file or an external link." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Insert the study material
        const query = `INSERT INTO study_materials (title, description, class_group, subject, material_type, file_path, external_link, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        await connection.query(query, [title, description, class_group, subject, material_type, file_path, external_link || null, uploaded_by]);

        // ★★★★★ START: NEW NOTIFICATION LOGIC FOR CREATION ★★★★★
        
        // 1. Find all students in the affected class group
        const [students] = await connection.query("SELECT id FROM users WHERE role = 'student' AND class_group = ?", [class_group]);
        
        if (students.length > 0) {
            // 2. Get the uploader's name for the notification
            const [[uploader]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [uploaded_by]);
            const senderName = uploader.full_name || "School Administration";
            
            // 3. Prepare notification details
            const studentIds = students.map(s => s.id);
            const notificationTitle = `New Study Material: ${subject || 'General'}`;
            const notificationMessage = `"${title}" has been added for your class.`;

            // 4. Send notifications
            await createBulkNotifications(
                connection,
                studentIds,
                senderName,
                notificationTitle,
                notificationMessage,
                '/study-materials' // Generic link to the study materials screen
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC FOR CREATION ★★★★★

        await connection.commit();
        res.status(201).json({ message: 'Study material uploaded and students notified.' });

    } catch (error) {
        await connection.rollback();
        console.error("Error creating study material:", error);
        res.status(500).json({ message: 'Failed to upload study material.' });
    } finally {
        connection.release();
    }
});

// READ: Get all materials uploaded by a specific teacher
app.get('/api/study-materials/teacher/:teacherId', async (req, res) => {
    try {
        const { teacherId } = req.params;
        const query = `SELECT * FROM study_materials WHERE uploaded_by = ? ORDER BY created_at DESC`;
        const [materials] = await db.query(query, [teacherId]);
        res.json(materials);
    } catch (error) {
        console.error("Error fetching teacher's study materials:", error);
        res.status(500).json({ message: "Failed to fetch study materials." });
    }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// UPDATE: Edit an existing study material
app.put('/api/study-materials/:materialId', upload.single('materialFile'), async (req, res) => {
    const { materialId } = req.params;
    const { title, description, class_group, subject, material_type, external_link, existing_file_path, uploaded_by } = req.body; // Assuming uploaded_by is sent
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Update the study material (logic to handle file path is the same)
        let file_path = existing_file_path || null;
        if (req.file) {
            file_path = `/uploads/${req.file.filename}`;
            if (existing_file_path) {
                fs.unlink(path.join(__dirname, existing_file_path.replace(/\\/g, "/")), (err) => {
                    if (err) console.error("Could not delete old material file on update:", err);
                });
            }
        }
        const query = `UPDATE study_materials SET title = ?, description = ?, class_group = ?, subject = ?, material_type = ?, file_path = ?, external_link = ? WHERE material_id = ?`;
        await connection.query(query, [title, description, class_group, subject, material_type, file_path, external_link || null, materialId]);

        // ★★★★★ START: NEW NOTIFICATION LOGIC FOR UPDATE ★★★★★
        
        // 1. Find all students in the affected class group
        const [students] = await connection.query("SELECT id FROM users WHERE role = 'student' AND class_group = ?", [class_group]);
        
        if (students.length > 0) {
            // 2. Get the uploader's/editor's name for the notification
            const [[uploader]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [uploaded_by]);
            const senderName = uploader.full_name || "School Administration";
            
            // 3. Prepare notification details
            const studentIds = students.map(s => s.id);
            const notificationTitle = `Study Material Updated: ${subject || 'General'}`;
            const notificationMessage = `The material "${title}" has been updated. Please check for new content.`;

            // 4. Send notifications
            await createBulkNotifications(
                connection,
                studentIds,
                senderName,
                notificationTitle,
                notificationMessage,
                '/study-materials'
            );
        }
        
        // ★★★★★ END: NEW NOTIFICATION LOGIC FOR UPDATE ★★★★★

        await connection.commit();
        res.status(200).json({ message: 'Study material updated and students notified successfully.' });

    } catch (error) {
        await connection.rollback();
        console.error("Error updating study material:", error);
        res.status(500).json({ message: 'Failed to update study material.' });
    } finally {
        connection.release();
    }
});

// DELETE: Remove a study material
app.delete('/api/study-materials/:materialId', async (req, res) => {
    const { materialId } = req.params;
    try {
        // First, get the file path to delete the physical file
        const [[material]] = await db.query('SELECT file_path FROM study_materials WHERE material_id = ?', [materialId]);
        
        // Delete the database record
        const [result] = await db.query('DELETE FROM study_materials WHERE material_id = ?', [materialId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Material not found.' });
        }

        // If a file was associated, delete it from the server
        if (material && material.file_path) {
            fs.unlink(path.join(__dirname, material.file_path), (err) => {
                if (err) console.error("Could not delete file from server:", err);
            });
        }

        res.status(200).json({ message: 'Study material deleted successfully.' });
    } catch (error) {
        console.error("Error deleting study material:", error);
        res.status(500).json({ message: 'Failed to delete study material.' });
    }
});


// --- STUDENT ROUTE ---

// READ: Get all materials for a student's class
app.get('/api/study-materials/student/:classGroup', async (req, res) => {
    try {
        const { classGroup } = req.params;
        const query = `SELECT * FROM study_materials WHERE class_group = ? ORDER BY created_at DESC`;
        const [materials] = await db.query(query, [classGroup]);
        res.json(materials);
    } catch (error) {
        console.error("Error fetching student's study materials:", error);
        res.status(500).json({ message: "Failed to fetch study materials." });
    }
});



// ==========================================================
// --- PROGRESS REPORTS (RESULTS) API ROUTES ---
// ==========================================================

// --- TEACHER / ADMIN ROUTES ---

// GET all students in a specific class
// --- TEACHER / ADMIN ROUTES ---

// GET all students in a specific class
app.get('/api/reports/class/:classGroup/students', async (req, res) => {
    try {
        const { classGroup } = req.params;
        const query = "SELECT id, full_name FROM users WHERE role = 'student' AND class_group = ?";
        const [students] = await db.query(query, [classGroup]);
        res.json(students);
    } catch (error) {
        console.error("Error fetching students for class:", error);
        res.status(500).json({ message: 'Failed to fetch students.' });
    }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// CREATE a new progress report
app.post('/api/reports', async (req, res) => {
    const { reportDetails, subjectsData, uploaded_by } = req.body;
    const { student_id, class_group, report_title, issue_date, overall_grade, teacher_comments, sgpa, cgpa, total_backlog, result_status } = reportDetails;
    
    if (!student_id || !report_title || !issue_date) {
        return res.status(400).json({ message: "Student, Report Title, and Issue Date are required." });
    }
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Create the report and subject entries (no change here)
        const reportQuery = `INSERT INTO progress_reports (student_id, class_group, report_title, issue_date, overall_grade, teacher_comments, sgpa, cgpa, total_backlog, result_status, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const reportValues = [student_id, class_group, report_title, issue_date, overall_grade, teacher_comments, sgpa || null, cgpa || null, total_backlog || 0, result_status, uploaded_by];
        const [reportResult] = await connection.query(reportQuery, reportValues);
        const report_id = reportResult.insertId;

        if (subjectsData && subjectsData.length > 0) {
            const subjectsQuery = `INSERT INTO report_subjects (report_id, subject_code, subject_name, credit, grade, grade_point, credit_point) VALUES ?`;
            const subjectValues = subjectsData.map(s => [ report_id, s.subject_code || null, s.subject_name, s.credit === '' ? null : s.credit, s.grade || null, s.grade_point === '' ? null : s.grade_point, s.credit_point === '' ? null : s.credit_point ]).filter(s => s[2] && s[2].trim() !== '');
            if (subjectValues.length > 0) {
                await connection.query(subjectsQuery, [subjectValues]);
            }
        }
        
        // ★★★★★ START: NEW NOTIFICATION LOGIC FOR CREATION ★★★★★
        
        // 1. Get the name of the teacher/admin who uploaded the report
        const [[uploader]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [uploaded_by]);
        const senderName = uploader.full_name || "School Administration";

        // 2. Prepare notification details for the student
        const notificationTitle = `New Report Published: ${report_title}`;
        const notificationMessage = `Your progress report for "${report_title}" has been published. You can view or download it now.`;

        // 3. Send a single notification to the specific student
        await createNotification(
            connection,
            student_id,
            senderName,
            notificationTitle,
            notificationMessage,
            `/reports/${report_id}` // Link to the specific report
        );

        // ★★★★★ END: NEW NOTIFICATION LOGIC FOR CREATION ★★★★★

        await connection.commit();
        res.status(201).json({ message: 'Progress report created successfully and student notified.', report_id });

    } catch (error) {
        await connection.rollback();
        console.error("Error creating progress report:", error);
        res.status(500).json({ message: 'Failed to create report.' });
    } finally {
        connection.release();
    }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// UPDATE an existing progress report
app.put('/api/reports/:reportId', async (req, res) => {
    const { reportId } = req.params;
    const { reportDetails, subjectsData, uploaded_by } = req.body; // Ensure 'uploaded_by' is sent from the form on update
    const { report_title, issue_date, overall_grade, teacher_comments, sgpa, cgpa, total_backlog, result_status } = reportDetails;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // --- Step 1 & 2: Update report and subjects (no change here) ---
        const reportQuery = `UPDATE progress_reports SET report_title = ?, issue_date = ?, overall_grade = ?, teacher_comments = ?, sgpa = ?, cgpa = ?, total_backlog = ?, result_status = ? WHERE report_id = ?`;
        const sanitized_issue_date = issue_date === '' ? null : issue_date;
        await connection.query(reportQuery, [report_title, sanitized_issue_date, overall_grade, teacher_comments, sgpa || null, cgpa || null, total_backlog || 0, result_status, reportId]);

        await connection.query('DELETE FROM report_subjects WHERE report_id = ?', [reportId]);
        
        if (subjectsData && subjectsData.length > 0) {
            const subjectsQuery = `INSERT INTO report_subjects (report_id, subject_code, subject_name, credit, grade, grade_point, credit_point) VALUES ?`;
            const subjectValues = subjectsData.map(s => [
                reportId, s.subject_code || null, s.subject_name,
                s.credit === '' ? null : s.credit, s.grade || null,
                s.grade_point === '' ? null : s.grade_point,
                s.credit_point === '' ? null : s.credit_point
            ]).filter(s => s[2] && s[2].trim() !== '');
            
            if (subjectValues.length > 0) {
                await connection.query(subjectsQuery, [subjectValues]);
            }
        }
        
        // ★★★★★ START: NEW NOTIFICATION LOGIC FOR UPDATE ★★★★★

        // 1. Get the student's ID from the report we just updated
        const [[report]] = await connection.query("SELECT student_id FROM progress_reports WHERE report_id = ?", [reportId]);

        if (report) {
            // 2. Get the name of the teacher/admin who updated the report
            const [[uploader]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [uploaded_by]);
            const senderName = uploader.full_name || "School Administration";

            // 3. Prepare notification details
            const notificationTitle = `Report Updated: ${report_title}`;
            const notificationMessage = `Your progress report for "${report_title}" has been updated. Please review the changes.`;

            // 4. Send the notification to the student
            await createNotification(
                connection,
                report.student_id,
                senderName,
                notificationTitle,
                notificationMessage,
                `/reports/${reportId}`
            );
        }
        
        // ★★★★★ END: NEW NOTIFICATION LOGIC FOR UPDATE ★★★★★

        await connection.commit();
        res.status(200).json({ message: 'Progress report updated and student notified successfully.' });

    } catch (error) {
        await connection.rollback();
        console.error("Error updating progress report:", error);
        res.status(500).json({ message: 'Failed to update report.' });
    } finally {
        connection.release();
    }
});

// DELETE a progress report
app.delete('/api/reports/:reportId', async (req, res) => {
    try {
        const { reportId } = req.params;
        const [result] = await db.query('DELETE FROM progress_reports WHERE report_id = ?', [reportId]);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Report not found." });
        res.status(200).json({ message: "Report deleted successfully." });
    } catch (error) {
        console.error("Error deleting report:", error);
        res.status(500).json({ message: "Failed to delete report." });
    }
});


// --- STUDENT ROUTES ---

// GET all reports for a specific student
app.get('/api/reports/student/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const query = `SELECT * FROM progress_reports WHERE student_id = ? ORDER BY issue_date DESC`;
        const [reports] = await db.query(query, [studentId]);
        res.json(reports);
    } catch (error) {
        console.error("Error fetching student reports:", error);
        res.status(500).json({ message: "Failed to fetch reports." });
    }
});

// GET full details of a single report
app.get('/api/reports/:reportId/details', async (req, res) => {
    try {
        const { reportId } = req.params;
        const reportQuery = `SELECT pr.*, u.full_name, u.username, up.roll_no FROM progress_reports pr JOIN users u ON pr.student_id = u.id LEFT JOIN user_profiles up ON u.id = up.user_id WHERE pr.report_id = ?`;
        const subjectsQuery = `SELECT * FROM report_subjects WHERE report_id = ?`;
        
        const [[reportDetails]] = await db.query(reportQuery, [reportId]);
        if (!reportDetails) return res.status(404).json({ message: "Report not found." });
        
        const [subjects] = await db.query(subjectsQuery, [reportId]);
        res.json({ reportDetails, subjects });
    } catch (error) {
        console.error("Error fetching report details:", error);
        res.status(500).json({ message: "Failed to fetch report details." });
    }
});

// ==========================================================
// --- UTILITY & SYLLABUS API ROUTES ---
// ==========================================================

// GET a unique list of all subjects from the 'users' table
app.get('/api/subjects/all-unique', async (req, res) => {
    try {
        const query = `
            SELECT subjects_taught 
            FROM users 
            WHERE role = 'teacher' AND subjects_taught IS NOT NULL AND subjects_taught <> '' AND subjects_taught <> '[]'
        `;
        const [rows] = await db.query(query);
        const uniqueSubjects = new Set(); 
        for (const row of rows) {
            const subjectString = row.subjects_taught;
            if (!subjectString) continue;
            const matches = subjectString.match(/["'](.*?)["']/g);
            if (matches) {
                for (const match of matches) {
                    const cleanedSubject = match.substring(1, match.length - 1);
                    if (cleanedSubject) {
                        uniqueSubjects.add(cleanedSubject);
                    }
                }
            } else {
                 if (subjectString.trim()){
                    uniqueSubjects.add(subjectString.trim());
                 }
            }
        }
        const finalSubjectsList = Array.from(uniqueSubjects).sort();
        res.status(200).json(finalSubjectsList);
    } catch (error) {
        console.error("[ERROR] in /api/subjects/all-unique:", error);
        res.status(500).json({ message: 'Could not fetch the list of subjects.' });
    }
});

// ADMIN: Create a new syllabus
app.post('/api/syllabus/create', async (req, res) => {
    const { class_group, subject_name, lessons, creator_id } = req.body;
    if (!class_group || !subject_name || !lessons || !creator_id) {
        return res.status(400).json({ message: "Missing required fields." });
    }
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [syllabusResult] = await connection.query('INSERT INTO syllabuses (class_group, subject_name, creator_id) VALUES (?, ?, ?)', [class_group, subject_name, creator_id]);
        const newSyllabusId = syllabusResult.insertId;
        const lessonValues = lessons.map(lesson => [newSyllabusId, lesson.lessonName, lesson.dueDate]);
        await connection.query('INSERT INTO syllabus_lessons (syllabus_id, lesson_name, due_date) VALUES ?', [lessonValues]);
        const [students] = await connection.query("SELECT id FROM users WHERE role = 'student' AND class_group = ?", [class_group]);
        const [newlyCreatedLessons] = await connection.query('SELECT id FROM syllabus_lessons WHERE syllabus_id = ?', [newSyllabusId]);
        if (students.length > 0 && newlyCreatedLessons.length > 0) {
            const progressRecords = [];
            for (const student of students) {
                for (const lesson of newlyCreatedLessons) {
                    progressRecords.push([student.id, lesson.id]);
                }
            }
            await connection.query("INSERT INTO syllabus_progress (student_id, lesson_id) VALUES ?", [progressRecords]);
        }
        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★

        // 1. Find the assigned teacher and all students in the class
        const teacherId = creator_id;
        const studentIds = students.map(s => s.id);
        const allRecipientIds = [teacherId, ...studentIds];

        // 2. Prepare notification details
        const notificationTitle = `New Syllabus: ${subject_name}`;
        const notificationMessage = `A new syllabus for ${subject_name} has been assigned to ${class_group}.`;
        const senderName = "School Administration";

        // 3. Send notifications to the teacher and all students
        if (allRecipientIds.length > 0) {
            await createBulkNotifications(
                connection,
                allRecipientIds,
                senderName,
                notificationTitle,
                notificationMessage,
                '/syllabus' // A generic link to the syllabus section
            );
        }
        
        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★
        await connection.commit();
        res.status(201).json({ message: 'Syllabus created successfully!', syllabusId: newSyllabusId });
    } catch (error) {
        await connection.rollback();
        console.error("Error creating syllabus:", error);
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A syllabus for this class and subject already exists.' });
        res.status(500).json({ message: 'Error creating syllabus.' });
    } finally {
        connection.release();
    }
});

// 📂 File: backend/server.js (ADD THIS NEW ROUTE)

// ADMIN: UPDATE an existing syllabus (replaces lessons)
app.put('/api/syllabus/:syllabusId', async (req, res) => {
    const { syllabusId } = req.params;
    const { lessons, creator_id } = req.body; // creator_id is the teacher_id

    if (!lessons || !creator_id) {
        return res.status(400).json({ message: "Lessons and creator ID are required." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Get existing syllabus details for notifications and validation
        const [[syllabus]] = await connection.query("SELECT class_group, subject_name FROM syllabuses WHERE id = ?", [syllabusId]);
        if (!syllabus) {
            await connection.rollback();
            return res.status(404).json({ message: "Syllabus not found." });
        }

        // Step 2: Delete all old lessons and their progress records (cascading delete)
        await connection.query("DELETE FROM syllabus_lessons WHERE syllabus_id = ?", [syllabusId]);

        // Step 3: Insert the new set of lessons
        const lessonValues = lessons.map(lesson => [syllabusId, lesson.lessonName, lesson.dueDate]);
        await connection.query('INSERT INTO syllabus_lessons (syllabus_id, lesson_name, due_date) VALUES ?', [lessonValues]);

        // Step 4: Re-create progress records for all students for the new lessons
        const [students] = await connection.query("SELECT id FROM users WHERE role = 'student' AND class_group = ?", [syllabus.class_group]);
        const [newlyCreatedLessons] = await connection.query('SELECT id FROM syllabus_lessons WHERE syllabus_id = ?', [syllabusId]);

        if (students.length > 0 && newlyCreatedLessons.length > 0) {
            const progressRecords = [];
            for (const student of students) {
                for (const lesson of newlyCreatedLessons) {
                    progressRecords.push([student.id, lesson.id]);
                }
            }
            await connection.query("INSERT INTO syllabus_progress (student_id, lesson_id) VALUES ?", [progressRecords]);
        }
        
        // ★★★★★ START: NOTIFICATION LOGIC FOR UPDATE ★★★★★
        
        // 1. Find the assigned teacher and all students in the class
        const studentIds = students.map(s => s.id);
        const allRecipientIds = [creator_id, ...studentIds]; 

        // 2. Prepare notification details
        const notificationTitle = `Syllabus Updated: ${syllabus.subject_name}`;
        const notificationMessage = `The syllabus for ${syllabus.subject_name} (${syllabus.class_group}) has been updated by the administration.`;
        const senderName = "School Administration";

        // 3. Send notifications
        if (allRecipientIds.length > 0) {
            await createBulkNotifications(
                connection,
                allRecipientIds,
                senderName,
                notificationTitle,
                notificationMessage,
                '/syllabus'
            );
        }
        
        // ★★★★★ END: NOTIFICATION LOGIC FOR UPDATE ★★★★★

        await connection.commit();
        res.status(200).json({ message: 'Syllabus updated successfully and users notified!' });

    } catch (error) {
        await connection.rollback();
        console.error("Error updating syllabus:", error);
        res.status(500).json({ message: 'Error updating syllabus.' });
    } finally {
        connection.release();
    }
});

// ADMIN: Get all syllabuses for the history view
app.get('/api/syllabus/all', async (req, res) => {
    try {
        const query = `
            SELECT s.*, u.full_name as creator_name, 
            (SELECT COUNT(*) FROM syllabus_lessons sl WHERE sl.syllabus_id = s.id) as lesson_count
            FROM syllabuses s 
            JOIN users u ON s.creator_id = u.id 
            ORDER BY s.class_group, s.subject_name`;
        const [syllabuses] = await db.query(query);
        res.json(syllabuses);
    } catch (error) {
        console.error("Error fetching all syllabuses:", error);
        res.status(500).json({ message: "Failed to fetch syllabuses." });
    }
});

// ADMIN: Get teachers for a specific class and subject from the timetable
app.get('/api/syllabus/teachers/:classGroup/:subjectName', async (req, res) => {
    const { classGroup, subjectName } = req.params;
    if (!classGroup || !subjectName) return res.status(400).json({ message: "Class and Subject are required." });
    try {
        const query = `
            SELECT DISTINCT u.id, u.full_name 
            FROM users u
            JOIN timetables t ON u.id = t.teacher_id
            WHERE t.class_group = ? AND t.subject_name = ? AND u.role = 'teacher'
            ORDER BY u.full_name;`;
        const [teachers] = await db.query(query, [classGroup, subjectName]);
        res.status(200).json(teachers);
    } catch (error) { console.error("Error fetching teachers for syllabus:", error); res.status(500).json({ message: "Failed to fetch teachers." }); }
});

// ADMIN: Get detailed progress for a syllabus, showing which teacher updated what
app.get('/api/syllabus/class-progress/:syllabusId', async (req, res) => {
    const { syllabusId } = req.params;
    try {
        const query = `
            SELECT 
                sl.id as lesson_id,
                sl.lesson_name,
                sl.due_date,
                (SELECT sp.status FROM syllabus_progress sp WHERE sp.lesson_id = sl.id LIMIT 1) as status,
                (SELECT u.full_name FROM users u JOIN syllabus_progress sp ON u.id = sp.last_updated_by WHERE sp.lesson_id = sl.id AND sp.last_updated_by IS NOT NULL LIMIT 1) as updater_name
            FROM syllabus_lessons sl
            WHERE sl.syllabus_id = ?
            ORDER BY sl.due_date ASC;
        `;
        const [lessons] = await db.query(query, [syllabusId]);
        const result = lessons.map(lesson => ({
            ...lesson,
            status: lesson.status || 'Pending',
            updater_name: lesson.updater_name || 'Not yet updated'
        }));
        res.status(200).json(result);
    } catch (error) {
        console.error("Error fetching admin class progress:", error);
        res.status(500).json({ message: "Failed to fetch class progress data." });
    }
});

// TEACHER: Get syllabus and lessons for a specific class/subject
app.get('/api/syllabus/teacher/:classGroup/:subjectName', async (req, res) => {
    const { classGroup, subjectName } = req.params;
    try {
        const [[syllabus]] = await db.query('SELECT id, class_group, subject_name FROM syllabuses WHERE class_group = ? AND subject_name = ?', [classGroup, subjectName]);
        if (!syllabus) return res.status(404).json({ message: 'Syllabus not found for this class and subject.' });
        const [lessons] = await db.query('SELECT id, lesson_name, due_date FROM syllabus_lessons WHERE syllabus_id = ? ORDER BY due_date ASC', [syllabus.id]);
        res.json({ ...syllabus, lessons });
    } catch (error) { console.error("Error fetching teacher syllabus:", error); res.status(500).json({ message: 'Failed to fetch syllabus.' }); }
});

// TEACHER: Mark a lesson's status for the ENTIRE class
app.patch('/api/syllabus/lesson-status', async (req, res) => {
    const { class_group, lesson_id, status, teacher_id } = req.body;
    if (!class_group || !lesson_id || !status || !teacher_id) {
        return res.status(400).json({ message: "Invalid data provided." });
    }
    
    const connection = await db.getConnection(); // Use a transaction
    try {
        await connection.beginTransaction();

        // Step 1: Update the syllabus progress for all students in the class (No change here)
        const query = `
            UPDATE syllabus_progress sp
            JOIN users u ON sp.student_id = u.id
            SET sp.status = ?, sp.last_updated_by = ? 
            WHERE sp.lesson_id = ? AND u.class_group = ?`;
        const [result] = await connection.query(query, [status, teacher_id, lesson_id, class_group]);

        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★

        // Only send a notification if the status is NOT being reverted to 'Pending'
        if (status === 'Completed' || status === 'Missed') {
            
            // 1. Find all students in the affected class group
            const [students] = await connection.query("SELECT id FROM users WHERE role = 'student' AND class_group = ?", [class_group]);

            // 2. Get details for the notification message (teacher's name, lesson name)
            const [[teacher]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [teacher_id]);
            const [[lesson]] = await connection.query("SELECT lesson_name FROM syllabus_lessons WHERE id = ?", [lesson_id]);
            
            // 3. Prepare notification details
            const notificationTitle = `Syllabus Update: ${lesson.lesson_name}`;
            const notificationMessage = `${teacher.full_name} has marked the lesson "${lesson.lesson_name}" as ${status}.`;
            const senderName = teacher.full_name;

            // 4. Send notifications to all students in that class
            if (students.length > 0) {
                const studentIds = students.map(s => s.id);
                await createBulkNotifications(
                    connection,
                    studentIds,
                    senderName,
                    notificationTitle,
                    notificationMessage,
                    '/syllabus'
                );
            }
        }
        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★

        await connection.commit();
        res.status(200).json({ message: `Lesson marked as ${status} for ${result.affectedRows} students.` });

    } catch (error) {
        await connection.rollback();
        console.error("Error updating lesson status:", error);
        res.status(500).json({ message: 'Error updating lesson status for the class.' });
    } finally {
        connection.release();
    }
});

// STUDENT: Get their overall progress summary
app.get('/api/syllabus/student/overview/:studentId', async (req, res) => {
    const { studentId } = req.params;
    try {
        const [totalStats] = await db.query("SELECT status, COUNT(*) as count FROM syllabus_progress WHERE student_id = ? GROUP BY status", [studentId]);
        const [subjectStats] = await db.query(`SELECT s.id as syllabus_id, s.subject_name, sp.status, COUNT(sp.id) as count FROM syllabus_progress sp JOIN syllabus_lessons sl ON sp.lesson_id = sl.id JOIN syllabuses s ON sl.syllabus_id = s.id WHERE sp.student_id = ? GROUP BY s.id, s.subject_name, sp.status`, [studentId]);
        res.json({ totalStats, subjectStats });
    } catch (error) { console.error("Error fetching student overview:", error); res.status(500).json({ message: 'Failed to fetch progress overview.' }); }
});

// STUDENT: Get their detailed progress for one subject
app.get('/api/syllabus/student/subject-details/:syllabusId/:studentId', async (req, res) => {
    const { syllabusId, studentId } = req.params;
    try {
        const [[syllabus]] = await db.query('SELECT * FROM syllabuses WHERE id = ?', [syllabusId]);
        if (!syllabus) return res.status(404).json({ message: 'Syllabus not found.' });
        const [lessonsWithStatus] = await db.query(`SELECT sl.id, sl.lesson_name, sl.due_date, sp.status FROM syllabus_lessons sl LEFT JOIN syllabus_progress sp ON sl.id = sp.lesson_id AND sp.student_id = ? WHERE sl.syllabus_id = ? ORDER BY sl.due_date ASC`, [studentId, syllabusId]);
        res.json({ ...syllabus, lessons: lessonsWithStatus });
    } catch (error) { console.error("Error fetching subject details:", error); res.status(500).json({ message: 'Failed to fetch subject details.' }); }
});



// ==========================================================
// --- FULL TRANSPORT API ROUTES (WITH STOP COORDINATES) ---
// ==========================================================
const Openrouteservice = require('openrouteservice-js');
const { encode } = require('@googlemaps/polyline-codec');

const ors = new Openrouteservice.Directions({
  api_key: process.env.OPENROUTESERVICE_API_KEY,
});

const geocodeService = new Openrouteservice.Geocode({
    api_key: process.env.OPENROUTESERVICE_API_KEY,
});

async function geocodeAddress(addressText) {
    const response = await geocodeService.geocode({ text: addressText, size: 1 });
    if (response.features && response.features.length > 0) {
        return response.features[0].geometry.coordinates; // [longitude, latitude]
    }
    throw new Error(`Could not find coordinates for address: "${addressText}"`);
}

// =========================================================================
// ★★★ THIS IS THE NEW CODE YOU MUST ADD ★★★
// This is the special, public endpoint for the driver's phone.
// It does not require a login token.
// =========================================================================
app.put('/api/transport/routes/public/:routeId/location', async (req, res) => {
  const { lat, lng } = req.body;
  const { routeId } = req.params;

  if (!lat || !lng) {
    return res.status(400).json({ message: 'Latitude and Longitude are required.' });
  }

  try {
    const [result] = await db.query(
      'UPDATE transport_routes SET current_lat = ?, current_lng = ?, last_location_update = NOW() WHERE route_id = ?', 
      [lat, lng, routeId]
    );

    if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Route not found to update location.' });
    }

    res.status(200).json({ message: 'Location updated successfully.' });
  } catch (error) {
    console.error("Error updating public location:", error);
    res.status(500).json({ message: 'Failed to update location.' });
  }
});

// --- CREATE ROUTE (MODIFIED) ---
app.post('/api/transport/routes', async (req, res) => {
    const { route_name, driver_name, driver_phone, conductor_name, conductor_phone, stops, city, state, country, created_by } = req.body;
    if (!process.env.OPENROUTESERVICE_API_KEY) return res.status(500).json({ message: "Server configuration error: ORS API key missing." });
    if (!route_name || !stops || stops.length < 2) return res.status(400).json({ message: 'Route Name and at least two boarding points are required.' });

    const connection = await db.getConnection();
    try {
        // Geocode each stop to get its coordinates and store them
        const stopData = [];
        for (const stop of stops) {
            const fullAddress = `${stop.point}, ${city}, ${state}, ${country}`;
            const coords = await geocodeAddress(fullAddress); // Gets [longitude, latitude]
            stopData.push({ name: stop.point, coordinates: coords });
        }

        // Calculate the full route polyline using the geocoded coordinates
        const routeResponse = await ors.calculate({ coordinates: stopData.map(s => s.coordinates), profile: 'driving-car', format: 'geojson' });
        if (!routeResponse.features || routeResponse.features.length === 0) throw new Error("OpenRouteService did not return a valid route.");
        const routeGeometry = routeResponse.features[0].geometry.coordinates;
        const pointsToEncode = routeGeometry.map(p => [p[1], p[0]]); // Flip to [lat, lng] for encoding
        const routePolyline = encode(pointsToEncode, 5);

        await connection.beginTransaction();
        
        // Insert the main route details
        const routeQuery = 'INSERT INTO transport_routes (route_name, driver_name, driver_phone, conductor_name, conductor_phone, city, state, country, route_path_polyline, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
        const [routeResult] = await connection.query(routeQuery, [route_name, driver_name, driver_phone, conductor_name, conductor_phone, city, state, country, routePolyline, created_by]);
        const route_id = routeResult.insertId;
        
        // Insert each stop with its name, order, AND coordinates
        const stopsQuery = 'INSERT INTO transport_stops (route_id, stop_name, stop_order, stop_lat, stop_lng) VALUES ?';
        const stopValues = stopData.map((stop, index) => [
            route_id, 
            stop.name, 
            index + 1,
            stop.coordinates[1], // Latitude is the second element
            stop.coordinates[0]  // Longitude is the first element
        ]);
        await connection.query(stopsQuery, [stopValues]);
        
        // Notification logic (unchanged)
        const [usersToNotify] = await connection.query("SELECT id FROM users WHERE role IN ('student', 'teacher') AND id != ?", [created_by]);
        if (usersToNotify.length > 0) {
            const [[admin]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [created_by]);
            const senderName = admin.full_name || "Transport Department";
            const recipientIds = usersToNotify.map(u => u.id);
            const notificationTitle = "New Transport Route Added";
            const notificationMessage = `A new bus route, "${route_name}", has been added. Please check if it's relevant for you.`;
            await createBulkNotifications(connection, recipientIds, senderName, notificationTitle, notificationMessage, '/transport');
        }

        await connection.commit();
        res.status(201).json({ message: 'Route created and users notified successfully!' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Error creating transport route:", error);
        res.status(500).json({ message: error.message || 'Failed to create route.' });
    } finally {
        if (connection) connection.release();
    }
});


// --- UPDATE ROUTE (MODIFIED) ---
app.put('/api/transport/routes/:routeId', async (req, res) => {
    const { routeId } = req.params;
    const { route_name, driver_name, driver_phone, conductor_name, conductor_phone, stops, city, state, country, created_by } = req.body;
    
    const connection = await db.getConnection();
    try {
        // Geocode each stop to get its coordinates and store them
        const stopData = [];
        for (const stop of stops) {
            const fullAddress = `${stop.point}, ${city}, ${state}, ${country}`;
            const coords = await geocodeAddress(fullAddress);
            stopData.push({ name: stop.point, coordinates: coords });
        }

        // Recalculate the full route polyline
        const routeResponse = await ors.calculate({ coordinates: stopData.map(s => s.coordinates), profile: 'driving-car', format: 'geojson' });
        if (!routeResponse.features || !routeResponse.features.length) throw new Error("OpenRouteService did not return a valid route.");
        const routeGeometry = routeResponse.features[0].geometry.coordinates;
        const pointsToEncode = routeGeometry.map(p => [p[1], p[0]]);
        const routePolyline = encode(pointsToEncode, 5);

        await connection.beginTransaction();
        
        // Update the main route details
        const routeQuery = 'UPDATE transport_routes SET route_name = ?, driver_name = ?, driver_phone = ?, conductor_name = ?, conductor_phone = ?, city = ?, state = ?, country = ?, route_path_polyline = ? WHERE route_id = ?';
        await connection.query(routeQuery, [route_name, driver_name, driver_phone, conductor_name, conductor_phone, city, state, country, routePolyline, routeId]);
        
        // Delete old stops and insert the new ones with coordinates
        await connection.query('DELETE FROM transport_stops WHERE route_id = ?', [routeId]);
        const stopsQuery = 'INSERT INTO transport_stops (route_id, stop_name, stop_order, stop_lat, stop_lng) VALUES ?';
        const stopValues = stopData.map((stop, index) => [
            routeId, 
            stop.name, 
            index + 1,
            stop.coordinates[1], // Latitude
            stop.coordinates[0]  // Longitude
        ]);
        await connection.query(stopsQuery, [stopValues]);

        // Notification logic (unchanged)
        const [usersToNotify] = await connection.query("SELECT id FROM users WHERE role IN ('student', 'teacher') AND id != ?", [created_by]);
        if (usersToNotify.length > 0) {
            const [[admin]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [created_by]);
            const senderName = admin.full_name || "Transport Department";
            const recipientIds = usersToNotify.map(u => u.id);
            const notificationTitle = "Transport Route Updated";
            const notificationMessage = `The bus route "${route_name}" has been updated. Please review the changes.`;
            await createBulkNotifications(connection, recipientIds, senderName, notificationTitle, notificationMessage, '/transport');
        }
        
        await connection.commit();
        res.status(200).json({ message: 'Route updated and users notified successfully!' });

    } catch (error) {
        if (connection) await connection.rollback();
        console.error("Error updating transport route:", error);
        res.status(500).json({ message: error.message || 'Failed to update route.' });
    } finally {
        if (connection) connection.release();
    }
});


// --- GET ROUTE DETAILS (MODIFIED) ---
app.get('/api/transport/routes/:routeId', async (req, res) => { 
    try { 
        const [routeResult] = await db.query('SELECT * FROM transport_routes WHERE route_id = ?', [req.params.routeId]); 
        if (!routeResult[0]) { 
            return res.status(404).json({ message: 'Route not found.' }); 
        } 
        // Modified to select the new stop_lat and stop_lng columns
        const [stopsResult] = await db.query(
            'SELECT stop_name as point, stop_order as sno, stop_lat, stop_lng FROM transport_stops WHERE route_id = ? ORDER BY stop_order ASC', 
            [req.params.routeId]
        ); 
        
        const route = routeResult[0]; 
        const stops = stopsResult;
        res.json({ ...route, stops }); 

    } catch (error) { 
        console.error("Error getting route details:", error);
        res.status(500).json({ message: 'Failed to fetch route details.' }); 
    }
});


// --- Other routes (Unchanged) ---
app.delete('/api/transport/routes/:routeId', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM transport_routes WHERE route_id = ?', [req.params.routeId]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Route not found.' });
    res.status(200).json({ message: 'Route deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete route.' });
  }
});

app.put('/api/transport/routes/:routeId/location', async (req, res) => {
  const { lat, lng } = req.body;
  if (!lat || !lng) return res.status(400).json({ message: 'Latitude and Longitude are required.' });
  try {
    await db.query('UPDATE transport_routes SET current_lat = ?, current_lng = ?, last_location_update = NOW() WHERE route_id = ?', [lat, lng, req.params.routeId]);
    res.status(200).json({ message: 'Location updated.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update location.' });
  }
});

app.get('/api/transport/routes', async (req, res) => {
  try {
    const [routes] = await db.query('SELECT route_id, route_name FROM transport_routes ORDER BY route_name ASC');
    res.json(routes);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch routes.' });
  }
});



// ==========================================================
// --- GALLERY API ROUTES (CORRECTED AND OPTIMIZED) ---
// ==========================================================

// --- ★★★ 1. THE NEW, FAST ROUTE TO GET ALBUM SUMMARIES ★★★ ---
// This replaces your old /api/gallery route. It's much faster.
app.get('/api/gallery', async (req, res) => {
    const query = `
        SELECT 
            g.title, 
            MAX(g.event_date) as event_date, 
            COUNT(g.id) as item_count,
            (
                SELECT file_path 
                FROM gallery_items 
                WHERE title = g.title AND file_type = 'photo' 
                ORDER BY event_date DESC, created_at DESC 
                LIMIT 1
            ) as cover_image_path
        FROM gallery_items g
        GROUP BY g.title
        ORDER BY MAX(g.event_date) DESC;
    `;
    try {
        const [albums] = await db.query(query);
        res.status(200).json(albums);
    } catch (error) {
        console.error("GET /api/gallery (albums) Error:", error);
        res.status(500).json({ message: "Error fetching gallery albums." });
    }
});

// --- ★★★ 2. THE NEW, REQUIRED ROUTE TO GET ITEMS FOR A SINGLE ALBUM ★★★ ---
// Your AlbumDetailScreen needs this to work.
app.get('/api/gallery/album/:title', async (req, res) => {
    const { title } = req.params;
    if (!title) {
        return res.status(400).json({ message: 'Album title is required.' });
    }

    try {
        const decodedTitle = decodeURIComponent(title);
        const query = `
            SELECT id, title, event_date, file_path, file_type 
            FROM gallery_items 
            WHERE title = ? 
            ORDER BY created_at DESC
        `;
        const [items] = await db.query(query, [decodedTitle]);
        res.status(200).json(items);
    } catch (error) {
        console.error(`GET /api/gallery/album/${title} Error:`, error);
        res.status(500).json({ message: "Error fetching album items." });
    }
});

// POST: Upload a new gallery item (Your existing code, it's correct)
app.post('/api/gallery/upload', galleryUpload.single('media'), async (req, res) => {
    const { title, event_date, role, adminId } = req.body;
    const file = req.file;

    if (role !== 'admin') {
        if (file) fs.unlinkSync(file.path);
        return res.status(403).json({ message: "Forbidden: Requires Admin Role." });
    }
    if (!file || !title || !event_date || !adminId) {
        if (file) fs.unlinkSync(file.path);
        return res.status(400).json({ message: "Missing required fields: adminId, title, event_date, and a media file." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const file_type = file.mimetype.startsWith('image') ? 'photo' : 'video';
        const file_path = `/uploads/${file.filename}`;
        const insertQuery = 'INSERT INTO gallery_items (title, event_date, file_path, file_type, uploaded_by) VALUES (?, ?, ?, ?, ?)';
        const [result] = await connection.query(insertQuery, [title, event_date, file_path, file_type, adminId]);
        
        // --- Notification Logic (Your existing code, looks fine) ---
        // This function is assumed to be defined elsewhere, perhaps in middleware
        const createBulkNotifications = async (conn, recipients, sender, notifTitle, notifMsg, link) => { /* ... */ };
        const [usersToNotify] = await connection.query("SELECT id FROM users WHERE role IN ('student', 'teacher', 'donor') AND id != ?", [adminId]);
        if (usersToNotify.length > 0) {
            const [[admin]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [adminId]);
            const senderName = admin.full_name || "School Administration";
            const recipientIds = usersToNotify.map(u => u.id);
            const notificationTitle = `New Gallery Album: ${title}`;
            const notificationMessage = `New photos/videos for "${title}" have been added. Check them out!`;
            // Ensure createBulkNotifications is available in this scope or defined
            // if (typeof createBulkNotifications === 'function') {
            //     await createBulkNotifications(connection, recipientIds, senderName, notificationTitle, notificationMessage, '/gallery');
            // }
        }
        // --- End Notification Logic ---
        
        await connection.commit();
        res.status(201).json({
            message: "Media uploaded successfully!",
            insertId: result.insertId,
            filePath: file_path
        });
    } catch (error) {
        await connection.rollback();
        if (file) fs.unlinkSync(file.path);
        console.error("POST /api/gallery/upload Error:", error);
        res.status(500).json({ message: "Failed to save gallery item." });
    } finally {
        connection.release();
    }
});

// DELETE: Delete an entire album by its title (Your existing code, it's correct)
app.delete('/api/gallery/album', async (req, res) => {
    const { title, role } = req.body;
    if (role !== 'admin') {
        return res.status(403).json({ message: "Forbidden: Requires Admin Role." });
    }
    if (!title) {
        return res.status(400).json({ message: "Album title is required." });
    }
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [items] = await connection.query('SELECT file_path FROM gallery_items WHERE title = ?', [title]);
        if (items.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Album not found." });
        }
        await connection.query('DELETE FROM gallery_items WHERE title = ?', [title]);
        items.forEach(item => {
            if (item.file_path) {
                const fullPath = path.join(__dirname, '..', item.file_path); // Correct pathing assuming server is in a subfolder
                fs.unlink(fullPath, (err) => {
                    if (err) console.error(`Failed to delete file from disk: ${fullPath}`, err);
                });
            }
        });
        await connection.commit();
        res.status(200).json({ message: `Album "${title}" deleted successfully.` });
    } catch (error) {
        await connection.rollback();
        console.error(`DELETE /api/gallery/album Error:`, error);
        res.status(500).json({ message: "Error deleting album." });
    } finally {
        connection.release();
    }
});

// DELETE: Delete a single gallery item (Your existing code, it's correct)
app.delete('/api/gallery/:id', async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    if (role !== 'admin') {
        return res.status(403).json({ message: "Forbidden: Requires Admin Role." });
    }
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query('SELECT file_path FROM gallery_items WHERE id = ?', [id]);
        if (rows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Item not found." });
        }
        const filePath = rows[0].file_path;
        await connection.query('DELETE FROM gallery_items WHERE id = ?', [id]);
        if (filePath) {
            const fullPath = path.join(__dirname, '..', filePath); // Correct pathing
            fs.unlink(fullPath, (err) => {
                if (err) console.error(`Failed to delete file from disk: ${fullPath}`, err);
            });
        }
        await connection.commit();
        res.status(200).json({ message: "Item deleted successfully." });
    } catch (error) {
        await connection.rollback();
        console.error(`DELETE /api/gallery/${id} Error:`, error);
        res.status(500).json({ message: "Error deleting item." });
    } finally {
        connection.release();
    }
});



// ==============================
// --- CHAT-AI API ROUTES ---
// ==============================

// This setup defines how to handle audio file uploads for the Chat AI.
// It MUST come before the routes that use 'uploadAudio'.

// // 1. Define the directory where chat audio files will be stored
// const audioUploadDir = 'uploads/audio';

// // 2. Create the directory if it doesn't exist
// if (!fs.existsSync(audioUploadDir)) {
//     fs.mkdirSync(audioUploadDir, { recursive: true });
// }

// // 3. Configure how audio files are stored
// const audioStorage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, audioUploadDir); // Save files in the 'uploads/audio' folder
//     },
//     filename: (req, file, cb) => {
//         // Create a unique filename like 'audio-1678886400000.mp4'
//         cb(null, `audio-${Date.now()}${path.extname(file.originalname)}`);
//     }
// });

// // 4. Create the multer instance that the route will use.
// // This is the 'uploadAudio' that was previously undefined.
// const uploadAudio = multer({ storage: audioStorage });


// // Get chat history for a specific user
// app.get('/api/chat/history/:userId', async (req, res) => {
//   const { userId } = req.params;
//   if (!userId) return res.status(400).json({ message: 'User ID is required.' });

//   try {
//     const query = "SELECT id, role, content, type, created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at ASC";
//     const [messages] = await db.query(query, [userId]);
//     res.status(200).json(messages);
//   } catch (error) {
//     console.error("GET /api/chat/history Error:", error);
//     res.status(500).json({ message: "Error fetching chat history." });
//   }
// });

// // Post a user message and get AI response (TEXT/IMAGE)
// app.post('/api/chat/message', async (req, res) => {
//   const { userId, message, type } = req.body;

//   if (!userId || !message || typeof message !== 'string') {
//     return res.status(400).json({ message: "userId and message are required." });
//   }

//   const messageType = type || 'text';

//   const connection = await db.getConnection();
//   try {
//     await connection.beginTransaction();

//     await connection.query(
//       'INSERT INTO chat_messages (user_id, role, content, type) VALUES (?, ?, ?, ?)',
//       [userId, 'user', message, messageType]
//     );

//     if (messageType !== 'text') {
//       // Don't get AI reply for non-text messages like images
//       await connection.commit();
//       res.status(200).json({ reply: null });
//       return;
//     }

//     const [history] = await connection.query(
//       "SELECT role, content FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 10",
//       [userId]
//     );

//     const messages = history.reverse().map(m => ({
//       role: m.role === 'ai' ? 'assistant' : 'user',
//       content: m.content,
//     }));
//     messages.push({ role: 'user', content: message });

//     const completion = await openai.chat.completions.create({
//       model: "gpt-3.5-turbo",
//       messages: messages,
//     });

//     const aiReply = completion.choices[0].message.content;

//     await connection.query(
//       'INSERT INTO chat_messages (user_id, role, content, type) VALUES (?, ?, ?, ?)',
//       [userId, 'ai', aiReply, 'text']
//     );

//     await connection.commit();
//     res.status(200).json({ reply: aiReply });
//   } catch (error) {
//     await connection.rollback();
//     console.error("POST /api/chat/message Error:", error);
//     res.status(500).json({ message: "An error occurred." });
//   } finally {
//     connection.release();
//   }
// });

// // Route for uploading and saving VOICE MESSAGES
// app.post('/api/chat/voice-message', uploadAudio.single('audio'), async (req, res) => {
//     const { userId } = req.body;
//     if (!req.file || !userId) {
//         return res.status(400).json({ message: 'User ID and audio file are required.' });
//     }

//     // The path to save in the database, normalized to use forward slashes
//     const audioUrl = `/${audioUploadDir}/${req.file.filename}`.replace(/\\/g, "/");

//     try {
//         const query = 'INSERT INTO chat_messages (user_id, role, content, type) VALUES (?, ?, ?, ?)';
//         await db.query(query, [userId, 'user', audioUrl, 'audio']);
        
//         // We don't generate an AI reply for voice messages.
//         res.status(200).json({ message: 'Audio message saved.', audioUrl });

//     } catch (error) {
//         console.error("POST /api/chat/voice-message Error:", error);
//         res.status(500).json({ message: 'Failed to save audio message.' });
//     }
// });



// 📂 File: backend/server.js (Paste this code before the app.listen() call)

// ==========================================================
// --- SUGGESTIONS API ROUTES (NEW) ---
// ==========================================================

// DONOR: Get a list of their own suggestion threads
app.get('/api/suggestions/my-suggestions/:donorId', async (req, res) => {
    const { donorId } = req.params;
    const query = 'SELECT * FROM suggestions WHERE donor_id = ? ORDER BY last_reply_at DESC';
    try {
        const [suggestions] = await db.query(query, [donorId]);
        res.json(suggestions);
    } catch (error) { res.status(500).json({ message: 'Error fetching suggestions.' }); }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// DONOR: Create a new suggestion thread with an initial message/file
app.post('/api/suggestions', upload.single('attachment'), async (req, res) => {
    const { donorId, subject, message } = req.body;
    if (!subject || (!message && !req.file)) {
        return res.status(400).json({ message: 'A subject and either a message or a file attachment is required.' });
    }
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        
        // Step 1: Create the suggestion thread and the first message
        const [suggestionResult] = await connection.query('INSERT INTO suggestions (donor_id, subject) VALUES (?, ?)', [donorId, subject]);
        const newSuggestionId = suggestionResult.insertId;
        const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
        const fileName = req.file ? req.file.originalname : null;
        await connection.query('INSERT INTO suggestion_messages (suggestion_id, user_id, message_text, file_url, file_name) VALUES (?, ?, ?, ?, ?)', [newSuggestionId, donorId, message, fileUrl, fileName]);

        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★
        
        // 1. Find all admins
        const [admins] = await connection.query("SELECT id FROM users WHERE role = 'admin'");
        
        if (admins.length > 0) {
            // 2. Get the donor's name
            const [[donor]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [donorId]);

            // 3. Prepare and send notifications
            const adminIds = admins.map(a => a.id);
            const notificationTitle = `New Suggestion Received`;
            const notificationMessage = `${donor.full_name} has submitted a new suggestion: "${subject}"`;
            
            await createBulkNotifications(
                connection,
                adminIds,
                donor.full_name,
                notificationTitle,
                notificationMessage,
                `/admin/suggestions/${newSuggestionId}` // Link for admins to view the suggestion
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★

        await connection.commit();
        res.status(201).json({ message: 'Suggestion submitted successfully!', suggestionId: newSuggestionId });

    } catch (error) {
        await connection.rollback();
        console.error("Suggestion Post Error:", error);
        res.status(500).json({ message: 'Error submitting suggestion.' });
    } finally {
        connection.release();
    }
});

// ADMIN/DONOR: Get a full conversation for a single suggestion thread
app.get('/api/suggestions/:suggestionId', async (req, res) => {
    const { suggestionId } = req.params;
    try {
        const [[thread]] = await db.query('SELECT s.*, u.full_name as donor_name FROM suggestions s JOIN users u ON s.donor_id = u.id WHERE s.id = ?', [suggestionId]);
        if (!thread) return res.status(404).json({ message: 'Suggestion thread not found.' });
        
        const [messages] = await db.query('SELECT sm.*, u.role, u.full_name FROM suggestion_messages sm JOIN users u ON sm.user_id = u.id WHERE sm.suggestion_id = ? ORDER BY sm.created_at ASC', [suggestionId]);
        
        res.json({ thread, messages });
    } catch (error) { res.status(500).json({ message: 'Error fetching suggestion details.' }); }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// ADMIN/DONOR: Post a new message/file to an existing thread
app.post('/api/suggestions/reply', upload.single('attachment'), async (req, res) => {
    const { suggestionId, userId, message } = req.body;
    if (!message && !req.file) {
        return res.status(400).json({ message: 'A message or a file attachment is required.' });
    }
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Insert the new reply
        const fileUrl = req.file ? `/uploads/${req.file.filename}` : null;
        const fileName = req.file ? req.file.originalname : null;
        await connection.query('INSERT INTO suggestion_messages (suggestion_id, user_id, message_text, file_url, file_name) VALUES (?, ?, ?, ?, ?)', [suggestionId, userId, message, fileUrl, fileName]);

        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★
        
        // 1. Get info about the replier and the suggestion's original creator
        const [[replier]] = await connection.query("SELECT full_name, role FROM users WHERE id = ?", [userId]);
        const [[suggestion]] = await connection.query("SELECT donor_id, subject FROM suggestions WHERE id = ?", [suggestionId]);

        // 2. CASE A: An admin replied. Notify the original donor.
        if (replier.role === 'admin') {
            const originalDonorId = suggestion.donor_id;
            // Ensure admin doesn't get notified for their own reply if they started a thread (future-proofing)
            if (originalDonorId !== userId) { 
                const notificationTitle = `Reply on Suggestion: "${suggestion.subject}"`;
                const notificationMessage = `${replier.full_name} has replied to your suggestion.`;
                await createNotification(connection, originalDonorId, replier.full_name, notificationTitle, notificationMessage, `/suggestions/${suggestionId}`);
            }
        } 
        // 3. CASE B: A donor replied. Notify all admins.
        else {
            const [admins] = await connection.query("SELECT id FROM users WHERE role = 'admin'");
            if (admins.length > 0) {
                const adminIds = admins.map(a => a.id);
                const notificationTitle = `Reply on Suggestion: "${suggestion.subject}"`;
                const notificationMessage = `${replier.full_name} has replied to a suggestion thread.`;
                await createBulkNotifications(connection, adminIds, replier.full_name, notificationTitle, notificationMessage, `/admin/suggestions/${suggestionId}`);
            }
        }
        
        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★

        await connection.commit();
        res.status(201).json({ message: 'Reply sent successfully.' });

    } catch (error) {
        await connection.rollback();
        console.error("Error sending suggestion reply:", error);
        res.status(500).json({ message: 'Error sending reply.' });
    } finally {
        connection.release();
    }
});

// ADMIN: Get all suggestion threads for the management dashboard
app.get('/api/admin/suggestions', async (req, res) => {
    const { status } = req.query;
    let query = 'SELECT s.*, u.full_name as donor_name FROM suggestions s JOIN users u ON s.donor_id = u.id ';
    const params = [];
    if (status) {
        query += 'WHERE s.status = ? ';
        params.push(status);
    }
    query += 'ORDER BY s.last_reply_at DESC';
    try {
        const [suggestions] = await db.query(query, params);
        res.json(suggestions);
    } catch (error) { res.status(500).json({ message: 'Error fetching all suggestions.' }); }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// ADMIN: Change a suggestion's status
app.put('/api/admin/suggestion/status', async (req, res) => {
    const { suggestionId, status, adminId } = req.body; // Expect adminId from frontend
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Update the status
        await connection.query('UPDATE suggestions SET status = ? WHERE id = ?', [status, suggestionId]);
        
        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★

        // 1. Get the suggestion details to find the original donor
        const [[suggestion]] = await connection.query("SELECT donor_id, subject FROM suggestions WHERE id = ?", [suggestionId]);

        if (suggestion) {
            // 2. Get the admin's name
            const [[admin]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [adminId]);
            const senderName = admin.full_name || "School Administration";

            // 3. Prepare notification details
            const notificationTitle = `Suggestion Status Updated`;
            const notificationMessage = `The status of your suggestion "${suggestion.subject}" has been updated to "${status}".`;

            // 4. Send the notification to the original donor
            await createNotification(
                connection,
                suggestion.donor_id,
                senderName,
                notificationTitle,
                notificationMessage,
                `/suggestions/${suggestionId}`
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★

        await connection.commit();
        res.status(200).json({ message: 'Status updated and donor notified.' });

    } catch (error) {
        await connection.rollback();
        console.error("Error updating suggestion status:", error);
        res.status(500).json({ message: 'Error updating status.' });
    } finally {
        connection.release();
    }
});


// 📂 File: backend/server.js (DELETE both old blocks and PASTE this one in their place)

// ==========================================================
// --- SPONSORSHIP & PAYMENTS API ROUTES (CORRECTED & UNIFIED) ---
// ==========================================================

// 1. SINGLE, UNIFIED MULTER SETUP FOR BOTH MODULES
const paymentStorage = multer.diskStorage({
    destination: './public/uploads/', // Ensure you have a /public/uploads directory
    filename: function(req, file, cb){
        // Give files a clear prefix based on what they are for
        let prefix = 'file';
        if (file.fieldname === 'qrCodeImage') prefix = 'qr';
        if (file.fieldname === 'screenshot') prefix = 'proof'; // Used by both modules
        
        cb(null, `${prefix}-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const paymentUpload = multer({ storage: paymentStorage });

// 2. SINGLE APP.USE() for serving images.
// Make the '/public' folder and its contents (like '/uploads') accessible via URL.
app.use('/public', express.static(path.join(__dirname, 'public')));


// --- SUB-MODULE: MANUAL PAYMENTS (QR Code & Bank Details) ---

// ADMIN: Get the current QR/Bank details for the management screen
app.get('/api/admin/payment-details', async (req, res) => {
    try {
        const [[details]] = await db.query('SELECT * FROM payment_details WHERE id = 1');
        res.json(details || {});
    } catch (error) { res.status(500).json({ message: 'Error fetching payment details.' }); }
});

// ADMIN: Update QR/Bank details
app.post('/api/admin/payment-details', paymentUpload.single('qrCodeImage'), async (req, res) => {
    const { accountHolderName, accountNumber, ifscCode, cifCode } = req.body;
    let sql = 'UPDATE payment_details SET account_holder_name = ?, account_number = ?, ifsc_code = ?, cif_code = ?';
    const params = [accountHolderName, accountNumber, ifscCode, cifCode];

    if (req.file) {
        const qrCodeUrl = `/public/uploads/${req.file.filename}`;
        sql += ', qr_code_url = ?';
        params.push(qrCodeUrl);
    }
    sql += ' WHERE id = 1';

    try {
        await db.query(sql, params);
        res.json({ message: 'Payment details updated successfully!' });
    } catch (error) { res.status(500).json({ message: 'Error updating details.' }); }
});

// ADMIN: Get a list of all general payment proofs submitted by donors
app.get('/api/admin/payment-proofs', async (req, res) => {
    const query = `
        SELECT pp.*, u.username as donor_username FROM payment_proofs pp
        JOIN users u ON pp.donor_id = u.id ORDER BY pp.submission_date DESC`;
    try {
        const [proofs] = await db.query(query);
        res.json(proofs);
    } catch (error) {
        console.error("Error fetching admin payment proofs:", error);
        res.status(500).json({ message: 'Error fetching payment proofs.' });
    }
});

// DONOR: Get the QR/Bank details to display on their screen
app.get('/api/payment-details', async (req, res) => {
    try {
        const [[details]] = await db.query('SELECT * FROM payment_details WHERE id = 1');
        res.json(details || {});
    } catch (error) { res.status(500).json({ message: 'Error fetching payment details.' }); }
});

// DONOR: Upload their general payment screenshot as proof (WITH AMOUNT)
app.post('/api/donor/payment-proof', paymentUpload.single('screenshot'), async (req, res) => {
    const { donorId, amount } = req.body;
    if (!req.file || !donorId || !amount) return res.status(400).json({ message: 'Amount, screenshot, and Donor ID are required.' });
    const screenshotUrl = `/public/uploads/${req.file.filename}`;
    try {
        await db.query('INSERT INTO payment_proofs (donor_id, amount, screenshot_url) VALUES (?, ?, ?)', [donorId, amount, screenshotUrl]);
        res.status(201).json({ message: 'Payment proof uploaded successfully. Thank you!' });
    } catch (error) { res.status(500).json({ message: 'Error uploading proof.' }); }
});

// DONOR: Get their personal general payment proof history (WITH AMOUNT)
app.get('/api/donor/payment-history/:donorId', async (req, res) => {
    const { donorId } = req.params;
    if (!donorId) return res.status(400).json({ message: 'Donor ID is required.' });
    try {
        const query = `SELECT id, amount, screenshot_url, submission_date FROM payment_proofs WHERE donor_id = ? ORDER BY submission_date DESC`;
        const [history] = await db.query(query, [donorId]);
        res.json(history);
    } catch (error) { res.status(500).json({ message: 'Error fetching payment history.' }); }
});


// --- SUB-MODULE: SPONSORSHIP (Manual Proof-Based Flow) ---

// 📂 File: server.js (REPLACE THIS ROUTE)

// DONOR: Submit the initial sponsorship application form
app.post('/api/sponsorship/apply', async (req, res) => {
    const { donorId, fullName, email, phone, organization, message, wantsUpdates, wantsToVisit } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Insert the application
        const [result] = await connection.query(
            'INSERT INTO sponsorship_applications (donor_id, full_name, email, phone, organization, message, wants_updates, wants_to_visit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [donorId, fullName, email, phone, organization, message, wantsUpdates, wantsToVisit]
        );
        const newApplicationId = result.insertId;

        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★
        
        // 1. Find all admins
        const [admins] = await connection.query("SELECT id FROM users WHERE role = 'admin'");
        
        if (admins.length > 0) {
            // 2. Prepare and send notifications
            const adminIds = admins.map(a => a.id);
            const notificationTitle = `New Sponsorship Application`;
            const notificationMessage = `${fullName} has submitted a new application for sponsorship.`;
            
            await createBulkNotifications(
                connection,
                adminIds,
                fullName, // The donor is the sender
                notificationTitle,
                notificationMessage,
                `/admin/sponsorship/${newApplicationId}` // Link for admins to view the application
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★

        await connection.commit();
        res.status(201).json({ message: 'Application received! Please proceed to payment.', applicationId: newApplicationId });

    } catch (error) { 
        await connection.rollback();
        console.error("Sponsorship Apply Error:", error);
        res.status(500).json({ message: 'Error submitting application.' }); 
    } finally {
        connection.release();
    }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// DONOR: Upload their payment screenshot for a specific sponsorship application
app.post('/api/sponsorship/upload-proof', paymentUpload.single('screenshot'), async (req, res) => {
    const { applicationId, donorId, amount } = req.body;
    if (!req.file || !applicationId || !donorId || !amount) return res.status(400).json({ message: 'Missing required information.' });

    const screenshotUrl = `/public/uploads/${req.file.filename}`;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Insert the payment record
        await connection.query('INSERT INTO sponsorship_payments (application_id, donor_id, amount, screenshot_url) VALUES (?, ?, ?, ?)', [applicationId, donorId, amount, screenshotUrl]);
        
        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★
        
        // 1. Find all admins
        const [admins] = await connection.query("SELECT id FROM users WHERE role = 'admin'");
        
        if (admins.length > 0) {
            // 2. Get donor's name for the message
            const [[donor]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [donorId]);

            // 3. Prepare and send notifications
            const adminIds = admins.map(a => a.id);
            const notificationTitle = `Sponsorship Payment Proof Uploaded`;
            const notificationMessage = `${donor.full_name} has uploaded a payment proof of ₹${amount} for their sponsorship application. Please verify.`;
            
            await createBulkNotifications(
                connection,
                adminIds,
                donor.full_name,
                notificationTitle,
                notificationMessage,
                `/admin/sponsorship/${applicationId}` // Link for admins to view the application and proof
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★
        
        await connection.commit();
        res.status(201).json({ message: 'Sponsorship proof uploaded successfully. Thank you!' });

    } catch (error) { 
        await connection.rollback();
        console.error("Sponsorship Proof Upload Error:", error);
        res.status(500).json({ message: 'Error uploading proof.' }); 
    } finally {
        connection.release();
    }
});

// DONOR: Get their personal sponsorship history (list of applications with payment status)
app.get('/api/sponsorship/history/:donorId', async (req, res) => {
    const { donorId } = req.params;
    const query = `SELECT sa.*, sp.amount, sp.status, sp.screenshot_url FROM sponsorship_applications sa LEFT JOIN sponsorship_payments sp ON sa.id = sp.application_id WHERE sa.donor_id = ? ORDER BY sa.application_date DESC`;
    try {
        const [history] = await db.query(query, [donorId]);
        res.json(history);
    } catch (error) { 
        res.status(500).json({ message: 'Error fetching sponsorship history.' }); 
    }
});

// ADMIN: Get a list of all sponsorship applications for management
app.get('/api/admin/sponsorships', async (req, res) => {
    const query = `SELECT sa.*, u.username as donor_username, sp.amount, sp.status as payment_status FROM sponsorship_applications sa JOIN users u ON sa.donor_id = u.id LEFT JOIN sponsorship_payments sp ON sa.id = sp.application_id ORDER BY sa.application_date DESC`;
    try {
        const [applications] = await db.query(query);
        res.json(applications);
    } catch (error) { 
        res.status(500).json({ message: 'Error fetching sponsorships.' }); 
    }
});

// ADMIN: Get full details for one sponsorship application, including the payment proof
app.get('/api/admin/sponsorship/:appId', async (req, res) => {
    const { appId } = req.params;
    try {
        const appQuery = `SELECT sa.*, u.username as donor_username FROM sponsorship_applications sa JOIN users u ON sa.donor_id = u.id WHERE sa.id = ?`;
        const [[appDetails]] = await db.query(appQuery, [appId]);
        if (!appDetails) return res.status(404).json({ message: 'Sponsorship application not found.' });
        
        const [[paymentDetails]] = await db.query('SELECT * FROM sponsorship_payments WHERE application_id = ?', [appId]);
        res.json({ appDetails, paymentDetails: paymentDetails || null });
    } catch (error) { 
        res.status(500).json({ message: 'Error fetching sponsorship details.' }); 
    }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// ADMIN: Verify a payment and update its status
// ADMIN: Verify a payment and update its status
app.put('/api/admin/sponsorship/verify-payment/:paymentId', async (req, res) => {
    const { paymentId } = req.params;
    
    // ✅ SAFE: Handle missing adminId gracefully
    const adminId = req.body?.adminId;
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Update the payment status
        const [result] = await connection.query("UPDATE sponsorship_payments SET status = 'Verified' WHERE id = ?", [paymentId]);
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Payment record not found." });
        }
        
        // ★★★★★ SAFE NOTIFICATION LOGIC ★★★★★
        try {
            // 1. Get payment details to find the original donor
            const [paymentRows] = await connection.query("SELECT donor_id, amount FROM sponsorship_payments WHERE id = ?", [paymentId]);
            const payment = paymentRows[0];
            
            if (payment) {
                // 2. Get the admin's name (with safe fallback)
                let senderName = "School Administration"; // Default fallback
                
                if (adminId) {
                    try {
                        const [adminRows] = await connection.query("SELECT full_name FROM users WHERE id = ?", [adminId]);
                        const admin = adminRows[0];
                        
                        if (admin && admin.full_name) {
                            senderName = admin.full_name;
                        }
                    } catch (adminError) {
                        console.log('⚠️ Could not fetch admin name, using default');
                    }
                }

                // 3. Prepare notification details
                const notificationTitle = `Sponsorship Payment Verified`;
                const notificationMessage = `Thank you! Your sponsorship payment of ₹${payment.amount} has been successfully verified by ${senderName}. We appreciate your support.`;
                
                // 4. Send the notification to the donor
                if (typeof createNotification === 'function') {
                    await createNotification(
                        connection,
                        payment.donor_id,
                        senderName,
                        notificationTitle,
                        notificationMessage,
                        '/sponsorship/history'
                    );
                }
            }
        } catch (notificationError) {
            // Don't fail the main operation if notification fails
            console.error('⚠️ Notification error (non-critical):', notificationError);
        }

        await connection.commit();
        res.status(200).json({ message: 'Payment verified and donor notified successfully!' });

    } catch (error) { 
        await connection.rollback();
        console.error("Error verifying payment:", error);
        res.status(500).json({ message: 'Failed to verify payment.' }); 
    } finally {
        connection.release();
    }
});



// ==========================================================
// --- KITCHEN INVENTORY API ROUTES ---
// ==========================================================

const kitchenStorage = multer.diskStorage({
    destination: './public/uploads/',
    filename: function(req, file, cb){
        cb(null, `kitchen-item-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const kitchenUpload = multer({ storage: kitchenStorage });


// --- Inventory Management Routes ---

// GET all items in the inventory (Remaining Provisions)
app.get('/api/kitchen/inventory', async (req, res) => {
    try {
        const [items] = await db.query('SELECT * FROM kitchen_inventory WHERE quantity_remaining > 0 ORDER BY item_name ASC');
        res.json(items);
    } catch (error) {
        console.error("GET Inventory Error:", error);
        res.status(500).json({ message: 'Error fetching inventory.' });
    }
});

// POST a new item to the inventory (from the '+' button)
app.post('/api/kitchen/inventory', kitchenUpload.single('itemImage'), async (req, res) => {
    const { itemName, quantity, unit } = req.body;
    const imageUrl = req.file ? `/public/uploads/${req.file.filename}` : null;
    try {
        await db.query(
            'INSERT INTO kitchen_inventory (item_name, quantity_remaining, unit, image_url) VALUES (?, ?, ?, ?)',
            [itemName, quantity, unit, imageUrl]
        );
        res.status(201).json({ message: 'Item added to inventory successfully.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'This item already exists in the inventory.' });
        }
        console.error("POST Inventory Error:", error);
        res.status(500).json({ message: 'Error adding item.' });
    }
});

// ✏️ NEW: PUT (update) an existing inventory item's details (name, unit)
app.put('/api/kitchen/inventory/:id', kitchenUpload.single('itemImage'), async (req, res) => {
    const { id } = req.params;
    const { itemName, unit } = req.body;
    const imageUrl = req.file ? `/public/uploads/${req.file.filename}` : null;

    // Build the query dynamically based on whether a new image was uploaded
    let query = 'UPDATE kitchen_inventory SET item_name = ?, unit = ?';
    const params = [itemName, unit];

    if (imageUrl) {
        query += ', image_url = ?';
        params.push(imageUrl);
    }

    query += ' WHERE id = ?';
    params.push(id);

    try {
        const [result] = await db.query(query, params);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Item not found.' });
        }
        res.status(200).json({ message: 'Item updated successfully.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Another item with this name already exists.' });
        }
        console.error("PUT Inventory Error:", error);
        res.status(500).json({ message: 'Error updating item.' });
    }
});

// 🗑️ NEW: DELETE an inventory item
app.delete('/api/kitchen/inventory/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Your DB schema `ON DELETE CASCADE` will automatically remove related usage logs.
        const [result] = await db.query('DELETE FROM kitchen_inventory WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Item not found.' });
        }
        res.status(200).json({ message: 'Item deleted successfully.' });
    } catch (error) {
        console.error("DELETE Inventory Error:", error);
        res.status(500).json({ message: 'Error deleting item.' });
    }
});


// --- Usage Logging Routes (No Changes Here) ---

// GET today's usage log by default, or for a specific date
app.get('/api/kitchen/usage', async (req, res) => {
    const usageDate = req.query.date || new Date().toISOString().split('T')[0];
    const query = `
        SELECT kul.id, kul.quantity_used, ki.item_name, ki.unit, ki.image_url
        FROM kitchen_usage_log kul
        JOIN kitchen_inventory ki ON kul.inventory_id = ki.id
        WHERE kul.usage_date = ?
        ORDER BY kul.logged_at DESC
    `;
    try {
        const [usage] = await db.query(query, [usageDate]);
        res.json(usage);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching usage log.' });
    }
});

// POST a new usage entry
app.post('/api/kitchen/usage', async (req, res) => {
    const { inventoryId, quantityUsed, usageDate } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query(
            'INSERT INTO kitchen_usage_log (inventory_id, quantity_used, usage_date) VALUES (?, ?, ?)',
            [inventoryId, quantityUsed, usageDate]
        );
        const [updateResult] = await connection.query(
            'UPDATE kitchen_inventory SET quantity_remaining = quantity_remaining - ? WHERE id = ?',
            [quantityUsed, inventoryId]
        );
        if (updateResult.affectedRows === 0) throw new Error('Inventory item not found.');
        await connection.commit();
        res.status(201).json({ message: 'Usage logged successfully.' });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: 'Error logging usage.' });
    } finally {
        connection.release();
    }
});

// ==========================================================
// ★★★ PERMANENT ASSET API ROUTES (UPDATED FOR IMAGE UPLOAD) ★★★
// ==========================================================

// GET all permanent items
app.get('/api/permanent-inventory', async (req, res) => {
    // This route does not change
    try {
        const [items] = await db.query('SELECT * FROM permanent_inventory ORDER BY item_name ASC');
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching permanent inventory.' });
    }
});

// POST a new permanent item (NOW ACCEPTS AN IMAGE)
app.post('/api/permanent-inventory', kitchenUpload.single('itemImage'), async (req, res) => {
    const { itemName, totalQuantity, notes } = req.body;
    const imageUrl = req.file ? `/public/uploads/${req.file.filename}` : null; // Get image path if uploaded
    try {
        await db.query(
            'INSERT INTO permanent_inventory (item_name, total_quantity, notes, image_url) VALUES (?, ?, ?, ?)',
            [itemName, totalQuantity, notes, imageUrl]
        );
        res.status(201).json({ message: 'Permanent item added successfully.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'This item already exists.' });
        res.status(500).json({ message: 'Error adding permanent item.' });
    }
});

// PUT (update) an existing permanent item (NOW ACCEPTS AN IMAGE)
app.put('/api/permanent-inventory/:id', kitchenUpload.single('itemImage'), async (req, res) => {
    const { id } = req.params;
    const { itemName, totalQuantity, notes } = req.body;
    
    try {
        let query = 'UPDATE permanent_inventory SET item_name = ?, total_quantity = ?, notes = ?';
        const params = [itemName, totalQuantity, notes];

        // If a new image is being uploaded, add it to the query
        if (req.file) {
            query += ', image_url = ?';
            params.push(`/public/uploads/${req.file.filename}`);
        }

        query += ' WHERE id = ?';
        params.push(id);
        
        const [result] = await db.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Item not found.' });
        
        res.status(200).json({ message: 'Item updated successfully.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Another item with this name already exists.' });
        res.status(500).json({ message: 'Error updating item.' });
    }
});

// DELETE a permanent item (This route does not change)
app.delete('/api/permanent-inventory/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [result] = await db.query('DELETE FROM permanent_inventory WHERE id = ?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Item not found.' });
        res.status(200).json({ message: 'Item deleted successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting item.' });
    }
});



// ==========================================================
// --- FOOD MENU API ROUTES (FINAL & CORRECTED) ---
// ==========================================================

// GET the full weekly food menu (Accessible to all roles)
app.get('/api/food-menu', async (req, res) => {
    try {
        const query = `
            SELECT * FROM food_menu 
            ORDER BY 
                FIELD(day_of_week, "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"), 
                FIELD(meal_type, "Tiffin", "Lunch", "Snacks", "Dinner")
        `;
        const [menuItems] = await db.query(query);

        const groupedMenu = menuItems.reduce((acc, item) => {
            const day = item.day_of_week;
            if (!acc[day]) { acc[day] = []; }
            acc[day].push(item);
            return acc;
        }, {});

        res.json(groupedMenu);
    } catch (error) {
        console.error("Error fetching food menu:", error);
        res.status(500).json({ message: 'Error fetching food menu.' });
    }
});


// ★★★ ROUTE ORDER CORRECTED ★★★
// The specific route for '/time' must come BEFORE the general route for '/:id'.

// 📂 File: server.js (REPLACE THIS ROUTE)

// PUT (update) the TIME for an entire meal column (Admin only)
app.put('/api/food-menu/time', async (req, res) => {
    const { meal_type, meal_time, editorId } = req.body;

    if (!editorId) {
        return res.status(401).json({ message: 'Unauthorized: User authentication is required.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Check admin role
        const [[editor]] = await connection.query('SELECT role, full_name FROM users WHERE id = ?', [editorId]);
        if (!editor || editor.role !== 'admin') {
            await connection.rollback();
            return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
        }
        
        // Step 2: Update the meal time
        const [result] = await connection.query('UPDATE food_menu SET meal_time = ? WHERE meal_type = ?', [meal_time, meal_type]);

        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★
        
        // 1. Find all students and teachers (excluding the editor admin)
        const [usersToNotify] = await connection.query("SELECT id FROM users WHERE role IN ('student', 'teacher') AND id != ?", [editorId]);
        
        if (usersToNotify.length > 0) {
            // 2. Prepare notification details
            const recipientIds = usersToNotify.map(u => u.id);
            const senderName = editor.full_name || "School Administration";
            const notificationTitle = `Food Menu Updated`;
            const notificationMessage = `The timing for ${meal_type} has been updated to ${meal_time}. Please check the new schedule.`;

            // 3. Send notifications
            await createBulkNotifications(
                connection,
                recipientIds,
                senderName,
                notificationTitle,
                notificationMessage,
                '/food-menu' // A generic link to the food menu screen
            );
        }

        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★

        await connection.commit();
        res.status(200).json({ message: `${meal_type} time updated for all days.`, affectedRows: result.affectedRows });

    } catch (error) {
        await connection.rollback();
        console.error("Error updating meal time:", error);
        res.status(500).json({ message: 'Error updating meal time.' });
    } finally {
        connection.release();
    }
});

// 📂 File: server.js (REPLACE THIS ROUTE)

// PUT (update) a SINGLE food item's text (Admin only)
app.put('/api/food-menu/:id', async (req, res) => {
    const { id } = req.params;
    const { food_item, editorId } = req.body;

    if (!editorId) {
        return res.status(401).json({ message: 'Unauthorized: User authentication is required.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Step 1: Check admin role
        const [[editor]] = await connection.query('SELECT role, full_name FROM users WHERE id = ?', [editorId]);
        if (!editor || editor.role !== 'admin') {
            await connection.rollback();
            return res.status(403).json({ message: 'Forbidden: You do not have permission to perform this action.' });
        }

        // Step 2: Update the food item
        const [result] = await connection.query('UPDATE food_menu SET food_item = ? WHERE id = ?', [food_item, id]);
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Menu item not found.' });
        }

        // ★★★★★ START: NEW NOTIFICATION LOGIC ★★★★★

        // 1. Find all students and teachers (excluding the editor admin)
        const [usersToNotify] = await connection.query("SELECT id FROM users WHERE role IN ('student', 'teacher') AND id != ?", [editorId]);
        
        if (usersToNotify.length > 0) {
            // 2. Get details about the meal that was changed
            const [[mealDetails]] = await connection.query("SELECT day_of_week, meal_type FROM food_menu WHERE id = ?", [id]);

            // 3. Prepare notification details
            const recipientIds = usersToNotify.map(u => u.id);
            const senderName = editor.full_name || "School Administration";
            const notificationTitle = `Food Menu Updated`;
            const notificationMessage = `The menu for ${mealDetails.day_of_week} ${mealDetails.meal_type} has been updated.`;

            // 4. Send notifications
            await createBulkNotifications(
                connection,
                recipientIds,
                senderName,
                notificationTitle,
                notificationMessage,
                '/food-menu'
            );
        }
        
        // ★★★★★ END: NEW NOTIFICATION LOGIC ★★★★★

        await connection.commit();
        res.status(200).json({ message: 'Menu item updated successfully.' });

    } catch (error) {
        await connection.rollback();
        console.error("Error updating food menu item:", error);
        res.status(500).json({ message: 'Error updating menu item.' });
    } finally {
        connection.release();
    }
});



// ==========================================================
// --- ADS MODULE API ROUTES (FINAL - UNIFIED & CORRECTED) ---
// ==========================================================

// This single endpoint handles creating an ad for ALL user roles.

app.post('/api/ads', verifyToken, adsUpload.fields([
    { name: 'ad_content_image', maxCount: 1 },
    { name: 'payment_screenshot', maxCount: 1 }
]), async (req, res) => {
    const { ad_type, ad_content_text, payment_text } = req.body;
    const { id: user_id, role, full_name } = req.user; // Now 'full_name' will be correct

    if (!req.files || !req.files.ad_content_image) {
        return res.status(400).json({ message: 'Ad image is required.' });
    }
    const ad_content_image_url = `/uploads/${req.files.ad_content_image[0].filename}`;
    const isPayingUser = role === 'student' || role === 'teacher' || role === 'donor';
    if (isPayingUser && (!req.files || !req.files.payment_screenshot)) {
        return res.status(400).json({ message: 'Payment proof screenshot is required for your role.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const adStatus = (role === 'admin') ? 'approved' : 'pending';
        const [result] = await connection.query(
            'INSERT INTO ads (user_id, ad_type, ad_content_image_url, ad_content_text, status) VALUES (?, ?, ?, ?, ?)',
            [user_id, ad_type, ad_content_image_url, ad_content_text, adStatus]
        );
        const adId = result.insertId;

        if (isPayingUser) {
            const payment_screenshot_url = `/uploads/${req.files.payment_screenshot[0].filename}`;
            await connection.query(
                'INSERT INTO ad_payments (ad_id, payment_screenshot_url, payment_text) VALUES (?, ?, ?)',
                [adId, payment_screenshot_url, payment_text || null]
            );
        }

        if (role !== 'admin') {
            const [admins] = await connection.query("SELECT id FROM users WHERE role = 'admin'");
            if (admins.length > 0) {
                const adminIds = admins.map(a => a.id);
                const notificationTitle = "New Ad for Review";
                const notificationMessage = `${full_name} (${role}) has submitted a new advertisement for your approval.`;
                await createBulkNotifications(connection, adminIds, full_name, notificationTitle, notificationMessage, `/admin/ads`);
            }
        }
        
        if (role === 'admin') {
            const [otherUsers] = await connection.query("SELECT id FROM users WHERE role IN ('student', 'teacher', 'donor')");
            if (otherUsers.length > 0) {
                const userIds = otherUsers.map(u => u.id);
                const notificationTitle = "New Advertisement Posted";
                const notificationMessage = `A new ad "${ad_content_text || 'View Ad'}" has been posted by the administration.`;
                await createBulkNotifications(connection, userIds, full_name, notificationTitle, notificationMessage, `/ads/display`);
            }
        }
        
        await connection.commit();
        const successMessage = (role === 'admin') ? 'Ad has been posted and users notified!' : 'Ad and payment proof have been submitted for review!';
        res.status(201).json({ message: successMessage });
    } catch (error) {
        await connection.rollback();
        console.error("Error creating ad:", error);
        res.status(500).json({ message: 'Server error while creating the ad.' });
    } finally {
        connection.release();
    }
});

// This route is no longer needed as payment is submitted with the ad.
// You can safely delete the old app.post('/api/ads/:adId/payment', ...) route if it exists.


// PUBLIC: Get approved ads for display (The "Small Key" endpoint)
// CHANGED: Added a WHERE condition to only fetch 'top_notch' ads.
app.get('/api/ads/display', async (req, res) => {
    try {
        const query = `
            SELECT id, ad_type, ad_content_image_url, ad_content_text 
            FROM ads 
            WHERE status = 'approved' AND ad_type = 'top_notch' 
            ORDER BY RAND()
        `;
        const [ads] = await db.query(query);
        res.json(ads);
    } catch (error) {
        console.error("Error fetching display ads:", error);
        res.status(500).json({ message: 'Server error fetching ads.' });
    }
});


// --- ADMIN-ONLY ROUTES ---

// GET /api/admin/ads - Fetches all ads for the admin dashboard.
app.get('/api/admin/ads', [verifyToken, isAdmin], async (req, res) => {
    try {
        const query = `
             SELECT a.*, u.username as userName, u.full_name, p.payment_screenshot_url, p.payment_text
             FROM ads a 
             JOIN users u ON a.user_id = u.id
             LEFT JOIN ad_payments p ON a.id = p.ad_id
             ORDER BY a.created_at DESC`;
        const [ads] = await db.query(query);
        res.json(ads);
    } catch (error) {
        console.error("Error fetching all ads for admin:", error);
        res.status(500).json({ message: 'Server error fetching ads for admin.' });
    }
});

// PUT /api/admin/ads/:adId/status - Allows admin to approve, reject, or stop a pending ad.
app.put('/api/admin/ads/:adId/status', [verifyToken, isAdmin], async (req, res) => {
    const { adId } = req.params;
    const { status } = req.body;
    const adminFullName = req.user.full_name;

    if (!['approved', 'rejected', 'stopped'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status provided.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [[adDetails]] = await connection.query("SELECT user_id, ad_content_text FROM ads WHERE id = ?", [adId]);

        if (!adDetails) {
            await connection.rollback();
            return res.status(404).json({ message: 'Ad not found.' });
        }

        const [result] = await connection.query("UPDATE ads SET status = ? WHERE id = ?", [status, adId]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Ad could not be updated.' });
        }
       
        if (status === 'approved') {
            const originalCreatorId = adDetails.user_id;
            const notificationTitle = "Your Ad has been Approved!";
            const adTitle = adDetails.ad_content_text || "your recent ad submission";
            const notificationMessage = `Congratulations! Your ad "${adTitle}" has been approved by ${adminFullName}.`;
            await createNotification(connection, originalCreatorId, adminFullName, notificationTitle, notificationMessage, `/my-ads`);
        }
        
        await connection.commit();
        res.json({ message: `Ad has been successfully ${status}.` });

    } catch (error) {
        await connection.rollback();
        console.error("Error updating ad status:", error);
        res.status(500).json({ message: 'Server error updating ad status.' });
    } finally {
        connection.release();
    }
});


// DELETE /api/admin/ads/:adId - Allows admin to delete any ad.
app.delete('/api/admin/ads/:adId', [verifyToken, isAdmin], async (req, res) => {
    const { adId } = req.params;
    try {
        const [result] = await db.query("DELETE FROM ads WHERE id = ?", [adId]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Ad not found.' });
        res.json({ message: 'Ad successfully deleted.' });
    } catch (error) {
        console.error("Error deleting ad:", error);
        res.status(500).json({ message: 'Server error deleting ad.' });
    }
});



// ==========================================================
// --- UPDATED ADVERTISEMENT PAYMENT SETTINGS ROUTES ---
// ==========================================================

// PUBLIC: Gets the Admin's payment details, including the ad amount.
// CHANGED: Endpoint name and table name in query
app.get('/api/ad-payment-details', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM ad_payment_details WHERE id = 1');
        res.json(rows[0] || {});
    } catch (error) {
        console.error("Error fetching ad payment details:", error);
        res.status(500).json({ message: 'Error fetching ad payment details.' });
    }
});

// ADMIN: Creates or Updates the payment details, including the ad amount.
// CHANGED: Endpoint name and table name in queries
app.post('/api/admin/ad-payment-details', [verifyToken, isAdmin], paymentUpload.single('qrCodeImage'), async (req, res) => {
    const { adAmount, accountHolderName, accountNumber, ifscCode, cifCode } = req.body;
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // CHANGED: Table name in the query
        const upsertQuery = `
            INSERT INTO ad_payment_details (id, ad_amount, account_holder_name, account_number, ifsc_code, cif_code, qr_code_url)
            VALUES (1, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                ad_amount = VALUES(ad_amount),
                account_holder_name = VALUES(account_holder_name),
                account_number = VALUES(account_number),
                ifsc_code = VALUES(ifsc_code),
                cif_code = VALUES(cif_code),
                qr_code_url = VALUES(qr_code_url);
        `;

        // CHANGED: Table name in the query
        const [rows] = await connection.query('SELECT qr_code_url FROM ad_payment_details WHERE id = 1');
        const currentDetails = rows[0];

        let qrCodeUrlToSave = currentDetails ? currentDetails.qr_code_url : null;
        if (req.file) {
            qrCodeUrlToSave = `/public/uploads/${req.file.filename}`;
        }
        
        const params = [adAmount, accountHolderName, accountNumber, ifscCode, cifCode, qrCodeUrlToSave];
        
        await connection.query(upsertQuery, params);
        await connection.commit();
        
        res.status(200).json({ message: 'Ad payment details saved successfully!' });

    } catch (error) {
        await connection.rollback();
        console.error("Error saving ad payment details:", error);
        res.status(500).json({ message: 'Error saving details.' });
    } finally {
        if (connection) connection.release();
    }
});



// ==========================================================
// --- GROUP CHAT API & REAL-TIME ROUTES (WITH MEDIA) ---
// ==========================================================

// ★★★ Multer storage configuration for chat media (NO CHANGES) ★★★
const chatStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'uploads/'); },
    filename: (req, file, cb) => { cb(null, `chat-media-${Date.now()}${path.extname(file.originalname)}`); }
});
const chatUpload = multer({ storage: chatStorage });

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });


// --- 1. API ROUTE TO UPLOAD CHAT MEDIA (NO CHANGES) ---
app.post('/api/group-chat/upload-media', chatUpload.single('media'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const fileUrl = `/uploads/${req.file.filename}`;
    res.status(201).json({ fileUrl: fileUrl });
});


// --- 2. API ROUTE TO GET MESSAGE HISTORY (NO CHANGES) ---
app.get('/api/group-chat/history', async (req, res) => {
    try {
        const query = `
            SELECT 
                m.id, m.message_text, m.timestamp, m.user_id,
                m.message_type, m.file_url,
                COALESCE(u.full_name, 'Deleted User') as full_name, u.role
            FROM group_chat_messages m
            LEFT JOIN users u ON m.user_id = u.id
            ORDER BY m.timestamp ASC 
            LIMIT 100; 
        `;
        const [messages] = await db.query(query);
        res.json(messages);
    } catch (error) {
        console.error("Error fetching chat history:", error);
        res.status(500).json({ message: "Error fetching chat history." });
    }
});


// --- 3. REAL-TIME SOCKET.IO LOGIC (MODIFIED) ---
io.on('connection', (socket) => {
    console.log(`🔌 A user connected: ${socket.id}`);
    socket.join('school-group-chat');

    socket.on('sendMessage', async (data) => {
        const { userId, messageType, messageText, fileUrl } = data;
        if (!userId || !messageType || (messageType === 'text' && !messageText?.trim()) || (messageType !== 'text' && !fileUrl)) return;

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.query('INSERT INTO group_chat_messages (user_id, message_type, message_text, file_url) VALUES (?, ?, ?, ?)', [userId, messageType, messageText || null, fileUrl || null]);
            const newMessageId = result.insertId;
            const [[broadcastMessage]] = await connection.query(`
                SELECT m.id, m.message_text, m.timestamp, m.user_id, m.message_type, m.file_url, u.full_name, u.role
                FROM group_chat_messages m JOIN users u ON m.user_id = u.id WHERE m.id = ?`, [newMessageId]);
            await connection.commit();
            socket.broadcast.to('school-group-chat').emit('newMessage', broadcastMessage);
        } catch (error) {
            await connection.rollback();
            console.error('❌ CRITICAL ERROR: Failed to save and broadcast message.', error);
        } finally {
            connection.release();
        }
    });

    // ★★★ NEW: Listen for delete message events ★★★
    socket.on('deleteMessage', async (data) => {
        const { messageId, userId } = data;
        if (!messageId || !userId) {
            console.warn('⚠️ Delete request missing messageId or userId.');
            return;
        }

        const connection = await db.getConnection();
        try {
            // STEP A: Verify the user requesting deletion is the actual owner
            const [[message]] = await connection.query(
                'SELECT user_id FROM group_chat_messages WHERE id = ?',
                [messageId]
            );

            if (!message) return; // Message already deleted or never existed

            // STEP B: SECURITY CHECK - If not the owner, deny the request
            if (message.user_id != userId) {
                console.error(`🔒 SECURITY ALERT: User ${userId} tried to delete message ${messageId} owned by ${message.user_id}.`);
                return;
            }
            
            // STEP C: If authorized, delete the message from the database
            await connection.query('DELETE FROM group_chat_messages WHERE id = ?', [messageId]);
            
            // STEP D: Broadcast the ID of the deleted message to ALL clients in the room
            io.to('school-group-chat').emit('messageDeleted', messageId);
            console.log(`🗑️ Message ${messageId} deleted by user ${userId}.`);

        } catch (error) {
            console.error(`❌ CRITICAL ERROR: Failed to delete message ${messageId}.`, error);
        } finally {
            connection.release();
        }
    });

    socket.on('disconnect', () => {
        console.log(`🔌 User disconnected: ${socket.id}`);
    });
});




// ==========================================================
// --- NOTIFICATIONS API ROUTES (NEW) ---
// ==========================================================

// GET all notifications for the logged-in user (THIS ROUTE ALREADY EXISTS)
app.get('/api/notifications', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        console.log(`[NOTIFICATIONS GET] Fetching notifications for recipient_id: ${userId}`); 

        const query = 'SELECT * FROM notifications WHERE recipient_id = ? ORDER BY created_at DESC';
        const [notifications] = await db.query(query, [userId]);
        res.json(notifications);
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ message: 'Failed to fetch notifications.' });
    }
});

// ★★★ THIS IS THE MISSING ROUTE - ADD THIS CODE BLOCK ★★★
// MARK a single notification as read
app.put('/api/notifications/:notificationId/read', verifyToken, async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.id; // Get user ID from the token for security

        console.log(`[NOTIFICATIONS UPDATE] User ${userId} marking notification ${notificationId} as read.`);

        // This query is secure: it ensures a user can only update THEIR OWN notifications.
        const query = 'UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_id = ?';
        const [result] = await db.query(query, [notificationId, userId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Notification not found or you do not have permission to update it.' });
        }

        res.status(200).json({ message: 'Notification marked as read.' });
    } catch (error) {
        console.error("Error marking notification as read:", error);
        res.status(500).json({ message: 'Failed to update notification.' });
    }
});



// ==========================================================
// ★★★ START: ONLINE CLASS MODULE API ROUTES (CORRECTED & FINAL) ★★★
// ==========================================================

// GET all online classes (NOW WITH ROLE-AWARE FILTERING)
app.get('/api/online-classes', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        // Admins and teachers see all online classes
        if (userRole === 'admin' || userRole === 'teacher') {
            const query = 'SELECT * FROM online_classes ORDER BY class_datetime DESC';
            const [classes] = await db.query(query);
            return res.status(200).json(classes);
        }

        // Students only see classes for their group or for 'All' classes
        if (userRole === 'student') {
            const [[user]] = await db.query('SELECT class_group FROM users WHERE id = ?', [userId]);
            if (!user || !user.class_group) {
                const query = `SELECT * FROM online_classes WHERE class_group = 'All' ORDER BY class_datetime DESC`;
                const [classes] = await db.query(query);
                return res.status(200).json(classes);
            }

            const studentClassGroup = user.class_group;
            const query = `
                SELECT * FROM online_classes 
                WHERE class_group = ? OR class_group = 'All' 
                ORDER BY class_datetime DESC
            `;
            const [classes] = await db.query(query, [studentClassGroup]);
            return res.status(200).json(classes);
        }
        
        // Deny access for other roles
        res.status(403).json({ message: "You do not have permission to view online classes." });

    } catch (error) {
        console.error("GET /api/online-classes Error:", error);
        res.status(500).json({ message: 'Error fetching online classes.' });
    }
});

// GET list of classes for the form
app.get('/api/student-classes', verifyToken, async (req, res) => {
    try {
        const query = "SELECT DISTINCT class_group FROM users WHERE role = 'student' AND class_group IS NOT NULL AND class_group != '' ORDER BY class_group ASC";
        const [results] = await db.query(query);
        const classes = results.map(item => item.class_group);
        res.status(200).json(classes);
    } catch (error) {
        console.error("GET /api/student-classes Error:", error);
        res.status(500).json({ message: 'Could not fetch student classes.' });
    }
});

// POST a new online class (NOW WITH CORRECT NOTIFICATION LOGIC)
app.post('/api/online-classes', verifyToken, async (req, res) => {
    const { title, class_group, subject, teacher_id, class_datetime, meet_link, description } = req.body;
    const created_by = req.user.id;
    
    if (!title || !class_group || !subject || !teacher_id || !class_datetime || !meet_link) {
        return res.status(400).json({ message: 'All required fields must be filled.' });
    }

    const jsDate = new Date(class_datetime);
    const formattedMysqlDatetime = jsDate.toISOString().slice(0, 19).replace('T', ' ');

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [[teacher]] = await connection.query('SELECT full_name FROM users WHERE id = ?', [teacher_id]);
        if (!teacher) {
            await connection.rollback();
            return res.status(404).json({ message: 'Selected teacher not found.' });
        }

        const query = `INSERT INTO online_classes (title, class_group, subject, teacher_id, teacher_name, class_datetime, meet_link, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        await connection.query(query, [title, class_group, subject, teacher_id, teacher.full_name, formattedMysqlDatetime, meet_link, description]);

        // --- Corrected Notification Logic ---
        let studentsQuery = "SELECT id FROM users WHERE role = 'student'";
        const queryParams = [];
        if (class_group !== 'All') {
            studentsQuery += " AND class_group = ?";
            queryParams.push(class_group);
        }

        const [students] = await connection.query(studentsQuery, queryParams);
        const studentIds = students.map(s => s.id);
        const recipientIds = [...new Set([parseInt(teacher_id, 10), ...studentIds])];

        if (recipientIds.length > 0) {
            const senderName = req.user.full_name || "School Administration";
            const displayClass = class_group === 'All' ? 'all classes' : class_group;
            const notificationTitle = `New Online Class: ${subject}`;
            const eventDate = new Date(class_datetime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
            const notificationMessage = `A class on "${title}" for ${displayClass} with ${teacher.full_name} is scheduled for ${eventDate}.`;

            await createBulkNotifications(connection, recipientIds, senderName, notificationTitle, notificationMessage, '/online-class');
        }

        await connection.commit();
        res.status(201).json({ message: 'Online class scheduled and users notified successfully!' });

    } catch (error) {
        await connection.rollback();
        console.error("POST /api/online-classes Error:", error);
        res.status(500).json({ message: 'Failed to schedule the class.' });
    } finally {
        connection.release();
    }
});

// PUT (update) an existing class
app.put('/api/online-classes/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { title, meet_link, description } = req.body;

    try {
        const query = `UPDATE online_classes SET title = ?, meet_link = ?, description = ? WHERE id = ?`;
        const [result] = await db.query(query, [title, meet_link, description || null, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Class not found.' });
        }
        res.status(200).json({ message: 'Class updated successfully!' });
    } catch (error) {
        console.error(`PUT /api/online-classes/${id} Error:`, error);
        res.status(500).json({ message: 'Failed to update class.' });
    }
});

// DELETE a class
app.delete('/api/online-classes/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const query = 'DELETE FROM online_classes WHERE id = ?';
        const [result] = await db.query(query, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Class not found.' });
        }
        res.status(200).json({ message: 'Class deleted successfully.' });
    } catch (error) {
        console.error(`DELETE /api/online-classes/${id} Error:`, error);
        res.status(500).json({ message: 'Failed to delete class.' });
    }
});

// ==========================================================
// --- DYNAMIC FORM DATA API ROUTES ---
// ==========================================================

// ★★★ NEW ROUTE 1: GET SUBJECTS FOR A SPECIFIC CLASS ★★★
app.get('/api/subjects-for-class/:classGroup', async (req, res) => {
    const { classGroup } = req.params;
    try {
        // This query finds all unique subjects assigned to a class in the timetable.
        const query = "SELECT DISTINCT subject_name FROM timetables WHERE class_group = ? ORDER BY subject_name ASC";
        const [results] = await db.query(query, [classGroup]);
        const subjects = results.map(item => item.subject_name);
        res.status(200).json(subjects);
    } catch (error) {
        console.error("GET /api/subjects-for-class Error:", error);
        res.status(500).json({ message: 'Could not fetch subjects for the selected class.' });
    }
});

// ★★★ NEW ROUTE 2: GET TEACHERS FOR A SPECIFIC CLASS ★★★
app.get('/api/teachers-for-class/:classGroup', async (req, res) => {
    const { classGroup } = req.params;
    try {
        // This query finds all unique teachers assigned to a class in the timetable.
        const query = `
            SELECT DISTINCT u.id, u.full_name 
            FROM users u
            JOIN timetables t ON u.id = t.teacher_id
            WHERE t.class_group = ? AND u.role = 'teacher'
            ORDER BY u.full_name ASC
        `;
        const [teachers] = await db.query(query, [classGroup]);
        res.status(200).json(teachers);
    } catch (error) {
        console.error("GET /api/teachers-for-class Error:", error);
        res.status(500).json({ message: 'Could not fetch teachers for the selected class.' });
    }
});



// ==========================================================
// --- ALUMNI RECORDS API ROUTES (WITH IMAGE UPLOAD) ---
// ==========================================================



// Add a dedicated multer storage config for alumni photos
const alumniStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/';
        // Ensure the directory exists
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `alumni-pic-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const alumniUpload = multer({ storage: alumniStorage });

// GET all alumni records
app.get('/api/alumni', async (req, res) => {
    try {
        const query = "SELECT * FROM alumni_records ORDER BY alumni_name ASC";
        const [records] = await db.query(query);
        res.status(200).json(records);
    } catch (error) {
        console.error("GET /api/alumni Error:", error);
        res.status(500).json({ message: "Failed to fetch alumni records." });
    }
});

// POST a new alumni record (now handles file upload)
app.post('/api/alumni', alumniUpload.single('profile_pic'), async (req, res) => {
    const fields = req.body;
    const profile_pic_url = req.file ? `/uploads/${req.file.filename}` : null;

    if (!fields.admission_no || !fields.alumni_name) {
        return res.status(400).json({ message: "Admission Number and Alumni Name are required." });
    }

    const query = `
        INSERT INTO alumni_records (
            admission_no, alumni_name, profile_pic_url, dob, pen_no, phone_no, aadhar_no, parent_name, 
            parent_phone, address, school_joined_date, school_joined_grade, 
            school_outgoing_date, school_outgoing_grade, tc_issued_date, tc_number, present_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        fields.admission_no, fields.alumni_name, profile_pic_url, fields.dob || null, fields.pen_no || null, 
        fields.phone_no || null, fields.aadhar_no || null, fields.parent_name || null, fields.parent_phone || null, 
        fields.address || null, fields.school_joined_date || null, fields.school_joined_grade || null, 
        fields.school_outgoing_date || null, fields.school_outgoing_grade || null, fields.tc_issued_date || null, 
        fields.tc_number || null, fields.present_status || null
    ];

    try {
        await db.query(query, params);
        res.status(201).json({ message: "Alumni record created successfully." });
    } catch (error) {
        console.error("POST /api/alumni Error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `An alumni record with Admission No '${fields.admission_no}' already exists.` });
        }
        res.status(500).json({ message: "Failed to create alumni record." });
    }
});

// PUT (update) an existing alumni record (now handles file upload)
app.put('/api/alumni/:id', alumniUpload.single('profile_pic'), async (req, res) => {
    const { id } = req.params;
    const fields = req.body;
    
    // Dynamically build the query to avoid updating profile_pic_url to NULL if not provided
    let setClauses = [];
    let params = [];
    
    const updatableFields = [
        'admission_no', 'alumni_name', 'dob', 'pen_no', 'phone_no', 'aadhar_no', 
        'parent_name', 'parent_phone', 'address', 'school_joined_date', 
        'school_joined_grade', 'school_outgoing_date', 'school_outgoing_grade', 
        'tc_issued_date', 'tc_number', 'present_status'
    ];

    updatableFields.forEach(field => {
        if (fields[field] !== undefined) {
            setClauses.push(`${field} = ?`);
            params.push(fields[field] || null);
        }
    });

    if (req.file) {
        setClauses.push('profile_pic_url = ?');
        params.push(`/uploads/${req.file.filename}`);
    }

    if (setClauses.length === 0) {
        return res.status(400).json({ message: "No fields to update." });
    }

    const query = `UPDATE alumni_records SET ${setClauses.join(', ')} WHERE id = ?`;
    params.push(id);
    
    try {
        const [result] = await db.query(query, params);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Alumni record not found." });
        }
        res.status(200).json({ message: "Alumni record updated successfully." });
    } catch (error) {
        console.error(`PUT /api/alumni/${id} Error:`, error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `An alumni record with Admission No '${fields.admission_no}' already exists.` });
        }
        res.status(500).json({ message: "Failed to update alumni record." });
    }
});

// DELETE an alumni record (now also deletes the image file)
app.delete('/api/alumni/:id', async (req, res) => {
    const { id } = req.params;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // First, get the record to find the image path
        const [[record]] = await connection.query("SELECT profile_pic_url FROM alumni_records WHERE id = ?", [id]);

        // Then, delete the record from the database
        const [result] = await connection.query("DELETE FROM alumni_records WHERE id = ?", [id]);
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Alumni record not found." });
        }

        // If an image path exists, delete the file from the server
        if (record && record.profile_pic_url) {
            // Construct absolute path
            const filePath = path.join(__dirname, '..', record.profile_pic_url); // Adjust '..' if necessary based on your folder structure
            if (fs.existsSync(filePath)) {
                fs.unlink(filePath, (err) => {
                    if (err) console.error("Failed to delete alumni image file:", err);
                });
            }
        }
        
        await connection.commit();
        res.status(200).json({ message: "Alumni record deleted successfully." });
    } catch (error) {
        await connection.rollback();
        console.error(`DELETE /api/alumni/${id} Error:`, error);
        res.status(500).json({ message: "Failed to delete alumni record." });
    } finally {
        connection.release();
    }
});



// ==========================================================
// --- PRE-ADMISSIONS API ROUTES ---
// ==========================================================

// Multer storage config for pre-admission photos
const preAdmissionsStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/preadmissions/'; // Use a dedicated subfolder
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `preadmission-photo-${Date.now()}${path.extname(file.originalname)}`);
    }
});
const preAdmissionsUpload = multer({ storage: preAdmissionsStorage });

// GET all pre-admission records
app.get('/api/preadmissions', async (req, res) => {
    try {
        const query = "SELECT * FROM pre_admissions ORDER BY submission_date DESC";
        const [records] = await db.query(query);
        res.status(200).json(records);
    } catch (error) {
        console.error("GET /api/preadmissions Error:", error);
        res.status(500).json({ message: "Failed to fetch pre-admission records." });
    }
});

// POST a new pre-admission record
app.post('/api/preadmissions', preAdmissionsUpload.single('photo'), async (req, res) => {
    const fields = req.body;
    const photo_url = req.file ? `/uploads/preadmissions/${req.file.filename}` : null;

    if (!fields.admission_no || !fields.student_name || !fields.joining_grade) {
        return res.status(400).json({ message: "Admission No, Student Name, and Joining Grade are required." });
    }

    const query = `
        INSERT INTO pre_admissions (
            admission_no, student_name, photo_url, dob, pen_no, phone_no, aadhar_no, 
            parent_name, parent_phone, previous_institute, previous_grade, 
            joining_grade, address, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        fields.admission_no, fields.student_name, photo_url, fields.dob || null, fields.pen_no || null, 
        fields.phone_no || null, fields.aadhar_no || null, fields.parent_name || null, 
        fields.parent_phone || null, fields.previous_institute || null, fields.previous_grade || null,
        fields.joining_grade, fields.address || null, fields.status || 'Pending'
    ];

    try {
        await db.query(query, params);
        res.status(201).json({ message: "Pre-admission record created successfully." });
    } catch (error) {
        console.error("POST /api/preadmissions Error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `A record with Admission No '${fields.admission_no}' already exists.` });
        }
        res.status(500).json({ message: "Failed to create pre-admission record." });
    }
});

// PUT (update) an existing pre-admission record
app.put('/api/preadmissions/:id', preAdmissionsUpload.single('photo'), async (req, res) => {
    const { id } = req.params;
    const fields = req.body;
    
    let setClauses = [];
    let params = [];
    
    const updatableFields = [
        'admission_no', 'student_name', 'dob', 'pen_no', 'phone_no', 'aadhar_no', 
        'parent_name', 'parent_phone', 'previous_institute', 'previous_grade', 
        'joining_grade', 'address', 'status'
    ];

    updatableFields.forEach(field => {
        if (fields[field] !== undefined) {
            setClauses.push(`${field} = ?`);
            params.push(fields[field] || null);
        }
    });

    if (req.file) {
        setClauses.push('photo_url = ?');
        params.push(`/uploads/preadmissions/${req.file.filename}`);
    }

    if (setClauses.length === 0) {
        return res.status(400).json({ message: "No fields to update." });
    }

    const query = `UPDATE pre_admissions SET ${setClauses.join(', ')} WHERE id = ?`;
    params.push(id);
    
    try {
        const [result] = await db.query(query, params);
        if (result.affectedRows === 0) return res.status(404).json({ message: "Record not found." });
        res.status(200).json({ message: "Pre-admission record updated successfully." });
    } catch (error) {
        console.error(`PUT /api/preadmissions/${id} Error:`, error);
        res.status(500).json({ message: "Failed to update record." });
    }
});

// DELETE a pre-admission record
app.delete('/api/preadmissions/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        // First, get the record to find the image path
        const [[record]] = await db.query("SELECT photo_url FROM pre_admissions WHERE id = ?", [id]);
        
        // Delete the record from the database
        const [result] = await db.query("DELETE FROM pre_admissions WHERE id = ?", [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Record not found." });
        }

        // If an image path exists, delete the file from the server
        if (record && record.photo_url) {
            fs.unlink(path.join(__dirname, '..', record.photo_url), (err) => {
                if (err) console.error("Failed to delete pre-admission photo:", err);
            });
        }
        
        res.status(200).json({ message: "Pre-admission record deleted successfully." });
    } catch (error) {
        console.error(`DELETE /api/preadmissions/${id} Error:`, error);
        res.status(500).json({ message: "Failed to delete record." });
    }
});



// ==========================================================
// --- ACADEMIC RESOURCES & Textbook API ROUTES (Single Table, Link-Based) ---
// ==========================================================

// --- ★ NEW ENDPOINT FOR STUDENT CLASS SELECTION ★ ---
// GET all unique classes that have at least one resource published.
app.get('/api/resources/classes', async (req, res) => {
    try {
        const query = `SELECT DISTINCT class_group FROM learning_resources ORDER BY class_group;`;
        const [classes] = await db.query(query);
        res.status(200).json(classes.map(c => c.class_group));
    } catch (error) {
        res.status(500).json({ message: 'Could not fetch class list.' });
    }
});


// --- STUDENT VIEW ROUTES (No changes, but used differently now) ---
app.get('/api/resources/textbook/class/:class_group', async (req, res) => {
    try {
        const { class_group } = req.params;
        const query = `SELECT id, url FROM learning_resources WHERE class_group = ? AND resource_type = 'textbook';`;
        const [[link]] = await db.query(query, [class_group]);
        if (!link) return res.status(404).json({ message: 'Textbook link not found.' });
        res.status(200).json(link);
    } catch (error) { res.status(500).json({ message: 'Could not fetch textbook link.' }); }
});

app.get('/api/resources/syllabus/class/:class_group', async (req, res) => {
    try {
        const { class_group } = req.params;
        const query = `SELECT id, subject_name, url, cover_image_url FROM learning_resources WHERE class_group = ? AND resource_type = 'syllabus' ORDER BY subject_name;`;
        const [subjects] = await db.query(query, [class_group]);
        res.status(200).json(subjects);
    } catch (error) { res.status(500).json({ message: 'Could not fetch subjects for the class.' }); }
});


// --- ADMIN & TEACHER MANAGEMENT ROUTES ---

app.get('/api/resources/textbooks', async (req, res) => {
    try {
        const query = `SELECT id, class_group, url FROM learning_resources WHERE resource_type = 'textbook' ORDER BY class_group;`;
        const [links] = await db.query(query);
        res.status(200).json(links);
    } catch (error) {
        res.status(500).json({ message: 'Could not fetch textbook links.' });
    }
});

app.get('/api/resources/syllabus', async (req, res) => {
    try {
        const query = `SELECT id, class_group, subject_name, url, cover_image_url FROM learning_resources WHERE resource_type = 'syllabus' ORDER BY class_group, subject_name;`;
        const [syllabi] = await db.query(query);
        res.status(200).json(syllabi);
    } catch (error) {
        res.status(500).json({ message: 'Could not fetch syllabus list.' });
    }
});

app.post('/api/resources/syllabus', async (req, res) => {
    try {
        const { class_group, subject_name, url, cover_image_url } = req.body;
        if (!class_group || !subject_name || !url) {
            return res.status(400).json({ message: 'Class, subject, and syllabus URL are required.' });
        }
        const query = 'INSERT INTO learning_resources (class_group, resource_type, subject_name, url, cover_image_url) VALUES (?, "syllabus", ?, ?, ?)';
        await db.query(query, [class_group, subject_name, url, cover_image_url]);
        res.status(201).json({ message: 'Syllabus created successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error creating syllabus.' });
    }
});

app.put('/api/resources/syllabus/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { class_group, subject_name, url, cover_image_url } = req.body;
        const query = 'UPDATE learning_resources SET class_group = ?, subject_name = ?, url = ?, cover_image_url = ? WHERE id = ? AND resource_type = "syllabus"';
        await db.query(query, [class_group, subject_name, url, cover_image_url, id]);
        res.status(200).json({ message: 'Syllabus updated successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating syllabus.' });
    }
});

app.delete('/api/resources/syllabus/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM learning_resources WHERE id = ? AND resource_type = "syllabus"', [id]);
        res.status(200).json({ message: 'Syllabus deleted.' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting syllabus.' });
    }
});

app.post('/api/resources/textbooks', async (req, res) => {
    try {
        const { class_group, url } = req.body;
        if (!class_group || !url) {
            return res.status(400).json({ message: 'Class and URL are required.' });
        }
        const query = `
            INSERT INTO learning_resources (class_group, resource_type, url) VALUES (?, 'textbook', ?)
            ON DUPLICATE KEY UPDATE url = VALUES(url);
        `;
        await db.query(query, [class_group, url]);
        res.status(201).json({ message: 'Textbook link saved successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error saving textbook link.' });
    }
});


// By using "server.listen", you enable both your API routes and the real-time chat.
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server is running on port ${PORT} and is now accessible on your network.`);
    // You can add your IP address reminder here if you like, for example:
    // console.log(`   On your phone, use the IP Address: http://192.168.1.4:${PORT}`);
});