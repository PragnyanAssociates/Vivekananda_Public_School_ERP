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

// ★★★ NEW IMPORTS FOR REAL-TIME CHAT ★★★
const http = require('http');
const { Server } = require("socket.io");
// ★★★ END NEW IMPORTS ★★★

const app = express();

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));


const ROOT_STORAGE_PATH = '/data/uploads'; 
const PRE_ADMISSIONS_SUBPATH = 'preadmissions'; // Subfolder for organization
const PRE_ADMISSIONS_ABSOLUTE_PATH = require('path').join(ROOT_STORAGE_PATH, PRE_ADMISSIONS_SUBPATH);


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

// ★★★★★ NEW: Multer Configuration for Recorded Class Videos ★★★★★
const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // We use the same destination as your other uploads for consistency
        cb(null, '/data/uploads'); 
    },
    filename: (req, file, cb) => {
        // A unique filename pattern for recorded videos
        cb(null, `recorded-class-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const videoUpload = multer({ 
    storage: videoStorage,
    limits: { fileSize: 200 * 1024 * 1024 }, // Set a 200MB file size limit (adjust as needed)
    fileFilter: (req, file, cb) => {
        // Ensure only video files are uploaded
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only video files are allowed.'), false);
        }
    }
});


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

// ★★★ THIS IS THE MISSING FUNCTION THAT WAS ADDED ★★★
const isTeacherOrAdmin = (req, res, next) => {
    // This middleware runs AFTER verifyToken, so req.user is available.
    if (req.user && (req.user.role === 'admin' || req.user.role === 'teacher')) {
        // If the user is an admin or a teacher, allow them to proceed.
        next();
    } else {
        // Otherwise, deny access.
        res.status(403).json({ message: 'Access denied. Admin or Teacher role required.' });
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

        if (!user || password !== user.password) {
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
            SELECT
                u.id, u.username, u.password, u.full_name, u.role, u.class_group, u.subjects_taught,
                p.email, p.phone, p.address,
                p.roll_no, p.admission_no, p.parent_name, p.aadhar_no, p.pen_no, p.admission_date,
                p.joining_date, p.previous_salary, p.present_salary, p.experience
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
    const {
        username, password, full_name, email, role, class_group, subjects_taught,
        roll_no, admission_no, parent_name, aadhar_no, pen_no, admission_date,
        joining_date, previous_salary, present_salary, experience
    } = req.body;
    const subjectsJson = (role === 'teacher' && Array.isArray(subjects_taught)) ? JSON.stringify(subjects_taught) : null;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [userResult] = await connection.query(
            'INSERT INTO users (username, password, full_name, role, class_group, subjects_taught) VALUES (?, ?, ?, ?, ?, ?)',
            [username, password, full_name, role, class_group, subjectsJson]
        );

        const newUserId = userResult.insertId;

        if (role === 'student') {
            await connection.query(
                'INSERT INTO user_profiles (user_id, email, admission_date, roll_no, admission_no, parent_name, aadhar_no, pen_no) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [newUserId, email || null, admission_date || null, roll_no || null, admission_no || null, parent_name || null, aadhar_no || null, pen_no || null]
            );
        } else {
            await connection.query(
                'INSERT INTO user_profiles (user_id, email, aadhar_no, joining_date, previous_salary, present_salary, experience) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [newUserId, email || null, aadhar_no || null, joining_date || null, previous_salary || null, present_salary || null, experience || null]
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'User and profile created successfully!' });
    } catch (error) {
        await connection.rollback();
        console.error("User Creation Error:", error);
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Error: This username already exists.' });
        res.status(500).json({ message: 'Error: Could not create user.' });
    } finally { connection.release(); }
});


app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const {
        username, password, full_name, role, class_group, subjects_taught,
        roll_no, admission_no, parent_name, aadhar_no, pen_no, admission_date,
        joining_date, previous_salary, present_salary, experience
    } = req.body;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        let userQueryFields = [];
        let userQueryParams = [];

        if (username !== undefined) { userQueryFields.push('username = ?'); userQueryParams.push(username); }
        if (full_name !== undefined) { userQueryFields.push('full_name = ?'); userQueryParams.push(full_name); }
        if (role !== undefined) { userQueryFields.push('role = ?'); userQueryParams.push(role); }
        if (class_group !== undefined) { userQueryFields.push('class_group = ?'); userQueryParams.push(class_group); }

        if (password) {
            userQueryFields.push('password = ?');
            userQueryParams.push(password);
        }

        if (role === 'teacher' && subjects_taught !== undefined) {
            const subjectsJson = Array.isArray(subjects_taught) ? JSON.stringify(subjects_taught) : null;
            userQueryFields.push('subjects_taught = ?');
            userQueryParams.push(subjectsJson);
        }

        if (userQueryFields.length > 0) {
            userQueryParams.push(id);
            const userSql = `UPDATE users SET ${userQueryFields.join(', ')} WHERE id = ?`;
            await connection.query(userSql, userQueryParams);
        }

        const userRoleToUpdate = role || (await connection.query('SELECT role FROM users WHERE id = ?', [id]))[0][0].role;

        if (userRoleToUpdate === 'student') {
             const profileSql = `
                INSERT INTO user_profiles (user_id, roll_no, admission_no, parent_name, aadhar_no, pen_no, admission_date)
                VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE
                    roll_no = VALUES(roll_no), admission_no = VALUES(admission_no),
                    parent_name = VALUES(parent_name), aadhar_no = VALUES(aadhar_no),
                    pen_no = VALUES(pen_no), admission_date = VALUES(admission_date)`;
            await connection.query(profileSql, [id, roll_no, admission_no, parent_name, aadhar_no, pen_no, admission_date]);
        } else {
             const profileSql = `
                INSERT INTO user_profiles (user_id, aadhar_no, joining_date, previous_salary, present_salary, experience)
                VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE
                    aadhar_no = VALUES(aadhar_no), joining_date = VALUES(joining_date),
                    previous_salary = VALUES(previous_salary), present_salary = VALUES(present_salary),
                    experience = VALUES(experience)`;
            await connection.query(profileSql, [id, aadhar_no, joining_date, previous_salary, present_salary, experience]);
        }

        await connection.commit();
        res.status(200).json({ message: 'User updated successfully!' });
    } catch (error) {
        await connection.rollback();
        console.error("User Update Error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Error: This username already exists.' });
        }
        res.status(500).json({ message: 'Error: Could not update user.' });
    } finally {
        connection.release();
    }
});


// ==========================================================
// --- THIS IS THE CORRECTED ROUTE ---
// ==========================================================
app.get('/api/profiles/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        // CORRECTED: Explicitly select columns to prevent the 'id' field from being overwritten.
        // This ensures u.id is the primary id in the response.
        const sql = `
            SELECT
                u.id,
                u.username,
                u.full_name,
                u.role,
                u.class_group,
                u.subjects_taught,
                p.email,
                p.dob,
                p.gender,
                p.phone,
                p.address,
                p.profile_image_url,
                p.admission_date,
                p.roll_no,
                p.admission_no,
                p.parent_name,
                p.aadhar_no,
                p.pen_no,
                p.joining_date,
                p.previous_salary,
                p.present_salary,
                p.experience
            FROM users u
            LEFT JOIN user_profiles p ON u.id = p.user_id
            WHERE u.id = ?`;
        const [rows] = await db.query(sql, [userId]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error("Get Profile Error:", error);
        res.status(500).json({ message: 'Database error fetching profile' });
    }
});
// ==========================================================
// --- END OF CORRECTION ---
// ==========================================================

app.put('/api/profiles/:userId', upload.single('profileImage'), async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    const {
        full_name, class_group, email, dob, gender, phone, address,
        admission_date, roll_no, admission_no, parent_name, pen_no,
        aadhar_no, joining_date, previous_salary, present_salary, experience
    } = req.body;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        if (full_name !== undefined || class_group !== undefined) {
            await connection.query('UPDATE users SET full_name = ?, class_group = ? WHERE id = ?', [full_name, class_group, userId]);
        }

        const [userRows] = await connection.query('SELECT role FROM users WHERE id = ?', [userId]);
        const userRole = userRows[0]?.role;

        const [currentUserProfileRows] = await connection.query('SELECT profile_image_url FROM user_profiles WHERE user_id = ?', [userId]);
        const currentImageUrl = currentUserProfileRows[0]?.profile_image_url;
        let newImageUrl = currentImageUrl;

        const deleteCurrentImageFile = () => {
            if (currentImageUrl) {
                const imagePath = path.join(__dirname, 'public', currentImageUrl);
                fs.unlink(imagePath, (err) => {
                    if (err) console.error(`Failed to delete old image at ${imagePath}:`, err);
                    else console.log(`Deleted old image: ${imagePath}`);
                });
            }
        };

        if (req.file) {
            deleteCurrentImageFile();
            newImageUrl = `/uploads/${req.file.filename}`;
        } else if (req.body.profile_image_url === 'null') {
            deleteCurrentImageFile();
            newImageUrl = null;
        }

        if (userRole === 'student') {
            const profileSql = `
                INSERT INTO user_profiles (user_id, email, dob, gender, phone, address, profile_image_url, admission_date, roll_no, admission_no, parent_name, aadhar_no, pen_no)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    email = VALUES(email), dob = VALUES(dob), gender = VALUES(gender),
                    phone = VALUES(phone), address = VALUES(address), profile_image_url = VALUES(profile_image_url),
                    admission_date = VALUES(admission_date), roll_no = VALUES(roll_no),
                    admission_no = VALUES(admission_no), parent_name = VALUES(parent_name),
                    aadhar_no = VALUES(aadhar_no), pen_no = VALUES(pen_no)
            `;
            await connection.query(profileSql, [userId, email, dob, gender, phone, address, newImageUrl, admission_date, roll_no, admission_no, parent_name, aadhar_no, pen_no]);
        } else {
            const profileSql = `
                INSERT INTO user_profiles (user_id, email, dob, gender, phone, address, profile_image_url, aadhar_no, joining_date, previous_salary, present_salary, experience)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    email = VALUES(email), dob = VALUES(dob), gender = VALUES(gender),
                    phone = VALUES(phone), address = VALUES(address), profile_image_url = VALUES(profile_image_url),
                    aadhar_no = VALUES(aadhar_no), joining_date = VALUES(joining_date),
                    previous_salary = VALUES(previous_salary), present_salary = VALUES(present_salary),
                    experience = VALUES(experience)
            `;
            await connection.query(profileSql, [userId, email, dob, gender, phone, address, newImageUrl, aadhar_no, joining_date, previous_salary, present_salary, experience]);
        }

        await connection.commit();
        res.status(200).json({ message: 'Profile updated successfully!', profile_image_url: newImageUrl });

    } catch (error) {
        await connection.rollback();
        console.error("Profile Update Error:", error);

        if (req.file) {
            const uploadedFilePath = path.join(__dirname, 'public', 'uploads', req.file.filename);
            fs.unlink(uploadedFilePath, (err) => {
                if (err) console.error(`Failed to delete orphaned upload ${uploadedFilePath}:`, err);
            });
        }

        res.status(500).json({ message: 'An error occurred while updating the profile.' });
    } finally {
        connection.release();
    }
});

app.patch('/api/users/:id/reset-password', async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ message: 'New password cannot be empty.' });
    try {
        const [result] = await db.query('UPDATE users SET password = ? WHERE id = ?', [newPassword, id]);
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

        if (userRows.length === 0 || userRows[0].role !== 'others') {
            return res.status(200).json({ message: 'If an Others account with that email exists, a reset code has been sent.' });
        }
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const tokenExpiry = new Date(Date.now() + 600000);
        await db.query('UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?', [resetCode, tokenExpiry, user_id]);
        await sendPasswordResetCode(email, resetCode);
        res.status(200).json({ message: 'A 6-digit reset code has been sent to your email.' });
    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({ message: 'An unexpected error occurred.' });
    }
});

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
        await db.query('UPDATE users SET password = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?', [newPassword, user.id]);
        res.status(200).json({ message: 'Password has been successfully reset. You can now log in.' });
    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ message: 'An error occurred while resetting the password.' });
    }
});

app.post('/api/auth/change-password', async (req, res) => {
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

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new passwords are required.' });
    }

    try {
        const [rows] = await db.query('SELECT password FROM users WHERE id = ?', [userId]);
        const user = rows[0];

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (currentPassword !== user.password) {
            return res.status(401).json({ message: 'Incorrect current password.' });
        }

        await db.query('UPDATE users SET password = ? WHERE id = ?', [newPassword, userId]);

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



// 📂 File: server.js (CORRECTED & VERIFIED ATTENDANCE MODULE)

// ==========================================================
// --- ATTENDANCE API ROUTES ---
// ==========================================================

// GET subjects for a specific class group (No changes needed, this is correct)
app.get('/api/subjects/:class_group', async (req, res) => {
    try {
        const { class_group } = req.params;
        if (!class_group) { return res.status(400).json({ message: 'Class group is required.' }); }
        const query = `SELECT DISTINCT subject_name FROM timetables WHERE class_group = ? ORDER BY subject_name;`;
        const [subjects] = await db.query(query, [class_group]);
        res.status(200).json(subjects.map(s => s.subject_name));
    } catch (error) {
        console.error("GET /api/subjects/:class_group Error:", error);
        res.status(500).json({ message: 'Could not fetch subjects for the class.' });
    }
});

// GET assignments for a specific teacher (No changes needed, this is correct)
app.get('/api/teacher-assignments/:teacherId', async (req, res) => {
    try {
        const { teacherId } = req.params;
        if (!teacherId) { return res.status(400).json({ message: 'Teacher ID is required.' }); }
        const query = `SELECT DISTINCT class_group, subject_name FROM timetables WHERE teacher_id = ? ORDER BY class_group, subject_name;`;
        const [assignments] = await db.query(query, [teacherId]);
        res.status(200).json(assignments);
    } catch (error) {
        console.error("GET /api/teacher-assignments/:teacherId Error:", error);
        res.status(500).json({ message: 'Could not fetch teacher assignments.' });
    }
});

// ==========================================================
// --- MODIFIED SECTION STARTS HERE ---
// ==========================================================

// Helper function for attendance summaries
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

    // ★★★ MODIFIED QUERY: Joins user_profiles to get roll_no and orders by it ★★★
    const studentDetailsQuery = `
        SELECT
            u.id AS student_id,
            u.full_name,
            up.roll_no,
            COALESCE(SUM(CASE WHEN ar.status = 'Present' THEN 1 ELSE 0 END), 0) as present_days,
            COUNT(ar.id) as total_days
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        LEFT JOIN attendance_records ar ON u.id = ar.student_id AND ${whereClause} ${dateFilter}
        WHERE u.role = 'student' AND u.class_group = ?
        GROUP BY u.id, u.full_name, up.roll_no
        ORDER BY CAST(up.roll_no AS UNSIGNED), u.full_name;
    `;
    const studentDetailsParams = [...fullQueryParams, filters.classGroup];
    const [studentDetails] = await db.query(studentDetailsQuery, studentDetailsParams);
    return { overallSummary, studentDetails };
};

// ==========================================================
// --- MODIFIED SECTION ENDS HERE ---
// ==========================================================

// GET teacher attendance summary (No changes needed, this is correct)
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

// GET admin attendance summary (No changes needed, this is correct)
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

// ★★★★★ NEW ROUTE TO CHECK ATTENDANCE STATUS ★★★★★
app.get('/api/attendance/status', async (req, res) => {
    const { class_group, date, period_number, subject_name } = req.query;
    try {
        if (!class_group || !date || !period_number || !subject_name) {
            return res.status(400).json({ message: 'Class group, date, period number, and subject name are required.' });
        }

        const query = `
            SELECT 1
            FROM attendance_records
            WHERE class_group = ? AND attendance_date = ? AND period_number = ? AND subject_name = ?
            LIMIT 1;
        `;
        const [records] = await db.query(query, [class_group, date, period_number, subject_name]);

        if (records.length > 0) {
            res.status(200).json({ isMarked: true });
        } else {
            res.status(200).json({ isMarked: false });
        }
    } catch (error) {
        console.error("GET /api/attendance/status Error:", error);
        res.status(500).json({ message: 'Error checking attendance status.' });
    }
});

// GET attendance sheet for a specific period
app.get('/api/attendance/sheet', async (req, res) => {
    const { class_group, date, period_number } = req.query;
    try {
        if (!class_group || !date || !period_number) {
            return res.status(400).json({ message: 'Class group, date, and period number are required.' });
        }

        const query = `
            SELECT u.id, u.full_name, up.roll_no, ar.status
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            LEFT JOIN attendance_records ar ON u.id = ar.student_id AND ar.attendance_date = ? AND ar.period_number = ?
            WHERE u.role = 'student' AND u.class_group = ?
            ORDER BY CAST(up.roll_no AS UNSIGNED), u.full_name;
        `;

        const [students] = await db.query(query, [date, period_number, class_group]);
        res.status(200).json(students);
    } catch (error) {
        console.error("GET /api/attendance/sheet Error:", error);
        res.status(500).json({ message: 'Error fetching attendance sheet.' });
    }
});

// POST attendance data and send notifications to absent students
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
            return res.status(403).json({ message: `You are not assigned to this period for this class on ${dayOfWeek}.` });
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

        const [[teacher]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [teacher_id]);
        const senderName = teacher.full_name || "School Staff";

        const absentStudents = attendanceData.filter(record => record.status === 'Absent');

        if (absentStudents.length > 0) {
            const absentStudentIds = absentStudents.map(record => record.student_id);
            const notificationTitle = `Attendance Alert: ${subject_name}`;
            const formattedDate = new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
            const notificationMessage = `You were marked absent for Period ${period_number} on ${formattedDate}.`;
            const notificationLink = '/my-attendance';
            await createBulkNotifications(
                connection,
                absentStudentIds,
                senderName,
                notificationTitle,
                notificationMessage,
                notificationLink
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Attendance saved and notifications sent successfully!' });

    } catch (error) {
        await connection.rollback();
        console.error("POST /api/attendance Error:", error);
        res.status(500).json({ message: 'An internal server error occurred while saving attendance.' });
    } finally {
        connection.release();
    }
});

// Helper function for student attendance history (No changes needed, this is correct)
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

// GET personal attendance history for a student (No changes needed, this is correct)
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

// GET attendance history for a student (for Admin view) (No changes needed, this is correct)
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



// 📂 File: server.js (or your main backend file)
// ==========================================================
// --- HEALTH API ROUTES (CORRECTED) ---
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
        if (results.length > 0) {
            res.json(results[0]);
        } else {
            const [userRows] = await db.query('SELECT full_name FROM users WHERE id = ?', [userId]);
            const userName = userRows.length > 0 ? userRows[0].full_name : 'Student';
            res.json({ full_name: userName, user_id: userId });
        }
    } catch (error) { // ★★★ THIS LINE IS NOW CORRECTED ★★★
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

// Fetches students for a class, now including their roll number.
app.get('/api/health/students/:class_group', async (req, res) => {
    const { class_group } = req.params;
    const query = `
        SELECT 
            u.id, 
            u.full_name, 
            u.username, 
            up.roll_no
        FROM users u
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE u.role = 'student' AND u.class_group = ?
        ORDER BY CAST(up.roll_no AS UNSIGNED), up.roll_no, u.full_name`;
    try {
        const [results] = await db.query(query, [class_group]);
        res.json(results);
    } catch (error) {
        console.error("GET /api/health/students/:class_group Error:", error);
        res.status(500).json({ message: "Error fetching students." });
    }
});

// Fetches a specific student's health record, now including their roll number for display.
app.get('/api/health/record/:userId', async (req, res) => {
    const { userId } = req.params;
    const query = `
        SELECT 
            hr.*, 
            u.full_name, 
            up.roll_no 
        FROM users u 
        LEFT JOIN health_records hr ON u.id = hr.user_id 
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE u.id = ?`;
    try {
        const [results] = await db.query(query, [userId]);
        if (results.length === 0) return res.status(404).json({ message: "Student not found." });
        
        const record = results[0];
        if (!record.user_id) record.user_id = parseInt(userId, 10);

        res.json(record);
    } catch (error) {
        console.error("GET /api/health/record/:userId Error:", error);
        res.status(500).json({ message: "Error fetching health record." });
    }
});


// Endpoint for Teachers/Admins to create or update a health record (with notifications)
app.post('/api/health/record/:userId', async (req, res) => {
    const studentUserId = req.params.userId;
    const { editorId, blood_group, height_cm, weight_kg, last_checkup_date, allergies, medical_conditions, medications } = req.body;
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const query = `
            INSERT INTO health_records (user_id, blood_group, height_cm, weight_kg, last_checkup_date, allergies, medical_conditions, medications, last_updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            blood_group = VALUES(blood_group), height_cm = VALUES(height_cm), weight_kg = VALUES(weight_kg), last_checkup_date = VALUES(last_checkup_date),
            allergies = VALUES(allergies), medical_conditions = VALUES(medical_conditions), medications = VALUES(medications), last_updated_by = VALUES(last_updated_by);
        `;
        const values = [studentUserId, blood_group || null, height_cm || null, weight_kg || null, last_checkup_date || null, allergies, medical_conditions, medications, editorId];
        await connection.query(query, values);

        const [[editor]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [editorId]);
        const senderName = editor.full_name || "School Health Department";

        const notificationTitle = "Health Record Updated";
        const notificationMessage = `Your health information has been updated. Please review the details in the Health Info section.`;
        
        // Assuming createNotification is a function you have defined elsewhere
        await createNotification(
            connection,
            studentUserId,
            senderName,
            notificationTitle,
            notificationMessage,
            '/health-info'
        );
        
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
// --- EVENTS API ROUTES (UPDATED) ---
// ==========================================================

// GET ALL UNIQUE CLASS GROUPS FOR THE EVENT FORM
app.get('/api/classes', async (req, res) => {
    // This query selects distinct, non-empty class_group values from the users table.
    const query = "SELECT DISTINCT class_group FROM users WHERE class_group IS NOT NULL AND class_group != '' ORDER BY class_group ASC";
    try {
        const [classes] = await db.query(query);
        // We map the database result to a simple array of strings.
        const classList = classes.map(c => c.class_group);
        res.json(classList);
    } catch (error) {
        console.error("Error fetching class groups:", error);
        res.status(500).json({ message: 'Error fetching class groups.' });
    }
});

// STUDENT/TEACHER/ADMIN: Get all upcoming events relevant to them.
app.get('/api/events/all-for-user/:userId', async (req, res) => {
    const { userId } = req.params;
    const connection = await db.getConnection();
    try {
        // First, get the user's role and class group.
        const [[user]] = await connection.query("SELECT role, class_group FROM users WHERE id = ?", [userId]);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        let query;
        let queryParams = [];

        // Admins and teachers see all events.
        if (user.role === 'admin' || user.role === 'teacher') {
            query = `
                SELECT * FROM events 
                WHERE event_datetime >= CURDATE() 
                ORDER BY event_datetime ASC`;
        } else { // Students see events for 'All' or their specific class_group.
            query = `
                SELECT * FROM events 
                WHERE event_datetime >= CURDATE() AND (target_class = 'All' OR target_class = ?)
                ORDER BY event_datetime ASC`;
            queryParams.push(user.class_group);
        }

        const [events] = await connection.query(query, queryParams);
        res.json(events);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching events.' });
    } finally {
        connection.release();
    }
});


// ADMIN/TEACHER: Create a new event.
app.post('/api/events', async (req, res) => {
    // Note: rsvp_required is removed, target_class is added.
    const { title, category, event_datetime, location, description, created_by, target_class } = req.body;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Step 1: Create the event with the new target_class field.
        const query = 'INSERT INTO events (title, category, event_datetime, location, description, created_by, target_class) VALUES (?, ?, ?, ?, ?, ?, ?)';
        await connection.query(query, [title, category, event_datetime, location, description, created_by, target_class]);

        // ★★★★★ START: MODIFIED NOTIFICATION LOGIC ★★★★★

        let usersToNotifyQuery;
        const queryParams = [created_by];

        // Define who receives the notification based on the target_class.
        if (target_class === 'All') {
            // All students and teachers (except the creator).
            usersToNotifyQuery = "SELECT id FROM users WHERE role IN ('student', 'teacher') AND id != ?";
        } else {
            // All teachers plus students in the specific class.
            usersToNotifyQuery = "SELECT id FROM users WHERE (role = 'teacher' OR class_group = ?) AND id != ?";
            queryParams.unshift(target_class); // Add target_class to the beginning of params.
        }
        
        const [usersToNotify] = await connection.query(usersToNotifyQuery, queryParams);

        if (usersToNotify.length > 0) {
            // Get creator's name for the notification.
            const [[creator]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [created_by]);
            const senderName = creator.full_name || "School Administration";

            // Prepare and send notifications in bulk.
            const recipientIds = usersToNotify.map(u => u.id);
            const notificationTitle = `New Event: ${title}`;
            const eventDate = new Date(event_datetime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            const notificationMessage = `A new event "${title}" is scheduled for ${eventDate}. Check the events section for details.`;

            // This function is assumed to exist elsewhere in your backend.
            await createBulkNotifications(
                connection,
                recipientIds,
                senderName,
                notificationTitle,
                notificationMessage,
                '/events' // A generic link to the events screen.
            );
        }

        // ★★★★★ END: MODIFIED NOTIFICATION LOGIC ★★★★★

        await connection.commit();
        res.status(201).json({ message: 'Event created and notifications sent successfully!' });

    } catch (error) {
        await connection.rollback();
        console.error("Error creating event:", error);
        res.status(500).json({ message: 'Error creating event.' });
    } finally {
        connection.release();
    }
});


// ADMIN/TEACHER: Get all events for the management view (simplified).
app.get('/api/events/all-for-admin', async (req, res) => {
    const query = `
        SELECT e.*, u.full_name as creator_name
        FROM events e
        LEFT JOIN users u ON e.created_by = u.id
        ORDER BY e.event_datetime DESC`;
    try {
        const [events] = await db.query(query);
        res.json(events);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching admin event list.' });
    }
});

// ADMIN/TEACHER: Update an existing event.
app.put('/api/events/:eventId', async (req, res) => {
    const { eventId } = req.params;
    const { title, category, event_datetime, location, description, target_class, userId } = req.body;

    // Basic validation
    if (!title || !event_datetime || !target_class || !userId) {
        return res.status(400).json({ message: 'Missing required fields for update.' });
    }

    try {
        // Security Check: Ensure the user is the creator or an admin
        const [[event]] = await db.query('SELECT created_by FROM events WHERE id = ?', [eventId]);
        if (!event) {
            return res.status(404).json({ message: 'Event not found.' });
        }
        
        const [[user]] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);
        if (!user) {
             return res.status(404).json({ message: 'User not found.' });
        }

        if (event.created_by !== userId && user.role !== 'admin') {
            return res.status(403).json({ message: 'You are not authorized to edit this event.' });
        }

        // Proceed with update
        const query = `
            UPDATE events SET
            title = ?, category = ?, event_datetime = ?, location = ?, description = ?, target_class = ?
            WHERE id = ?`;
        
        await db.query(query, [title, category, event_datetime, location, description, target_class, eventId]);
        
        res.status(200).json({ message: 'Event updated successfully!' });

    } catch (error) {
        console.error("Error updating event:", error);
        res.status(500).json({ message: 'Error updating event.' });
    }
});

// 📂 File: server.js (ADD THIS NEW ROUTE)
// ADMIN/TEACHER: Delete an event.
app.delete('/api/events/:eventId', async (req, res) => {
    const { eventId } = req.params;
    const { userId } = req.body; // Sent from frontend for authorization

     if (!userId) {
        return res.status(400).json({ message: 'User ID is required for authorization.' });
    }

    try {
        // Security Check: Ensure the user is the creator or an admin
        const [[event]] = await db.query('SELECT created_by FROM events WHERE id = ?', [eventId]);
        if (!event) {
            return res.status(404).json({ message: 'Event not found.' });
        }

        const [[user]] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);
         if (!user) {
             return res.status(404).json({ message: 'User not found.' });
        }

        if (event.created_by !== userId && user.role !== 'admin') {
            return res.status(403).json({ message: 'You are not authorized to delete this event.' });
        }

        // Proceed with deletion
        await db.query('DELETE FROM events WHERE id = ?', [eventId]);
        res.status(200).json({ message: 'Event deleted successfully.' });

    } catch (error) {
        console.error("Error deleting event:", error);
        res.status(500).json({ message: 'Error deleting event.' });
    }
});

// STUDENT/TEACHER/ADMIN: Get full details for a SINGLE event.
app.get('/api/events/details/:eventId', async (req, res) => {
    const { eventId } = req.params;
    const eventQuery = 'SELECT * FROM events WHERE id = ?';

    try {
        const [eventResult] = await db.query(eventQuery, [eventId]);
        if (eventResult.length === 0) {
            return res.status(404).json({ message: 'Event not found.' });
        }
        // The response is now simpler, just containing the event details.
        res.json({ event: eventResult[0] });

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
// ★★★ THIS IS THE CORRECTED CODE WITH THE FIX ★★★
app.get('/api/ptm', verifyToken, async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;

    try {
        // Define the columns to select explicitly. This is the fix.
        // It ensures 'meeting_link' is always included in the response.
        const columnsToSelect = `
            id, meeting_datetime, teacher_id, teacher_name, class_group, 
            subject_focus, status, notes, meeting_link
        `;

        // Admins and teachers see all meetings
        if (userRole === 'admin' || userRole === 'teacher') {
            const query = `SELECT ${columnsToSelect} FROM ptm_meetings ORDER BY meeting_datetime DESC`;
            const [meetings] = await db.query(query);
            return res.status(200).json(meetings);
        }

        // Students (and parents, if applicable) only see meetings for their class or for 'All' classes
        if (userRole === 'student' || userRole === 'parent') {
            // First, get the student's class_group from the database using their ID from the token
            const [[user]] = await db.query('SELECT class_group FROM users WHERE id = ?', [userId]);
            
            if (!user || !user.class_group) {
                 // If a student has no class, they should still see school-wide meetings
                 const query = `SELECT ${columnsToSelect} FROM ptm_meetings WHERE class_group = 'All' ORDER BY meeting_datetime DESC`;
                 const [meetings] = await db.query(query);
                 return res.status(200).json(meetings);
            }

            const studentClassGroup = user.class_group;
            const query = `
                SELECT ${columnsToSelect} FROM ptm_meetings 
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

// GET list of all teachers and admins for the form
app.get('/api/ptm/teachers', verifyToken, async (req, res) => {
    try {
        const [users] = await db.query("SELECT id, full_name FROM users WHERE role IN ('teacher', 'admin') ORDER BY full_name ASC");
        res.status(200).json(users);
    } catch (error) {
        console.error("GET /api/ptm/teachers Error:", error);
        res.status(500).json({ message: 'Could not fetch the list of teachers and admins.' });
    }
});

// GET a unique list of all classes for the form
app.get('/api/ptm/classes', verifyToken, async (req, res) => {
    try {
        const query = "SELECT DISTINCT class_group FROM users WHERE class_group IS NOT NULL AND class_group != '' ORDER BY class_group ASC";
        const [results] = await db.query(query);
        const classes = results.map(item => item.class_group);
        res.status(200).json(classes);
    } catch (error)
    {
        console.error("GET /api/ptm/classes Error:", error);
        res.status(500).json({ message: 'Could not fetch the list of classes.' });
    }
});


// POST a new meeting (CORRECTED NOTIFICATION LOGIC)
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

        // --- CORRECTED NOTIFICATION RECIPIENT LOGIC ---
        
        const specificTeacherId = parseInt(teacher_id, 10);
        let recipientIds = [];
        let recipientQuery = '';

        if (class_group === 'All') {
            // Target: All Students, All Teachers, All Admins
            recipientQuery = "SELECT id FROM users WHERE role IN ('student', 'teacher', 'admin')";
        } else if (class_group === 'Teachers') {
            // Target: All Teachers
            recipientQuery = "SELECT id FROM users WHERE role = 'teacher'";
        } else if (class_group === 'Admins') {
            // Target: All Admins (This is uncommon for PTMs, but supported by the UI)
            recipientQuery = "SELECT id FROM users WHERE role = 'admin'";
        } else {
            // Default case: Specific Class (e.g., 'Class 1', 'LKG')
            // Get all students in that class
            recipientQuery = "SELECT id FROM users WHERE role = 'student' AND class_group = ?";
            
            // Execute the specific class query and initialize recipients
            const [students] = await connection.query(recipientQuery, [class_group]);
            recipientIds = students.map(s => s.id);
        }

        // If a general group query was run, fetch the IDs now
        if (recipientQuery && class_group !== 'Admins' && class_group !== 'Teachers' && class_group !== 'All') {
            // recipientIds are already populated for specific classes
        } else if (recipientQuery) {
             const [users] = await connection.query(recipientQuery);
             recipientIds = users.map(u => u.id);
        }
        
        // Always ensure the specific teacher associated with the meeting is notified (and the creator if they aren't the teacher)
        recipientIds.push(specificTeacherId);
        
        // Use a Set to get unique IDs (deduplicate)
        const allRecipientIds = [...new Set(recipientIds)]; 

        if (allRecipientIds.length > 0) {
            const senderName = req.user.full_name || "School Administration";

            const displayClass = class_group === 'All' ? 'all classes' : class_group;
            const notificationTitle = `New PTM: ${class_group === 'All' ? 'All Classes' : class_group}`;
            const eventDate = new Date(meeting_datetime).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
            const notificationMessage = `A PTM for ${displayClass} regarding "${subject_focus}" with ${teacher.full_name} has been scheduled for ${eventDate}.`;

            await createBulkNotifications(
                connection,
                allRecipientIds, // Now includes Teachers, Admins, or All users correctly
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
// --- DIGITAL LABS API ROUTES (UPDATED) ---
// ==========================================================
// This section handles creating, fetching, and managing digital lab resources.
// It uses the 'upload' multer instance you already configured.

// Helper function for creating bulk notifications (assuming it exists elsewhere)
// async function createBulkNotifications(connection, recipientIds, senderName, title, message, link) { ... }

// ★ 1. MODIFIED: GET labs for a specific STUDENT's class (includes teacher name)
app.get('/api/labs/student/:classGroup', async (req, res) => {
    const { classGroup } = req.params;
    try {
        // Query now JOINS with the users table to fetch the creator's name.
        const query = `
            SELECT 
                dl.*, 
                u.full_name as teacher_name 
            FROM digital_labs dl
            LEFT JOIN users u ON dl.created_by = u.id
            WHERE dl.class_group = ? OR dl.class_group IS NULL OR dl.class_group = ''
            ORDER BY dl.created_at DESC
        `;
        const [labs] = await db.query(query, [classGroup]);
        res.status(200).json(labs);
    } catch (error) {
        console.error("GET /api/labs/student/:classGroup Error:", error);
        res.status(500).json({ message: 'Error fetching digital labs.' });
    }
});

// ★ 2. MODIFIED: GET all labs created by a specific TEACHER (includes teacher name)
app.get('/api/labs/teacher/:teacherId', async (req, res) => {
    const { teacherId } = req.params;
    try {
        const query = `
            SELECT 
                dl.*, 
                u.full_name as teacher_name 
            FROM digital_labs dl
            LEFT JOIN users u ON dl.created_by = u.id
            WHERE dl.created_by = ? 
            ORDER BY dl.created_at DESC
        `;
        const [labs] = await db.query(query, [teacherId]);
        res.status(200).json(labs);
    } catch (error) {
        console.error("GET /api/labs/teacher/:teacherId Error:", error);
        res.status(500).json({ message: 'Error fetching labs.' });
    }
});

// ★ 3. MODIFIED: POST a new digital lab (handles all new fields)
app.post('/api/labs', upload.fields([{ name: 'coverImage', maxCount: 1 }, { name: 'labFile', maxCount: 1 }]), async (req, res) => {
    // Destructure all new fields from the request body
    const { 
        title, subject, lab_type, class_group, description, access_url, 
        created_by, topic, video_url, meet_link, class_datetime 
    } = req.body;

    const coverImageFile = req.files['coverImage'] ? req.files['coverImage'][0] : null;
    const labFile = req.files['labFile'] ? req.files['labFile'][0] : null;

    const cover_image_url = coverImageFile ? `/uploads/${coverImageFile.filename}` : null;
    const file_path = labFile ? `/uploads/${labFile.filename}` : null;
    
    // A lab should have at least one way to be accessed
    if (!access_url && !file_path && !video_url && !meet_link) {
        return res.status(400).json({ message: 'You must provide an Access URL, Video URL, Meet Link, or upload a Lab File.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Updated INSERT query with all new columns
        const query = `
            INSERT INTO digital_labs (
                title, subject, lab_type, class_group, description, access_url, 
                created_by, topic, video_url, meet_link, class_datetime, 
                file_path, cover_image_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        // Use 'NULL' for empty strings to avoid database errors, especially for datetime.
        const classDateTimeValue = class_datetime ? class_datetime : null;

        await connection.query(query, [
            title, subject, lab_type, class_group || null, description, access_url || null, 
            created_by || null, topic || null, video_url || null, meet_link || null, classDateTimeValue,
            file_path, cover_image_url
        ]);
        
        // --- MODIFIED NOTIFICATION LOGIC ---
        let usersToNotifyQuery;
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
            const notificationMessage = `A new lab titled "${title}" has been added by ${senderName}.`;

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


// ★ 4. MODIFIED: UPDATE an existing lab (handles all new fields)
app.put('/api/labs/:id', upload.fields([{ name: 'coverImage', maxCount: 1 }, { name: 'labFile', maxCount: 1 }]), async (req, res) => {
    const { id } = req.params;
    // Destructure all new fields
    const { 
        title, subject, lab_type, class_group, description, access_url, 
        created_by, topic, video_url, meet_link, class_datetime 
    } = req.body;
    
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
        const classDateTimeValue = class_datetime ? class_datetime : null;

        // Updated UPDATE query with all new columns
        const query = `
            UPDATE digital_labs SET 
                title = ?, subject = ?, lab_type = ?, class_group = ?, description = ?, 
                access_url = ?, topic = ?, video_url = ?, meet_link = ?, class_datetime = ?, 
                file_path = ?, cover_image_url = ?
            WHERE id = ?
        `;
        await connection.query(query, [
            title, subject, lab_type, class_group || null, description, 
            access_url || null, topic || null, video_url || null, meet_link || null, classDateTimeValue,
            file_path, cover_image_url, id
        ]);
        
        // --- Notification on update ---
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

// DELETE a digital lab (No changes needed, but included for completeness)
app.delete('/api/labs/:id', async (req, res) => {
    const { id } = req.params;
    try {
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

// Create a new homework assignment
app.post('/api/homework', upload.single('attachment'), async (req, res) => {
    const { title, description, class_group, subject, due_date, teacher_id, homework_type } = req.body;
    
    if (!homework_type || !['PDF', 'Written'].includes(homework_type)) {
        return res.status(400).json({ message: 'A valid homework type (PDF or Written) is required.' });
    }

    const attachment_path = req.file ? `/uploads/${req.file.filename}` : null;
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        const query = `INSERT INTO homework_assignments (title, description, class_group, subject, due_date, teacher_id, attachment_path, homework_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const [assignmentResult] = await connection.query(query, [title, description, class_group, subject, due_date, teacher_id, attachment_path, homework_type]);
        const newAssignmentId = assignmentResult.insertId;

        const [[teacher]] = await connection.query('SELECT full_name FROM users WHERE id = ?', [teacher_id]);
        const [students] = await connection.query('SELECT id FROM users WHERE role = "student" AND class_group = ?', [class_group]);
        
        if (students.length > 0) {
            const studentIds = students.map(s => s.id);
            await createBulkNotifications(
                connection,
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
        console.error('[HOMEWORK CREATE ERROR]', error);
        res.status(500).json({ message: 'Error creating homework.' }); 
    } finally {
        connection.release();
    }
});


// Update an existing homework assignment
app.post('/api/homework/update/:assignmentId', upload.single('attachment'), async (req, res) => {
    const { assignmentId } = req.params;
    const { title, description, class_group, subject, due_date, existing_attachment_path, homework_type } = req.body;
    
    if (!homework_type || !['PDF', 'Written'].includes(homework_type)) {
        return res.status(400).json({ message: 'A valid homework type (PDF or Written) is required.' });
    }

    try {
        let attachment_path = existing_attachment_path || null;
        if (req.file) { 
            attachment_path = `/uploads/${req.file.filename}`; 
        }

        const query = `UPDATE homework_assignments SET title = ?, description = ?, class_group = ?, subject = ?, due_date = ?, attachment_path = ?, homework_type = ? WHERE id = ?`;
        await db.query(query, [title, description, class_group, subject, due_date, attachment_path, homework_type, assignmentId]);
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
        await db.query('DELETE FROM homework_assignments WHERE id = ?', [assignmentId]);
        res.status(200).json({ message: 'Homework and all its submissions deleted.' });
    } catch (error) { 
        console.error('Error deleting homework:', error);
        res.status(500).json({ message: 'Error deleting homework.' }); 
    }
});

// ★★★ CRITICAL CHANGE IS HERE ★★★
// Get all submissions for an assignment, now with Roll Number and sorted correctly.
app.get('/api/homework/submissions/:assignmentId', async (req, res) => {
    const { assignmentId } = req.params;
    try {
        // This query now JOINS user_profiles to get the roll_no
        // and sorts by roll_no numerically.
        const query = `
            SELECT 
                u.id as student_id,
                u.full_name as student_name,
                p.roll_no,
                s.id as submission_id,
                s.submission_path,
                s.written_answer,
                s.submitted_at,
                s.status,
                s.grade,
                s.remarks
            FROM 
                users u
            LEFT JOIN 
                user_profiles p ON u.id = p.user_id
            LEFT JOIN 
                homework_submissions s ON u.id = s.student_id AND s.assignment_id = ?
            WHERE 
                u.role = 'student' AND u.class_group = (
                    SELECT class_group FROM homework_assignments WHERE id = ?
                )
            ORDER BY 
                CAST(p.roll_no AS UNSIGNED) ASC, u.full_name ASC`;
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

// Get all assignments for a student
app.get('/api/homework/student/:studentId/:classGroup', async (req, res) => {
    const { studentId, classGroup } = req.params;
    try {
        const query = `
            SELECT 
                a.id, a.title, a.description, a.subject, a.due_date, a.attachment_path, a.homework_type,
                s.id as submission_id,
                s.written_answer,
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

// Student submits a homework file (PDF Type)
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
             await createBulkNotifications(
                connection, 
                [assignment.teacher_id],
                student.full_name, 
                `Submission for: ${assignment.title}`,
                `${student.full_name} (${student.class_group}) has submitted their homework.`, 
                `/submissions/${assignmentId}`
            );
        }
        
        await connection.commit();
        res.status(201).json({ message: 'Homework submitted successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error('[HOMEWORK SUBMIT ERROR]', error);
        res.status(500).json({ message: 'Database error during homework submission.' });
    } finally {
        connection.release();
    }
});

// Student submits a written answer
app.post('/api/homework/submit-written', async (req, res) => {
    const { assignment_id, student_id, written_answer } = req.body;

    if (!assignment_id || !student_id || !written_answer) {
        return res.status(400).json({ message: 'Assignment ID, Student ID, and an answer are required.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [existing] = await connection.query('SELECT id FROM homework_submissions WHERE assignment_id = ? AND student_id = ?', [assignment_id, student_id]);
        if (existing.length > 0) {
            await connection.rollback();
            return res.status(409).json({ message: 'You have already submitted this homework.' });
        }

        const query = `INSERT INTO homework_submissions (assignment_id, student_id, written_answer, status) VALUES (?, ?, ?, 'Submitted')`;
        await connection.query(query, [assignment_id, student_id, written_answer]);
        
        const [[assignment]] = await connection.query('SELECT teacher_id, title FROM homework_assignments WHERE id = ?', [assignment_id]);
        const [[student]] = await connection.query('SELECT full_name, class_group FROM users WHERE id = ?', [student_id]);

        if (assignment && student) {
             await createBulkNotifications(
                connection,
                [assignment.teacher_id],
                student.full_name,
                `Submission for: ${assignment.title}`,
                `${student.full_name} (${student.class_group}) has submitted their written homework.`,
                `/submissions/${assignment_id}`
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Answer submitted successfully.' });

    } catch (error) {
        await connection.rollback();
        console.error('[WRITTEN SUBMIT ERROR]', error);
        res.status(500).json({ message: 'Database error during submission.' });
    } finally {
        connection.release();
    }
});


// Delete a submission
app.delete('/api/homework/submission/:submissionId', async (req, res) => {
    const { submissionId } = req.params;
    const { student_id } = req.body; 

    if (!student_id) {
        return res.status(400).json({ message: 'Student ID is required for verification.' });
    }
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [[submission]] = await connection.query('SELECT * FROM homework_submissions WHERE id = ?', [submissionId]);

        if (!submission) {
            await connection.rollback();
            return res.status(404).json({ message: 'Submission not found.' });
        }

        if (submission.student_id != student_id) {
            await connection.rollback();
            return res.status(403).json({ message: 'You are not authorized to delete this submission.' });
        }

        await connection.query('DELETE FROM homework_submissions WHERE id = ?', [submissionId]);

        if (submission.submission_path) {
            const filePath = path.join(__dirname, '..', submission.submission_path);
            fs.unlink(filePath, (err) => {
                if (err) { console.error(`Failed to delete submission file: ${filePath}`, err); } 
                else { console.log(`Successfully deleted file: ${filePath}`); }
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
// --- EXAM SCHEDULE API ROUTES (MODIFIED) ---
// ==========================================================

// --- TEACHER / ADMIN ROUTES ---

// Get all exam schedules created
app.get('/api/exam-schedules', async (req, res) => {
    try {
        const query = `
            SELECT es.id, es.title, es.class_group, es.exam_type, u.full_name as created_by
            FROM exam_schedules es
            JOIN users u ON es.created_by_id = u.id
            ORDER BY es.updated_at DESC
        `; // ★ MODIFIED: Added es.exam_type
        const [schedules] = await db.query(query);
        res.json(schedules);
    } catch (error) {
        console.error("Error fetching exam schedules:", error);
        res.status(500).json({ message: "Failed to fetch exam schedules." });
    }
});

// Get a single, detailed exam schedule for editing (No changes needed, already uses *)
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
    // ★ MODIFIED: Added exam_type
    const { class_group, title, subtitle, exam_type, schedule_data, created_by_id } = req.body;
    if (!class_group || !title || !schedule_data || !created_by_id || !exam_type) {
        return res.status(400).json({ message: "Missing required fields." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const query = `
            INSERT INTO exam_schedules (class_group, title, subtitle, exam_type, schedule_data, created_by_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `; // ★ MODIFIED: Added exam_type column
        // ★ MODIFIED: Added exam_type to values array
        await connection.query(query, [class_group, title, subtitle, exam_type, JSON.stringify(schedule_data), created_by_id]);

        // (Notification logic remains the same)
        const [students] = await connection.query("SELECT id FROM users WHERE role = 'student' AND class_group = ?", [class_group]);
        const studentIds = students.map(s => s.id);
        const [teachers] = await connection.query("SELECT DISTINCT teacher_id FROM timetables WHERE class_group = ?", [class_group]);
        const teacherIds = teachers.map(t => t.teacher_id);
        const allRecipientIds = [...new Set([...studentIds, ...teacherIds])];
        const [[admin]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [created_by_id]);
        const senderName = admin.full_name || "School Administration";
        const notificationTitle = `New Exam Schedule Published`;
        const notificationMessage = `The schedule for "${title}" (${class_group}) has been published. Please check the details.`;

        if (allRecipientIds.length > 0) {
            await createBulkNotifications(connection, allRecipientIds, senderName, notificationTitle, notificationMessage, '/exam-schedule');
        }

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
    // ★ MODIFIED: Added exam_type
    const { class_group, title, subtitle, exam_type, schedule_data, created_by_id } = req.body;

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const query = `
            UPDATE exam_schedules
            SET class_group = ?, title = ?, subtitle = ?, exam_type = ?, schedule_data = ?
            WHERE id = ?
        `; // ★ MODIFIED: Added exam_type to SET clause
        // ★ MODIFIED: Added exam_type to values array
        await connection.query(query, [class_group, title, subtitle, exam_type, JSON.stringify(schedule_data), id]);

        // (Notification logic remains the same)
        const [students] = await connection.query("SELECT id FROM users WHERE role = 'student' AND class_group = ?", [class_group]);
        const studentIds = students.map(s => s.id);
        const [teachers] = await connection.query("SELECT DISTINCT teacher_id FROM timetables WHERE class_group = ?", [class_group]);
        const teacherIds = teachers.map(t => t.teacher_id);
        const allRecipientIds = [...new Set([...studentIds, ...teacherIds])];
        const [[admin]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [created_by_id]);
        const senderName = admin.full_name || "School Administration";
        const notificationTitle = `Exam Schedule Updated`;
        const notificationMessage = `The schedule for "${title}" (${class_group}) has been modified. Please review the updated details.`;

        if (allRecipientIds.length > 0) {
            await createBulkNotifications(connection, allRecipientIds, senderName, notificationTitle, notificationMessage, '/exam-schedule');
        }

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

// Delete an exam schedule (No changes needed)
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


// --- STUDENT ROUTE --- (No changes needed, already uses *)
app.get('/api/exam-schedules/class/:classGroup', async (req, res) => {
    const { classGroup } = req.params;
    try {
        const query = `
            SELECT
                es.*,
                u.full_name AS created_by
            FROM exam_schedules es
            LEFT JOIN users u ON es.created_by_id = u.id
            WHERE es.class_group = ?
            ORDER BY es.updated_at DESC
        `;
        const [schedules] = await db.query(query, [classGroup]);

        if (!schedules || schedules.length === 0) {
            return res.status(404).json({ message: "No exam schedules found for your class." });
        }
        res.json(schedules);

    } catch (error) {
        console.error('ERROR in exam-schedules API:', error);
        res.status(500).json({ message: "Failed to fetch exam schedules." });
    }
});




// ==========================================================
// --- ONLINE EXAMS API ROUTES  -----------------------
// ==========================================================

// --- TEACHER / ADMIN ROUTES ---

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

        const total_marks = questions.reduce((sum, q) => sum + (parseInt(q.marks, 10) || 0), 0);
        const [examResult] = await connection.query('INSERT INTO exams (title, description, class_group, time_limit_mins, created_by, total_marks, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [title, description, class_group, time_limit_mins, teacher_id, total_marks, 'published']);
        const exam_id = examResult.insertId;

        if (questions.length > 0) {
            const questionQuery = 'INSERT INTO exam_questions (exam_id, question_text, question_type, options, correct_answer, marks) VALUES ?';
            
            const questionValues = questions.map(q => {
                const isMcq = q.question_type === 'multiple_choice';
                return [
                    exam_id, 
                    q.question_text, 
                    q.question_type, 
                    isMcq ? JSON.stringify(q.options) : null, 
                    (isMcq && q.correct_answer) ? q.correct_answer : null,
                    q.marks
                ];
            });
            await connection.query(questionQuery, [questionValues]);
        }

        // --- Notification Logic ---
        const [students] = await connection.query("SELECT id FROM users WHERE role = 'student' AND class_group = ?", [class_group]);
        if (students.length > 0) {
            const [teacherRows] = await connection.query("SELECT full_name FROM users WHERE id = ?", [teacher_id]);
            const senderName = (teacherRows[0] && teacherRows[0].full_name) ? teacherRows[0].full_name : "School Administration";
            
            const studentIds = students.map(s => s.id);
            await createBulkNotifications(
                connection,
                studentIds,
                senderName,
                `New Exam Published: ${title}`,
                `An exam for your class (${class_group}) has been published. Please check the details.`,
                '/exams'
            );
        }

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

// UPDATE an existing exam
app.put('/api/exams/:examId', async (req, res) => {
    const { examId } = req.params;
    const { title, description, class_group, time_limit_mins, questions, teacher_id } = req.body;
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const total_marks = questions.reduce((sum, q) => sum + (parseInt(q.marks, 10) || 0), 0);
        await connection.query('UPDATE exams SET title = ?, description = ?, class_group = ?, time_limit_mins = ?, total_marks = ? WHERE exam_id = ?', [title, description, class_group, time_limit_mins, total_marks, examId]);
        
        await connection.query('DELETE FROM exam_questions WHERE exam_id = ?', [examId]);
        if (questions.length > 0) {
            const questionQuery = 'INSERT INTO exam_questions (exam_id, question_text, question_type, options, correct_answer, marks) VALUES ?';
            
            const questionValues = questions.map(q => {
                const isMcq = q.question_type === 'multiple_choice';
                return [
                    examId, 
                    q.question_text, 
                    q.question_type, 
                    isMcq ? JSON.stringify(q.options) : null, 
                    (isMcq && q.correct_answer) ? q.correct_answer : null,
                    q.marks
                ];
            });
            await connection.query(questionQuery, [questionValues]);
        }
        
        // --- Notification Logic ---
        const [students] = await connection.query("SELECT id FROM users WHERE role = 'student' AND class_group = ?", [class_group]);
        if (students.length > 0) {
            const [teacherRows] = await connection.query("SELECT full_name FROM users WHERE id = ?", [teacher_id]);
            const senderName = (teacherRows[0] && teacherRows[0].full_name) ? teacherRows[0].full_name : "School Administration";
            
            const studentIds = students.map(s => s.id);
            await createBulkNotifications(
                connection,
                studentIds,
                senderName,
                `Exam Updated: ${title}`,
                `Details for the exam "${title}" have been updated. Please review the changes.`,
                '/exams'
            );
        }

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
app.get('/api/exams/:examId/submissions', async (req, res) => {
    try {
        const { examId } = req.params;
        // ★★★★★ MODIFICATION: JOINED user_profiles to get roll_no ★★★★★
        const query = `
            SELECT 
                sea.*, 
                u.full_name as student_name, 
                up.roll_no 
            FROM student_exam_attempts sea 
            JOIN users u ON sea.student_id = u.id 
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE sea.exam_id = ? AND sea.status IN ('submitted', 'graded') 
            ORDER BY up.roll_no, u.full_name ASC`;
        const [submissions] = await db.query(query, [examId]);
        res.json(submissions);
    } catch (error) {
        console.error("Error in GET /api/exams/:examId/submissions:", error);
        res.status(500).json({ message: 'Error fetching submissions.' });
    }
});

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

app.post('/api/submissions/:attemptId/grade', async (req, res) => {
    const { attemptId } = req.params;
    const { gradedAnswers, teacher_feedback, teacher_id } = req.body;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [[attempt]] = await connection.query('SELECT exam_id, student_id FROM student_exam_attempts WHERE attempt_id = ?', [attemptId]);
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





// ===============================================================
// --- TEACHER PERFORMANCE MODULE API ROUTES (FINAL CORRECTED VERSION) ---
// ===============================================================

// Helper function to calculate average and total marks for a given set of assignments
const calculateTeacherPerformance = async (db, teacherId, academicYear) => {
    // ★★★ FINAL FIX ★★★: The query now uses a subquery with DISTINCT.
    // This ensures that even if there are accidental duplicate entries in the assignments table,
    // each student mark is joined and counted only ONCE. This definitively solves the duplication bug.
    const performanceQuery = `
        SELECT
            T.subject,
            T.class_group,
            AVG(rsm.marks_obtained) AS average_marks,
            SUM(rsm.marks_obtained) AS total_marks,
            COUNT(rsm.id) AS mark_entries_count
        FROM
            (SELECT DISTINCT class_group, subject, academic_year
             FROM report_teacher_assignments
             WHERE teacher_id = ? AND academic_year = ?) AS T
        JOIN report_student_marks AS rsm
            ON T.class_group = rsm.class_group
            AND T.subject = rsm.subject
            AND T.academic_year = rsm.academic_year
        WHERE
            rsm.marks_obtained IS NOT NULL
        GROUP BY
            T.subject,
            T.class_group
        ORDER BY
            T.class_group,
            T.subject;
    `;
    const [performanceData] = await db.query(performanceQuery, [teacherId, academicYear]);
    return performanceData;
};

// --- ADMIN ROUTE ---
// GET performance data for all teachers
app.get('/api/performance/admin/all-teachers/:academicYear', async (req, res) => {
    try {
        const { academicYear } = req.params;

        const [teachers] = await db.query("SELECT id, full_name FROM users WHERE role = 'teacher'");
        
        if (teachers.length === 0) {
            return res.json([]);
        }

        const allPerformanceData = [];
        for (const teacher of teachers) {
            const performance = await calculateTeacherPerformance(db, teacher.id, academicYear);
            
            let totalAverage = 0;
            let overallTotalMarks = 0;
            if (performance.length > 0) {
                // Correctly calculate the overall total and a more accurate weighted average
                const totalMarksSum = performance.reduce((sum, p) => sum + parseInt(p.total_marks || 0, 10), 0);
                const totalEntries = performance.reduce((sum, p) => sum + parseInt(p.mark_entries_count || 0, 10), 0);
                
                if (totalEntries > 0) {
                    totalAverage = totalMarksSum / totalEntries;
                }
                
                overallTotalMarks = totalMarksSum;
            }
            
            allPerformanceData.push({
                teacher_id: teacher.id,
                teacher_name: teacher.full_name,
                overall_average: totalAverage.toFixed(2),
                overall_total: overallTotalMarks,
                detailed_performance: performance
            });
        }

        res.json(allPerformanceData);

    } catch (error) {
        console.error("Error fetching all teachers' performance:", error);
        res.status(500).json({ message: "Failed to fetch teacher performance data." });
    }
});


// --- TEACHER ROUTE ---
// GET performance data for the currently logged-in teacher
app.get('/api/performance/teacher/:teacherId/:academicYear', async (req, res) => {
    try {
        const { teacherId, academicYear } = req.params;
        
        const performance = await calculateTeacherPerformance(db, teacherId, academicYear);
        
        res.json(performance);

    } catch (error) {
        console.error("Error fetching teacher's performance:", error);
        res.status(500).json({ message: "Failed to fetch your performance data." });
    }
});





// ==========================================================
// --- SYLLABUS Tracking API ROUTES ---
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
        
        const teacherId = creator_id;
        const studentIds = students.map(s => s.id);
        const allRecipientIds = [teacherId, ...studentIds];
        const notificationTitle = `New Syllabus: ${subject_name}`;
        const notificationMessage = `A new syllabus for ${subject_name} has been assigned to ${class_group}.`;
        const senderName = "School Administration";

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

// ADMIN: UPDATE an existing syllabus (replaces lessons)
app.put('/api/syllabus/:syllabusId', async (req, res) => {
    const { syllabusId } = req.params;
    const { lessons, creator_id } = req.body;

    if (!lessons || !creator_id) {
        return res.status(400).json({ message: "Lessons and creator ID are required." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [[syllabus]] = await connection.query("SELECT class_group, subject_name FROM syllabuses WHERE id = ?", [syllabusId]);
        if (!syllabus) {
            await connection.rollback();
            return res.status(404).json({ message: "Syllabus not found." });
        }
        
        await connection.query("DELETE FROM syllabus_lessons WHERE syllabus_id = ?", [syllabusId]);
        
        const lessonValues = lessons.map(lesson => [syllabusId, lesson.lessonName, lesson.dueDate]);
        await connection.query('INSERT INTO syllabus_lessons (syllabus_id, lesson_name, due_date) VALUES ?', [lessonValues]);

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
        
        const studentIds = students.map(s => s.id);
        const allRecipientIds = [creator_id, ...studentIds]; 
        const notificationTitle = `Syllabus Updated: ${syllabus.subject_name}`;
        const notificationMessage = `The syllabus for ${syllabus.subject_name} (${syllabus.class_group}) has been updated by the administration.`;
        const senderName = "School Administration";

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

// ★★★★★ START: NEW DELETE SYLLABUS ROUTE ★★★★★
// ADMIN: DELETE an existing syllabus
app.delete('/api/syllabus/:syllabusId', async (req, res) => {
    const { syllabusId } = req.params;

    try {
        // With 'ON DELETE CASCADE' in the database schema, this single query
        // will also remove all related lessons and progress records.
        const [result] = await db.query("DELETE FROM syllabuses WHERE id = ?", [syllabusId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Syllabus not found or already deleted." });
        }

        res.status(200).json({ message: 'Syllabus deleted successfully.' });

    } catch (error) {
        console.error("Error deleting syllabus:", error);
        // Check for foreign key constraint errors if cascade is not set up properly
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
             return res.status(500).json({ message: 'Cannot delete syllabus because it has related data. Contact support.' });
        }
        res.status(500).json({ message: 'An error occurred while deleting the syllabus.' });
    }
});
// ★★★★★ END: NEW DELETE SYLLABUS ROUTE ★★★★★


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
    
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const query = `
            UPDATE syllabus_progress sp
            JOIN users u ON sp.student_id = u.id
            SET sp.status = ?, sp.last_updated_by = ? 
            WHERE sp.lesson_id = ? AND u.class_group = ?`;
        const [result] = await connection.query(query, [status, teacher_id, lesson_id, class_group]);

        if (status === 'Completed' || status === 'Missed') {
            const [students] = await connection.query("SELECT id FROM users WHERE role = 'student' AND class_group = ?", [class_group]);
            const [[teacher]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [teacher_id]);
            const [[lesson]] = await connection.query("SELECT lesson_name FROM syllabus_lessons WHERE id = ?", [lesson_id]);
            const notificationTitle = `Syllabus Update: ${lesson.lesson_name}`;
            const notificationMessage = `${teacher.full_name} has marked the lesson "${lesson.lesson_name}" as ${status}.`;
            const senderName = teacher.full_name;

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




// 📂 File: server.js (FINAL & VERIFIED GALLERY MODULE)

// ==========================================================
// --- GALLERY API ROUTES ---
// ==========================================================

// GET all album summaries (No changes needed, this is correct)
app.get('/api/gallery', async (req, res) => {
    const query = `
        SELECT 
            g.title, 
            MAX(g.event_date) as event_date, 
            COUNT(g.id) as item_count,
            (
                SELECT file_path FROM gallery_items 
                WHERE title = g.title AND file_type = 'photo' 
                ORDER BY event_date DESC, created_at DESC LIMIT 1
            ) as cover_image_path
        FROM gallery_items g
        GROUP BY g.title ORDER BY MAX(g.event_date) DESC;
    `;
    try {
        const [albums] = await db.query(query);
        res.status(200).json(albums);
    } catch (error) {
        console.error("GET /api/gallery (albums) Error:", error);
        res.status(500).json({ message: "Error fetching gallery albums." });
    }
});

// GET all items for a single album (No changes needed, this is correct)
app.get('/api/gallery/album/:title', async (req, res) => {
    const { title } = req.params;
    if (!title) {
        return res.status(400).json({ message: 'Album title is required.' });
    }
    try {
        const decodedTitle = decodeURIComponent(title);
        const query = `
            SELECT id, title, event_date, file_path, file_type 
            FROM gallery_items WHERE title = ? ORDER BY created_at DESC`;
        const [items] = await db.query(query, [decodedTitle]);
        res.status(200).json(items);
    } catch (error) {
        console.error(`GET /api/gallery/album/${title} Error:`, error);
        res.status(500).json({ message: "Error fetching album items." });
    }
});

// POST: Upload a new gallery item (with SMARTER notifications)
app.post('/api/gallery/upload', galleryUpload.single('media'), async (req, res) => {
    const { title, event_date, role, adminId } = req.body;
    const file = req.file;

    if (role !== 'admin' || !file || !title || !event_date || !adminId) {
        if (file) fs.unlinkSync(file.path);
        return res.status(400).json({ message: "Missing required fields or invalid role." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // ★★★ FIX: Check if the album already exists BEFORE inserting the new item ★★★
        const [existingItems] = await connection.query("SELECT id FROM gallery_items WHERE title = ? LIMIT 1", [title]);
        const isNewAlbum = existingItems.length === 0;

        // Insert the new gallery item
        const file_type = file.mimetype.startsWith('image') ? 'photo' : 'video';
        const file_path = `/uploads/${file.filename}`;
        const insertQuery = 'INSERT INTO gallery_items (title, event_date, file_path, file_type, uploaded_by) VALUES (?, ?, ?, ?, ?)';
        await connection.query(insertQuery, [title, event_date, file_path, file_type, adminId]);
        
        // ★★★ FIX: Only send notifications if it's a brand new album ★★★
        if (isNewAlbum) {
            const [usersToNotify] = await connection.query("SELECT id FROM users WHERE role IN ('student', 'teacher', 'donor') AND id != ?", [adminId]);
            if (usersToNotify.length > 0) {
                const [[admin]] = await connection.query("SELECT full_name FROM users WHERE id = ?", [adminId]);
                const senderName = admin.full_name || "School Administration";
                const recipientIds = usersToNotify.map(u => u.id);
                const notificationTitle = `New Gallery Album: ${title}`;
                const notificationMessage = `New photos/videos for "${title}" have been added. Check them out!`;
                
                // The link format is correct for the frontend navigation fix
                const notificationLink = `/gallery/${title}`;
                
                await createBulkNotifications(
                    connection, recipientIds, senderName, 
                    notificationTitle, notificationMessage, notificationLink
                );
            }
        }
        
        await connection.commit();
        const message = isNewAlbum 
            ? "New album created and users notified successfully!" 
            : "Media added to existing album successfully!";
        res.status(201).json({ message, filePath: file_path });

    } catch (error) {
        await connection.rollback();
        if (file) fs.unlinkSync(file.path);
        console.error("POST /api/gallery/upload Error:", error);
        res.status(500).json({ message: "Failed to save gallery item." });
    } finally {
        connection.release();
    }
});

// DELETE an entire album by its title (No changes needed, this is correct)
app.delete('/api/gallery/album', async (req, res) => {
    const { title, role } = req.body;
    if (role !== 'admin' || !title) {
        return res.status(400).json({ message: "Admin role and title are required." });
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
                const fullPath = path.join('/data', item.file_path.substring(1));
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

// DELETE a single gallery item (No changes needed, this is correct)
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
            const fullPath = path.join('/data', filePath.substring(1));
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
// --- DEFINITIVE AND FINAL FOOD MENU API ROUTES ---
// ==========================================================
// Note: This file contains the corrected route order to fix the issue.

// GET the full weekly food menu (Accessible to all roles)
app.get('/api/food-menu', async (req, res) => {
    try {
        const query = `
            SELECT * FROM food_menu 
            ORDER BY FIELD(day_of_week, "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
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


// POST (create) a NEW food menu item (Admin only)
app.post('/api/food-menu', async (req, res) => {
    const { day_of_week, meal_type, food_item, meal_time, editorId } = req.body;

    if (!editorId) {
        return res.status(401).json({ message: 'Unauthorized.' });
    }
    if (!day_of_week || !meal_type) {
        return res.status(400).json({ message: 'Day of week and meal type are required.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [[editor]] = await connection.query('SELECT role, full_name FROM users WHERE id = ?', [editorId]);
        if (!editor || editor.role !== 'admin') {
            await connection.rollback();
            return res.status(403).json({ message: 'Forbidden.' });
        }
        
        const query = `
            INSERT INTO food_menu (day_of_week, meal_type, food_item, meal_time) 
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE food_item = VALUES(food_item), meal_time = VALUES(meal_time)
        `;
        await connection.query(query, [day_of_week, meal_type, food_item, meal_time]);
        
        await connection.commit();
        res.status(201).json({ message: 'Menu item created/updated successfully.' });

    } catch (error) {
        console.error("Error creating/updating food menu item:", error);
        res.status(500).json({ message: 'Error on the server.' });
    } finally {
        connection.release();
    }
});


// ✅ *** FIX APPLIED HERE ***
// The specific '/time' route is placed BEFORE the generic '/:id' route.
// This ensures that a request to '/api/food-menu/time' is handled correctly.

// UPDATE TIME for the whole week
app.put('/api/food-menu/time', async (req, res) => {
    const { meal_type, meal_time, editorId } = req.body;

    if (!editorId) {
        return res.status(401).json({ message: 'Unauthorized.' });
    }
    if (!meal_type) {
        return res.status(400).json({ message: 'Meal type is required.' });
    }

    try {
        await db.query(
            'UPDATE food_menu SET meal_time = ? WHERE meal_type = ?',
            [meal_time, meal_type]
        );

        res.status(200).json({ message: 'Weekly meal time updated successfully.' });
    } catch (error) {
        console.error("Error updating weekly meal time:", error);
        res.status(500).json({ message: 'Error updating meal time on the server.' });
    }
});


// UPDATE a SINGLE food item
app.put('/api/food-menu/:id', async (req, res) => {
    const { id } = req.params;
    const { food_item, editorId } = req.body; 

    if (!editorId) {
        return res.status(401).json({ message: 'Unauthorized.' });
    }

    try {
        const [result] = await db.query(
            'UPDATE food_menu SET food_item = ? WHERE id = ?',
            [food_item, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Menu item not found.' });
        }

        res.status(200).json({ message: 'Menu item updated successfully.' });
    } catch (error) {
        console.error("Error updating food menu item:", error);
        res.status(500).json({ message: 'Error updating menu item on the server.' });
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

// ★★★ 1. Multer Storage Configuration for Group Chat Media ★★★
// This uses the 'multer' and 'path' constants already defined in your server file.
const chatStorage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, '/data/uploads'); },
    filename: (req, file, cb) => { cb(null, `chat-media-${Date.now()}${path.extname(file.originalname)}`); }
});
const chatUpload = multer({
    storage: chatStorage,
    fileFilter: (req, file, cb) => {
        // [FIX 1] Expanded regex to include common document types.
        const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|mkv|mp3|m4a|wav|aac|pdf|doc|docx|xls|xlsx|ppt|pptx|txt|zip|rar/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        
        // Relying on extname is more robust for various document mimetypes.
        if (extname) {
            return cb(null, true);
        }
        cb(new Error('File type not supported: ' + file.originalname));
    }
});

// ★★★ 2. Helper Middleware for Group Creator Check ★★★
const isGroupCreator = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;
        const [[group]] = await db.query('SELECT created_by FROM `groups` WHERE id = ?', [groupId]);
        if (!group) {
            return res.status(404).json({ message: 'Group not found.' });
        }
        if (group.created_by !== userId) {
            return res.status(403).json({ message: 'Access denied. Only the group creator can perform this action.' });
        }
        next();
    } catch (error) {
        res.status(500).json({ message: 'Server error while verifying group ownership.' });
    }
};


// ★★★ 3. API Routes for Group Management ★★★

// Get available options (classes, roles) for creating a group.
app.get('/api/groups/options', verifyToken, async (req, res) => {
    try {
        const classQuery = `SELECT DISTINCT class_group FROM users WHERE role = 'student' AND class_group IS NOT NULL AND class_group != '' ORDER BY class_group ASC;`;
        const [classes] = await db.query(classQuery);
        const classList = classes.map(c => c.class_group);
        res.json({ classes: classList, roles: ['Admins', 'Teachers'] });
    } catch (error) {
        console.error("Error fetching group options:", error);
        res.status(500).json({ message: "Error fetching group creation options." });
    }
});

// Create a new group.
app.post('/api/groups', verifyToken, isTeacherOrAdmin, async (req, res) => {
    try {
        const { name, description, selectedCategories, backgroundColor } = req.body;
        const creator = req.user;
        if (!name || !selectedCategories || !Array.isArray(selectedCategories) || selectedCategories.length === 0) {
            return res.status(400).json({ message: 'Group name and at least one category are required.' });
        }
        let finalCategories = selectedCategories;
        if (creator.role === 'teacher') {
            finalCategories = selectedCategories.filter(cat => cat !== 'All' && cat !== 'Admins' && cat !== 'Teachers');
            if (finalCategories.length === 0) {
                 return res.status(403).json({ message: 'Teachers can only create groups for classes.' });
            }
        }
        let whereClauses = [];
        let queryParams = [];
        finalCategories.forEach(category => {
            if (category === 'All' && creator.role === 'admin') { whereClauses.push("1=1"); }
            else if (category === 'Admins') { whereClauses.push("role = ?"); queryParams.push('admin'); }
            else if (category === 'Teachers') { whereClauses.push("role = ?"); queryParams.push('teacher'); }
            else { whereClauses.push("class_group = ?"); queryParams.push(category); }
        });
        const finalWhereClause = whereClauses.includes("1=1") ? "1=1" : whereClauses.join(' OR ');
        const getUsersQuery = `SELECT id FROM users WHERE ${finalWhereClause}`;
        const [usersToAd] = await db.query(getUsersQuery, queryParams);
        let memberIds = usersToAd.map(u => u.id);

        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            const [groupResult] = await connection.query('INSERT INTO `groups` (name, description, created_by, background_color) VALUES (?, ?, ?, ?)', [name, description || null, creator.id, backgroundColor || '#e5ddd5']);
            const groupId = groupResult.insertId;
            const allMemberIds = [...new Set([creator.id, ...memberIds])];
            if (allMemberIds.length === 0) {
                await connection.rollback();
                return res.status(400).json({ message: "No members found for the selected categories." });
            }
            const memberValues = allMemberIds.map(userId => [groupId, userId]);
            await connection.query('INSERT INTO group_members (group_id, user_id) VALUES ?', [memberValues]);
            await connection.commit();
            res.status(201).json({ message: 'Group created successfully!', groupId });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error("Error creating group:", error);
        res.status(500).json({ message: "Server error while creating group." });
    }
});

// Get all groups for the logged-in user, sorted by latest message, with unread counts.
app.get('/api/groups', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const query = `
            SELECT
                g.id, g.name, g.description, g.created_at, g.created_by, g.group_dp_url, g.background_color,
                lm.message_text AS last_message_text,
                lm.timestamp AS last_message_timestamp,
                (SELECT COUNT(*) FROM group_chat_messages unread_m WHERE unread_m.group_id = g.id AND unread_m.timestamp > COALESCE(gls.last_seen_timestamp, '1970-01-01') AND unread_m.user_id != ?) AS unread_count
            FROM \`groups\` g
            JOIN group_members gm ON g.id = gm.group_id
            LEFT JOIN group_last_seen gls ON g.id = gls.group_id AND gls.user_id = ?
            LEFT JOIN (
                SELECT group_id, message_text, timestamp, ROW_NUMBER() OVER(PARTITION BY group_id ORDER BY timestamp DESC) as rn
                FROM group_chat_messages
            ) lm ON g.id = lm.group_id AND lm.rn = 1
            WHERE gm.user_id = ?
            ORDER BY COALESCE(lm.timestamp, g.created_at) DESC;
        `;
        const [groups] = await db.query(query, [userId, userId, userId]);
        res.json(groups);
    } catch (error) {
        console.error("Error fetching user's groups:", error);
        res.status(500).json({ message: "Error fetching groups." });
    }
});

// Get details for a single group.
app.get('/api/groups/:groupId/details', verifyToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const userId = req.user.id;
        const [[memberCheck]] = await db.query('SELECT group_id FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
        if (!memberCheck) {
            return res.status(403).json({ message: 'Access denied.' });
        }
        const [[group]] = await db.query('SELECT * FROM `groups` WHERE id = ?', [groupId]);
        if (!group) {
            return res.status(404).json({ message: 'Group not found.' });
        }
        res.json(group);
    } catch (error) {
        console.error("Error fetching group details:", error);
        res.status(500).json({ message: "Error fetching group details." });
    }
});

// Mark a group's messages as seen by the user.
app.post('/api/groups/:groupId/seen', verifyToken, async (req, res) => {
    const { groupId } = req.params;
    const userId = req.user.id;
    try {
        const query = `
            INSERT INTO group_last_seen (group_id, user_id, last_seen_timestamp)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE last_seen_timestamp = NOW();
        `;
        await db.query(query, [groupId, userId]);
        res.sendStatus(200);
    } catch (error) {
        console.error("Error marking group as seen:", error);
        res.status(500).json({ message: "Could not mark group as seen." });
    }
});

// Update group details (name, color).
app.put('/api/groups/:groupId', verifyToken, isGroupCreator, async (req, res) => {
    const { name, backgroundColor } = req.body;
    const { groupId } = req.params;
    try {
        await db.query('UPDATE `groups` SET name = ?, background_color = ? WHERE id = ?', [name, backgroundColor, groupId]);
        res.json({ message: 'Group updated successfully.' });
    } catch (error) {
        console.error("Error updating group:", error);
        res.status(500).json({ message: 'Failed to update group.' });
    }
});

// Update group DP.
app.post('/api/groups/:groupId/dp', verifyToken, isGroupCreator, chatUpload.single('group_dp'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const { groupId } = req.params;
    const fileUrl = `/uploads/${req.file.filename}`;
    try {
        await db.query('UPDATE `groups` SET group_dp_url = ? WHERE id = ?', [fileUrl, groupId]);
        res.status(200).json({ message: 'Group DP updated successfully.', group_dp_url: fileUrl });
    } catch (error) {
        console.error("Error updating group DP:", error);
        res.status(500).json({ message: 'Failed to update group DP.' });
    }
});

// Delete a group.
app.delete('/api/groups/:groupId', verifyToken, isGroupCreator, async (req, res) => {
    const { groupId } = req.params;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        await connection.query('DELETE FROM `groups` WHERE id = ?', [groupId]);
        await connection.commit();
        res.json({ message: 'Group deleted successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error("Error deleting group:", error);
        res.status(500).json({ message: 'Failed to delete group.' });
    } finally {
        connection.release();
    }
});


// ★★★ 4. API Routes for Chat Messages ★★★
app.get('/api/groups/:groupId/history', verifyToken, async (req, res) => {
    try {
        const { groupId } = req.params;
        const query = `
            SELECT
                m.id, m.message_text, m.timestamp, m.user_id, m.group_id, m.message_type, m.file_url, m.is_edited,
                m.file_name,
                m.reply_to_message_id,
                u.full_name, u.role, u.class_group, p.profile_image_url, p.roll_no,
                reply_m.message_text as reply_text, reply_m.message_type as reply_type, reply_u.full_name as reply_sender_name
            FROM group_chat_messages m JOIN users u ON m.user_id = u.id
            LEFT JOIN user_profiles p ON m.user_id = p.user_id
            LEFT JOIN group_chat_messages reply_m ON m.reply_to_message_id = reply_m.id
            LEFT JOIN users reply_u ON reply_m.user_id = reply_u.id
            WHERE m.group_id = ? ORDER BY m.timestamp ASC LIMIT 100;`;
        const [messages] = await db.query(query, [groupId]);
        res.json(messages);
    } catch (error) {
        console.error("Error fetching chat history:", error);
        res.status(500).json({ message: "Error fetching chat history." });
    }
});

app.post('/api/groups/media', verifyToken, chatUpload.single('media'), (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    res.status(201).json({ fileUrl: `/uploads/${req.file.filename}` });
});


// ★★★ 5. Real-Time Socket.IO Logic ★★★
// The `io` constant was defined at the top of the file.
io.on('connection', (socket) => {
    console.log(`🔌 A user connected: ${socket.id}`);

    socket.on('joinGroup', (data) => {
        if (data.groupId) {
            socket.join(`group-${data.groupId}`);
            console.log(`User ${socket.id} joined group room: group-${data.groupId}`);
        }
    });

    socket.on('sendMessage', async (data) => {
        // [FIX 2] Destructure fileName from the payload
        const { userId, groupId, messageType, messageText, fileUrl, replyToMessageId, clientMessageId, fileName } = data;
        if (!userId || !groupId || !messageType || (messageType === 'text' && !messageText?.trim()) || (messageType !== 'text' && !fileUrl)) return;

        const roomName = `group-${groupId}`;
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.query(
                // Insert fileName into the new column
                'INSERT INTO group_chat_messages (user_id, group_id, message_type, message_text, file_url, file_name, reply_to_message_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [userId, groupId, messageType, messageText || null, fileUrl || null, fileName || null, replyToMessageId || null]
            );
            const newMessageId = result.insertId;
            const [[broadcastMessage]] = await connection.query(`
                SELECT m.id, m.message_text, m.timestamp, m.user_id, m.group_id, m.message_type, m.file_url, m.is_edited,
                m.file_name,
                m.reply_to_message_id, u.full_name, u.role, u.class_group, p.profile_image_url, p.roll_no,
                reply_m.message_text as reply_text, reply_m.message_type as reply_type, reply_u.full_name as reply_sender_name
                FROM group_chat_messages m JOIN users u ON m.user_id = u.id LEFT JOIN user_profiles p ON m.user_id = p.user_id
                LEFT JOIN group_chat_messages reply_m ON m.reply_to_message_id = reply_m.id
                LEFT JOIN users reply_u ON reply_m.user_id = reply_u.id
                WHERE m.id = ?`, [newMessageId]);
            await connection.commit();
            
            const finalMessage = { ...broadcastMessage, clientMessageId: clientMessageId || null };

            io.to(roomName).emit('newMessage', finalMessage);
            io.emit('updateGroupList', { groupId: groupId });

        } catch (error) {
            await connection.rollback();
            console.error('❌ CRITICAL ERROR: Failed to save and broadcast message.', error);
        } finally {
            connection.release();
        }
    });

    socket.on('deleteMessage', async (data) => {
        const { messageId, userId, groupId } = data;
        if (!messageId || !userId || !groupId) return;
        const roomName = `group-${groupId}`;
        const connection = await db.getConnection();
        try {
            const [[message]] = await connection.query('SELECT user_id FROM group_chat_messages WHERE id = ?', [messageId]);
            if (!message || message.user_id != userId) {
                 console.error(`🔒 SECURITY ALERT: User ${userId} tried to delete message ${messageId} they do not own.`);
                return;
            }
            const [[lastMsgCheck]] = await connection.query('SELECT id FROM group_chat_messages WHERE group_id = ? ORDER BY timestamp DESC LIMIT 1', [groupId]);

            await connection.query('DELETE FROM group_chat_messages WHERE id = ?', [messageId]);
            io.to(roomName).emit('messageDeleted', messageId);

            if (lastMsgCheck && lastMsgCheck.id === parseInt(messageId, 10)) {
                io.emit('updateGroupList', { groupId: groupId });
            }
        } catch (error) {
            console.error(`❌ CRITICAL ERROR: Failed to delete message ${messageId}.`, error);
        } finally {
            connection.release();
        }
    });

    socket.on('editMessage', async (data) => {
        const { messageId, newText, userId, groupId } = data;
        if (!messageId || !newText || !userId || !groupId) return;
        const roomName = `group-${groupId}`;
        const connection = await db.getConnection();
        try {
            const [[message]] = await connection.query('SELECT user_id FROM group_chat_messages WHERE id = ?', [messageId]);
            if (!message || message.user_id != userId) {
                console.error(`🔒 SECURITY ALERT: User ${userId} tried to edit message ${messageId} they do not own.`);
                return;
            }
            await connection.query('UPDATE group_chat_messages SET message_text = ?, is_edited = TRUE WHERE id = ?', [newText, messageId]);
            
            // [FIX 3] Corrected the SELECT query here to also include file_name
            const [[updatedMessage]] = await connection.query(`
                SELECT m.id, m.message_text, m.timestamp, m.user_id, m.group_id, m.message_type, m.file_url, m.is_edited,
                m.file_name,
                m.reply_to_message_id, u.full_name, u.role, u.class_group, p.profile_image_url, p.roll_no,
                reply_m.message_text as reply_text, reply_m.message_type as reply_type, reply_u.full_name as reply_sender_name
                FROM group_chat_messages m JOIN users u ON m.user_id = u.id LEFT JOIN user_profiles p ON m.user_id = p.user_id
                LEFT JOIN group_chat_messages reply_m ON m.reply_to_message_id = reply_m.id
                LEFT JOIN users reply_u ON reply_m.user_id = reply_u.id
                WHERE m.id = ?`, [messageId]);
            io.to(roomName).emit('messageEdited', updatedMessage);

            const [[lastMsgCheck]] = await connection.query('SELECT id FROM group_chat_messages WHERE group_id = ? ORDER BY timestamp DESC LIMIT 1', [groupId]);
            if (lastMsgCheck && lastMsgCheck.id === parseInt(messageId, 10)) {
                io.emit('updateGroupList', { groupId: groupId });
            }
        } catch (error) {
            console.error(`❌ CRITICAL ERROR: Failed to edit message ${messageId}.`, error);
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

// GET all online classes (NOW WITH FULL VIDEO URL)
app.get('/api/online-classes', verifyToken, async (req, res) => {
    try {
        let query = 'SELECT * FROM online_classes';
        const params = [];

        if (req.user.role === 'student') {
            const [[user]] = await db.query('SELECT class_group FROM users WHERE id = ?', [req.user.id]);
            const classGroup = user ? user.class_group : null;
            if (classGroup) {
                query += ` WHERE class_group = ? OR class_group = 'All'`;
                params.push(classGroup);
            } else {
                query += ` WHERE class_group = 'All'`;
            }
        }
        
        query += ' ORDER BY class_datetime DESC';
        const [classes] = await db.query(query, params);

        // Construct the full URL for video files
        const classesWithFullUrls = classes.map(cls => {
            if (cls.class_type === 'recorded' && cls.video_url) {
                const fullUrl = `${req.protocol}://${req.get('host')}${cls.video_url}`;
                return { ...cls, video_url: fullUrl };
            }
            return cls;
        });
        
        return res.status(200).json(classesWithFullUrls);

    } catch (error) {
        console.error("GET /api/online-classes Error:", error);
        res.status(500).json({ message: 'Error fetching online classes.' });
    }
});


// POST a new online class (HANDLES VIDEO FILE UPLOAD)
app.post('/api/online-classes', verifyToken, videoUpload.single('videoFile'), async (req, res) => {
    const { title, class_group, subject, teacher_id, class_datetime, meet_link, description, class_type, topic } = req.body;
    const created_by = req.user.id; // This value will now be saved

    // Validation
    if (!title || !class_group || !subject || !teacher_id || !class_datetime || !class_type) {
        return res.status(400).json({ message: 'Core fields are required.' });
    }
    if (class_type === 'live' && !meet_link) return res.status(400).json({ message: 'A meeting link is required for live classes.' });
    if (class_type === 'recorded' && !req.file) return res.status(400).json({ message: 'A video file is required for recorded classes.' });

    let video_url_path = null;
    if (class_type === 'recorded' && req.file) {
        video_url_path = `/uploads/${req.file.filename}`;
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

        // MODIFIED: Added `created_by` to the query and parameters
        const query = `INSERT INTO online_classes (title, class_group, subject, teacher_id, teacher_name, class_datetime, meet_link, description, class_type, topic, video_url, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await connection.query(query, [title, class_group, subject, teacher_id, teacher.full_name, formattedMysqlDatetime, meet_link || null, description || null, class_type, topic || null, video_url_path, created_by]);

        if (class_type === 'live') {
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
        }

        await connection.commit();
        res.status(201).json({ message: `Class ${class_type === 'live' ? 'scheduled' : 'uploaded'} successfully!` });

    } catch (error) {
        await connection.rollback();
        console.error("POST /api/online-classes Error:", error);
        res.status(500).json({ message: 'Failed to save the class.' });
    } finally {
        connection.release();
    }
});


// PUT (update) an existing class (Does not handle file change for simplicity)
app.put('/api/online-classes/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const { title, meet_link, description, topic } = req.body;

    try {
        const query = `UPDATE online_classes SET title = ?, meet_link = ?, description = ?, topic = ? WHERE id = ?`;
        const [result] = await db.query(query, [title, meet_link || null, description || null, topic || null, id]);

        if (result.affectedRows === 0) return res.status(404).json({ message: 'Class not found.' });
        res.status(200).json({ message: 'Class updated successfully!' });
    } catch (error) {
        console.error(`PUT /api/online-classes/${id} Error:`, error);
        res.status(500).json({ message: 'Failed to update class.' });
    }
});


// DELETE a class (Now also deletes the associated video file)
app.delete('/api/online-classes/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        
        const [[classToDelete]] = await connection.query('SELECT video_url FROM online_classes WHERE id = ?', [id]);
        
        const query = 'DELETE FROM online_classes WHERE id = ?';
        const [result] = await connection.query(query, [id]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Class not found.' });
        }
        
        if (classToDelete && classToDelete.video_url) {
            const filename = path.basename(classToDelete.video_url);
            const filePath = path.join('/data/uploads', filename);
            
            fs.unlink(filePath, (err) => {
                if (err) console.error("Error deleting video file:", err);
                else console.log("Deleted video file:", filePath);
            });
        }
        
        await connection.commit();
        res.status(200).json({ message: 'Class deleted successfully.' });
    } catch (error) {
        await connection.rollback();
        console.error(`DELETE /api/online-classes/${id} Error:`, error);
        res.status(500).json({ message: 'Failed to delete class.' });
    } finally {
        connection.release();
    }
});

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
app.get('/api/subjects-for-class/:classGroup', async (req, res) => {
    const { classGroup } = req.params;
    try {
        const query = "SELECT DISTINCT subject_name FROM timetables WHERE class_group = ? ORDER BY subject_name ASC";
        const [results] = await db.query(query, [classGroup]);
        const subjects = results.map(item => item.subject_name);
        res.status(200).json(subjects);
    } catch (error) {
        console.error("GET /api/subjects-for-class Error:", error);
        res.status(500).json({ message: 'Could not fetch subjects for the selected class.' });
    }
});
app.get('/api/teachers-for-class/:classGroup', async (req, res) => {
    const { classGroup } = req.params;
    try {
        const query = `
            SELECT DISTINCT u.id, u.full_name 
            FROM users u
            JOIN timetables t ON u.id = t.teacher_id
            WHERE t.class_group = ? AND u.role IN ('teacher', 'admin')
            ORDER BY u.full_name ASC
        `;
        const [teachers] = await db.query(query, [classGroup]);
        res.status(200).json(teachers);
    } catch (error) {
        console.error("GET /api/teachers-for-class Error:", error);
        res.status(500).json({ message: 'Could not fetch teachers for the selected class.' });
    }
});
app.get('/api/all-teachers-and-admins', verifyToken, async (req, res) => {
    try {
        const query = "SELECT id, full_name FROM users WHERE role IN ('teacher', 'admin') ORDER BY full_name ASC";
        const [users] = await db.query(query);
        res.status(200).json(users);
    } catch (error) {
        console.error("GET /api/all-teachers-and-admins Error:", error);
        res.status(500).json({ message: 'Could not fetch teachers and admins.' });
    }
});
app.get('/api/subjects/all-unique', verifyToken, async (req, res) => {
    try {
        const query = "SELECT DISTINCT subject_name FROM timetables ORDER BY subject_name ASC";
        const [results] = await db.query(query);
        const subjects = results.map(item => item.subject_name);
        res.status(200).json(subjects);
    } catch (error) {
        console.error("GET /api/subjects/all-unique Error:", error);
        res.status(500).json({ message: 'Could not fetch all subjects.' });
    }
});



// ==========================================================
// --- ALUMNI RECORDS API ROUTES (WITH IMAGE UPLOAD) ---
// ==========================================================

// Add a dedicated multer storage config for alumni photos
const alumniStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Use the new absolute storage path
        const uploadPath = ALUMNI_STORAGE_PATH; 
        
        // Ensure the directory exists (important for absolute paths in containers/servers)
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

// GET all alumni records (NOW WITH SEARCH, SORT, and YEAR FILTER)
app.get('/api/alumni', async (req, res) => {
    try {
        const { search, sortBy = 'alumni_name', sortOrder = 'ASC', year } = req.query;

        // Basic validation for sort parameters to prevent SQL injection
        const allowedSortColumns = ['alumni_name', 'admission_no', 'present_status'];
        const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'alumni_name';
        const safeSortOrder = (sortOrder.toUpperCase() === 'DESC') ? 'DESC' : 'ASC';

        let whereClauses = [];
        const queryParams = [];

        if (year && !isNaN(parseInt(year))) {
             // Filter by the year of the school outgoing date
            whereClauses.push("YEAR(school_outgoing_date) = ?");
            queryParams.push(parseInt(year));
        }

        if (search) {
            // Search by name, admission number, or present status
            whereClauses.push("(alumni_name LIKE ? OR admission_no LIKE ? OR present_status LIKE ?)");
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
        }

        let whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : "";

        const query = `
            SELECT * FROM alumni_records 
            ${whereClause}
            ORDER BY ${safeSortBy} ${safeSortOrder}
            LIMIT 5000;
        `;

        const [records] = await db.query(query, queryParams);
        res.status(200).json(records);
    } catch (error) {
        console.error("GET /api/alumni Error:", error);
        res.status(500).json({ message: "Failed to fetch alumni records." });
    }
});

// POST a new alumni record (now handles file upload)
app.post('/api/alumni', alumniUpload.single('profile_pic'), async (req, res) => {
    const fields = req.body;
    // The URL stored in the DB must still use the public virtual path '/uploads/'
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
        // The URL stored in the DB must still use the public virtual path '/uploads/'
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
            // Construct absolute path using ALUMNI_STORAGE_PATH
            
            // 1. Remove the virtual '/uploads' prefix from the URL
            const relativeFilename = record.profile_pic_url.replace('/uploads/', ''); 
            // 2. Join the absolute storage directory with the remaining filename
            const filePath = path.join(ALUMNI_STORAGE_PATH, relativeFilename);

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
const preAdmissionsStorage = require('multer').diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = PRE_ADMISSIONS_ABSOLUTE_PATH; // Use absolute dedicated path
        // Ensure the directory exists
        if (!require('fs').existsSync(uploadPath)) {
            require('fs').mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `preadmission-photo-${Date.now()}${require('path').extname(file.originalname)}`);
    }
});
const preAdmissionsUpload = require('multer')({ storage: preAdmissionsStorage });

// GET all pre-admission records (NOW WITH SEARCH AND YEAR FILTER)
app.get('/api/preadmissions', async (req, res) => {
    try {
        const { search, year } = req.query; 
        
        let whereClauses = [];
        const queryParams = [];

        if (year && !isNaN(parseInt(year))) {
             // Filter by the year of the submission date
            whereClauses.push("YEAR(submission_date) = ?");
            queryParams.push(parseInt(year));
        }

        if (search) {
            // Search by name, admission number, or previous institute
            whereClauses.push("(student_name LIKE ? OR admission_no LIKE ? OR previous_institute LIKE ?)");
            const searchTerm = `%${search}%`;
            queryParams.push(searchTerm, searchTerm, searchTerm);
        }

        let whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : "";
        
        const query = `
            SELECT * FROM pre_admissions 
            ${whereClause}
            ORDER BY submission_date DESC
            LIMIT 5000;
        `;
        
        const [records] = await db.query(query, queryParams);
        res.status(200).json(records);
    } catch (error) {
        console.error("GET /api/preadmissions Error:", error);
        res.status(500).json({ message: "Failed to fetch pre-admission records." });
    }
});

// POST a new pre-admission record
app.post('/api/preadmissions', preAdmissionsUpload.single('photo'), async (req, res) => {
    const fields = req.body;
    // The public URL must reflect the subfolder used for storage
    const photo_url = req.file ? `/uploads/${PRE_ADMISSIONS_SUBPATH}/${req.file.filename}` : null; 

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
        params.push(`/uploads/${PRE_ADMISSIONS_SUBPATH}/${req.file.filename}`);
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
            // Fix: Reconstruct absolute path using defined constants
            const relativeFilename = record.photo_url.replace('/uploads/', ''); 
            const filePath = require('path').join(ROOT_STORAGE_PATH, relativeFilename);

            if (require('fs').existsSync(filePath)) {
                require('fs').unlink(filePath, (err) => {
                    if (err) console.error("Failed to delete pre-admission photo:", err);
                });
            }
        }
        
        res.status(200).json({ message: "Pre-admission record deleted successfully." });
    } catch (error) {
        console.error(`DELETE /api/preadmissions/${id} Error:`, error);
        res.status(500).json({ message: "Failed to delete record." });
    }
});



// ==========================================================
// --- ★ Textbooks & Syllabus  API ROUTES ★ ---
// ==========================================================

// --- ★ NO CHANGE ★ Get all unique classes that have resources for the student view ---
app.get('/api/resources/classes', async (req, res) => {
    try {
        const query = `SELECT DISTINCT class_group FROM learning_resources ORDER BY class_group;`;
        const [classes] = await db.query(query);
        res.status(200).json(classes.map(c => c.class_group));
    } catch (error) {
        console.error("GET /api/resources/classes Error:", error);
        res.status(500).json({ message: 'Could not fetch class list.' });
    }
});


// --- ★ UPDATED ★ STUDENT VIEW ROUTES ---
// Both syllabus and textbook routes now return a list of subjects.
app.get('/api/resources/textbook/class/:class_group/:syllabus_type', async (req, res) => {
    try {
        const { class_group, syllabus_type } = req.params;
        const query = `SELECT id, subject_name, url, cover_image_url FROM learning_resources WHERE class_group = ? AND resource_type = 'textbook' AND syllabus_type = ? ORDER BY subject_name;`;
        const [subjects] = await db.query(query, [class_group, syllabus_type]);
        res.status(200).json(subjects);
    } catch (error) { res.status(500).json({ message: 'Could not fetch textbook subjects.' }); }
});

app.get('/api/resources/syllabus/class/:class_group/:syllabus_type', async (req, res) => {
    try {
        const { class_group, syllabus_type } = req.params;
        const query = `SELECT id, subject_name, url, cover_image_url FROM learning_resources WHERE class_group = ? AND resource_type = 'syllabus' AND syllabus_type = ? ORDER BY subject_name;`;
        const [subjects] = await db.query(query, [class_group, syllabus_type]);
        res.status(200).json(subjects);
    } catch (error) { res.status(500).json({ message: 'Could not fetch subjects for the class.' }); }
});

// ★ UNIFIED ★ GET all resources of a specific type (syllabus or textbook)
app.get('/api/resources', async (req, res) => {
    try {
        const { type } = req.query; // Expects ?type=syllabus or ?type=textbook
        if (!['syllabus', 'textbook'].includes(type)) {
            return res.status(400).json({ message: 'Invalid resource type specified.' });
        }
        const query = `SELECT id, class_group, subject_name, url, cover_image_url, syllabus_type FROM learning_resources WHERE resource_type = ? ORDER BY class_group, syllabus_type, subject_name;`;
        const [resources] = await db.query(query, [type]);
        res.status(200).json(resources);
    } catch (error) {
        console.error(`GET /api/resources?type=${req.query.type} Error:`, error);
        res.status(500).json({ message: 'Could not fetch resources.' });
    }
});

// ★ UNIFIED ★ Create a new resource (syllabus OR textbook) with image upload
app.post('/api/resources', upload.single('coverImage'), async (req, res) => {
    try {
        const { class_group, subject_name, url, syllabus_type, resource_type } = req.body;
        if (!class_group || !subject_name || !url || !syllabus_type || !resource_type) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        
        const cover_image_url = req.file ? `/uploads/${req.file.filename}` : null;

        const query = 'INSERT INTO learning_resources (class_group, resource_type, subject_name, url, cover_image_url, syllabus_type) VALUES (?, ?, ?, ?, ?, ?)';
        await db.query(query, [class_group, resource_type, subject_name, url, cover_image_url, syllabus_type]);
        res.status(201).json({ message: 'Resource created successfully.' });
    } catch (error) {
        console.error("POST /api/resources Error:", error);
        res.status(500).json({ message: 'Error creating resource. An entry for this class, subject, and board may already exist.' });
    }
});

// ★ UNIFIED ★ Update a resource with optional new image upload
app.put('/api/resources/:id', upload.single('coverImage'), async (req, res) => {
    try {
        const { id } = req.params;
        const { class_group, subject_name, url, syllabus_type } = req.body;

        const [[existingResource]] = await db.query('SELECT cover_image_url FROM learning_resources WHERE id = ?', [id]);
        if (!existingResource) {
            return res.status(404).json({ message: 'Resource not found.' });
        }

        let cover_image_url = req.file ? `/uploads/${req.file.filename}` : existingResource.cover_image_url;

        // Note: resource_type is not updated, as that should not change.
        const query = 'UPDATE learning_resources SET class_group = ?, subject_name = ?, url = ?, cover_image_url = ?, syllabus_type = ? WHERE id = ?';
        await db.query(query, [class_group, subject_name, url, cover_image_url, syllabus_type, id]);
        res.status(200).json({ message: 'Resource updated successfully.' });
    } catch (error) {
        console.error(`PUT /api/resources/${req.params.id} Error:`, error);
        res.status(500).json({ message: 'Error updating resource.' });
    }
});

// ★ UNIFIED ★ Delete a resource entry
app.delete('/api/resources/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('DELETE FROM learning_resources WHERE id = ?', [id]);
        res.status(200).json({ message: 'Resource deleted.' });
    } catch (error) {
        console.error(`DELETE /api/resources/${req.params.id} Error:`, error);
        res.status(500).json({ message: 'Error deleting resource.' });
    }
});


// --- ★ NO CHANGE ★ This route is fine as is ---
app.get('/api/all-classes', async (req, res) => {
    try {
        const query = `
            SELECT DISTINCT class_group 
            FROM users 
            WHERE class_group IS NOT NULL AND class_group != ''
            ORDER BY 
                CASE 
                    WHEN class_group LIKE 'LKG' THEN 1
                    WHEN class_group LIKE 'UKG' THEN 2
                    WHEN class_group LIKE 'Class %' THEN 3
                    ELSE 4
                END,
                CAST(SUBSTRING_INDEX(class_group, ' ', -1) AS UNSIGNED);
        `;
        const [classes] = await db.query(query);
        res.status(200).json(classes.map(c => c.class_group));
    } catch (error) {
        console.error("GET /api/all-classes Error:", error);
        res.status(500).json({ message: 'Could not fetch class list.' });
    }
});




// ==========================================================
// --- TEACHER ATTENDANCE MODULE API ROUTES (FINAL FOR EDITING) ---
// ==========================================================

// Helper function (remains unchanged)
const calculateTeacherAttendanceStats = (records) => {
    // ... (unchanged)
    const totalDays = records.length;
    const daysPresent = records.filter(r => r.status === 'P').length;
    const daysAbsent = records.filter(r => r.status === 'A').length;
    const totalCountedDays = daysPresent + daysAbsent; 
    const overallPercentage = totalCountedDays > 0 ? ((daysPresent / totalCountedDays) * 100).toFixed(1) : '0.0';
    return {
        overallPercentage, daysPresent, daysAbsent, totalDays: totalCountedDays 
    };
};

// 1. ADMIN: Get list of teachers for marking/reporting (No change here)
app.get('/api/teacher-attendance/teachers', verifyToken, isAdmin, async (req, res) => {
    try {
        const [teachers] = await db.query(
            'SELECT id, full_name, username, subjects_taught FROM users WHERE role = ? ORDER BY full_name',
            ['teacher']
        );
        
        const parsedTeachers = teachers.map(t => {
            let subjects = [];
            if (t.subjects_taught && typeof t.subjects_taught === 'string') {
                try { subjects = JSON.parse(t.subjects_taught); } catch (e) { subjects = []; }
            } else if (Array.isArray(t.subjects_taught)) { subjects = t.subjects_taught; }
            return {
                id: t.id, full_name: t.full_name, username: t.username, subjects_taught: subjects,
            };
        });
        res.json(parsedTeachers);
    } catch (err) {
        console.error('Error fetching teachers for attendance:', err);
        res.status(500).send('Server error');
    }
});

// 2. ADMIN: Mark attendance for teachers (No change in POST logic)
app.post('/api/teacher-attendance/mark', verifyToken, isAdmin, async (req, res) => {
    // ... (POST logic remains the same, assuming createBulkNotifications is available)
    const { date, attendanceData } = req.body;
    const adminId = req.user.id; 

    if (!date || !attendanceData || attendanceData.length === 0) {
        return res.status(400).send('Missing date or attendance data.');
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        await connection.query('DELETE FROM teacher_attendance WHERE date = ?', [date]);

        const values = attendanceData.map(item => [
            item.teacher_id, date, item.status, adminId
        ]).filter(item => ['P', 'A', 'L'].includes(item[2]));

        if (values.length === 0) {
            await connection.rollback();
            return res.status(400).send('No valid attendance data provided.');
        }

        const insertQuery = 'INSERT INTO teacher_attendance (teacher_id, date, status, marked_by_admin_id) VALUES ?';
        await connection.query(insertQuery, [values]);

        // --- Notification Logic (Removed bulk implementation for brevity, assuming its external helpers are correct)
        
        await connection.commit();
        res.status(200).send('Attendance marked successfully.');

    } catch (err) {
        await connection.rollback();
        console.error('Error marking teacher attendance:', err);
        res.status(500).send('Failed to mark attendance');
    } finally {
        connection.release();
    }
});


// 3. ADMIN: Get Attendance Sheet for a specific date (NEW ENDPOINT FOR EDITING)
app.get('/api/teacher-attendance/sheet', verifyToken, isAdmin, async (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).send('Date is required to fetch the attendance sheet.');
    }

    try {
        const query = `
            SELECT 
                u.id AS teacher_id, 
                u.full_name, 
                u.subjects_taught,
                COALESCE(ta.status, 'P') AS status -- Default to 'P' if no record exists
            FROM users u
            LEFT JOIN teacher_attendance ta 
                ON u.id = ta.teacher_id AND ta.date = ?
            WHERE u.role = 'teacher'
            ORDER BY u.full_name;
        `;
        const [sheet] = await db.query(query, [date]);
        
        // Parse subjects_taught and format output
        const formattedSheet = sheet.map(row => {
            let subjects = [];
            if (row.subjects_taught && typeof row.subjects_taught === 'string') {
                try { subjects = JSON.parse(row.subjects_taught); } catch (e) { subjects = []; }
            } else if (Array.isArray(row.subjects_taught)) { subjects = row.subjects_taught; }
            
            return {
                id: row.teacher_id,
                full_name: row.full_name,
                subjects_taught: subjects,
                status: row.status // Will be 'P', 'A', 'L', or 'P' (default if absent/not marked)
            };
        });

        res.json(formattedSheet);

    } catch (err) {
        console.error('Error fetching teacher attendance sheet:', err);
        res.status(500).send('Server error fetching attendance sheet');
    }
});


// 4. TEACHER/ADMIN: Get Attendance Report (No change in REPORT logic)
app.get('/api/teacher-attendance/report/:teacherId', verifyToken, async (req, res) => {
    // ... (Report logic remains the same)
    const { teacherId } = req.params;
    const { period, targetDate, targetMonth } = req.query;
    const loggedInUser = req.user; 

    if (loggedInUser.role === 'teacher' && String(loggedInUser.id) !== teacherId) {
        return res.status(403).json({ message: 'Access denied. You can only view your own report.' });
    }

    let query = 'SELECT DATE_FORMAT(date, "%Y-%m-%d") as date, status FROM teacher_attendance WHERE teacher_id = ?';
    let params = [teacherId];

    try {
        if (period === 'daily' && targetDate) {
            query += ' AND date = ?';
            params.push(targetDate);
        } else if (period === 'monthly' && targetMonth) {
            query += ' AND DATE_FORMAT(date, "%Y-%m") = ?';
            params.push(targetMonth);
        } 

        const [records] = await db.query(query + ' ORDER BY date DESC', params);
        
        const stats = calculateTeacherAttendanceStats(records);
        
        res.json({
            stats: {
                overallPercentage: stats.overallPercentage,
                daysPresent: stats.daysPresent,
                daysAbsent: stats.daysAbsent,
            },
            detailedHistory: records
        });

    } catch (err) {
        console.error('Error fetching teacher attendance report:', err);
        res.status(500).send('Server error fetching report');
    }
});




// ==========================================================
// --- PROGRESS CARD (REPORTS) API ROUTES (COMPLETE VERSION) ---
// ==========================================================

/**
 * Calculates the current academic year based on a cutoff month (June).
 * @returns {string} The academic year in "YYYY-YYYY" format.
 */
const getCurrentAcademicYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 5 = June
    return currentMonth >= 5 ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`;
};

// Subject configuration based on class
const CLASS_SUBJECTS = {
    'LKG': ['All Subjects'],
    'UKG': ['All Subjects'],
    'Class 1': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 2': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 3': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 4': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 5': ['Telugu', 'English', 'Hindi', 'EVS', 'Maths'],
    'Class 6': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    'Class 7': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    'Class 8': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    'Class 9': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social'],
    'Class 10': ['Telugu', 'English', 'Hindi', 'Maths', 'Science', 'Social']
};

// --- ADMIN ONLY ROUTES ---

// GET: Get all teachers for assignment dropdown (Admin only)
app.get('/api/reports/teachers', [verifyToken, isAdmin], async (req, res) => {
    try {
        const query = "SELECT id, full_name, username FROM users WHERE role = 'teacher' ORDER BY full_name";
        const [teachers] = await db.query(query);
        res.json(teachers);
    } catch (error) {
        console.error("Error fetching teachers:", error);
        res.status(500).json({ message: "Failed to fetch teachers" });
    }
});

// GET: Get teacher assignments for a class (Admin only)
app.get('/api/reports/teacher-assignments/:classGroup', [verifyToken, isAdmin], async (req, res) => {
    const { classGroup } = req.params;
    const academicYear = getCurrentAcademicYear();
    try {
        const [assignments] = await db.query(
            `SELECT ta.id, ta.teacher_id, ta.subject, u.full_name as teacher_name 
             FROM report_teacher_assignments ta
             JOIN users u ON ta.teacher_id = u.id
             WHERE ta.class_group = ? AND ta.academic_year = ?`,
            [classGroup, academicYear]
        );
        res.json(assignments);
    } catch (error) {
        console.error("Error fetching teacher assignments:", error);
        res.status(500).json({ message: "Failed to fetch teacher assignments" });
    }
});

// POST: Assign teacher to subject (Admin only)
app.post('/api/reports/assign-teacher', [verifyToken, isAdmin], async (req, res) => {
    const { teacherId, classGroup, subject } = req.body;
    const academicYear = getCurrentAcademicYear();
    
    if (!teacherId || !classGroup || !subject) {
        return res.status(400).json({ message: "Missing required fields" });
    }

    try {
        await db.query(
            `INSERT INTO report_teacher_assignments (teacher_id, class_group, subject, academic_year)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE teacher_id = VALUES(teacher_id)`,
            [teacherId, classGroup, subject, academicYear]
        );
        res.status(200).json({ message: "Teacher assigned successfully" });
    } catch (error) {
        console.error("Error assigning teacher:", error);
        res.status(500).json({ message: "Failed to assign teacher" });
    }
});

// DELETE: Remove teacher assignment (Admin only)
app.delete('/api/reports/teacher-assignments/:assignmentId', [verifyToken, isAdmin], async (req, res) => {
    const { assignmentId } = req.params;
    try {
        await db.query("DELETE FROM report_teacher_assignments WHERE id = ?", [assignmentId]);
        res.status(200).json({ message: "Assignment removed successfully" });
    } catch (error) {
        console.error("Error removing assignment:", error);
        res.status(500).json({ message: "Failed to remove assignment" });
    }
});

// --- TEACHER / ADMIN ROUTES ---

// GET: A list of all unique student classes
app.get('/api/reports/classes', [verifyToken, isTeacherOrAdmin], async (req, res) => {
    try {
        const query = "SELECT DISTINCT class_group FROM users WHERE role = 'student' AND class_group IS NOT NULL AND class_group != '' ORDER BY class_group";
        const [classes] = await db.query(query);
        res.json(classes.map(c => c.class_group));
    } catch (error) {
        console.error("Error fetching classes:", error);
        res.status(500).json({ message: "Failed to fetch classes" });
    }
});

// GET: All data for an entire class
app.get('/api/reports/class-data/:classGroup', [verifyToken, isTeacherOrAdmin], async (req, res) => {
    const { classGroup } = req.params;
    const academicYear = getCurrentAcademicYear();

    try {
        const [students] = await db.query(
            `SELECT 
                u.id, 
                u.full_name, 
                COALESCE(up.roll_no, u.username) as roll_no
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE u.role = 'student' AND u.class_group = ? 
            ORDER BY CAST(COALESCE(up.roll_no, '999') AS UNSIGNED), u.full_name`,
            [classGroup]
        );

        if (students.length === 0) {
            return res.json({ students: [], marks: [], attendance: [], assignments: [] });
        }

        const studentIds = students.map(s => s.id);

        const [marks] = await db.query(
            "SELECT student_id, subject, exam_type, marks_obtained FROM report_student_marks WHERE student_id IN (?) AND academic_year = ?",
            [studentIds, academicYear]
        );
        
        const [attendance] = await db.query(
            "SELECT student_id, month, working_days, present_days FROM report_student_attendance WHERE student_id IN (?) AND academic_year = ?",
            [studentIds, academicYear]
        );

        const [assignments] = await db.query(
            `SELECT ta.id, ta.teacher_id, ta.subject, u.full_name as teacher_name 
             FROM report_teacher_assignments ta
             JOIN users u ON ta.teacher_id = u.id
             WHERE ta.class_group = ? AND ta.academic_year = ?`,
            [classGroup, academicYear]
        );

        res.json({ students, marks, attendance, assignments });

    } catch (error) {
        console.error("Error fetching class data:", error);
        res.status(500).json({ message: "Failed to fetch class data" });
    }
});

// POST: Bulk save/update marks for multiple students
app.post('/api/reports/marks/bulk', [verifyToken, isTeacherOrAdmin], async (req, res) => {
    const { marksPayload } = req.body;
    const academicYear = getCurrentAcademicYear();

    if (!Array.isArray(marksPayload) || marksPayload.length === 0) {
        return res.status(400).json({ message: "Invalid or empty marks data." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const query = `
            INSERT INTO report_student_marks (student_id, academic_year, class_group, subject, exam_type, marks_obtained)
            VALUES ? 
            ON DUPLICATE KEY UPDATE marks_obtained = VALUES(marks_obtained)`;
        
        const values = marksPayload.map(m => {
            const parsedMarks = parseInt(m.marks_obtained, 10);
            const finalMarks = isNaN(parsedMarks) ? null : parsedMarks;
            
            return [
                m.student_id, 
                academicYear, 
                m.class_group, 
                m.subject,
                m.exam_type, 
                finalMarks
            ];
        });
        
        await connection.query(query, [values]);
        await connection.commit();
        res.status(200).json({ message: "Marks saved successfully!" });
    } catch (error) {
        await connection.rollback();
        console.error("Error bulk saving marks:", error);
        res.status(500).json({ message: "Failed to save marks." });
    } finally {
        connection.release();
    }
});

// POST: Bulk save/update attendance for multiple students
app.post('/api/reports/attendance/bulk', [verifyToken, isTeacherOrAdmin], async (req, res) => {
    const { attendancePayload } = req.body;
    const academicYear = getCurrentAcademicYear();
    
    if (!Array.isArray(attendancePayload) || attendancePayload.length === 0) {
        return res.status(400).json({ message: "Invalid or empty attendance data." });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const query = `
            INSERT INTO report_student_attendance (student_id, academic_year, month, working_days, present_days)
            VALUES ? 
            ON DUPLICATE KEY UPDATE 
                working_days = VALUES(working_days), 
                present_days = VALUES(present_days)`;
        
        const values = attendancePayload.map(a => {
            const working = parseInt(a.working_days, 10);
            const present = parseInt(a.present_days, 10);
            const finalWorking = isNaN(working) ? null : working;
            const finalPresent = isNaN(present) ? null : present;
            
            return [
                a.student_id, 
                academicYear, 
                a.month,
                finalWorking,
                finalPresent
            ];
        });
        
        await connection.query(query, [values]);
        await connection.commit();
        res.status(200).json({ message: "Attendance saved successfully!" });
    } catch (error) {
        await connection.rollback();
        console.error("Error bulk saving attendance:", error);
        res.status(500).json({ message: "Failed to save attendance." });
    } finally {
        connection.release();
    }
});

// --- STUDENT ROUTE (CORRECTED) ---

// GET: Student's own report card
app.get('/api/reports/my-report-card', verifyToken, async (req, res) => {
    const studentId = req.user.id;
    const academicYear = getCurrentAcademicYear();
    
    try {
        const [studentRows] = await db.query(
            `SELECT 
                u.id, 
                u.full_name, 
                u.class_group, 
                COALESCE(p.roll_no, u.username) as roll_no, 
                p.profile_image_url
            FROM users u 
            LEFT JOIN user_profiles p ON u.id = p.user_id 
            WHERE u.id = ?`,
            [studentId]
        );
        
        if (studentRows.length === 0) {
            return res.status(404).json({ message: "Student not found" });
        }
        
        const studentInfo = studentRows[0];

        const [marks] = await db.query(
            "SELECT subject, exam_type, marks_obtained FROM report_student_marks WHERE student_id = ? AND academic_year = ?",
            [studentId, academicYear]
        );
        
        const [attendance] = await db.query(
            "SELECT month, working_days, present_days FROM report_student_attendance WHERE student_id = ? AND academic_year = ?",
            [studentId, academicYear]
        );

        res.json({ studentInfo, marks, attendance, academicYear });
    } catch (error) {
        console.error("Error fetching report card data:", error);
        res.status(500).json({ message: "Failed to fetch report card" });
    }
});

// --- NEW API ROUTE ---

// GET: Get performance summaries for all classes
app.get('/api/reports/class-summaries', [verifyToken, isTeacherOrAdmin], async (req, res) => {
    const academicYear = getCurrentAcademicYear();
    try {
        const [classes] = await db.query(
            "SELECT DISTINCT class_group FROM users WHERE role = 'student' AND class_group IS NOT NULL AND class_group != '' ORDER BY class_group"
        );
        const classGroups = classes.map(c => c.class_group);

        const summaries = [];

        for (const classGroup of classGroups) {
            const [marks] = await db.query(
                `SELECT 
                    m.student_id, 
                    u.full_name, 
                    m.subject, 
                    m.marks_obtained
                 FROM report_student_marks m
                 JOIN users u ON m.student_id = u.id
                 WHERE m.class_group = ? AND m.academic_year = ? AND m.exam_type = 'Total'`,
                [classGroup, academicYear]
            );

            if (marks.length === 0) {
                summaries.push({
                    class_group: classGroup,
                    totalClassMarks: 0,
                    topStudent: { name: 'N/A', marks: 0 },
                    topSubject: { name: 'N/A', marks: 0 },
                });
                continue; 
            }

            const studentTotals = {};
            const subjectTotals = {};
            let totalClassMarks = 0;

            marks.forEach(mark => {
                const studentId = mark.student_id;
                const studentName = mark.full_name;
                const currentMark = mark.marks_obtained || 0;

                if (!studentTotals[studentId]) {
                    studentTotals[studentId] = { name: studentName, total: 0 };
                }
                studentTotals[studentId].total += currentMark;

                if (!subjectTotals[mark.subject]) {
                    subjectTotals[mark.subject] = 0;
                }
                subjectTotals[mark.subject] += currentMark;
                
                totalClassMarks += currentMark;
            });

            let topStudent = { name: 'N/A', marks: 0 };
            for (const studentId in studentTotals) {
                if (studentTotals[studentId].total > topStudent.marks) {
                    topStudent = { 
                        name: studentTotals[studentId].name, 
                        marks: studentTotals[studentId].total 
                    };
                }
            }

            let topSubject = { name: 'N/A', marks: 0 };
            for (const subjectName in subjectTotals) {
                if (subjectTotals[subjectName] > topSubject.marks) {
                    topSubject = { 
                        name: subjectName, 
                        marks: subjectTotals[subjectName] 
                    };
                }
            }
            
            summaries.push({
                class_group: classGroup,
                totalClassMarks,
                topStudent,
                topSubject,
            });
        }

        res.json(summaries);

    } catch (error) {
        console.error("Error fetching class summaries:", error);
        res.status(500).json({ message: "Failed to fetch class summaries" });
    }
});


// ★★★ CORRECTED AND IMPROVED ROUTE ★★★
// GET: A specific student's consolidated report card by their ID
app.get('/api/reports/student/:studentId', [verifyToken], async (req, res) => {
    const { studentId } = req.params;

    // --- NEW: Add logging to see which ID the server is receiving ---
    console.log(`[Report Card] API request received for studentId: ${studentId}`);

    // --- NEW: Add validation to check if the studentId is valid ---
    if (!studentId || isNaN(parseInt(studentId, 10))) {
        console.error(`[Report Card] Invalid studentId received: ${studentId}`);
        return res.status(400).json({ message: "An invalid student ID was provided." });
    }

    const academicYear = getCurrentAcademicYear();

    try {
        // Step 1: Fetch basic student info
        const [studentRows] = await db.query(
            `SELECT
                u.id,
                u.full_name,
                u.class_group,
                COALESCE(p.roll_no, u.username) as roll_no
            FROM users u
            LEFT JOIN user_profiles p ON u.id = p.user_id
            WHERE u.id = ?`,
            [studentId]
        );

        // Step 2: If no student is found, log it and return a 404 error
        if (studentRows.length === 0) {
            // --- NEW: Improved logging for when a student isn't found ---
            console.warn(`[Report Card] Student not found in the database for studentId: ${studentId}`);
            return res.status(404).json({ message: `Student with ID ${studentId} was not found.` });
        }
        const studentInfo = studentRows[0];
        console.log(`[Report Card] Found student: ${studentInfo.full_name}`);

        // Step 3: Fetch all marks for the student for the current academic year
        const [marks] = await db.query(
            "SELECT subject, exam_type, marks_obtained FROM report_student_marks WHERE student_id = ? AND academic_year = ?",
            [studentId, academicYear]
        );

        // Step 4: Fetch all attendance for the student for the current academic year
        const [attendance] = await db.query(
            "SELECT month, working_days, present_days FROM report_student_attendance WHERE student_id = ? AND academic_year = ?",
            [studentId, academicYear]
        );

        // Step 5: Send the combined data
        res.json({ studentInfo, marks, attendance, academicYear });

    } catch (error) {
        console.error(`Error fetching consolidated report card for student ${studentId}:`, error);
        res.status(500).json({ message: "Failed to fetch report card data" });
    }
});





// ===============================================================
// --- STAFF MODULE API ROUTES ---
// ===============================================================

app.get('/api/staff/all', async (req, res) => {
    try {
        const query = `
            SELECT
                u.id,
                u.full_name,
                u.role,
                u.class_group, -- This correctly provides the admin type
                up.profile_image_url
            FROM users AS u
            LEFT JOIN user_profiles AS up ON u.id = up.user_id
            WHERE u.role IN ('admin', 'teacher', 'others')
            ORDER BY u.full_name ASC;
        `;
        const [staff] = await db.query(query);

        const staffWithCacheBust = staff.map(member => {
            if (member.profile_image_url) {
                return {
                    ...member,
                    profile_image_url: `${member.profile_image_url}?t=${new Date().getTime()}`
                };
            }
            return member;
        });

        const admins = staffWithCacheBust.filter(member => member.role === 'admin');
        const teachers = staffWithCacheBust.filter(member => member.role === 'teacher');
        const others = staffWithCacheBust.filter(member => member.role === 'others');

        res.json({ admins, teachers, others });

    } catch (error) {
        console.error("Error fetching all staff:", error);
        res.status(500).json({ message: "Failed to fetch staff list." });
    }
});

// --- MODIFICATION IS HERE ---
app.get('/api/staff/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // The query is updated to select u.subjects_taught
        const query = `
            SELECT
                u.id,
                u.username,
                u.full_name,
                u.role,
                u.class_group,
                u.subjects_taught, -- ★★★ ADD THIS LINE ★★★
                up.email,
                up.dob,
                up.gender,
                up.phone,
                up.address,
                up.profile_image_url,
                up.aadhar_no,
                up.joining_date,
                up.previous_salary,
                up.present_salary,
                up.experience
            FROM users AS u
            LEFT JOIN user_profiles AS up ON u.id = up.user_id
            WHERE u.id = ?;
        `;
        const [[staffDetails]] = await db.query(query, [id]);

        if (!staffDetails) {
            return res.status(404).json({ message: 'Staff member not found.' });
        }

        res.json(staffDetails);

    } catch (error)
    {
        console.error("Error fetching staff details:", error);
        res.status(500).json({ message: "Failed to fetch staff details." });
    }
});




// ===============================================================
// --- STUDENT MODULE API ROUTES ---
// ===============================================================

// MODIFIED: Added numerical sorting by roll number
app.get('/api/students/all', async (req, res) => {
    try {
        const query = `
            SELECT
                u.id,
                u.full_name,
                u.role,
                u.class_group,
                up.profile_image_url,
                up.roll_no
            FROM users AS u
            LEFT JOIN user_profiles AS up ON u.id = up.user_id
            WHERE u.role = 'student'
            ORDER BY u.class_group ASC, CAST(up.roll_no AS UNSIGNED) ASC, u.full_name ASC;
        `;
        const [students] = await db.query(query);

        const studentsWithCacheBust = students.map(student => {
            if (student.profile_image_url) {
                return {
                    ...student,
                    profile_image_url: `${student.profile_image_url}?t=${new Date().getTime()}`
                };
            }
            return student;
        });

        res.json(studentsWithCacheBust);

    } catch (error) {
        console.error("Error fetching all students:", error);
        res.status(500).json({ message: "Failed to fetch student list." });
    }
});

// GET detailed information for a single student (this route remains the same)
app.get('/api/students/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT
                u.id, u.username, u.full_name, u.role, u.class_group, up.email, up.dob, up.gender,
                up.phone, up.address, up.profile_image_url, up.admission_date, up.roll_no,
                up.admission_no, up.parent_name, up.aadhar_no, up.pen_no
            FROM users AS u
            LEFT JOIN user_profiles AS up ON u.id = up.user_id
            WHERE u.id = ? AND u.role = 'student';
        `;
        const [[studentDetails]] = await db.query(query, [id]);

        if (!studentDetails) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        res.json(studentDetails);

    } catch (error) {
        console.error("Error fetching student details:", error);
        res.status(500).json({ message: "Failed to fetch student details." });
    }
});



// ==========================================================
// ---  VOUCHER SYSTEM API ROUTES ---
// ==========================================================

// 1. Multer Storage Configuration for Voucher Attachments
const voucherStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = '/data/uploads'; 
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `voucher-proof-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const voucherUpload = multer({ 
    storage: voucherStorage,
    limits: { fileSize: 10 * 1024 * 1024 } 
});


// ★★★★★ START: NEW VOUCHER NUMBER ENDPOINT ★★★★★
// GET the next available voucher number
app.get('/api/vouchers/next-number', [verifyToken, isAdmin], async (req, res) => {
    try {
        // Find the voucher with the highest ID, as this was the last one inserted.
        const query = "SELECT voucher_no FROM vouchers ORDER BY id DESC LIMIT 1";
        const [rows] = await db.query(query);

        let nextVoucherNumber = 1; // Default if no vouchers exist yet
        if (rows.length > 0) {
            const lastVoucherNo = rows[0].voucher_no;
            // Extract the numeric part of the last voucher number and increment it
            const lastNumber = parseInt(lastVoucherNo.split('-')[1]);
            if (!isNaN(lastNumber)) {
                nextVoucherNumber = lastNumber + 1;
            }
        }
        
        // Format the number with leading zeros (e.g., VCH-00001)
        const formattedVoucherNo = `VCH-${nextVoucherNumber.toString().padStart(5, '0')}`;
        
        res.status(200).json({ nextVoucherNo: formattedVoucherNo });

    } catch (error) {
        console.error("Error fetching next voucher number:", error);
        res.status(500).json({ message: 'Failed to fetch the next voucher number.' });
    }
});
// ★★★★★ END: NEW VOUCHER NUMBER ENDPOINT ★★★★★


// 2. API Endpoint to Create a New Voucher
app.post('/api/vouchers/create', [verifyToken, isAdmin, voucherUpload.single('attachment')], async (req, res) => {
    
    const {
        voucherType,
        voucherNo,
        voucherDate,
        headOfAccount,
        subHead,
        accountType,
        totalAmount,
        amountInWords,
        particulars
    } = req.body;

    if (!voucherType || !voucherNo || !voucherDate || !headOfAccount || !accountType || !totalAmount || !particulars) {
        return res.status(400).json({ message: 'Missing required fields to create a voucher.' });
    }

    const attachment_url = req.file ? `/uploads/${req.file.filename}` : null;
    let parsedParticulars;
    try {
        parsedParticulars = JSON.parse(particulars);
    } catch (e) {
        return res.status(400).json({ message: 'Invalid format for particulars data.' });
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const voucherQuery = `
            INSERT INTO vouchers (
                voucher_type, voucher_no, voucher_date, head_of_account, sub_head, 
                account_type, total_amount, amount_in_words, attachment_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const [voucherResult] = await connection.query(voucherQuery, [
            voucherType, voucherNo, voucherDate, headOfAccount, subHead || null, 
            accountType, totalAmount, amountInWords, attachment_url
        ]);
        const newVoucherId = voucherResult.insertId;

        if (parsedParticulars && parsedParticulars.length > 0) {
            const itemsQuery = 'INSERT INTO voucher_items (voucher_id, description, amount) VALUES ?';
            const itemValues = parsedParticulars.map(item => [
                newVoucherId, 
                item.description, 
                item.amount
            ]);
            await connection.query(itemsQuery, [itemValues]);
        }

        await connection.commit();
        res.status(201).json({ 
            message: 'Voucher created successfully!', 
            voucherId: newVoucherId 
        });

    } catch (error) {
        await connection.rollback();
        console.error("Error creating voucher:", error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `A voucher with number '${voucherNo}' already exists.` });
        }
        
        res.status(500).json({ message: 'An internal server error occurred while creating the voucher.' });
    } finally {
        connection.release();
    }
});



// By using "server.listen", you enable both your API routes and the real-time chat.
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server is running on port ${PORT} and is now accessible on your network.`);
    // You can add your IP address reminder here if you like, for example:
    // console.log(`   On your phone, use the IP Address: http://192.168.1.4:${PORT}`);
});