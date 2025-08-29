// VERTEX CRM - Complete Backend Server
// server.js - Main application server

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const XLSX = require('xlsx');
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult, param, query } = require('express-validator');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

// Security configuration
const SECURITY_CONFIG = {
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_REQUIRE_SPECIAL: true,
    PASSWORD_REQUIRE_NUMBER: true,
    PASSWORD_REQUIRE_UPPERCASE: true,
    BCRYPT_ROUNDS: 12,
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'text/csv', 'application/vnd.ms-excel']
};

// Token blacklist (in production, use Redis or database)
const tokenBlacklist = new Set();

// Rate limiting and security tracking
const loginAttempts = new Map(); // username -> { count, lastAttempt, lockedUntil }
const rateLimitMap = new Map(); // ip -> { count, resetTime }

// Security utility functions
class SecurityUtils {
    static validatePassword(password) {
        const errors = [];
        
        if (password.length < SECURITY_CONFIG.PASSWORD_MIN_LENGTH) {
            errors.push(`Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters long`);
        }
        
        if (SECURITY_CONFIG.PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        
        if (SECURITY_CONFIG.PASSWORD_REQUIRE_NUMBER && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        
        if (SECURITY_CONFIG.PASSWORD_REQUIRE_SPECIAL && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    static sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .replace(/[<>]/g, '') // Remove potential HTML tags
            .replace(/['"]/g, '') // Remove quotes to prevent injection
            .trim();
    }
    
    static sanitizeFilename(filename) {
        return filename
            .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
            .replace(/\.{2,}/g, '.') // Remove multiple dots
            .substring(0, 100); // Limit length
    }
    
    static isAccountLocked(username) {
        const attempts = loginAttempts.get(username);
        if (!attempts) return false;
        
        return attempts.lockedUntil && Date.now() < attempts.lockedUntil;
    }
    
    static recordFailedLogin(username) {
        const now = Date.now();
        const attempts = loginAttempts.get(username) || { count: 0, lastAttempt: 0, lockedUntil: null };
        
        // Reset count if last attempt was more than 1 hour ago
        if (now - attempts.lastAttempt > 60 * 60 * 1000) {
            attempts.count = 0;
        }
        
        attempts.count++;
        attempts.lastAttempt = now;
        
        // Lock account if too many attempts
        if (attempts.count >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS) {
            attempts.lockedUntil = now + SECURITY_CONFIG.LOCKOUT_DURATION;
        }
        
        loginAttempts.set(username, attempts);
        
        return {
            attemptsRemaining: Math.max(0, SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS - attempts.count),
            lockedUntil: attempts.lockedUntil
        };
    }
    
    static clearFailedLogins(username) {
        loginAttempts.delete(username);
    }
    
    static checkRateLimit(ip, maxRequests = 10, windowMs = 60000) {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        const requests = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };
        
        // Reset if window expired
        if (now > requests.resetTime) {
            requests.count = 0;
            requests.resetTime = now + windowMs;
        }
        
        requests.count++;
        rateLimitMap.set(ip, requests);
        
        return {
            allowed: requests.count <= maxRequests,
            remaining: Math.max(0, maxRequests - requests.count),
            resetTime: requests.resetTime
        };
    }
}

// Input validation middleware
const validateInput = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        SystemLogger.warn('validation', req.path, 'Input validation failed', {
            errors: errors.array(),
            body: req.body,
            params: req.params,
            query: req.query
        }, req);
        
        return res.status(400).json({
            success: false,
            error: 'Invalid input data',
            details: errors.array()
        });
    }
    next();
};

// Validation rules
const loginValidation = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 50 })
        .matches(/^[a-zA-Z0-9_.-]+$/)
        .withMessage('Username must be 3-50 characters and contain only letters, numbers, dots, hyphens, and underscores'),
    body('password')
        .isLength({ min: 1 })
        .withMessage('Password is required')
];

const passwordChangeValidation = [
    body('currentPassword')
        .isLength({ min: 1 })
        .withMessage('Current password is required'),
    body('newPassword')
        .isLength({ min: SECURITY_CONFIG.PASSWORD_MIN_LENGTH })
        .withMessage(`New password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters long`)
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
        .withMessage('New password must contain uppercase, lowercase, number, and special character')
];

const userCreationValidation = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 50 })
        .matches(/^[a-zA-Z0-9_.-]+$/)
        .withMessage('Username must be 3-50 characters and contain only letters, numbers, dots, hyphens, and underscores'),
    body('name')
        .trim()
        .isLength({ min: 2, max: 100 })
        .matches(/^[a-zA-Z\s.-]+$/)
        .withMessage('Name must be 2-100 characters and contain only letters, spaces, dots, and hyphens'),
    body('email')
        .optional()
        .isEmail()
        .normalizeEmail()
        .withMessage('Must be a valid email address'),
    body('phone')
        .optional()
        .matches(/^\+?[\d\s()-]{10,15}$/)
        .withMessage('Phone number must be 10-15 digits'),
    body('role')
        .isIn(['super_admin', 'center_admin', 'agent', 'qa', 'client'])
        .withMessage('Invalid role specified')
];

// Logging utility class
class SystemLogger {
    static generateRequestId() {
        return crypto.randomBytes(8).toString('hex');
    }

    static async log(level, category, source, message, details = {}, req = null, error = null, duration = null) {
        const timestamp = new Date().toISOString();
        const requestId = req?.requestId || this.generateRequestId();
        const userId = req?.user?.id || null;
        const sessionId = req?.sessionID || null;
        const ipAddress = req?.ip || req?.connection?.remoteAddress || null;
        const userAgent = req?.get('User-Agent') || null;
        const statusCode = req?.res?.statusCode || null;

        const logEntry = {
            timestamp,
            level,
            category,
            source,
            user_id: userId,
            session_id: sessionId,
            ip_address: ipAddress,
            user_agent: userAgent,
            message,
            details: JSON.stringify(details),
            stack_trace: error?.stack || null,
            request_id: requestId,
            duration_ms: duration,
            status_code: statusCode
        };

        // Console output with color coding
        const colors = {
            error: '\x1b[31m',   // Red
            warn: '\x1b[33m',    // Yellow
            info: '\x1b[36m',    // Cyan
            debug: '\x1b[90m',   // Gray
            reset: '\x1b[0m'
        };

        const color = colors[level] || colors.reset;
        console.log(`${color}[${timestamp}] ${level.toUpperCase()} [${category}] ${source}: ${message}${colors.reset}`);
        
        if (error) {
            console.error(`${colors.error}Stack: ${error.stack}${colors.reset}`);
        }

        // Store in database (only after db is initialized)
        if (typeof db !== 'undefined' && db) {
            try {
                await new Promise((resolve, reject) => {
                    const query = `
                        INSERT INTO system_logs (
                            timestamp, level, category, source, user_id, session_id, 
                            ip_address, user_agent, message, details, stack_trace, 
                            request_id, duration_ms, status_code
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    
                    db.run(query, [
                        logEntry.timestamp, logEntry.level, logEntry.category, logEntry.source,
                        logEntry.user_id, logEntry.session_id, logEntry.ip_address, logEntry.user_agent,
                        logEntry.message, logEntry.details, logEntry.stack_trace,
                        logEntry.request_id, logEntry.duration_ms, logEntry.status_code
                    ], function(err) {
                        if (err) {
                            console.error('Failed to save log to database:', err);
                            reject(err);
                        } else {
                            resolve(this.lastID);
                        }
                    });
                });
            } catch (dbError) {
                console.error('Database logging failed:', dbError);
            }
        }

        return requestId;
    }

    static info(category, source, message, details, req) {
        return this.log('info', category, source, message, details, req);
    }

    static warn(category, source, message, details, req) {
        return this.log('warn', category, source, message, details, req);
    }

    static error(category, source, message, details, req, error) {
        return this.log('error', category, source, message, details, req, error);
    }

    static debug(category, source, message, details, req) {
        return this.log('debug', category, source, message, details, req);
    }

    static async apiStart(req, res, next) {
        const startTime = Date.now();
        const requestId = SystemLogger.generateRequestId();
        
        req.requestId = requestId;
        req.startTime = startTime;

        // Sanitize request body for logging (remove sensitive data)
        let sanitizedBody = undefined;
        if (req.method !== 'GET' && req.body) {
            sanitizedBody = { ...req.body };
            // Remove sensitive fields
            const sensitiveFields = ['password', 'currentPassword', 'newPassword', 'temp_password', 'token'];
            sensitiveFields.forEach(field => {
                if (sanitizedBody[field]) {
                    sanitizedBody[field] = '[REDACTED]';
                }
            });
        }

        await SystemLogger.info('api', req.method + ' ' + req.path, 'API request started', {
            method: req.method,
            url: req.originalUrl,
            query: req.query,
            body: sanitizedBody,
            headers: {
                'content-type': req.get('content-type'),
                'authorization': req.get('authorization') ? '[PRESENT]' : '[MISSING]'
            }
        }, req);

        // Override res.json to log response
        const originalJson = res.json;
        res.json = function(data) {
            const duration = Date.now() - startTime;
            const success = res.statusCode >= 200 && res.statusCode < 400;
            
            SystemLogger.log(
                success ? 'info' : 'warn',
                'api',
                req.method + ' ' + req.path,
                `API request completed - ${res.statusCode}`,
                {
                    statusCode: res.statusCode,
                    duration,
                    responseSize: JSON.stringify(data).length,
                    success
                },
                req,
                null,
                duration
            );

            return originalJson.call(this, data);
        };

        next();
    }
}

// Enhanced security with Helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            fontSrc: ["'self'"],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'none'"],
            workerSrc: ["'none'"],
            childSrc: ["'none'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: []
        }
    },
    crossOriginEmbedderPolicy: false, // Disable for compatibility
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Additional security headers
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// Rate limiting middleware
app.use('/api/auth', (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const rateLimit = SecurityUtils.checkRateLimit(clientIP, 100, 60000); // 100 requests per minute
    
    if (!rateLimit.allowed) {
        return res.status(429).json({
            success: false,
            error: 'Too many requests. Please try again later.',
            retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
        });
    }
    
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
    res.setHeader('X-RateLimit-Reset', rateLimit.resetTime);
    next();
});

// CORS with enhanced security
app.use(cors({
    origin: function(origin, callback) {
        console.log('CORS Origin check:', origin);
        
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:3000',
            'https://localhost:5173',
            'https://localhost:3000'
        ];
        
        // Add production domains from environment
        if (process.env.ALLOWED_ORIGINS) {
            allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(','));
        }
        
        console.log('Allowed origins:', allowedOrigins);
        
        if (allowedOrigins.includes(origin)) {
            console.log('✅ CORS allowed for origin:', origin);
            callback(null, true);
        } else {
            console.log('❌ CORS blocked for origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Remaining', 'X-RateLimit-Reset']
}));

// Fallback CORS headers for any missed requests
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:5173');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Enhanced JSON parsing with size limit
app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
        // Store raw body for signature verification if needed
        req.rawBody = buf;
    }
}));

app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve React build assets with proper MIME types
app.use('/assets', express.static(path.join(__dirname, 'dist', 'assets'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// Serve other static files from dist
app.use(express.static(path.join(__dirname, 'dist')));

// Add logging middleware to all API routes
app.use('/api', SystemLogger.apiStart);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        security: {
            rateLimit: 'enabled',
            authentication: 'jwt',
            fileUpload: 'restricted',
            headers: 'secured'
        }
    });
});

// Root health check for Railway - moved to /api/status to avoid conflict with frontend
app.get('/api/status', (req, res) => {
    res.json({
        message: 'Vertex CRM Server is running',
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Secure file upload configuration
const upload = multer({ 
    dest: 'uploads/',
    limits: { 
        fileSize: SECURITY_CONFIG.MAX_FILE_SIZE,
        files: 1 // Only one file at a time
    },
    fileFilter: (req, file, cb) => {
        // Check file type
        if (!SECURITY_CONFIG.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
            return cb(new Error(`File type ${file.mimetype} not allowed. Allowed types: ${SECURITY_CONFIG.ALLOWED_FILE_TYPES.join(', ')}`));
        }
        
        // Sanitize filename
        file.originalname = SecurityUtils.sanitizeFilename(file.originalname);
        
        // Additional security checks
        if (file.originalname.length === 0) {
            return cb(new Error('Invalid filename'));
        }
        
        cb(null, true);
    }
});

// =====================================================
// DATABASE INITIALIZATION
// =====================================================

const db = new sqlite3.Database('./vertex_crm.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to VERTEX CRM database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Update existing US entries to USA
        db.run(`UPDATE clients SET country = 'USA' WHERE country = 'US'`, (err) => {
            if (err) {
                console.error('Error updating US to USA:', err.message);
            }
        });


        // CAMPAIGNS TABLE - Different business verticals
        db.run(`CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_name TEXT NOT NULL,
            campaign_type TEXT NOT NULL,
            client_id INTEGER NOT NULL,
            main_client_name TEXT,
            country TEXT NOT NULL,
            transfer_number TEXT,
            collect_payment TEXT,
            close_sale TEXT,
            transfer_to_department TEXT,
            department_transfer_number TEXT,
            photo_url TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            FOREIGN KEY (client_id) REFERENCES clients(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        )`);

        // CENTERS TABLE - Outsourced centers
        db.run(`CREATE TABLE IF NOT EXISTS centers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER,
            center_name TEXT NOT NULL,
            center_code TEXT UNIQUE NOT NULL,
            address TEXT,
            phone TEXT,
            email TEXT,
            manager_name TEXT,
            capacity INTEGER,
            operating_hours TEXT,
            timezone TEXT,
            specializations TEXT, -- JSON array of specializations
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        )`);

        // Add new columns to existing centers table if they don't exist
        db.run(`ALTER TABLE centers ADD COLUMN center_name TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding center_name column:', err.message);
            }
        });
        
        db.run(`ALTER TABLE centers ADD COLUMN center_code TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding center_code column:', err.message);
            }
        });
        
        db.run(`ALTER TABLE centers ADD COLUMN manager_name TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding manager_name column:', err.message);
            }
        });
        
        db.run(`ALTER TABLE centers ADD COLUMN capacity INTEGER`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding capacity column:', err.message);
            }
        });


        
        db.run(`ALTER TABLE centers ADD COLUMN operating_hours TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding operating_hours column:', err.message);
            }
        });

        // Add commission column to campaigns table
        db.run(`ALTER TABLE campaigns ADD COLUMN commission DECIMAL(10,2) DEFAULT 0.00`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding commission column:', err.message);
            }
        });

        // Add commission column to centers table
        db.run(`ALTER TABLE centers ADD COLUMN commission DECIMAL(10,2) DEFAULT 0.00`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding commission column to centers:', err.message);
            }
        });

        // Add payment terms columns to campaigns table
        db.run(`ALTER TABLE campaigns ADD COLUMN payment_type TEXT DEFAULT 'per_sale'`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding payment_type column to campaigns:', err.message);
            }
        });

        // Add conversion strategy column to campaigns table
        db.run(`ALTER TABLE campaigns ADD COLUMN conversion_strategy TEXT DEFAULT 'installed'`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding conversion_strategy column to campaigns:', err.message);
            }
        });

        // Create campaign conversion rules table
        db.run(`CREATE TABLE IF NOT EXISTS campaign_conversion_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            conversion_type TEXT NOT NULL, -- 'status_based', 'forwarded_based', 'time_based', 'custom'
            conversion_criteria JSON NOT NULL, -- Flexible criteria storage
            priority INTEGER DEFAULT 1, -- For multiple rules per campaign
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        )`, (err) => {
            if (err && !err.message.includes('already exists')) {
                console.error('Error creating campaign_conversion_rules table:', err.message);
            }
        });

        db.run(`ALTER TABLE campaigns ADD COLUMN client_rate DECIMAL(10,2) DEFAULT 0.00`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding client_rate column to campaigns:', err.message);
            }
        });

        db.run(`ALTER TABLE campaigns ADD COLUMN payment_frequency TEXT DEFAULT 'per_transaction'`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding payment_frequency column to campaigns:', err.message);
            }
        });
        
        db.run(`ALTER TABLE centers ADD COLUMN timezone TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding timezone column:', err.message);
            }
        });
        
        db.run(`ALTER TABLE centers ADD COLUMN specializations TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding specializations column:', err.message);
            }
        });
        
        db.run(`ALTER TABLE centers ADD COLUMN updated_at DATETIME`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding updated_at column:', err.message);
            }
        });

        db.run(`ALTER TABLE centers ADD COLUMN country TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding country column:', err.message);
            }
        });

        // Add admin login columns
        db.run(`ALTER TABLE centers ADD COLUMN admin_username TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding admin_username column:', err.message);
            }
        });

        db.run(`ALTER TABLE centers ADD COLUMN admin_email TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding admin_email column:', err.message);
            }
        });

        db.run(`ALTER TABLE centers ADD COLUMN admin_password TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding admin_password column:', err.message);
            }
        });

        db.run(`ALTER TABLE centers ADD COLUMN admin_password_hash TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding admin_password_hash column:', err.message);
            }
        });

        // Add alias column to users table
        db.run(`ALTER TABLE users ADD COLUMN alias TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding alias column to users table:', err.message);
            }
        });

        // Add title column to users table
        db.run(`ALTER TABLE users ADD COLUMN title TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding title column to users table:', err.message);
            }
        });

        // Migrate data from old columns to new columns
        db.run(`UPDATE centers SET center_name = name WHERE center_name IS NULL AND name IS NOT NULL`, (err) => {
            if (err) {
                console.error('Error migrating center_name:', err.message);
            }
        });
        
        db.run(`UPDATE centers SET center_code = code WHERE center_code IS NULL AND code IS NOT NULL`, (err) => {
            if (err) {
                console.error('Error migrating center_code:', err.message);
            }
        });

        // USERS TABLE - All system users
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT UNIQUE NOT NULL,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            company_name TEXT,
            photo_url TEXT,
            email TEXT,
            phone TEXT,
            role TEXT NOT NULL CHECK(role IN ('super_admin', 'center_admin', 'agent', 'qa', 'client')),
            center_id INTEGER,
            vici_user TEXT,
            status TEXT DEFAULT 'active',
            last_login DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            FOREIGN KEY (center_id) REFERENCES centers(id)
        )`);

        // LEADS TABLE - Universal lead storage
        db.run(`CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            center_id INTEGER NOT NULL,
            agent_id INTEGER NOT NULL,
            customer_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT,
            lead_source TEXT DEFAULT 'call',
            interest_level TEXT DEFAULT 'Warm',
            custom_data JSON,
            consent_given BOOLEAN DEFAULT 1,
            consent_time DATETIME,
            status TEXT DEFAULT 'new',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
            FOREIGN KEY (center_id) REFERENCES centers(id),
            FOREIGN KEY (agent_id) REFERENCES users(id)
        )`);

        // INSTALLATIONS TABLE - Tracking successful conversions
        db.run(`CREATE TABLE IF NOT EXISTS installations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER,
            campaign_id INTEGER NOT NULL,
            center_id INTEGER NOT NULL,
            agent_id INTEGER NOT NULL,
            customer_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT,
            installation_date DATE,
            installation_status TEXT DEFAULT 'scheduled',
            package_type TEXT,
            monthly_value DECIMAL(10,2),
            import_batch_id INTEGER,
            imported_at DATETIME,
            matched_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (lead_id) REFERENCES leads(id),
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
            FOREIGN KEY (center_id) REFERENCES centers(id),
            FOREIGN KEY (agent_id) REFERENCES users(id)
        )`);

        // VALIDATION LOGS - DNC/Blacklist check history
        db.run(`CREATE TABLE IF NOT EXISTS validation_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL,
            validation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            blacklist_status TEXT,
            blacklist_message TEXT,
            blacklist_results INTEGER,
            blacklist_raw_response TEXT,
            tcpa_status TEXT,
            tcpa_federal_dnc BOOLEAN,
            tcpa_state_dnc TEXT,
            tcpa_raw_response TEXT,
            validation_passed BOOLEAN,
            denial_reason TEXT,
            agent_id INTEGER,
            center_id INTEGER,
            FOREIGN KEY (agent_id) REFERENCES users(id),
            FOREIGN KEY (center_id) REFERENCES centers(id)
        )`);

        // SUPPRESSION LIST - Internal blacklist
        db.run(`CREATE TABLE IF NOT EXISTS suppression_list (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT UNIQUE NOT NULL,
            reason TEXT NOT NULL,
            source TEXT,
            date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
            added_by INTEGER,
            center_id INTEGER,
            expires_at DATETIME,
            FOREIGN KEY (added_by) REFERENCES users(id),
            FOREIGN KEY (center_id) REFERENCES centers(id)
        )`);

        // SCRUB USAGE - Track API usage for billing
        db.run(`CREATE TABLE IF NOT EXISTS scrub_usage (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            center_id INTEGER NOT NULL,
            date DATE NOT NULL,
            blacklist_scrubs INTEGER DEFAULT 0,
            tcpa_scrubs INTEGER DEFAULT 0,
            dnc_scrubs INTEGER DEFAULT 0,
            total_cost DECIMAL(10,2),
            FOREIGN KEY (center_id) REFERENCES centers(id),
            UNIQUE(center_id, date)
        )`);

        // LEAD FORMS - Form configurations for campaigns
        db.run(`CREATE TABLE IF NOT EXISTS lead_forms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            campaign_id INTEGER NOT NULL,
            description TEXT,
            form_fields JSON NOT NULL,
            client_form_url TEXT,
            field_mapping JSON,
            success_message TEXT DEFAULT 'Thank you for your interest!',
            redirect_delay INTEGER DEFAULT 3,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )`);

        // PHONE PRE-VERIFICATION - Real-time phone checking before lead submission
        db.run(`CREATE TABLE IF NOT EXISTS phone_pre_verification (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL,
            agent_id INTEGER NOT NULL,
            center_id INTEGER NOT NULL,
            campaign_id INTEGER,
            verification_status TEXT DEFAULT 'checking', -- checking, approved, rejected, duplicate
            duplicate_found BOOLEAN DEFAULT 0,
            duplicate_center_id INTEGER,
            duplicate_agent_id INTEGER,
            duplicate_campaign_id INTEGER,
            duplicate_date DATETIME,
            blacklist_status TEXT,
            blacklist_message TEXT,
            blacklist2_status TEXT,
            blacklist2_message TEXT,
            tcpa_status TEXT,
            tcpa_message TEXT,
            validation_passed BOOLEAN DEFAULT 0,
            denial_reason TEXT,
            blacklist_raw_response TEXT,
            blacklist2_raw_response TEXT,
            tcpa_raw_response TEXT,
            checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME, -- Reservation expires after X minutes
            used_for_submission BOOLEAN DEFAULT 0,
            submission_id INTEGER,
            notes TEXT,
            FOREIGN KEY (agent_id) REFERENCES users(id),
            FOREIGN KEY (center_id) REFERENCES centers(id),
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
            FOREIGN KEY (duplicate_center_id) REFERENCES centers(id),
            FOREIGN KEY (duplicate_agent_id) REFERENCES users(id),
            FOREIGN KEY (duplicate_campaign_id) REFERENCES campaigns(id),
            FOREIGN KEY (submission_id) REFERENCES lead_submissions(id)
        )`);

        // VALIDATION FAILURES - Pre-pitch validation attempts that failed
        db.run(`CREATE TABLE IF NOT EXISTS validation_failures (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT NOT NULL,
            zipcode TEXT,
            agent_id INTEGER NOT NULL,
            center_id INTEGER NOT NULL,
            campaign_id INTEGER,
            validation_type TEXT NOT NULL, -- 'phone', 'zipcode', 'both'
            failure_reason TEXT NOT NULL,
            phone_status TEXT, -- 'rejected', 'duplicate', 'suppressed'
            zipcode_status TEXT, -- 'unserviceable'
            blacklist_status TEXT,
            blacklist_message TEXT,
            blacklist2_status TEXT,
            blacklist2_message TEXT,
            tcpa_status TEXT,
            tcpa_message TEXT,
            duplicate_details JSON,
            validation_details JSON,
            checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            proceeded_anyway BOOLEAN DEFAULT 0,
            notes TEXT,
            FOREIGN KEY (agent_id) REFERENCES users(id),
            FOREIGN KEY (center_id) REFERENCES centers(id),
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
        )`);

        // LEAD SUBMISSIONS - Only successfully validated and submitted leads
        db.run(`CREATE TABLE IF NOT EXISTS lead_submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            form_id INTEGER NOT NULL,
            center_id INTEGER NOT NULL,
            center_code TEXT NOT NULL,
            agent_id INTEGER,
            first_name TEXT,
            last_name TEXT,
            phone TEXT NOT NULL,
            email TEXT,
            additional_data JSON,
            validation_status TEXT DEFAULT 'clean', -- Only clean leads should be here now
            validation_log_id INTEGER,
            forwarded_to_client BOOLEAN DEFAULT 0,
            forwarded_at DATETIME,
            autofill_url TEXT,
            client_response TEXT,
            conversion_status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            ip_address TEXT,
            user_agent TEXT,
            zipcode TEXT,
            sales_status TEXT DEFAULT 'transferred',
            status_updated_at DATETIME,
            status_updated_by INTEGER,
            status_notes TEXT,
            FOREIGN KEY (form_id) REFERENCES lead_forms(id) ON DELETE CASCADE,
            FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE CASCADE,
            FOREIGN KEY (agent_id) REFERENCES users(id),
            FOREIGN KEY (validation_log_id) REFERENCES validation_logs(id),
            FOREIGN KEY (status_updated_by) REFERENCES users(id)
        )`);

        // ATTENDANCE TRACKING - Login/logout sessions for agents
        db.run(`CREATE TABLE IF NOT EXISTS attendance_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            logout_time DATETIME,
            session_duration INTEGER, -- in minutes
            ip_address TEXT,
            user_agent TEXT,
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // AI TARGET MANAGEMENT SYSTEM
        // =====================================================
        
        // CAMPAIGN AI CONFIGURATION - Campaign-specific AI settings and success criteria
        db.run(`CREATE TABLE IF NOT EXISTS campaign_ai_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL UNIQUE,
            success_criteria TEXT NOT NULL, -- JSON array: ["installed", "paid"]
            primary_metric TEXT NOT NULL, -- "conversion_rate", "lead_quality", "installation_rate"
            baseline_expectations TEXT NOT NULL, -- JSON: {"daily_target": 2, "quality_threshold": 0.8}
            industry_benchmarks TEXT, -- JSON: {"conversion_rate": 0.20, "cycle_days": 5}
            ai_model_preference TEXT DEFAULT 'mistralai/mistral-7b-instruct:free',
            custom_prompt_additions TEXT,
            performance_weights TEXT, -- JSON: {"quality": 0.4, "quantity": 0.6}
            target_structure TEXT, -- JSON: {"base_targets": {}, "center_multiplier": true}
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
        )`);
        
        // Add target_structure column to existing table if it doesn't exist
        db.run(`ALTER TABLE campaign_ai_config ADD COLUMN target_structure TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding target_structure column:', err.message);
            }
        });
        
        // SYSTEM LOGS - Comprehensive logging for monitoring and debugging
        db.run(`CREATE TABLE IF NOT EXISTS system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            level TEXT NOT NULL, -- 'info', 'warn', 'error', 'debug'
            category TEXT NOT NULL, -- 'api', 'database', 'ai', 'auth', 'frontend', 'system'
            source TEXT, -- endpoint, function name, component name
            user_id INTEGER, -- who triggered this log (if applicable)
            session_id TEXT, -- session identifier
            ip_address TEXT, -- client IP
            user_agent TEXT, -- browser/client info
            message TEXT NOT NULL, -- log message
            details TEXT, -- JSON with additional details
            stack_trace TEXT, -- error stack trace if applicable
            request_id TEXT, -- unique request identifier for tracing
            duration_ms INTEGER, -- operation duration
            status_code INTEGER, -- HTTP status code if applicable
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`, (err) => {
            if (err) {
                console.error('Error creating system_logs table:', err);
            } else {
                console.log('System logs table created successfully');
            }
        });

        // Create indexes for efficient log querying
        db.run(`CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp DESC)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_system_logs_user ON system_logs(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_system_logs_request ON system_logs(request_id)`);

        // NOTIFICATIONS SYSTEM - Hierarchical notification system
        db.run(`CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'info', -- 'info', 'campaign', 'target', 'policy', 'alert', 'performance'
            priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
            sender_id INTEGER NOT NULL,
            sender_role TEXT NOT NULL,
            target_type TEXT NOT NULL, -- 'all', 'centers', 'agents', 'specific'
            target_centers TEXT, -- JSON array of center IDs (if targeting specific centers)
            target_agents TEXT, -- JSON array of agent IDs (if targeting specific agents)
            campaign_id INTEGER, -- Optional: if notification is campaign-related
            expires_at DATETIME, -- Optional: auto-expire notifications
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_id) REFERENCES users(id),
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
        )`, (err) => {
            if (err) {
                console.error('Error creating notifications table:', err);
            } else {
                console.log('Notifications table created successfully');
            }
        });

        // NOTIFICATION RECIPIENTS - Track who received and read notifications
        db.run(`CREATE TABLE IF NOT EXISTS notification_recipients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            notification_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            is_read BOOLEAN DEFAULT 0,
            read_at DATETIME,
            delivered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(notification_id, user_id)
        )`, (err) => {
            if (err) {
                console.error('Error creating notification_recipients table:', err);
            } else {
                console.log('Notification recipients table created successfully');
            }
        });

        // Create indexes for efficient notification querying
        db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_sender ON notifications(sender_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_notification_recipients_user ON notification_recipients(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_notification_recipients_read ON notification_recipients(is_read)`);
        
        // CAMPAIGN TARGETS - Super Admin sets base targets per campaign
        db.run(`CREATE TABLE IF NOT EXISTS campaign_targets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            target_type TEXT NOT NULL, -- 'leads_per_day', 'conversion_rate', 'quality_rate'
            target_value REAL NOT NULL,
            target_period TEXT DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
            created_by INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1,
            ai_confidence REAL DEFAULT 0.0, -- AI confidence in this target (0-1)
            ai_reasoning TEXT, -- AI explanation for this target
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )`);

        // CENTER TARGETS - AI-adjusted targets per center for each campaign
        db.run(`CREATE TABLE IF NOT EXISTS center_targets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            center_id INTEGER NOT NULL,
            campaign_id INTEGER NOT NULL,
            target_type TEXT NOT NULL,
            target_value REAL NOT NULL,
            target_period TEXT DEFAULT 'daily',
            base_target_id INTEGER, -- Reference to campaign_targets
            adjustment_factor REAL DEFAULT 1.0, -- AI adjustment multiplier
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1,
            ai_confidence REAL DEFAULT 0.0,
            ai_reasoning TEXT,
            FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE CASCADE,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
            FOREIGN KEY (base_target_id) REFERENCES campaign_targets(id)
        )`);

        // AGENT TARGETS - AI-personalized targets per agent
        db.run(`CREATE TABLE IF NOT EXISTS agent_targets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_id INTEGER NOT NULL,
            campaign_id INTEGER NOT NULL,
            target_type TEXT NOT NULL,
            target_value REAL NOT NULL,
            target_period TEXT DEFAULT 'daily',
            center_target_id INTEGER, -- Reference to center_targets
            adjustment_factor REAL DEFAULT 1.0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1,
            ai_confidence REAL DEFAULT 0.0,
            ai_reasoning TEXT,
            performance_tier TEXT DEFAULT 'standard', -- 'underperformer', 'standard', 'overperformer'
            FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
            FOREIGN KEY (center_target_id) REFERENCES center_targets(id)
        )`);

        // AI PERFORMANCE ANALYSIS - Store AI insights and recommendations
        db.run(`CREATE TABLE IF NOT EXISTS ai_performance_analysis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            analysis_type TEXT NOT NULL, -- 'agent', 'center', 'campaign'
            entity_id INTEGER NOT NULL, -- agent_id, center_id, or campaign_id
            analysis_period_start DATE NOT NULL,
            analysis_period_end DATE NOT NULL,
            performance_data JSON NOT NULL, -- Raw performance metrics
            ai_insights JSON NOT NULL, -- AI analysis results
            recommendations JSON NOT NULL, -- AI recommendations
            confidence_score REAL DEFAULT 0.0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            model_used TEXT, -- Which AI model generated this analysis
            prompt_version TEXT DEFAULT '1.0'
        )`);

        // TARGET PERFORMANCE TRACKING - Track actual vs target performance
        db.run(`CREATE TABLE IF NOT EXISTS target_performance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_type TEXT NOT NULL, -- 'agent', 'center', 'campaign'
            target_id INTEGER NOT NULL, -- Reference to respective target table
            entity_id INTEGER NOT NULL, -- agent_id, center_id, or campaign_id
            date DATE NOT NULL,
            target_value REAL NOT NULL,
            actual_value REAL NOT NULL,
            achievement_percentage REAL NOT NULL,
            variance REAL NOT NULL, -- actual - target
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // AI TARGET ADJUSTMENTS LOG - Track all AI-driven target changes
        db.run(`CREATE TABLE IF NOT EXISTS ai_target_adjustments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_type TEXT NOT NULL,
            target_id INTEGER NOT NULL,
            entity_id INTEGER NOT NULL,
            old_value REAL NOT NULL,
            new_value REAL NOT NULL,
            adjustment_reason TEXT NOT NULL,
            ai_confidence REAL NOT NULL,
            ai_model TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            approved_by INTEGER, -- User who approved the AI recommendation
            approved_at DATETIME,
            status TEXT DEFAULT 'pending' -- 'pending', 'approved', 'rejected'
        )`);

        // VICI RECORDINGS - Call recordings from ViciDial
        db.run(`CREATE TABLE IF NOT EXISTS vici_recordings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            center_id INTEGER NOT NULL,
            agent_id INTEGER NOT NULL,
            uniqueid TEXT UNIQUE,
            lead_id TEXT,
            recording_url TEXT,
            call_date DATETIME,
            length_in_sec INTEGER,
            disposition TEXT,
            agent_user TEXT,
            phone_number TEXT,
            qa_status TEXT DEFAULT 'pending',
            qa_assigned_to INTEGER,
            qa_completed_at DATETIME,
            synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
            FOREIGN KEY (center_id) REFERENCES centers(id),
            FOREIGN KEY (agent_id) REFERENCES users(id),
            FOREIGN KEY (qa_assigned_to) REFERENCES users(id)
        )`);

        // QA AUDITS - Quality assurance evaluations
        db.run(`CREATE TABLE IF NOT EXISTS qa_audits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recording_id INTEGER NOT NULL,
            qa_user_id INTEGER NOT NULL,
            greeting_score INTEGER,
            product_knowledge_score INTEGER,
            objection_handling_score INTEGER,
            closing_score INTEGER,
            compliance_score INTEGER,
            overall_score INTEGER,
            strengths TEXT,
            improvements TEXT,
            coaching_notes TEXT,
            dnc_violation BOOLEAN DEFAULT 0,
            script_violation BOOLEAN DEFAULT 0,
            compliance_violation BOOLEAN DEFAULT 0,
            status TEXT DEFAULT 'pass',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            shared_with_agent_at DATETIME,
            agent_acknowledged_at DATETIME,
            FOREIGN KEY (recording_id) REFERENCES vici_recordings(id),
            FOREIGN KEY (qa_user_id) REFERENCES users(id)
        )`);

        // CENTER QA ASSIGNMENTS
        db.run(`CREATE TABLE IF NOT EXISTS center_qa_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            center_id INTEGER NOT NULL,
            qa_user_id INTEGER NOT NULL,
            daily_quota INTEGER DEFAULT 10,
            assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (center_id) REFERENCES centers(id),
            FOREIGN KEY (qa_user_id) REFERENCES users(id),
            UNIQUE(center_id, qa_user_id)
        )`);

        // IMPORT BATCHES - Track Excel uploads
        db.run(`CREATE TABLE IF NOT EXISTS import_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            filename TEXT,
            uploaded_by INTEGER,
            total_records INTEGER,
            matched_records INTEGER,
            unmatched_records INTEGER,
            import_status TEXT,
            import_log JSON,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
            FOREIGN KEY (uploaded_by) REFERENCES users(id)
        )`);

        // ACTIVITY LOGS - Audit trail
        db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            details TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // COMMISSION CALCULATOR - Super admin only
        db.run(`CREATE TABLE IF NOT EXISTS commission_calculator (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            month TEXT NOT NULL,
            total_installations INTEGER,
            revenue_per_install DECIMAL(10,2),
            total_revenue DECIMAL(10,2),
            center_payouts JSON,
            blacklist_scrubs_used INTEGER,
            blacklist_scrub_cost DECIMAL(10,2),
            tcpa_scrubs_used INTEGER,
            tcpa_scrub_cost DECIMAL(10,2),
            other_costs JSON,
            gross_profit DECIMAL(10,2),
            net_profit DECIMAL(10,2),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        )`);

        // CAMPAIGN-CENTER ASSIGNMENTS - Many-to-many relationship
        db.run(`CREATE TABLE IF NOT EXISTS campaign_center_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            center_id INTEGER NOT NULL,
            center_commission DECIMAL(10,2) DEFAULT 0.00,
            status TEXT DEFAULT 'active',
            assigned_date DATE DEFAULT CURRENT_DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            UNIQUE(campaign_id, center_id),
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
            FOREIGN KEY (center_id) REFERENCES centers(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )`);

        // REVENUE TRACKING - Track sales/installs per campaign/center
        db.run(`CREATE TABLE IF NOT EXISTS revenue_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            center_id INTEGER NOT NULL,
            transaction_type TEXT NOT NULL CHECK(transaction_type IN ('sale', 'install', 'lead', 'appointment')),
            quantity INTEGER DEFAULT 1,
            client_payment DECIMAL(10,2) NOT NULL,
            center_cost DECIMAL(10,2) NOT NULL,
            profit DECIMAL(10,2) NOT NULL,
            transaction_date DATE NOT NULL,
            month_year TEXT NOT NULL, -- Format: YYYY-MM for easy grouping
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
            FOREIGN KEY (center_id) REFERENCES centers(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        )`);

        // CAMPAIGN POSTCODES - Service area postcodes for campaigns
        db.run(`CREATE TABLE IF NOT EXISTS campaign_postcodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            postcode TEXT NOT NULL,
            upload_batch_id TEXT,
            uploaded_by INTEGER,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
            FOREIGN KEY (uploaded_by) REFERENCES users(id),
            UNIQUE(campaign_id, postcode)
        )`);

        // POSTCODE UPLOADS - Track postcode upload batches
        db.run(`CREATE TABLE IF NOT EXISTS postcode_uploads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            batch_id TEXT UNIQUE NOT NULL,
            filename TEXT NOT NULL,
            total_rows_processed INTEGER DEFAULT 0,
            valid_postcodes_added INTEGER DEFAULT 0,
            duplicate_postcodes_skipped INTEGER DEFAULT 0,
            invalid_postcodes_rejected INTEGER DEFAULT 0,
            uploaded_by INTEGER NOT NULL,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
            FOREIGN KEY (uploaded_by) REFERENCES users(id)
        )`);

        // CLIENTS - Client information
        db.run(`CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_name TEXT NOT NULL,
            client_type TEXT NOT NULL CHECK(client_type IN ('main_client', 'broker')),
            main_client_name TEXT,
            contact_person_name TEXT NOT NULL,
            contact_email TEXT NOT NULL,
            sector TEXT NOT NULL,
            sales_type TEXT,
            country TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )`);

        // Add ZIP code column to lead_submissions if it doesn't exist
        db.run(`ALTER TABLE lead_submissions ADD COLUMN zipcode TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('Error adding zipcode column:', err);
            }
        });

        // Create default super admin
        createDefaultSuperAdmin();
    });
}

async function createDefaultSuperAdmin() {
    db.get("SELECT * FROM users WHERE role = 'super_admin'", async (err, row) => {
        if (!row) {
            const hashedPassword = await bcrypt.hash('vertex2024', 10);
            db.run(`INSERT INTO users (user_id, username, password, name, role) 
                    VALUES (?, ?, ?, ?, ?)`,
                ['SA001', 'admin', hashedPassword, 'Super Administrator', 'super_admin'],
                (err) => {
                    if (!err) {
                        console.log('✅ Default super admin created');
                        console.log('   Username: admin');
                        console.log('   Password: vertex2024');
                    }
                }
            );
        }
    });
}

// =====================================================
// AUTHENTICATION MIDDLEWARE
// =====================================================

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        SystemLogger.warn('auth', 'authenticateToken', 'Missing access token', {
            path: req.path,
            method: req.method,
            ip: req.ip
        }, req);
        return res.status(401).json({ error: 'Access token required' });
    }

    // Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
        SystemLogger.warn('auth', 'authenticateToken', 'Blacklisted token used', {
            path: req.path,
            method: req.method,
            ip: req.ip
        }, req);
        return res.status(401).json({ error: 'Token has been revoked' });
    }

    jwt.verify(token, JWT_SECRET, async (err, user) => {
        if (err) {
            SystemLogger.error('auth', 'authenticateToken', 'Invalid token', {
                error: err.message,
                path: req.path,
                method: req.method,
                ip: req.ip
            }, req, err);
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        
        // Verify user still exists and is active
        try {
            const currentUser = await new Promise((resolve, reject) => {
                db.get(`SELECT id, username, role, status FROM users WHERE id = ? AND status = 'active'`, 
                    [user.id], (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
            });
            
            if (!currentUser) {
                SystemLogger.warn('auth', 'authenticateToken', 'User not found or inactive', {
                    userId: user.id,
                    path: req.path,
                    method: req.method
                }, req);
                return res.status(401).json({ error: 'User account not found or inactive' });
            }
            
        req.user = user;
            req.token = token; // Store token for potential blacklisting
            
            SystemLogger.debug('auth', 'authenticateToken', 'Token verified successfully', {
                userId: user.id,
                username: user.username,
                role: user.role
            }, req);
            
        next();
        } catch (dbError) {
            SystemLogger.error('auth', 'authenticateToken', 'Database error during token verification', {
                error: dbError.message,
                userId: user.id
            }, req, dbError);
            return res.status(500).json({ error: 'Authentication verification failed' });
        }
    });
};

const checkRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

// =====================================================
// AUTHENTICATION ENDPOINTS
// =====================================================

// Login endpoint
app.post('/api/auth/login', loginValidation, validateInput, async (req, res) => {
    const { username, password } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress;

    // Input validation
    if (!username || !password) {
        await SystemLogger.warn('auth', 'POST /api/auth/login', 'Missing credentials', {
            ip: clientIP,
            username: username || 'missing'
        }, req);
        return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    // Sanitize inputs
    const sanitizedUsername = SecurityUtils.sanitizeInput(username);

    // Check if account is locked
    if (SecurityUtils.isAccountLocked(sanitizedUsername)) {
        await SystemLogger.warn('auth', 'POST /api/auth/login', 'Login attempt on locked account', {
            username: sanitizedUsername,
            ip: clientIP
        }, req);
        return res.status(423).json({ 
            success: false, 
            error: 'Account temporarily locked due to too many failed attempts. Please try again later.' 
        });
    }

    db.get(`SELECT * FROM users WHERE username = ? AND status = 'active'`, 
        [sanitizedUsername], 
        async (err, user) => {
            if (err) {
                await SystemLogger.error('auth', 'POST /api/auth/login', 'Database error during login', {
                    error: err.message,
                    username: sanitizedUsername,
                    ip: clientIP
                }, req, err);
                return res.status(500).json({ success: false, error: 'Authentication service temporarily unavailable' });
            }
            
            if (!user) {
                // Record failed login attempt
                const failureInfo = SecurityUtils.recordFailedLogin(sanitizedUsername);
                
                await SystemLogger.warn('auth', 'POST /api/auth/login', 'Invalid username', {
                    username: sanitizedUsername,
                    ip: clientIP,
                    attemptsRemaining: failureInfo.attemptsRemaining
                }, req);
                
                return res.status(401).json({ success: false, error: 'Invalid credentials' });
            }

            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                // Record failed login attempt
                const failureInfo = SecurityUtils.recordFailedLogin(sanitizedUsername);
                
                await SystemLogger.warn('auth', 'POST /api/auth/login', 'Invalid password', {
                    username: sanitizedUsername,
                    userId: user.id,
                    ip: clientIP,
                    attemptsRemaining: failureInfo.attemptsRemaining
                }, req);
                
                return res.status(401).json({ success: false, error: 'Invalid credentials' });
            }

            // Clear failed login attempts on successful login
            SecurityUtils.clearFailedLogins(sanitizedUsername);

            // Update last login
            db.run(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`, [user.id]);

            // Get center info if applicable
            let centerInfo = null;
            if (user.center_id) {
                try {
                    centerInfo = await new Promise((resolve, reject) => {
                        db.get(`SELECT c.id, c.center_name, c.center_code, camp.campaign_name 
                                FROM centers c 
                                LEFT JOIN campaigns camp ON c.campaign_id = camp.id 
                                WHERE c.id = ?`, 
                            [user.center_id], 
                            (err, center) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve(center);
                                }
                            }
                        );
                    });
                } catch (centerError) {
                    centerInfo = null;
                }
            }

            // Generate JWT token with proper expiration
            const token = jwt.sign(
                { 
                    id: user.id, 
                    user_id: user.user_id,
                    username: user.username, 
                    role: user.role,
                    center_id: user.center_id,
                    name: user.name,
                    iat: Math.floor(Date.now() / 1000),
                    jti: crypto.randomBytes(16).toString('hex') // Unique token ID
                },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRY }
            );

            await SystemLogger.info('auth', 'POST /api/auth/login', 'Successful login', {
                userId: user.id,
                username: user.username,
                role: user.role,
                ip: clientIP
            }, req);

            // Track attendance login
            try {
                await trackUserLogin(user.id, req.ip, req.get('User-Agent'));
            } catch (attendanceError) {
                console.error('Error tracking login attendance:', attendanceError);
            }

            // Log activity
            db.run(`INSERT INTO activity_logs (user_id, action, details, ip_address) 
                    VALUES (?, ?, ?, ?)`,
                [user.id, 'login', `User ${user.username} logged in`, req.ip]);

            console.log('Login response for user', user.username, '- first_login:', user.first_login, 'firstLogin flag:', user.first_login === 1);

            res.json({ 
                success: true,
                token, 
                firstLogin: user.first_login === 1,
                user: {
                    id: user.id,
                    user_id: user.user_id,
                    username: user.username,
                    name: user.name,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    companyName: user.company_name,
                    photoUrl: user.photo_url,
                    role: user.role,
                    email: user.email,
                    center: centerInfo
                }
            });
        }
    );
});

// Logout endpoint
app.post('/api/auth/logout', authenticateToken, (req, res) => {
    db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
        [req.user.id, 'logout', `User logged out`]);
    
    res.json({ success: true, message: 'Logged out successfully' });
});

// Refresh token endpoint
app.post('/api/auth/refresh', authenticateToken, async (req, res) => {
    try {
        // Get fresh user data
        const user = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM users WHERE id = ? AND status = 'active'`, 
                [req.user.id], 
                (err, user) => {
                    if (err) reject(err);
                    else resolve(user);
                }
            );
        });

        if (!user) {
            return res.status(401).json({ success: false, error: 'User not found' });
        }

        // Get center info if applicable
        let centerInfo = null;
        if (user.center_id) {
            centerInfo = await new Promise((resolve, reject) => {
                db.get(`SELECT c.id, c.center_name, c.center_code, camp.campaign_name 
                        FROM centers c 
                        JOIN campaigns camp ON c.campaign_id = camp.id 
                        WHERE c.id = ?`, 
                    [user.center_id], 
                    (err, center) => {
                        if (err) reject(err);
                        else resolve(center);
                    }
                );
            });
        }

        // Generate new JWT token
        const newToken = jwt.sign(
            { 
                id: user.id, 
                user_id: user.user_id,
                username: user.username, 
                role: user.role,
                center_id: user.center_id,
                name: user.name
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Log activity
        db.run(`INSERT INTO activity_logs (user_id, action, details, ip_address) 
                VALUES (?, ?, ?, ?)`,
            [user.id, 'token_refresh', `Token refreshed for ${user.username}`, req.ip]);

        res.json({ 
            success: true,
            token: newToken,
            user: {
                id: user.id,
                user_id: user.user_id,
                username: user.username,
                name: user.name,
                firstName: user.first_name,
                lastName: user.last_name,
                companyName: user.company_name,
                photoUrl: user.photo_url,
                role: user.role,
                email: user.email,
                center: centerInfo
            }
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ success: false, error: 'Failed to refresh token' });
    }
});

// Logout endpoint (track attendance)
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
        // Blacklist the current token
        if (req.token) {
            tokenBlacklist.add(req.token);
        }
        
        // Track attendance logout
        await trackUserLogout(req.user.id);
        
        // Log activity
        db.run(`INSERT INTO activity_logs (user_id, action, details, ip_address) 
                VALUES (?, ?, ?, ?)`,
            [req.user.id, 'logout', `User ${req.user.username} logged out`, req.ip]);
        
        await SystemLogger.info('auth', 'POST /api/auth/logout', 'User logged out', {
            userId: req.user.id,
            username: req.user.username,
            ip: req.ip
        }, req);
        
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        await SystemLogger.error('auth', 'POST /api/auth/logout', 'Error during logout', {
            error: error.message,
            userId: req.user?.id
        }, req, error);
        res.json({ success: true, message: 'Logged out successfully' }); // Still succeed even if tracking fails
    }
});

// Change password endpoint
app.post('/api/auth/change-password', authenticateToken, passwordChangeValidation, validateInput, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
    }

    // Validate new password strength
    const passwordValidation = SecurityUtils.validatePassword(newPassword);
    if (!passwordValidation.valid) {
        await SystemLogger.warn('auth', 'POST /api/auth/change-password', 'Weak password attempt', {
            userId: req.user.id,
            username: req.user.username,
            errors: passwordValidation.errors
        }, req);
        return res.status(400).json({ 
            error: 'Password does not meet security requirements',
            details: passwordValidation.errors
        });
    }

    // Get current user
    db.get(`SELECT * FROM users WHERE id = ?`, [req.user.id], async (err, user) => {
        if (err) {
            console.error('Database error getting user:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        try {
            // Verify current password
            const validPassword = await bcrypt.compare(currentPassword, user.password);
            if (!validPassword) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }

            // Hash new password with stronger rounds
            const hashedNewPassword = await bcrypt.hash(newPassword, SECURITY_CONFIG.BCRYPT_ROUNDS);
            
            // Blacklist current token to force re-login
            if (req.token) {
                tokenBlacklist.add(req.token);
            }

            // Update password in users table (remove temp_password for security, store current_password for center admin visibility)
            db.run(`UPDATE users SET password = ?, temp_password = NULL, first_login = 0, current_password = ? WHERE id = ?`, 
                [hashedNewPassword, newPassword, req.user.id], 
                function(updateErr) {
                    if (updateErr) {
                        console.error('Error updating password:', updateErr);
                        return res.status(500).json({ error: 'Failed to update password' });
                    }

                    // If user is center admin, also update the centers table
                    if (user.role === 'center_admin' && user.center_id) {
                        db.run(`UPDATE centers SET admin_password = ? WHERE id = ?`, 
                            [newPassword, user.center_id], 
                            function(centerErr) {
                                if (centerErr) {
                                    console.error('Error updating center password:', centerErr);
                                }
                            }
                        );
                    }

                    // Log activity
                    db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
                        [user.id, 'password_change', `Password changed by user`]);

                    res.json({ 
                        success: true, 
                        message: 'Password changed successfully. Please log in again.' 
                    });
                }
            );

        } catch (bcryptError) {
            console.error('Bcrypt error:', bcryptError);
            res.status(500).json({ error: 'Password processing error' });
        }
    });
});

// Get current user info
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = await new Promise((resolve, reject) => {
            db.get(`SELECT id, user_id, username, name, email, role, center_id, first_name, last_name, company_name, photo_url 
                    FROM users WHERE id = ?`, 
                [req.user.id], 
                (err, user) => {
                    if (err) reject(err);
                    else resolve(user);
                }
            );
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get center info if applicable
        let centerInfo = null;
        if (user.center_id) {
            try {
                centerInfo = await new Promise((resolve, reject) => {
                    db.get(`SELECT c.id, c.center_name, c.center_code, camp.campaign_name 
                            FROM centers c 
                            LEFT JOIN campaigns camp ON c.campaign_id = camp.id 
                            WHERE c.id = ?`, 
                        [user.center_id], 
                        (err, center) => {
                            if (err) reject(err);
                            else resolve(center);
                        }
                    );
                });
            } catch (centerError) {
                console.error('Error fetching center info:', centerError);
                centerInfo = null;
            }
        }
        
        res.json({ user: { 
            ...user,
            firstName: user.first_name,
            lastName: user.last_name,
            companyName: user.company_name,
            photoUrl: user.photo_url,
            center: centerInfo
        } });
    } catch (error) {
        console.error('Error in /api/auth/me:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Update user profile
app.put('/api/auth/profile', authenticateToken, upload.single('profilePhoto'), async (req, res) => {
    const { firstName, lastName, companyName } = req.body;
    let photoUrl = null;

    try {
        // Handle file upload if present
        if (req.file) {
            const fileName = `profile_${req.user.id}_${Date.now()}_${req.file.originalname}`;
            const finalPath = path.join(__dirname, 'uploads', fileName);
            
            // Ensure uploads directory exists
            const uploadsDir = path.join(__dirname, 'uploads');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }
            
            // Move uploaded file to final location with proper name
            fs.renameSync(req.file.path, finalPath);
            photoUrl = `/uploads/${fileName}`;
        }

        // Update user profile in database
        const updateFields = [];
        const updateValues = [];

        if (firstName !== undefined) {
            updateFields.push('first_name = ?');
            updateValues.push(firstName);
        }
        if (lastName !== undefined) {
            updateFields.push('last_name = ?');
            updateValues.push(lastName);
        }
        if (companyName !== undefined) {
            updateFields.push('company_name = ?');
            updateValues.push(companyName);
        }
        if (photoUrl) {
            updateFields.push('photo_url = ?');
            updateValues.push(photoUrl);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        updateValues.push(req.user.id);

        db.run(`UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues,
            function(err) {
                if (err) {
                    console.error('Profile update error:', err);
                    return res.status(500).json({ error: 'Failed to update profile' });
                }

                res.json({ 
                    success: true, 
                    message: 'Profile updated successfully',
                    photoUrl: photoUrl
                });
            }
        );
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// =====================================================
// CAMPAIGN MANAGEMENT ENDPOINTS
// =====================================================



// Get all campaigns


// =====================================================
// CENTER MANAGEMENT ENDPOINTS
// =====================================================

// Create new center
app.post('/api/centers', authenticateToken, checkRole(['super_admin']), async (req, res) => {
    try {
        await SystemLogger.info('system', 'POST /api/centers', 'Center creation request received', {
            requestBody: req.body,
            createdBy: req.user.username
        }, req);
        
        console.log('Center creation request received');
        console.log('Request body:', req.body);
        
        const {
            centerName,
            centerCode,
            campaignId,
            country,
            address,
            adminName,
            status
        } = req.body;

        // Validate required fields
        console.log('Validation check:', {
            centerName: !!centerName,
            centerCode: !!centerCode,
            country: !!country,
            adminName: !!adminName,
            address: !!address
        });
        
        if (!centerName || !centerCode || !country || !adminName || !address) {
            console.log('Validation failed - missing fields');
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields' 
            });
        }
        
        console.log('Validation passed - all required fields present');

        // Check if center code already exists
        db.get(`SELECT * FROM centers WHERE center_code = ?`, [centerCode], (err, existing) => {
            if (err) {
                console.error('Error checking center code:', err.message);
                return res.status(500).json({ success: false, error: 'Internal server error' });
            }
            
            if (existing) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Center code already exists' 
                });
            }

            const query = `
                INSERT INTO centers (
                    campaign_id, center_name, center_code, country, address, manager_name,
                    status, created_by, updated_at, admin_password
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
            `;

            db.run(query, [
                campaignId || null, // Use null if campaignId is empty
                centerName,
                centerCode,
                country,
                address,
                adminName,
                status || 'active',
                req.user.id,
                req.body.admin_password // Store the admin password in centers table
            ], async function(err) {
                if (err) {
                    console.error('Error creating center - Database error:', err.message);
                    console.error('Full error:', err);
                    console.error('SQL Query:', query);
                    console.error('Query parameters:', [
                        campaignId || null,
                        centerName,
                        centerCode,
                        country,
                        address,
                        adminName,
                        status || 'active',
                        req.user.id,
                        req.body.admin_password
                    ]);
                    return res.status(500).json({ success: false, error: 'Failed to create center: ' + err.message });
                }

                const centerId = this.lastID;
                
                // Create center admin user account
                try {
                    const { admin_username, admin_password } = req.body;
                    
                    console.log('Creating center admin user account:');
                    console.log('Username:', admin_username);
                    console.log('Password:', admin_password ? '***PROVIDED***' : 'NOT PROVIDED');
                    
                    if (admin_username && admin_password) {
                        // Generate user ID for center admin
                        const timestamp = Date.now().toString().slice(-6);
                        const user_id = `CA${timestamp}`;
                        
                        // Hash the password
                        const hashedPassword = await bcrypt.hash(admin_password, 12);
                        
                        // Create user account
                        db.run(`INSERT INTO users (user_id, username, password, name, email, role, center_id, status, created_by, first_login, temp_password) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [user_id, admin_username, hashedPassword, adminName, req.body.adminEmail || '', 'center_admin', centerId, 'active', req.user.id, 1, admin_password],
                            function(userErr) {
                                if (userErr) {
                                    console.error('Error creating center admin user:', userErr.message);
                                    // Don't fail the center creation, just log the error
                                }
                                console.log('Center admin user created successfully:', admin_username);
                            }
                        );
                    }
                } catch (userCreationError) {
                    console.error('Error in center admin user creation:', userCreationError);
                }

                // Create campaign assignment if campaignId is provided
                if (campaignId) {
                    db.run(`INSERT INTO campaign_center_assignments (campaign_id, center_id, center_commission, assigned_date, status) 
                            VALUES (?, ?, ?, datetime('now'), 'active')`,
                        [campaignId, centerId, 0.00],
                        function(assignmentErr) {
                            if (assignmentErr) {
                                console.error('Error creating campaign assignment:', assignmentErr.message);
                                // Don't fail the center creation, just log the error
                            } else {
                                console.log('Campaign assignment created successfully for center:', centerId, 'campaign:', campaignId);
                            }
                        }
                    );
                }

                res.status(201).json({
                    success: true,
                    centerId: centerId,
                    message: 'Center created successfully'
                });
            });
        });
    } catch (error) {
        console.error('Unexpected error in center creation:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Get centers (filtered by role)
app.get('/api/centers', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const query = `
        SELECT c.*, camp.campaign_name
        FROM centers c
        LEFT JOIN campaigns camp ON c.campaign_id = camp.id
        WHERE c.status != 'deleted'
        ORDER BY c.created_at DESC
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching centers:', err.message);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
        res.json(rows);
    });
});

// PUT /api/centers/:id - Update center
app.put('/api/centers/:id', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const centerId = req.params.id;
    const {
        centerName,
        centerCode,
        campaignId,
        country,
        address,
        adminName,
        status
    } = req.body;

    // Validate required fields
    if (!centerName || !centerCode || !campaignId || !country || !adminName || !address) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields' 
        });
    }

    // Check if center code already exists (excluding current center, check both old and new columns)
    db.get(`SELECT * FROM centers WHERE (center_code = ? OR code = ?) AND id != ?`, [centerCode, centerCode, centerId], (err, existing) => {
        if (err) {
            console.error('Error checking center code:', err.message);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
        
        if (existing) {
            return res.status(400).json({ 
                success: false, 
                error: 'Center code already exists' 
            });
        }

        const query = `
            UPDATE centers SET
                campaign_id = ?, center_name = ?, center_code = ?, name = ?, code = ?, country = ?, address = ?, manager_name = ?,
                status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;

        db.run(query, [
            campaignId,
            centerName,
            centerCode,
            centerName, // Also update old 'name' column for backward compatibility
            centerCode, // Also update old 'code' column for backward compatibility
            country,
            address,
            adminName,
            status || 'active',
            centerId
        ], function(err) {
            if (err) {
                console.error('Error updating center:', err.message);
                return res.status(500).json({ success: false, error: 'Failed to update center' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ success: false, error: 'Center not found' });
            }

            res.json({
                success: true,
                message: 'Center updated successfully'
            });
        });
    });
});

// DELETE /api/centers/:id - Soft delete center
app.delete('/api/centers/:id', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const centerId = req.params.id;

    db.run(`UPDATE centers SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [centerId], function(err) {
        if (err) {
            console.error('Error deleting center:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to delete center' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'Center not found' });
        }

        res.json({
            success: true,
            message: 'Center deleted successfully'
        });
    });
});

// POST /api/centers/:id/admin - Create center admin
app.post('/api/centers/:id/admin', authenticateToken, checkRole(['super_admin']), async (req, res) => {
    const centerId = req.params.id;
    const { username, email, password } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
        return res.status(400).json({ 
            success: false, 
            error: 'Username, email, and password are required' 
        });
    }

    // Check if username already exists
    db.get(`SELECT * FROM centers WHERE admin_username = ? AND id != ?`, [username, centerId], async (err, existing) => {
        if (err) {
            console.error('Error checking username:', err.message);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }

        if (existing) {
            return res.status(400).json({ 
                success: false, 
                error: 'Username already exists' 
            });
        }

        try {
            // Hash password
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Update center with admin details
            const query = `
                UPDATE centers SET
                    admin_username = ?, admin_email = ?, admin_password_hash = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;

            db.run(query, [username, email, hashedPassword, centerId], function(err) {
                if (err) {
                    console.error('Error creating center admin:', err.message);
                    return res.status(500).json({ success: false, error: 'Failed to create admin' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ success: false, error: 'Center not found' });
                }

                res.json({
                    success: true,
                    message: 'Center admin created successfully',
                    admin: {
                        username,
                        email
                    }
                });
            });
        } catch (error) {
            console.error('Error hashing password:', error);
            return res.status(500).json({ success: false, error: 'Failed to create admin' });
        }
    });
});

// PUT /api/centers/:id/admin - Update center admin
app.put('/api/centers/:id/admin', authenticateToken, checkRole(['super_admin']), async (req, res) => {
    const centerId = req.params.id;
    const { username, email, password } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
        return res.status(400).json({ 
            success: false, 
            error: 'Username, email, and password are required' 
        });
    }

    // Check if username already exists (excluding current center)
    db.get(`SELECT * FROM centers WHERE admin_username = ? AND id != ?`, [username, centerId], async (err, existing) => {
        if (err) {
            console.error('Error checking username:', err.message);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }

        if (existing) {
            return res.status(400).json({ 
                success: false, 
                error: 'Username already exists' 
            });
        }

        try {
            // Hash password
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Update center with admin details
            const query = `
                UPDATE centers SET
                    admin_username = ?, admin_email = ?, admin_password_hash = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;

            db.run(query, [username, email, hashedPassword, centerId], function(err) {
                if (err) {
                    console.error('Error updating center admin:', err.message);
                    return res.status(500).json({ success: false, error: 'Failed to update admin' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ success: false, error: 'Center not found' });
                }

                res.json({
                    success: true,
                    message: 'Center admin updated successfully',
                    admin: {
                        username,
                        email
                    }
                });
            });
        } catch (error) {
            console.error('Error hashing password:', error);
            return res.status(500).json({ success: false, error: 'Failed to update admin' });
        }
    });
});

// =====================================================
// USER MANAGEMENT ENDPOINTS
// =====================================================

// Create new user
app.post('/api/users', authenticateToken, async (req, res) => {
    const { username, password, name, email, phone, role, center_id, vici_user } = req.body;

    // Check permissions
    if (req.user.role === 'center_admin') {
        if (role !== 'agent' || center_id != req.user.center_id) {
            return res.status(403).json({ error: 'Center admins can only create agents for their center' });
        }
    } else if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Generate user ID based on role
    const prefix = role === 'super_admin' ? 'SA' : 
                   role === 'center_admin' ? 'CA' : 
                   role === 'qa' ? 'QA' : 
                   role === 'client' ? 'CL' : 'AG';
    const timestamp = Date.now().toString().slice(-6);
    const user_id = `${prefix}${timestamp}`;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(`INSERT INTO users (user_id, username, password, name, email, phone, role, center_id, vici_user, created_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [user_id, username, hashedPassword, name, email, phone, role, center_id, vici_user, req.user.id],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ error: 'Username already exists' });
                }
                return res.status(500).json({ error: 'Failed to create user' });
            }
            
            res.json({ 
                success: true,
                id: this.lastID,
                user_id: user_id,
                message: 'User created successfully' 
            });
        }
    );
});

// Get users (filtered by role and center)
app.get('/api/users', authenticateToken, (req, res) => {
    let query = `SELECT u.id, u.user_id, u.username, u.name, u.email, u.phone, 
                        u.role, u.center_id, u.status, u.last_login, u.created_at,
                        c.name as center_name
                 FROM users u
                 LEFT JOIN centers c ON u.center_id = c.id
                 WHERE 1=1`;
    const params = [];

    // Apply role-based filters
    if (req.user.role === 'center_admin') {
        query += ` AND u.center_id = ? AND u.role = 'agent'`;
        params.push(req.user.center_id);
    } else if (req.user.role === 'agent') {
        query += ` AND u.id = ?`;
        params.push(req.user.id);
    } else if (req.user.role === 'client') {
        // Clients can only see their own profile
        query += ` AND u.id = ?`;
        params.push(req.user.id);
    }

    // Additional filters
    if (req.query.role) {
        query += ` AND u.role = ?`;
        params.push(req.query.role);
    }

    if (req.query.center_id) {
        query += ` AND u.center_id = ?`;
        params.push(req.query.center_id);
    }

    db.all(query, params, (err, users) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch users' });
        res.json(users);
    });
});

// VERTEX CRM - Lead Management & Validation APIs
// Add this to your server.js file after the User Management section

// =====================================================
// PHONE/EMAIL VALIDATION SYSTEM
// =====================================================

// Validate phone against all APIs
async function validatePhoneComplete(phone, agentId, centerId) {
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Validate phone number format (must be 10 digits for US numbers)
    if (cleanPhone.length !== 10) {
        console.log(`Phone validation failed: ${cleanPhone} has ${cleanPhone.length} digits, expected 10`);
        return {
            allowed: false,
            reason: `Invalid phone format: ${cleanPhone.length} digits (expected 10)`,
            logId: null
        };
    }
    
    const validationLog = {
        phone: cleanPhone,
        agent_id: agentId,
        center_id: centerId,
        validation_date: new Date().toISOString()
    };
    
    try {
        // 1. Check internal suppression first (fastest)
        const suppressed = await checkInternalSuppression(cleanPhone);
        if (suppressed) {
            validationLog.validation_passed = false;
            validationLog.denial_reason = `Internal Suppression: ${suppressed.reason}`;
            await saveValidationLog(validationLog);
            return {
                allowed: false,
                reason: validationLog.denial_reason,
                logId: validationLog.id
            };
        }
        
        // 2. Check Blacklist Alliance (Litigators)
        const blacklistApiKey = 'etNBbwu77EeZ2Xn8vZn2';
        if (blacklistApiKey) {
            try {
                console.log(`Checking phone ${cleanPhone} against first blacklist API`);
                const blacklistResponse = await fetch(`https://api.blacklistalliance.net/lookup?key=${blacklistApiKey}&ver=v1&resp=json&phone=${cleanPhone}`, {
                    method: 'GET'
                });
                
                const blacklistData = await blacklistResponse.json();
                console.log('Blacklist1 API Response:', blacklistData);
                validationLog.blacklist_status = blacklistData.status || 'error';
                validationLog.blacklist_message = blacklistData.message || '';
                validationLog.blacklist_results = blacklistData.results || -1;
                validationLog.blacklist_raw_response = JSON.stringify(blacklistData);
                
                // If blacklisted (results > 0 means found in blacklist)
                if (blacklistData.results > 0) {
                    validationLog.validation_passed = false;
                    validationLog.denial_reason = 'Blacklisted - Litigator Risk';
                    await saveValidationLog(validationLog);
                    await addToSuppression(cleanPhone, validationLog.denial_reason, centerId);
                    
                    // Track scrub usage (only if centerId is valid)
                    if (centerId) {
                        await trackScrubUsage(centerId, 'blacklist');
                    }
                    
                    return {
                        allowed: false,
                        reason: validationLog.denial_reason,
                        logId: validationLog.id
                    };
                }
            } catch (error) {
                console.error('Blacklist API error:', error);
                // Log the error but don't fail validation due to API issues
                validationLog.blacklist_status = 'api_error';
                validationLog.blacklist_message = error.message;
            }
        }
        
        // 3. Check Second Blacklist API (same endpoint, different key)
        // API Key: NJycTUgrrpDdHua67TTX
        // Blocks anything that doesn't contain: success, clean, or good
        const blacklist2ApiKey = 'NJycTUgrrpDdHua67TTX';
        if (blacklist2ApiKey) {
            try {
                console.log(`Checking phone ${cleanPhone} against second blacklist API`);
                // Using same API endpoint as first blacklist, just different key
                const blacklist2Response = await fetch(`https://api.blacklistalliance.net/lookup?key=${blacklist2ApiKey}&ver=v1&resp=json&phone=${cleanPhone}`, {
                    method: 'GET'
                });
                
                const blacklist2Data = await blacklist2Response.json();
                console.log('Blacklist2 API Response:', blacklist2Data);
                
                validationLog.blacklist2_status = blacklist2Data.status || 'error';
                validationLog.blacklist2_message = blacklist2Data.message || '';
                validationLog.blacklist2_raw_response = JSON.stringify(blacklist2Data);
                
                // SIMPLE LOGIC: Block if message is NOT "Good" or "Clean" (case insensitive)
                const message = (blacklist2Data.message || '').toLowerCase();
                
                console.log(`Blacklist2 validation - Message: "${message}"`);
                
                // Only allow if message is exactly "good" or "clean"
                const isAllowed = message === 'good' || message === 'clean';
                
                console.log(`Blacklist2 validation result: ${isAllowed ? 'ALLOWED' : 'BLOCKED'}`);
                
                // Block if message is anything other than "good" or "clean"
                if (!isAllowed) {
                    validationLog.validation_passed = false;
                    validationLog.denial_reason = `Blacklist2 - Status: ${blacklist2Data.status || 'Unknown'}, Message: ${blacklist2Data.message || 'No message'}`;
                    await saveValidationLog(validationLog);
                    await addToSuppression(cleanPhone, validationLog.denial_reason, centerId);
                    
                    // Track scrub usage (only if centerId is valid)
                    if (centerId) {
                        await trackScrubUsage(centerId, 'blacklist');
                    }
                    
                    return {
                        allowed: false,
                        reason: validationLog.denial_reason,
                        logId: validationLog.id
                    };
                }
            } catch (error) {
                console.error('Blacklist2 API error:', error);
                // Log the error but don't fail validation due to API issues
                validationLog.blacklist2_status = 'api_error';
                validationLog.blacklist2_message = error.message;
            }
        }
        
        // 4. Check TCPA (DNC + Litigators)
        if (process.env.TCPA_USERNAME && process.env.TCPA_PASSWORD) {
            try {
                const tcpaAuth = Buffer.from(`${process.env.TCPA_USERNAME}:${process.env.TCPA_PASSWORD}`).toString('base64');
                // Use the exact format from the PHP example
                const tcpaFormData = new URLSearchParams();
                tcpaFormData.append('type[]', 'tcpa');
                tcpaFormData.append('type[]', 'dnc_state');
                tcpaFormData.append('type[]', 'dnc_fed');
                tcpaFormData.append('type[]', 'dnc_complainers');
                tcpaFormData.append('phone_number', cleanPhone);
                tcpaFormData.append('contact_name', 'John');
                
                const tcpaResponse = await fetch('https://api.tcpalitigatorlist.com/scrub/phone/', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Basic ${tcpaAuth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: tcpaFormData
                });
                
                const tcpaData = await tcpaResponse.json();
                console.log('TCPA API Response:', JSON.stringify(tcpaData, null, 2));
                
                // TCPA API returns clean:1 for clean numbers, clean:0 for dirty numbers
                if (tcpaData.results?.clean === 0 || tcpaData.results?.is_bad_number === true) {
                    // Check for specific DNC status
                    const statusArray = tcpaData.results?.status_array || [];
                    const matchType = tcpaData.match?.[cleanPhone]?.type || '';
                    const status = tcpaData.results?.status || '';
                    
                    if (statusArray.includes('dnc_complainers') || matchType.includes('DNC') || status.includes('DNC')) {
                        validationLog.tcpa_status = status || matchType || 'DNC';
                    } else {
                        validationLog.tcpa_status = 'dirty';
                    }
                } else if (tcpaData.results?.clean === 1) {
                    validationLog.tcpa_status = 'clean';
                } else {
                    validationLog.tcpa_status = 'error';
                }
                
                validationLog.tcpa_federal_dnc = tcpaData.results?.status_array?.includes('dnc_complainers') || false;
                validationLog.tcpa_state_dnc = JSON.stringify(tcpaData.results?.status_array || []);
                validationLog.tcpa_raw_response = JSON.stringify(tcpaData);
                
                // If not clean (clean=0 means not clean, clean=1 means clean)
                if (tcpaData.results?.clean === 0) {
                    const reasons = [];
                    if (tcpaData.results?.status_array) {
                        tcpaData.results.status_array.forEach(status => {
                            if (status === 'dnc_complainers') reasons.push('DNC Complainers');
                            else if (status === 'federal_dnc') reasons.push('Federal DNC');
                            else if (status === 'state_dnc') reasons.push('State DNC');
                            else if (status === 'tcpa_litigator') reasons.push('TCPA Litigator');
                            else reasons.push(status.replace('_', ' ').toUpperCase());
                        });
                    }
                    
                    validationLog.validation_passed = false;
                    validationLog.denial_reason = reasons.join(' | ');
                    await saveValidationLog(validationLog);
                    await addToSuppression(cleanPhone, validationLog.denial_reason, centerId);
                    
                    // Track scrub usage (only if centerId is valid)
                    if (centerId) {
                        await trackScrubUsage(centerId, 'tcpa');
                    }
                    
                    return {
                        allowed: false,
                        reason: validationLog.denial_reason,
                        logId: validationLog.id
                    };
                }
            } catch (error) {
                console.error('TCPA API error:', error);
                // Log the error but don't fail validation due to API issues
                validationLog.tcpa_status = 'api_error';
                validationLog.tcpa_raw_response = error.message;
            }
        }
        
        // All validations passed
        validationLog.validation_passed = true;
        await saveValidationLog(validationLog);
        
        // Track successful scrub (only if centerId is valid)
        if (centerId) {
            await trackScrubUsage(centerId, 'blacklist');
            await trackScrubUsage(centerId, 'tcpa');
        }
        
        return {
            allowed: true,
            reason: null,
            logId: validationLog.id
        };
        
    } catch (error) {
        console.error('Validation error:', error);
        validationLog.validation_passed = false;
        validationLog.denial_reason = `System Error: ${error.message}`;
        await saveValidationLog(validationLog);
        
        return {
            allowed: false,
            reason: 'Validation service unavailable',
            logId: validationLog.id
        };
    }
}

// Check internal suppression list
function checkInternalSuppression(phone) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM suppression_list 
                WHERE phone = ? 
                AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
            [phone],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
}

// Add to suppression list
function addToSuppression(phone, reason, centerId) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT OR IGNORE INTO suppression_list (phone, reason, source, center_id, date_added) 
                VALUES (?, ?, 'API Validation', ?, CURRENT_TIMESTAMP)`,
            [phone, reason, centerId],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

// Helper function to check client suppression
const checkClientSuppression = async (phone, campaignId) => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT cs.*, su.filename, su.uploaded_at, u.first_name, u.last_name
            FROM campaign_suppression cs
            LEFT JOIN suppression_uploads su ON cs.upload_batch_id = su.batch_id
            LEFT JOIN users u ON cs.uploaded_by = u.id
            WHERE cs.campaign_id = ? AND cs.phone = ?
            LIMIT 1
        `;
        
        db.get(query, [campaignId, phone], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// Helper function to check for phone duplicates across all campaigns
const checkCampaignDuplicate = async (phone, campaignId) => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT 
                ls.id, ls.phone, ls.created_at, ls.center_id, ls.agent_id,
                c.name as center_name, c.code as center_code,
                u.first_name, u.last_name, u.username,
                lf.name as form_name,
                camp.campaign_name
            FROM lead_submissions ls
            LEFT JOIN centers c ON ls.center_id = c.id
            LEFT JOIN users u ON ls.agent_id = u.id
            LEFT JOIN lead_forms lf ON ls.form_id = lf.id
            LEFT JOIN campaigns camp ON lf.campaign_id = camp.id
            WHERE ls.phone = ?
            ORDER BY ls.created_at ASC
            LIMIT 1
        `;
        
        db.get(query, [phone], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// Save validation log
function saveValidationLog(log) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO validation_logs 
                (phone, validation_date, blacklist_status, blacklist_message, blacklist_results,
                 blacklist_raw_response, blacklist2_status, blacklist2_message, blacklist2_raw_response,
                 tcpa_status, tcpa_federal_dnc, tcpa_state_dnc, tcpa_raw_response, 
                 validation_passed, denial_reason, agent_id, center_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                log.phone, log.validation_date, log.blacklist_status, log.blacklist_message,
                log.blacklist_results, log.blacklist_raw_response, log.blacklist2_status,
                log.blacklist2_message, log.blacklist2_raw_response, log.tcpa_status,
                log.tcpa_federal_dnc, log.tcpa_state_dnc, log.tcpa_raw_response,
                log.validation_passed, log.denial_reason, log.agent_id, log.center_id
            ],
            function(err) {
                if (err) reject(err);
                else {
                    log.id = this.lastID;
                    resolve(log);
                }
            }
        );
    });
}

// Save validation failure (new function for pre-pitch validation failures)
function saveValidationFailure(failure) {
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO validation_failures 
                (phone, zipcode, agent_id, center_id, campaign_id, validation_type, failure_reason,
                 phone_status, zipcode_status, blacklist_status, blacklist_message, blacklist2_status,
                 blacklist2_message, tcpa_status, tcpa_message, duplicate_details, validation_details, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                failure.phone, failure.zipcode, failure.agent_id, failure.center_id, failure.campaign_id,
                failure.validation_type, failure.failure_reason, failure.phone_status, failure.zipcode_status,
                failure.blacklist_status, failure.blacklist_message, failure.blacklist2_status,
                failure.blacklist2_message, failure.tcpa_status, failure.tcpa_message,
                failure.duplicate_details, failure.validation_details, failure.notes
            ],
            function(err) {
                if (err) reject(err);
                else {
                    failure.id = this.lastID;
                    resolve(failure);
                }
            }
        );
    });
}

// Track user login session
function trackUserLogin(userId, ipAddress, userAgent) {
    return new Promise((resolve, reject) => {
        // First, close any existing active sessions for this user
        db.run(`UPDATE attendance_sessions 
                SET logout_time = CURRENT_TIMESTAMP, 
                    session_duration = ROUND((julianday(CURRENT_TIMESTAMP) - julianday(login_time)) * 24 * 60),
                    is_active = 0 
                WHERE user_id = ? AND is_active = 1`, [userId], (err) => {
            if (err) {
                console.error('Error closing previous sessions:', err);
            }
            
            // Create new login session
            db.run(`INSERT INTO attendance_sessions (user_id, ip_address, user_agent) 
                    VALUES (?, ?, ?)`, [userId, ipAddress, userAgent], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    });
}

// Track user logout
function trackUserLogout(userId) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE attendance_sessions 
                SET logout_time = CURRENT_TIMESTAMP, 
                    session_duration = ROUND((julianday(CURRENT_TIMESTAMP) - julianday(login_time)) * 24 * 60),
                    is_active = 0 
                WHERE user_id = ? AND is_active = 1`, [userId], function(err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// Track scrub usage for billing
function trackScrubUsage(centerId, scrubType) {
    const today = new Date().toISOString().split('T')[0];
    const column = scrubType + '_scrubs';
    
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO scrub_usage (center_id, date, ${column})
                VALUES (?, ?, 1)
                ON CONFLICT(center_id, date) 
                DO UPDATE SET ${column} = ${column} + 1`,
            [centerId, today],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
}

// Email validation
function validateEmailFormat(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const commonTypos = {
        'gmial.com': 'gmail.com',
        'gmai.com': 'gmail.com',
        'yahooo.com': 'yahoo.com',
        'hotmial.com': 'hotmail.com',
        'outlok.com': 'outlook.com'
    };
    
    if (!emailRegex.test(email)) {
        return { valid: false, reason: 'Invalid email format' };
    }
    
    const domain = email.split('@')[1].toLowerCase();
    if (commonTypos[domain]) {
        return { 
            valid: false, 
            reason: 'Possible typo',
            suggestion: email.replace(domain, commonTypos[domain])
        };
    }
    
    return { valid: true };
}

// =====================================================
// LEAD MANAGEMENT ENDPOINTS
// =====================================================

// Create new lead (Agent endpoint)
app.post('/api/leads', authenticateToken, checkRole(['agent', 'super_admin']), async (req, res) => {
    const { customer_name, phone, email, interest_level, lead_source, custom_data, campaign_id, center_id } = req.body;
    
    // Validate required fields
    if (!customer_name || !phone) {
        return res.status(400).json({ error: 'Name and phone are required' });
    }
    
    // For phone validation, we need to determine center_id first
    let validationCenterId = req.user.center_id;
    if (req.user.role === 'super_admin') {
        // Use provided center_id or get first available center for validation
        if (center_id) {
            validationCenterId = center_id;
        } else {
            const firstCenter = await new Promise((resolve, reject) => {
                db.get('SELECT id FROM centers LIMIT 1', (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            validationCenterId = firstCenter ? firstCenter.id : null;
        }
    }
    
    // Validate phone number
    const phoneValidation = await validatePhoneComplete(phone, req.user.id, validationCenterId);
    if (!phoneValidation.allowed) {
        return res.status(400).json({ 
            error: 'Phone validation failed',
            reason: phoneValidation.reason,
            validationLogId: phoneValidation.logId
        });
    }
    
    // Validate email if provided
    if (email) {
        const emailValidation = validateEmailFormat(email);
        if (!emailValidation.valid) {
            return res.status(400).json({ 
                error: 'Email validation failed',
                reason: emailValidation.reason,
                suggestion: emailValidation.suggestion
            });
        }
    }
    
    // Get campaign_id and center_id
    let finalCenterId, finalCampaignId;
    
    if (req.user.role === 'super_admin') {
        // Super admin can specify center_id and campaign_id in request body
        if (center_id && campaign_id) {
            finalCenterId = center_id;
            finalCampaignId = campaign_id;
            
            // Verify the center exists and belongs to the campaign
            const centerExists = await new Promise((resolve, reject) => {
                db.get('SELECT id FROM centers WHERE id = ? AND campaign_id = ?', 
                    [center_id, campaign_id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (!centerExists) {
                return res.status(400).json({ error: 'Invalid center_id or campaign_id combination' });
            }
        } else {
            // Use the first available center if not specified
            const firstCenter = await new Promise((resolve, reject) => {
                db.get('SELECT id, campaign_id FROM centers LIMIT 1', (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (!firstCenter) {
                return res.status(400).json({ 
                    error: 'No centers available. Please create a campaign and center first, or specify center_id and campaign_id in the request.' 
                });
            }
            
            finalCenterId = firstCenter.id;
            finalCampaignId = firstCenter.campaign_id;
        }
    } else {
        // Regular agent uses their assigned center
        if (!req.user.center_id) {
            return res.status(400).json({ error: 'User not assigned to any center' });
        }
        
        const center = await new Promise((resolve, reject) => {
            db.get('SELECT campaign_id FROM centers WHERE id = ?', [req.user.center_id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!center) {
            return res.status(400).json({ error: 'User center not found' });
        }
        
        finalCenterId = req.user.center_id;
        finalCampaignId = center.campaign_id;
    }
    
    // Check for duplicate lead (same phone in last 30 days)
    const duplicate = await new Promise((resolve, reject) => {
        db.get(`SELECT * FROM leads 
                WHERE phone = ? 
                AND campaign_id = ?
                AND DATE(created_at) >= DATE('now', '-30 days')`,
            [phone.replace(/\D/g, ''), finalCampaignId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
    
    if (duplicate) {
        return res.status(400).json({ 
            error: 'Duplicate lead',
            reason: 'This phone number was already submitted in the last 30 days'
        });
    }
    
    // Create lead
    db.run(`INSERT INTO leads 
            (campaign_id, center_id, agent_id, customer_name, phone, email, 
             interest_level, lead_source, custom_data, consent_given, consent_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
            finalCampaignId,
            finalCenterId,
            req.user.id,
            customer_name,
            phone.replace(/\D/g, ''),
            email || null,
            interest_level || 'Warm',
            lead_source || 'call',
            JSON.stringify(custom_data || {})
        ],
        function(err) {
            if (err) {
                console.error('Lead creation error:', err);
                return res.status(500).json({ error: 'Failed to create lead' });
            }
            
            // Log activity
            db.run(`INSERT INTO activity_logs (user_id, action, details) 
                    VALUES (?, ?, ?)`,
                [req.user.id, 'lead_created', `Created lead for ${customer_name}`]);
            
            res.json({ 
                success: true,
                id: this.lastID,
                message: 'Lead created successfully'
            });
        }
    );
});

// Get leads (filtered by role)
app.get('/api/leads', authenticateToken, (req, res) => {
    let query = `SELECT l.*, 
                        u.name as agent_name, 
                        u.user_id as agent_code,
                        c.name as center_name,
                        camp.name as campaign_name
                 FROM leads l
                 JOIN users u ON l.agent_id = u.id
                 JOIN centers c ON l.center_id = c.id
                 JOIN campaigns camp ON l.campaign_id = camp.id
                 WHERE 1=1`;
    const params = [];
    
    // Role-based filtering
    if (req.user.role === 'agent') {
        query += ` AND l.agent_id = ?`;
        params.push(req.user.id);
    } else if (req.user.role === 'center_admin') {
        query += ` AND l.center_id = ?`;
        params.push(req.user.center_id);
    }
    
    // Additional filters
    if (req.query.campaign_id) {
        query += ` AND l.campaign_id = ?`;
        params.push(req.query.campaign_id);
    }
    
    if (req.query.center_id) {
        query += ` AND l.center_id = ?`;
        params.push(req.query.center_id);
    }
    
    if (req.query.date_from) {
        query += ` AND DATE(l.created_at) >= ?`;
        params.push(req.query.date_from);
    }
    
    if (req.query.date_to) {
        query += ` AND DATE(l.created_at) <= ?`;
        params.push(req.query.date_to);
    }
    
    if (req.query.status) {
        query += ` AND l.status = ?`;
        params.push(req.query.status);
    }
    
    // Add ordering and limit
    query += ` ORDER BY l.created_at DESC LIMIT 1000`;
    
    db.all(query, params, (err, leads) => {
        if (err) {
            console.error('Error fetching leads:', err);
            return res.status(500).json({ error: 'Failed to fetch leads' });
        }
        
        // Parse custom_data JSON
        leads = leads.map(lead => ({
            ...lead,
            custom_data: JSON.parse(lead.custom_data || '{}')
        }));
        
        res.json(leads);
    });
});

// Validate phone endpoint (for real-time validation)
app.post('/api/validate/phone', authenticateToken, async (req, res) => {
    const { phone } = req.body;
    
    if (!phone) {
        return res.status(400).json({ error: 'Phone number required' });
    }
    
    const validation = await validatePhoneComplete(phone, req.user.id, req.user.center_id);
    
    res.json({
        valid: validation.allowed,
        reason: validation.reason,
        validationId: validation.logId
    });
});

// Validate email endpoint
app.post('/api/validate/email', authenticateToken, (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email required' });
    }
    
    const validation = validateEmailFormat(email);
    
    res.json({
        valid: validation.valid,
        reason: validation.reason,
        suggestion: validation.suggestion
    });
});

// Get suppression list
app.get('/api/suppression', authenticateToken, checkRole(['super_admin', 'center_admin']), (req, res) => {
    let query = `SELECT s.*, c.name as center_name, u.name as added_by_name
                 FROM suppression_list s
                 LEFT JOIN centers c ON s.center_id = c.id
                 LEFT JOIN users u ON s.added_by = u.id
                 WHERE 1=1`;
    const params = [];
    
    if (req.user.role === 'center_admin') {
        query += ` AND s.center_id = ?`;
        params.push(req.user.center_id);
    }
    
    if (req.query.phone) {
        query += ` AND s.phone LIKE ?`;
        params.push(`%${req.query.phone}%`);
    }
    
    query += ` ORDER BY s.date_added DESC LIMIT 1000`;
    
    db.all(query, params, (err, suppressions) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch suppression list' });
        res.json(suppressions);
    });
});

// Add to suppression list manually
app.post('/api/suppression', authenticateToken, checkRole(['super_admin', 'center_admin']), (req, res) => {
    const { phone, reason, expires_at } = req.body;
    
    if (!phone || !reason) {
        return res.status(400).json({ error: 'Phone and reason are required' });
    }
    
    const cleanPhone = phone.replace(/\D/g, '');
    
    db.run(`INSERT OR REPLACE INTO suppression_list 
            (phone, reason, source, added_by, center_id, expires_at)
            VALUES (?, ?, 'Manual', ?, ?, ?)`,
        [cleanPhone, reason, req.user.id, req.user.center_id, expires_at || null],
        function(err) {
            if (err) return res.status(500).json({ error: 'Failed to add to suppression list' });
            
            res.json({
                success: true,
                id: this.lastID,
                message: 'Added to suppression list'
            });
        }
    );
});

// Remove from suppression list
app.delete('/api/suppression/:id', authenticateToken, checkRole(['super_admin']), (req, res) => {
    db.run('DELETE FROM suppression_list WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: 'Failed to remove from suppression list' });
        
        res.json({
            success: true,
            message: 'Removed from suppression list'
        });
    });
});

// Get validation failures (Admin-only endpoint for pre-pitch validation failures)
app.get('/api/validation-failures', authenticateToken, checkRole(['super_admin', 'center_admin']), (req, res) => {
    const { campaign_id, center_id, start_date, end_date, validation_type, phone_status } = req.query;
    const userRole = req.user.role;
    const userCenterId = req.user.center_id;

    let whereConditions = [];
    let params = [];

    // Role-based access control
    if (userRole === 'center_admin') {
        whereConditions.push('vf.center_id = ?');
        params.push(userCenterId);
    } else if (center_id) {
        whereConditions.push('vf.center_id = ?');
        params.push(center_id);
    }

    // Additional filters
    if (campaign_id) {
        whereConditions.push('vf.campaign_id = ?');
        params.push(campaign_id);
    }
    if (start_date) {
        whereConditions.push('DATE(vf.checked_at) >= ?');
        params.push(start_date);
    }
    if (end_date) {
        whereConditions.push('DATE(vf.checked_at) <= ?');
        params.push(end_date);
    }
    if (validation_type) {
        whereConditions.push('vf.validation_type = ?');
        params.push(validation_type);
    }
    if (phone_status) {
        whereConditions.push('vf.phone_status = ?');
        params.push(phone_status);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const query = `
        SELECT 
            vf.*,
            u.first_name as agent_first_name,
            u.last_name as agent_last_name,
            u.username as agent_username,
            c.name as center_name,
            c.code as center_code,
            camp.campaign_name
        FROM validation_failures vf
        LEFT JOIN users u ON vf.agent_id = u.id
        LEFT JOIN centers c ON vf.center_id = c.id
        LEFT JOIN campaigns camp ON vf.campaign_id = camp.id
        ${whereClause}
        ORDER BY vf.checked_at DESC
        LIMIT 1000
    `;

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching validation failures:', err);
            return res.status(500).json({ success: false, error: 'Failed to fetch validation failures' });
        }

        // Parse JSON fields
        const failures = rows.map(row => ({
            ...row,
            duplicate_details: row.duplicate_details ? JSON.parse(row.duplicate_details) : null,
            validation_details: row.validation_details ? JSON.parse(row.validation_details) : null,
            agent_info: {
                id: row.agent_id,
                name: `${row.agent_first_name || ''} ${row.agent_last_name || ''}`.trim(),
                username: row.agent_username
            }
        }));

        res.json({ success: true, data: failures });
    });
});

// Get validation logs
app.get('/api/validation-logs', authenticateToken, checkRole(['super_admin', 'center_admin']), (req, res) => {
    let query = `SELECT vl.*, u.name as agent_name, c.name as center_name
                 FROM validation_logs vl
                 LEFT JOIN users u ON vl.agent_id = u.id
                 LEFT JOIN centers c ON vl.center_id = c.id
                 WHERE 1=1`;
    const params = [];
    
    if (req.user.role === 'center_admin') {
        query += ` AND vl.center_id = ?`;
        params.push(req.user.center_id);
    }
    
    if (req.query.date_from) {
        query += ` AND DATE(vl.validation_date) >= ?`;
        params.push(req.query.date_from);
    }
    
    if (req.query.date_to) {
        query += ` AND DATE(vl.validation_date) <= ?`;
        params.push(req.query.date_to);
    }
    
    if (req.query.passed !== undefined) {
        query += ` AND vl.validation_passed = ?`;
        params.push(req.query.passed === 'true' ? 1 : 0);
    }
    
    query += ` ORDER BY vl.validation_date DESC LIMIT 1000`;
    
    db.all(query, params, (err, logs) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch validation logs' });
        
        // Parse JSON fields
        logs = logs.map(log => ({
            ...log,
            blacklist_raw_response: JSON.parse(log.blacklist_raw_response || '{}'),
            tcpa_raw_response: JSON.parse(log.tcpa_raw_response || '{}'),
            tcpa_state_dnc: JSON.parse(log.tcpa_state_dnc || '[]')
        }));
        
        res.json(logs);
    });
});

// Get scrub usage report
app.get('/api/scrubs/usage', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const { month } = req.query; // Format: '2024-01'
    
    let query = `SELECT c.name as center_name,
                        SUM(su.blacklist_scrubs) as total_blacklist,
                        SUM(su.tcpa_scrubs) as total_tcpa,
                        SUM(su.dnc_scrubs) as total_dnc,
                        SUM(su.total_cost) as total_cost
                 FROM scrub_usage su
                 JOIN centers c ON su.center_id = c.id
                 WHERE 1=1`;
    const params = [];
    
    if (month) {
        query += ` AND strftime('%Y-%m', su.date) = ?`;
        params.push(month);
    }
    
    query += ` GROUP BY su.center_id ORDER BY total_cost DESC`;
    
    db.all(query, params, (err, usage) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch scrub usage' });
        
        // Calculate totals and tier info
        const totalBlacklistScrubs = usage.reduce((sum, r) => sum + (r.total_blacklist || 0), 0);
        const totalTcpaScrubs = usage.reduce((sum, r) => sum + (r.total_tcpa || 0), 0);
        
        // Blacklist Alliance pricing tiers
        let blacklistTier, blacklistCost;
        if (totalBlacklistScrubs <= 500000) {
            blacklistTier = 'Basic';
            blacklistCost = 549;
        } else if (totalBlacklistScrubs <= 1200000) {
            blacklistTier = 'Pro';
            blacklistCost = 1000;
        } else {
            blacklistTier = 'Enterprise';
            blacklistCost = totalBlacklistScrubs * 0.001; // Custom pricing
        }
        
        res.json({
            usage,
            summary: {
                total_blacklist_scrubs: totalBlacklistScrubs,
                total_tcpa_scrubs: totalTcpaScrubs,
                blacklist_tier: blacklistTier,
                blacklist_cost: blacklistCost,
                usage_percentage: totalBlacklistScrubs <= 500000 ? 
                    (totalBlacklistScrubs / 500000 * 100).toFixed(2) :
                    (totalBlacklistScrubs / 1200000 * 100).toFixed(2)
            }
        });
    });
});

// VERTEX CRM - Installation Tracking & Analytics APIs
// Add this to your server.js file after the Lead Management section

// =====================================================
// INSTALLATION TRACKING (Excel Import)
// =====================================================

// Import installations from Excel
app.post('/api/installations/import', 
    authenticateToken, 
    checkRole(['super_admin']),
    upload.single('file'),
    async (req, res) => {
        const { campaign_id } = req.body;
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        if (!campaign_id) {
            return res.status(400).json({ error: 'Campaign ID required' });
        }
        
        try {
            // Read Excel file
            const workbook = XLSX.readFile(file.path);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(sheet);
            
            // Create import batch record
            const batchId = await new Promise((resolve, reject) => {
                db.run(`INSERT INTO import_batches 
                        (campaign_id, filename, uploaded_by, total_records, import_status)
                        VALUES (?, ?, ?, ?, 'processing')`,
                    [campaign_id, file.originalname, req.user.id, data.length],
                    function(err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    }
                );
            });
            
            // Process each row
            const results = {
                matched: [],
                unmatched: [],
                errors: []
            };
            
            for (const row of data) {
                try {
                    const result = await processInstallationRow(row, campaign_id, batchId);
                    
                    if (result.matched) {
                        results.matched.push(result);
                    } else {
                        results.unmatched.push({
                            ...result,
                            row_data: row
                        });
                    }
                } catch (error) {
                    results.errors.push({
                        row,
                        error: error.message
                    });
                }
            }
            
            // Update batch status
            db.run(`UPDATE import_batches 
                    SET matched_records = ?, unmatched_records = ?, 
                        import_status = 'completed', import_log = ?
                    WHERE id = ?`,
                [
                    results.matched.length,
                    results.unmatched.length,
                    JSON.stringify(results),
                    batchId
                ]);
            
            // Clean up uploaded file
            const fs = require('fs');
            fs.unlinkSync(file.path);
            
            res.json({
                success: true,
                batchId,
                summary: {
                    total: data.length,
                    matched: results.matched.length,
                    unmatched: results.unmatched.length,
                    errors: results.errors.length
                },
                results
            });
            
        } catch (error) {
            console.error('Import error:', error);
            res.status(500).json({ error: 'Failed to process Excel file' });
        }
    }
);

// Process individual installation row
async function processInstallationRow(row, campaignId, batchId) {
    // Extract and clean data from Excel row
    const customerData = {
        name: (row['Customer Name'] || row['Name'] || row['Full Name'] || '').trim(),
        phone: cleanPhoneNumber(row['Phone'] || row['Phone Number'] || row['Contact'] || ''),
        email: (row['Email'] || row['Email Address'] || '').toLowerCase().trim(),
        installDate: parseDate(row['Install Date'] || row['Installation Date'] || row['Date']),
        packageType: row['Package'] || row['Package Type'] || row['Product'] || '',
        monthlyValue: parseFloat(row['Monthly Value'] || row['Value'] || row['Amount'] || 0)
    };
    
    // Validate required fields
    if (!customerData.phone) {
        throw new Error('Phone number is required');
    }
    
    // Try to match with existing lead
    const matchResult = await matchLeadToAgent(customerData, campaignId);
    
    if (matchResult.found) {
        // Create installation record
        const installationId = await new Promise((resolve, reject) => {
            db.run(`INSERT INTO installations 
                    (lead_id, campaign_id, center_id, agent_id, customer_name, phone, email,
                     installation_date, installation_status, package_type, monthly_value,
                     import_batch_id, matched_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)`,
                [
                    matchResult.lead_id,
                    campaignId,
                    matchResult.center_id,
                    matchResult.agent_id,
                    customerData.name,
                    customerData.phone,
                    customerData.email,
                    customerData.installDate,
                    customerData.packageType,
                    customerData.monthlyValue,
                    batchId,
                    matchResult.matchedBy
                ],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                }
            );
        });
        
        // Update lead status
        db.run('UPDATE leads SET status = "installed" WHERE id = ?', [matchResult.lead_id]);
        
        return {
            matched: true,
            installationId,
            ...matchResult,
            customerData
        };
    } else {
        return {
            matched: false,
            customerData,
            reason: 'No matching lead found'
        };
    }
}

// Match lead to agent helper
async function matchLeadToAgent(customerData, campaignId) {
    const cleanPhone = customerData.phone.replace(/\D/g, '');
    
    // Try matching by phone first
    let lead = await new Promise((resolve, reject) => {
        db.get(`SELECT l.*, u.name as agent_name, c.name as center_name
                FROM leads l
                JOIN users u ON l.agent_id = u.id
                JOIN centers c ON l.center_id = c.id
                WHERE l.campaign_id = ? 
                AND REPLACE(REPLACE(REPLACE(l.phone, '-', ''), '(', ''), ')', '') = ?
                ORDER BY l.created_at DESC
                LIMIT 1`,
            [campaignId, cleanPhone],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
    
    if (lead) {
        return {
            found: true,
            lead_id: lead.id,
            agent_id: lead.agent_id,
            center_id: lead.center_id,
            agent_name: lead.agent_name,
            center_name: lead.center_name,
            matchedBy: 'phone'
        };
    }
    
    // Try matching by email if provided
    if (customerData.email) {
        lead = await new Promise((resolve, reject) => {
            db.get(`SELECT l.*, u.name as agent_name, c.name as center_name
                    FROM leads l
                    JOIN users u ON l.agent_id = u.id
                    JOIN centers c ON l.center_id = c.id
                    WHERE l.campaign_id = ? AND LOWER(l.email) = LOWER(?)
                    ORDER BY l.created_at DESC
                    LIMIT 1`,
                [campaignId, customerData.email],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        
        if (lead) {
            return {
                found: true,
                lead_id: lead.id,
                agent_id: lead.agent_id,
                center_id: lead.center_id,
                agent_name: lead.agent_name,
                center_name: lead.center_name,
                matchedBy: 'email'
            };
        }
    }
    
    return { found: false };
}

// Helper functions
function cleanPhoneNumber(phone) {
    if (!phone) return '';
    return phone.toString().replace(/\D/g, '');
}

function parseDate(dateValue) {
    if (!dateValue) return new Date().toISOString().split('T')[0];
    
    // Handle Excel serial date
    if (typeof dateValue === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        const msPerDay = 86400000;
        const date = new Date(excelEpoch.getTime() + dateValue * msPerDay);
        return date.toISOString().split('T')[0];
    }
    
    // Try to parse string date
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
    }
    
    return new Date().toISOString().split('T')[0];
}

// Get installations
app.get('/api/installations', authenticateToken, (req, res) => {
    let query = `SELECT i.*, 
                        l.customer_name as lead_name,
                        u.name as agent_name, 
                        u.user_id as agent_code,
                        c.name as center_name,
                        camp.name as campaign_name
                 FROM installations i
                 LEFT JOIN leads l ON i.lead_id = l.id
                 JOIN users u ON i.agent_id = u.id
                 JOIN centers c ON i.center_id = c.id
                 JOIN campaigns camp ON i.campaign_id = camp.id
                 WHERE 1=1`;
    const params = [];
    
    // Role-based filtering
    if (req.user.role === 'agent') {
        query += ` AND i.agent_id = ?`;
        params.push(req.user.id);
    } else if (req.user.role === 'center_admin') {
        query += ` AND i.center_id = ?`;
        params.push(req.user.center_id);
    }
    
    // Additional filters
    if (req.query.campaign_id) {
        query += ` AND i.campaign_id = ?`;
        params.push(req.query.campaign_id);
    }
    
    if (req.query.date_from) {
        query += ` AND DATE(i.installation_date) >= ?`;
        params.push(req.query.date_from);
    }
    
    if (req.query.date_to) {
        query += ` AND DATE(i.installation_date) <= ?`;
        params.push(req.query.date_to);
    }
    
    query += ` ORDER BY i.installation_date DESC LIMIT 1000`;
    
    db.all(query, params, (err, installations) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch installations' });
        res.json(installations);
    });
});

// =====================================================
// ANALYTICS ENDPOINTS
// =====================================================

// Agent Analytics Dashboard
app.get('/api/analytics/agent/:agentId', authenticateToken, async (req, res) => {
    const { agentId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Verify agent can only see their own data
    if (req.user.role === 'agent' && req.user.id != agentId) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const analytics = {};
    
    // Get leads stats
    analytics.leads = await new Promise((resolve, reject) => {
        db.get(`SELECT 
                    COUNT(*) as total_leads,
                    COUNT(CASE WHEN DATE(created_at) = DATE('now') THEN 1 END) as today_leads,
                    COUNT(CASE WHEN DATE(created_at) >= DATE('now', '-7 days') THEN 1 END) as week_leads,
                    COUNT(CASE WHEN DATE(created_at) >= DATE('now', 'start of month') THEN 1 END) as month_leads,
                    COUNT(CASE WHEN interest_level = 'Hot' THEN 1 END) as hot_leads,
                    COUNT(CASE WHEN interest_level = 'Warm' THEN 1 END) as warm_leads,
                    COUNT(CASE WHEN interest_level = 'Cold' THEN 1 END) as cold_leads
                FROM leads
                WHERE agent_id = ?
                AND DATE(created_at) BETWEEN ? AND ?`,
            [agentId, startDate || '2020-01-01', endDate || '2099-12-31'],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
    
    // Get installations stats
    analytics.installations = await new Promise((resolve, reject) => {
        db.get(`SELECT 
                    COUNT(*) as total_installations,
                    COUNT(CASE WHEN DATE(installation_date) = DATE('now') THEN 1 END) as today_installations,
                    COUNT(CASE WHEN DATE(installation_date) >= DATE('now', '-7 days') THEN 1 END) as week_installations,
                    COUNT(CASE WHEN DATE(installation_date) >= DATE('now', 'start of month') THEN 1 END) as month_installations,
                    SUM(monthly_value) as total_monthly_value
                FROM installations
                WHERE agent_id = ?
                AND DATE(installation_date) BETWEEN ? AND ?
                AND installation_status = 'completed'`,
            [agentId, startDate || '2020-01-01', endDate || '2099-12-31'],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
    
    // Calculate conversion rate
    analytics.conversion = {
        rate: analytics.leads.total_leads > 0 
            ? ((analytics.installations.total_installations / analytics.leads.total_leads) * 100).toFixed(2)
            : 0
    };
    
    // Get daily performance for chart
    analytics.daily_performance = await new Promise((resolve, reject) => {
        db.all(`SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as leads,
                    (SELECT COUNT(*) FROM installations 
                     WHERE agent_id = ? 
                     AND DATE(installation_date) = DATE(l.created_at)) as installations
                FROM leads l
                WHERE agent_id = ?
                AND DATE(created_at) >= DATE('now', '-30 days')
                GROUP BY DATE(created_at)
                ORDER BY date DESC`,
            [agentId, agentId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
    
    res.json(analytics);
});

// Center Admin Analytics Dashboard
app.get('/api/analytics/center/:centerId', authenticateToken, checkRole(['center_admin', 'super_admin']), async (req, res) => {
    const { centerId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Verify center admin can only see their center
    if (req.user.role === 'center_admin' && req.user.center_id != centerId) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    const analytics = {};
    
    // Center overview
    analytics.overview = await new Promise((resolve, reject) => {
        db.get(`SELECT 
                    COUNT(DISTINCT l.agent_id) as active_agents,
                    COUNT(DISTINCT l.id) as total_leads,
                    COUNT(DISTINCT i.id) as total_installations,
                    SUM(i.monthly_value) as total_monthly_value
                FROM centers c
                LEFT JOIN leads l ON c.id = l.center_id
                LEFT JOIN installations i ON l.id = i.lead_id
                WHERE c.id = ?
                AND DATE(l.created_at) BETWEEN ? AND ?`,
            [centerId, startDate || '2020-01-01', endDate || '2099-12-31'],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
    
    // Agent performance
    analytics.agents = await new Promise((resolve, reject) => {
        db.all(`SELECT 
                    u.id,
                    u.name,
                    u.user_id,
                    COUNT(DISTINCT l.id) as leads,
                    COUNT(DISTINCT i.id) as installations,
                    SUM(i.monthly_value) as monthly_value,
                    ROUND(COUNT(DISTINCT i.id) * 100.0 / NULLIF(COUNT(DISTINCT l.id), 0), 2) as conversion_rate
                FROM users u
                LEFT JOIN leads l ON u.id = l.agent_id
                    AND DATE(l.created_at) BETWEEN ? AND ?
                LEFT JOIN installations i ON l.id = i.lead_id
                WHERE u.center_id = ?
                AND u.role = 'agent'
                GROUP BY u.id
                ORDER BY installations DESC`,
            [startDate || '2020-01-01', endDate || '2099-12-31', centerId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
    
    res.json(analytics);
});

// Super Admin Campaign Analytics
app.get('/api/analytics/campaign/:campaignId', authenticateToken, checkRole(['super_admin']), async (req, res) => {
    const { campaignId } = req.params;
    const { startDate, endDate } = req.query;
    
    const analytics = {};
    
    // Campaign totals
    analytics.totals = await new Promise((resolve, reject) => {
        db.get(`SELECT 
                    COUNT(DISTINCT c.id) as total_centers,
                    COUNT(DISTINCT u.id) as total_agents,
                    COUNT(DISTINCT l.id) as total_leads,
                    COUNT(DISTINCT i.id) as total_installations,
                    SUM(i.monthly_value) as total_monthly_value
                FROM campaigns camp
                LEFT JOIN centers c ON camp.id = c.campaign_id
                LEFT JOIN users u ON c.id = u.center_id AND u.role = 'agent'
                LEFT JOIN leads l ON camp.id = l.campaign_id
                    AND DATE(l.created_at) BETWEEN ? AND ?
                LEFT JOIN installations i ON l.id = i.lead_id
                WHERE camp.id = ?`,
            [startDate || '2020-01-01', endDate || '2099-12-31', campaignId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
    
    // Centers comparison
    analytics.centers = await new Promise((resolve, reject) => {
        db.all(`SELECT 
                    c.id,
                    c.name,
                    c.code,
                    COUNT(DISTINCT u.id) as agents,
                    COUNT(DISTINCT l.id) as leads,
                    COUNT(DISTINCT i.id) as installations,
                    SUM(i.monthly_value) as monthly_value,
                    ROUND(COUNT(DISTINCT i.id) * 100.0 / NULLIF(COUNT(DISTINCT l.id), 0), 2) as conversion_rate
                FROM centers c
                LEFT JOIN users u ON c.id = u.center_id AND u.role = 'agent'
                LEFT JOIN leads l ON c.id = l.center_id
                    AND DATE(l.created_at) BETWEEN ? AND ?
                LEFT JOIN installations i ON l.id = i.lead_id
                WHERE c.campaign_id = ?
                GROUP BY c.id
                ORDER BY installations DESC`,
            [startDate || '2020-01-01', endDate || '2099-12-31', campaignId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
    
    // Top agents across all centers
    analytics.topAgents = await new Promise((resolve, reject) => {
        db.all(`SELECT 
                    u.name,
                    u.user_id,
                    c.name as center_name,
                    COUNT(DISTINCT i.id) as installations,
                    SUM(i.monthly_value) as monthly_value
                FROM users u
                JOIN centers c ON u.center_id = c.id
                JOIN leads l ON u.id = l.agent_id
                JOIN installations i ON l.id = i.lead_id
                WHERE c.campaign_id = ?
                AND DATE(i.installation_date) BETWEEN ? AND ?
                GROUP BY u.id
                ORDER BY installations DESC
                LIMIT 10`,
            [campaignId, startDate || '2020-01-01', endDate || '2099-12-31'],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
    
    res.json(analytics);
});

// Get dashboard summary (for all roles)
app.get('/api/analytics/dashboard', authenticateToken, async (req, res) => {
    const summary = {};
    
    if (req.user.role === 'agent') {
        // Agent sees only their stats
        summary.stats = await new Promise((resolve, reject) => {
            db.get(`SELECT 
                        (SELECT COUNT(*) FROM leads WHERE agent_id = ? AND DATE(created_at) = DATE('now')) as today_leads,
                        (SELECT COUNT(*) FROM leads WHERE agent_id = ?) as total_leads,
                        (SELECT COUNT(*) FROM installations WHERE agent_id = ?) as total_installations`,
                [req.user.id, req.user.id, req.user.id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    } else if (req.user.role === 'center_admin') {
        // Center admin sees center stats
        summary.stats = await new Promise((resolve, reject) => {
            db.get(`SELECT 
                        (SELECT COUNT(*) FROM leads WHERE center_id = ? AND DATE(created_at) = DATE('now')) as today_leads,
                        (SELECT COUNT(*) FROM leads WHERE center_id = ?) as total_leads,
                        (SELECT COUNT(*) FROM installations WHERE center_id = ?) as total_installations,
                        (SELECT COUNT(*) FROM users WHERE center_id = ? AND role = 'agent') as total_agents`,
                [req.user.center_id, req.user.center_id, req.user.center_id, req.user.center_id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    } else if (req.user.role === 'super_admin') {
        // Super admin sees everything
        summary.stats = await new Promise((resolve, reject) => {
            db.get(`SELECT 
                        (SELECT COUNT(*) FROM campaigns WHERE status = 'active') as total_campaigns,
                        (SELECT COUNT(*) FROM centers WHERE status = 'active') as total_centers,
                        (SELECT COUNT(*) FROM users WHERE role = 'agent' AND status = 'active') as total_agents,
                        (SELECT COUNT(*) FROM leads WHERE DATE(created_at) = DATE('now')) as today_leads,
                        (SELECT COUNT(*) FROM leads) as total_leads,
                        (SELECT COUNT(*) FROM installations) as total_installations`,
                [],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }
    
    res.json(summary);
});

// Super Admin Commission Calculator
app.post('/api/commission/calculate', authenticateToken, checkRole(['super_admin']), async (req, res) => {
    const { 
        campaign_id, 
        month, 
        total_installations, 
        revenue_per_install, 
        center_payouts 
    } = req.body;
    
    // Calculate total revenue
    const totalRevenue = total_installations * revenue_per_install;
    
    // Get scrub costs for the month
    const scrubCosts = await new Promise((resolve, reject) => {
        db.get(`SELECT 
                    SUM(blacklist_scrubs) as total_blacklist,
                    SUM(tcpa_scrubs) as total_tcpa
                FROM scrub_usage su
                JOIN centers c ON su.center_id = c.id
                WHERE c.campaign_id = ?
                AND strftime('%Y-%m', su.date) = ?`,
            [campaign_id, month],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });
    
    // Calculate scrub costs
    let blacklistCost = 0;
    if (scrubCosts.total_blacklist) {
        if (scrubCosts.total_blacklist <= 500000) {
            blacklistCost = 549;
        } else if (scrubCosts.total_blacklist <= 1200000) {
            blacklistCost = 1000;
        } else {
            blacklistCost = scrubCosts.total_blacklist * 0.001;
        }
    }
    
    // Calculate total center payouts
    const totalCenterPayouts = Object.values(center_payouts || {})
        .reduce((sum, amount) => sum + amount, 0);
    
    // Calculate profit
    const grossProfit = totalRevenue - totalCenterPayouts;
    const netProfit = grossProfit - blacklistCost;
    
    // Save calculation
    db.run(`INSERT INTO commission_calculator 
            (campaign_id, month, total_installations, revenue_per_install,
             total_revenue, center_payouts, blacklist_scrubs_used,
             blacklist_scrub_cost, gross_profit, net_profit, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            campaign_id, month, total_installations, revenue_per_install,
            totalRevenue, JSON.stringify(center_payouts),
            scrubCosts.total_blacklist || 0, blacklistCost,
            grossProfit, netProfit, req.user.id
        ],
        function(err) {
            if (err) return res.status(500).json({ error: 'Failed to save calculation' });
            
            res.json({
                success: true,
                calculation: {
                    totalRevenue,
                    totalCenterPayouts,
                    scrubCosts: {
                        blacklist_scrubs: scrubCosts.total_blacklist || 0,
                        blacklist_cost: blacklistCost
                    },
                    grossProfit,
                    netProfit,
                    profitMargin: ((netProfit / totalRevenue) * 100).toFixed(2) + '%'
                }
            });
        }
    );
});

// =====================================================
// CLIENT MANAGEMENT ENDPOINTS
// =====================================================

// Create new client
app.post('/api/clients', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const { 
        clientName, 
        clientType, 
        mainClientName, 
        contactPersonName, 
        contactEmail, 
        sector, 
        salesType, 
        country 
    } = req.body;

    // Validate required fields
    if (!clientName || !clientType || !contactPersonName || !contactEmail || !sector || !country) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate broker-specific fields
    if (clientType === 'broker' && !mainClientName) {
        return res.status(400).json({ error: 'Main client name is required for brokers' });
    }

    // Validate sales-specific fields
    if (sector === 'sales' && !salesType) {
        return res.status(400).json({ error: 'Sales type is required for sales sector' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    db.run(`INSERT INTO clients 
            (client_name, client_type, main_client_name, contact_person_name, 
             contact_email, sector, sales_type, country, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            clientName,
            clientType,
            clientType === 'broker' ? mainClientName : null,
            contactPersonName,
            contactEmail,
            sector,
            sector === 'sales' ? salesType : null,
            country,
            req.user.id
        ],
        function(err) {
            if (err) {
                console.error('Client creation error:', err);
                return res.status(500).json({ error: 'Failed to create client' });
            }
            
            // Log activity
            db.run(`INSERT INTO activity_logs (user_id, action, details) 
                    VALUES (?, ?, ?)`,
                [req.user.id, 'client_created', `Created client: ${clientName}`]);
            
            res.json({ 
                success: true,
                id: this.lastID,
                message: 'Client created successfully' 
            });
        }
    );
});

// Get all clients
app.get('/api/clients', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const query = `SELECT c.*, u.name as created_by_name
                   FROM clients c
                   LEFT JOIN users u ON c.created_by = u.id
                   WHERE c.status = 'active'
                   ORDER BY c.created_at DESC`;
    
    db.all(query, [], (err, clients) => {
        if (err) {
            console.error('Error fetching clients:', err);
            return res.status(500).json({ success: false, error: 'Failed to fetch clients' });
        }
        
        res.json({ success: true, data: clients });
    });
});

// Update client
app.put('/api/clients/:id', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const { id } = req.params;
    const { 
        clientName, 
        clientType, 
        mainClientName, 
        contactPersonName, 
        contactEmail, 
        sector, 
        salesType, 
        country 
    } = req.body;

    db.run(`UPDATE clients SET 
            client_name = ?, client_type = ?, main_client_name = ?,
            contact_person_name = ?, contact_email = ?, sector = ?,
            sales_type = ?, country = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
        [
            clientName,
            clientType,
            clientType === 'broker' ? mainClientName : null,
            contactPersonName,
            contactEmail,
            sector,
            sector === 'sales' ? salesType : null,
            country,
            id
        ],
        function(err) {
            if (err) {
                console.error('Client update error:', err);
                return res.status(500).json({ error: 'Failed to update client' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Client not found' });
            }
            
            res.json({ 
                success: true,
                message: 'Client updated successfully' 
            });
        }
    );
});

// Delete client (soft delete)
app.delete('/api/clients/:id', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const { id } = req.params;
    
    db.run('UPDATE clients SET status = "deleted" WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Client deletion error:', err);
            return res.status(500).json({ error: 'Failed to delete client' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }
        
        res.json({ 
            success: true,
            message: 'Client deleted successfully' 
        });
    });
});

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════╗
    ║                                      ║
    ║        VERTEX CRM SERVER             ║
    ║        Running on port ${PORT}          ║
    ║                                      ║
    ║   Default Login:                     ║
    ║   Username: admin                    ║
    ║   Password: vertex2024               ║
    ║                                      ║
    ╚══════════════════════════════════════╝
    `);
});

// SALES & VALIDATION LOGS ENDPOINTS
// =====================================================

// Get sales and validation logs (Super Admin & Center Admin)
app.get('/api/sales-logs', authenticateToken, checkRole(['super_admin', 'center_admin', 'agent']), (req, res) => {
    const { campaign_id, center_id, start_date, end_date, status } = req.query;
    const userRole = req.user.role;
    const userCenterId = req.user.center_id;

    let whereConditions = [];
    let params = [];

    // Role-based access control
    if (userRole === 'center_admin') {
        whereConditions.push('ls.center_id = ?');
        params.push(userCenterId);
    } else if (userRole === 'agent') {
        // Agents can only see their own leads (temporarily removed clean filter for existing data)
        whereConditions.push('ls.agent_id = ?');
        params.push(req.user.id);
    } else if (center_id) {
        whereConditions.push('ls.center_id = ?');
        params.push(center_id);
    }

    // Campaign filter
    if (campaign_id) {
        whereConditions.push('lf.campaign_id = ?');
        params.push(campaign_id);
    }

    // Date range filter
    if (start_date) {
        whereConditions.push('DATE(ls.created_at) >= ?');
        params.push(start_date);
    }
    if (end_date) {
        whereConditions.push('DATE(ls.created_at) <= ?');
        params.push(end_date);
    }

    // Status filter
    if (status) {
        whereConditions.push('ls.validation_status = ?');
        params.push(status);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const query = `
        SELECT 
            ls.id,
            ls.first_name,
            ls.last_name,
            ls.phone,
            ls.email,
            ls.validation_status,
            ls.forwarded_to_client,
            ls.forwarded_at,
            ls.created_at,
            ls.center_code,
            ls.agent_id,
            c.name as center_name,
            lf.name as form_name,
            camp.campaign_name,
            camp.client_rate,
            camp.payment_type,
            cca.center_commission,
            vl.validation_passed,
            vl.blacklist_status,
            vl.blacklist_message,
            vl.blacklist2_status,
            vl.blacklist2_message,
            vl.tcpa_status,
            vl.denial_reason,
            vl.blacklist_raw_response,
            vl.blacklist2_raw_response,
            vl.tcpa_raw_response,
            ls.sales_status,
            ls.status_updated_at,
            ls.status_updated_by,
            ls.status_notes,
            u.first_name as agent_first_name,
            u.last_name as agent_last_name,
            u.username as agent_username,
            status_updater.first_name as status_updater_first_name,
            status_updater.last_name as status_updater_last_name
        FROM lead_submissions ls
        LEFT JOIN centers c ON ls.center_id = c.id
        LEFT JOIN lead_forms lf ON ls.form_id = lf.id
        LEFT JOIN campaigns camp ON lf.campaign_id = camp.id
        LEFT JOIN campaign_center_assignments cca ON (cca.campaign_id = camp.id AND cca.center_id = c.id)
        LEFT JOIN validation_logs vl ON ls.validation_log_id = vl.id
        LEFT JOIN users u ON ls.agent_id = u.id
        LEFT JOIN users status_updater ON ls.status_updated_by = status_updater.id
        ${whereClause}
        ORDER BY ls.created_at DESC
        LIMIT 1000
    `;

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching sales logs:', err);
            return res.status(500).json({ success: false, error: 'Failed to fetch sales logs' });
        }

        // Parse JSON fields and calculate commission/profit
        const logs = rows.map(row => {
            let blacklistResponse = null;
            let blacklist2Response = null;
            let tcpaResponse = null;
            
            try {
                if (row.blacklist_raw_response) {
                    blacklistResponse = JSON.parse(row.blacklist_raw_response);
                }
                if (row.blacklist2_raw_response) {
                    blacklist2Response = JSON.parse(row.blacklist2_raw_response);
                }
                if (row.tcpa_raw_response) {
                    tcpaResponse = JSON.parse(row.tcpa_raw_response);
                }
            } catch (e) {
                console.warn('Error parsing API responses:', e);
            }

            // Calculate financial metrics
            const clientRate = row.client_rate || 0;
            const centerCommission = row.center_commission || 0;
            const potential_revenue = row.forwarded_to_client && clientRate ? clientRate : 0;
            const commission_amount = row.forwarded_to_client && centerCommission ? centerCommission : 0;
            const profit = potential_revenue - commission_amount;

            // Format agent info - if no specific agent, show center agents
            let agent_info = null;
            if (row.agent_id) {
                // Specific agent who submitted
                agent_info = {
                    id: row.agent_id,
                    name: `${row.agent_first_name || ''} ${row.agent_last_name || ''}`.trim(),
                    username: row.agent_username,
                    type: 'specific'
                };
            } else if (row.center_id) {
                // No specific agent, but we can show center info
                agent_info = {
                    id: null,
                    name: `Center: ${row.center_name}`,
                    username: row.center_code,
                    type: 'center',
                    center_id: row.center_id
                };
            }

            // Format status updater info
            const status_updater_info = row.status_updated_by ? {
                name: `${row.status_updater_first_name || ''} ${row.status_updater_last_name || ''}`.trim()
            } : null;

            return {
                ...row,
                potential_revenue,
                commission_amount,
                profit,
                agent_info,
                status_updater_info,
                blacklist_details: blacklistResponse,
                blacklist2_details: blacklist2Response,
                tcpa_details: tcpaResponse
            };
        });

        res.json({ success: true, data: logs });
    });
});

// Get centers for a specific campaign (for filtering)
app.get('/api/campaigns/:campaignId/centers', authenticateToken, checkRole(['super_admin', 'center_admin']), (req, res) => {
    const { campaignId } = req.params;
    const userRole = req.user.role;
    const userCenterId = req.user.center_id;

    let whereConditions = ['cca.campaign_id = ?'];
    let params = [campaignId];

    // Role-based access control
    if (userRole === 'center_admin') {
        whereConditions.push('c.id = ?');
        params.push(userCenterId);
    }

    const whereClause = whereConditions.join(' AND ');

    const query = `
        SELECT DISTINCT
            c.id,
            c.name,
            c.code
        FROM centers c
        JOIN campaign_center_assignments cca ON c.id = cca.center_id
        WHERE ${whereClause}
        ORDER BY c.name
    `;

    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching campaign centers:', err);
            return res.status(500).json({ success: false, error: 'Failed to fetch campaign centers' });
        }

        res.json({ success: true, data: rows });
    });
});

// GET /api/analytics/daily-leads - Get daily lead submissions for the last 30 days
app.get('/api/analytics/daily-leads', authenticateToken, checkRole(['agent', 'center_admin', 'super_admin']), async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        
        let query = `
            SELECT 
                DATE(ls.created_at) as date,
                COUNT(*) as leads
            FROM lead_submissions ls
            LEFT JOIN lead_forms lf ON ls.form_id = lf.id
            LEFT JOIN campaigns c ON lf.campaign_id = c.id
            WHERE ls.created_at >= datetime('now', '-30 days')
        `;
        
        let params = [];
        
        // Filter by user role
        if (userRole === 'agent') {
            query += ` AND ls.agent_id = ?`;
            params.push(userId);
        } else if (userRole === 'center_admin') {
            query += ` AND ls.center_id = ?`;
            params.push(req.user.center_id || req.user.center?.id);
        }
        // super_admin sees all data
        
        query += `
            GROUP BY DATE(ls.created_at)
            ORDER BY date ASC
        `;
        
        const dailyLeads = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Fill in missing dates with 0 leads
        const result = [];
        const today = new Date();
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const dayData = dailyLeads.find(d => d.date === dateStr);
            result.push({
                date: dateStr,
                leads: dayData ? dayData.leads : 0,
                displayDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            });
        }
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        console.error('Error fetching daily leads:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch daily leads data'
        });
    }
});

// GET /api/analytics/sales-status - Get sales status breakdown for donut chart
app.get('/api/analytics/sales-status', authenticateToken, checkRole(['agent', 'center_admin', 'super_admin']), async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        
        let query = `
            SELECT 
                ls.sales_status,
                COUNT(*) as count
            FROM lead_submissions ls
            LEFT JOIN lead_forms lf ON ls.form_id = lf.id
            LEFT JOIN campaigns c ON lf.campaign_id = c.id
            WHERE ls.sales_status IS NOT NULL AND ls.sales_status != ''
        `;
        
        let params = [];
        
        // Filter by user role
        if (userRole === 'agent') {
            query += ` AND ls.agent_id = ?`;
            params.push(userId);
        } else if (userRole === 'center_admin') {
            query += ` AND ls.center_id = ?`;
            params.push(req.user.center_id || req.user.center?.id);
        }
        // super_admin sees all data
        
        query += `
            GROUP BY ls.sales_status
            ORDER BY count DESC
        `;
        
        const statusBreakdown = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Define colors for each status with distinct visual differences
        const statusColors = {
            'transferred': '#f97316', // orange-500 (main brand)
            'installed': '#10b981',   // green-500 (success color)
            'follow-up': '#fb7c00',   // darker orange (more distinct)
            'paid': '#c2410c',        // orange-700 (darkest orange)
            'dropped': '#fbbf24',     // amber-400 (yellow-orange)
            'cancelled': '#f59e0b'    // amber-500 (golden orange)
        };
        
        // Format data for the donut chart
        const result = statusBreakdown.map(item => ({
            name: item.sales_status.charAt(0).toUpperCase() + item.sales_status.slice(1),
            value: item.count,
            status: item.sales_status,
            color: statusColors[item.sales_status] || '#f97316' // default orange
        }));
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        console.error('Error fetching sales status breakdown:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch sales status breakdown'
        });
    }
});

// Get sales logs summary/statistics
app.get('/api/sales-logs/summary', authenticateToken, checkRole(['super_admin', 'center_admin', 'agent']), (req, res) => {
    const { campaign_id, center_id, start_date, end_date } = req.query;
    const userRole = req.user.role;
    const userCenterId = req.user.center_id;

    let whereConditions = [];
    let params = [];

    // Role-based access control
    if (userRole === 'center_admin') {
        whereConditions.push('ls.center_id = ?');
        params.push(userCenterId);
    } else if (userRole === 'agent') {
        // Agents can only see their own leads (temporarily removed clean filter for existing data)
        whereConditions.push('ls.agent_id = ?');
        params.push(req.user.id);
    } else if (center_id) {
        whereConditions.push('ls.center_id = ?');
        params.push(center_id);
    }

    // Campaign filter
    if (campaign_id) {
        whereConditions.push('lf.campaign_id = ?');
        params.push(campaign_id);
    }

    // Date range filter
    if (start_date) {
        whereConditions.push('DATE(ls.created_at) >= ?');
        params.push(start_date);
    }
    if (end_date) {
        whereConditions.push('DATE(ls.created_at) <= ?');
        params.push(end_date);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

            const summaryQuery = `
        SELECT 
            COUNT(*) as total_submissions,
            COUNT(CASE WHEN DATE(ls.created_at) = DATE('now') THEN 1 END) as today_submissions,
            COUNT(CASE WHEN DATE(ls.created_at) >= DATE('now', 'weekday 0', '-6 days') THEN 1 END) as week_submissions,
            COUNT(CASE WHEN ls.validation_status = 'clean' THEN 1 END) as clean_leads,
            COUNT(CASE WHEN ls.validation_status = 'rejected' THEN 1 END) as rejected_leads,
            COUNT(CASE WHEN ls.forwarded_to_client = 1 THEN 1 END) as forwarded_leads,
            COUNT(CASE WHEN ls.sales_status = 'transferred' THEN 1 END) as transferred_leads,
            COUNT(CASE WHEN ls.sales_status = 'installed' THEN 1 END) as installed_leads,
            SUM(CASE WHEN ls.forwarded_to_client = 1 AND camp.client_rate THEN camp.client_rate ELSE 0 END) as potential_revenue,
            AVG(CASE WHEN ls.validation_status = 'clean' THEN 1.0 ELSE 0.0 END) * 100 as success_rate
        FROM lead_submissions ls
        LEFT JOIN lead_forms lf ON ls.form_id = lf.id
        LEFT JOIN campaigns camp ON lf.campaign_id = camp.id
        ${whereClause}
    `;

    db.get(summaryQuery, params, (err, summary) => {
        if (err) {
            console.error('Error fetching sales summary:', err);
            return res.status(500).json({ success: false, error: 'Failed to fetch sales summary' });
        }

        res.json({ success: true, data: summary });
    });
});

// LEAD FORMS MANAGEMENT ENDPOINTS
// =====================================================

// Get all forms (Super Admin, Center Admin, Agent)
app.get('/api/forms', authenticateToken, checkRole(['super_admin', 'center_admin', 'agent']), (req, res) => {
    let query = `
        SELECT lf.*, c.name as campaign_name, c.photo_url as campaign_photo,
               c.transfer_number, c.department_transfer_number, c.transfer_to_department,
               COUNT(ls.id) as total_submissions,
               COUNT(CASE WHEN ls.validation_status = 'clean' THEN 1 END) as clean_submissions
        FROM lead_forms lf
        LEFT JOIN campaigns c ON lf.campaign_id = c.id
        LEFT JOIN lead_submissions ls ON lf.id = ls.form_id
    `;
    
    let params = [];
    let whereConditions = ['lf.status != ?'];
    params.push('deleted');
    
    // Role-based filtering
    if (req.user.role === 'center_admin' || req.user.role === 'agent') {
        // Only show forms for campaigns assigned to their center
        whereConditions.push(`c.id IN (
            SELECT cca.campaign_id 
            FROM campaign_center_assignments cca 
            WHERE cca.center_id = ? AND cca.status = 'active'
        )`);
        params.push(req.user.center_id);
    }
    
    query += ' WHERE ' + whereConditions.join(' AND ');
    query += ' GROUP BY lf.id ORDER BY lf.created_at DESC';
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching forms:', err);
            return res.status(500).json({ success: false, error: 'Failed to fetch forms' });
        }
        
        const forms = rows.map(form => ({
            ...form,
            form_fields: form.form_fields ? JSON.parse(form.form_fields) : [],
            field_mapping: form.field_mapping ? JSON.parse(form.field_mapping) : {},
            conversion_rate: form.total_submissions > 0 ? 
                ((form.clean_submissions / form.total_submissions) * 100).toFixed(1) : 0
        }));
        
        res.json({ success: true, data: forms });
    });
});

// Create new form (Super Admin)
app.post('/api/forms', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const { name, campaign_id, description, form_fields, client_form_url, field_mapping, success_message, redirect_delay } = req.body;
    
    if (!name || !campaign_id || !form_fields) {
        return res.status(400).json({ success: false, error: 'Name, campaign, and form fields are required' });
    }
    
    // Generate slug from name
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    const query = `
        INSERT INTO lead_forms (name, slug, campaign_id, description, form_fields, client_form_url, 
                               field_mapping, success_message, redirect_delay, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(query, [
        name, slug, campaign_id, description, 
        JSON.stringify(form_fields), client_form_url, 
        JSON.stringify(field_mapping || {}), 
        success_message || 'Thank you for your interest!', 
        redirect_delay || 3, 
        req.user.id
    ], function(err) {
        if (err) {
            console.error('Error creating form:', err);
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return res.status(400).json({ success: false, error: 'Form with this name already exists' });
            }
            return res.status(500).json({ success: false, error: 'Failed to create form' });
        }
        
        res.json({ success: true, data: { id: this.lastID, slug } });
    });
});

// Get form by slug (Public - for form rendering)
app.get('/api/forms/public/:slug', (req, res) => {
    const { slug } = req.params;
    const { center } = req.query;
    
    const query = `
        SELECT lf.*, c.name as campaign_name, c.photo_url as campaign_photo
        FROM lead_forms lf
        LEFT JOIN campaigns c ON lf.campaign_id = c.id
        WHERE lf.slug = ? AND lf.status = 'active'
    `;
    
    db.get(query, [slug], (err, form) => {
        if (err) {
            console.error('Error fetching form:', err);
            return res.status(500).json({ success: false, error: 'Failed to fetch form' });
        }
        
        if (!form) {
            return res.status(404).json({ success: false, error: 'Form not found' });
        }
        
        // Parse JSON fields
        form.form_fields = form.form_fields ? JSON.parse(form.form_fields) : [];
        form.field_mapping = form.field_mapping ? JSON.parse(form.field_mapping) : {};
        
        // Get center info if provided
        if (center) {
            const centerQuery = `SELECT id, name, code FROM centers WHERE code = ? AND status = 'active'`;
            db.get(centerQuery, [center], (err, centerData) => {
                if (err || !centerData) {
                    return res.status(400).json({ success: false, error: 'Invalid center code' });
                }
                
                res.json({ success: true, data: { ...form, center: centerData } });
            });
        } else {
            res.json({ success: true, data: form });
        }
    });
});

// Submit form (Public)
app.post('/api/forms/submit/:slug', async (req, res) => {
    const { slug } = req.params;
    const { center_code, ...formData } = req.body;
    const ip_address = req.ip || req.connection.remoteAddress;
    const user_agent = req.get('User-Agent');
    
    // Check if this is an authenticated agent submission (optional)
    let agentId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (decoded.role === 'agent') {
                agentId = decoded.id;
            }
        } catch (err) {
            // Token invalid or expired, but we don't fail - just treat as public submission
            console.log('Invalid token in form submission, treating as public:', err.message);
        }
    }
    
    try {
        // Get form and center info
        const form = await new Promise((resolve, reject) => {
            const query = `
                SELECT lf.*, c.name as campaign_name
                FROM lead_forms lf
                LEFT JOIN campaigns c ON lf.campaign_id = c.id
                WHERE lf.slug = ? AND lf.status = 'active'
            `;
            db.get(query, [slug], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!form) {
            return res.status(404).json({ success: false, error: 'Form not found' });
        }
        
        const center = await new Promise((resolve, reject) => {
            db.get('SELECT id, name, code FROM centers WHERE code = ? AND status = "active"', 
                   [center_code], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!center) {
            return res.status(400).json({ success: false, error: 'Invalid center code' });
        }
        
        // CRITICAL: Validate phone number if submitted by agent
        if (agentId && formData.phone) {
            const cleanPhone = formData.phone.replace(/\D/g, '');
            
            // Perform complete phone validation
            const phoneValidation = await validatePhoneComplete(cleanPhone, agentId, center.id);
            if (!phoneValidation.allowed) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Phone validation failed: ' + phoneValidation.reason,
                    validationLogId: phoneValidation.logId
                });
            }
        }
        
        // Save lead submission
        const leadId = await new Promise((resolve, reject) => {
            const query = `
                INSERT INTO lead_submissions (form_id, center_id, center_code, first_name, last_name, 
                                            phone, email, additional_data, ip_address, user_agent, agent_id, zipcode)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            db.run(query, [
                form.id, center.id, center_code, formData.first_name, formData.last_name,
                formData.phone, formData.email, JSON.stringify(formData), ip_address, user_agent, agentId, formData.zipcode
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
        
        // Check for duplicate phone number across ALL centers and campaigns
        const cleanPhone = formData.phone.replace(/\D/g, '');
        const duplicateCheck = await new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    ls.id, ls.phone, ls.created_at, ls.center_id, ls.agent_id,
                    c.name as center_name, c.code as center_code,
                    u.first_name, u.last_name, u.username,
                    lf.name as form_name,
                    camp.campaign_name
                FROM lead_submissions ls
                LEFT JOIN centers c ON ls.center_id = c.id
                LEFT JOIN users u ON ls.agent_id = u.id
                LEFT JOIN lead_forms lf ON ls.form_id = lf.id
                LEFT JOIN campaigns camp ON lf.campaign_id = camp.id
                WHERE ls.phone = ?
                ORDER BY ls.created_at ASC
                LIMIT 1
            `;
            
            db.get(query, [cleanPhone], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (duplicateCheck) {
            // Duplicate found - update current submission as rejected and return error
            await new Promise((resolve, reject) => {
                const updateQuery = `
                    UPDATE lead_submissions 
                    SET validation_status = 'rejected'
                    WHERE id = ?
                `;
                db.run(updateQuery, [leadId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            // Role-based duplicate messaging for form submission too
            let duplicateMessage, duplicateDetails;
            
            // For form submissions, we need to check if there's an authenticated user
            // If agentId exists, it's an agent submission, otherwise it's public
            if (agentId) {
                // Agent submission - show generic message
                duplicateMessage = `❌ ALREADY A CUSTOMER: This phone number is already in our system.`;
                duplicateDetails = {
                    message: 'Please try a different phone number.'
                };
            } else {
                // Public submission - can show more details since it's not competitive
                duplicateMessage = `❌ DUPLICATE CUSTOMER: This phone number was already used by ${duplicateCheck.center_name} on ${new Date(duplicateCheck.created_at).toLocaleDateString()}`;
                duplicateDetails = {
                    center: duplicateCheck.center_name,
                    center_code: duplicateCheck.center_code,
                    agent: duplicateCheck.first_name && duplicateCheck.last_name 
                        ? `${duplicateCheck.first_name} ${duplicateCheck.last_name}` 
                        : 'Unknown Agent',
                    date: new Date(duplicateCheck.created_at).toLocaleDateString(),
                    campaign: duplicateCheck.campaign_name || 'Unknown Campaign'
                };
            }
            
            return res.json({ 
                success: false, 
                message: duplicateMessage,
                duplicate_details: duplicateDetails
            });
        }

        // No duplicate found - proceed with phone validation using existing validation system
        const validation = await validatePhoneComplete(formData.phone, agentId, center.id);
        
        // Update lead with validation results
        await new Promise((resolve, reject) => {
            const updateQuery = `
                UPDATE lead_submissions 
                SET validation_status = ?, validation_log_id = ?
                WHERE id = ?
            `;
            const status = validation.allowed ? 'clean' : 'rejected';
            db.run(updateQuery, [status, validation.logId, leadId], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        if (validation.allowed) {
            // Generate autofill URL for client form
            const autofillUrl = generateAutofillUrl(form, formData, center_code, leadId);
            
            // Update lead with autofill URL
            await new Promise((resolve, reject) => {
                db.run('UPDATE lead_submissions SET autofill_url = ?, forwarded_to_client = 1, forwarded_at = CURRENT_TIMESTAMP WHERE id = ?',
                       [autofillUrl, leadId], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            
            res.json({ 
                success: true, 
                message: form.success_message,
                redirect_url: autofillUrl,
                redirect_delay: form.redirect_delay
            });
        } else {
            res.json({ 
                success: false, 
                message: `Sorry, we cannot process your request: ${validation.reason}`,
                show_alternative: true
            });
        }
        
    } catch (error) {
        console.error('Error processing form submission:', error);
        res.status(500).json({ success: false, error: 'Failed to process submission' });
    }
});

// Helper function to generate autofill URL
function generateAutofillUrl(form, formData, centerCode, leadId) {
    if (!form.client_form_url) {
        return null;
    }
    
    const url = new URL(form.client_form_url);
    const fieldMapping = form.field_mapping ? JSON.parse(form.field_mapping) : {};
    
    // Map form fields to client form fields
    Object.keys(formData).forEach(key => {
        const clientField = fieldMapping[key] || key;
        
        // Special handling for name fields - combine first and last name
        if (key === 'first_name' && formData.last_name) {
            // Try common name field variations
            const fullName = `${formData.first_name} ${formData.last_name}`.trim();
            url.searchParams.set('name', fullName);
            url.searchParams.set('full_name', fullName);
            url.searchParams.set('customer_name', fullName);
            url.searchParams.set('lead_name', fullName);
        }
        
        // Also set individual fields in case they're needed
        url.searchParams.set(clientField, formData[key]);
    });
    
    // Add tracking parameters
    url.searchParams.set('utm_source', 'vertex_crm');
    url.searchParams.set('utm_medium', 'lead_form');
    url.searchParams.set('utm_campaign', form.campaign_name);
    url.searchParams.set('center_ref', centerCode);
    url.searchParams.set('lead_id', leadId);
    
    return url.toString();
}

// POST /api/phone/pre-verify - Real-time phone pre-verification
app.post('/api/phone/pre-verify', authenticateToken, checkRole(['agent', 'center_admin', 'super_admin']), async (req, res) => {
    const { phone, campaignId } = req.body;
    const agentId = req.user.id;
    const centerId = req.user.center_id;
    
    if (!phone || phone.length !== 10) {
        return res.status(400).json({ 
            success: false, 
            error: 'Phone number must be exactly 10 digits' 
        });
    }
    
    if (!campaignId) {
        return res.status(400).json({ 
            success: false, 
            error: 'Campaign ID is required' 
        });
    }
    
    const cleanPhone = phone.replace(/\D/g, '');
    
    try {
        // NEW 4-LAYER VALIDATION FLOW:
        // 1. Client Suppression Check (campaign-specific)
        const suppressionCheck = await checkClientSuppression(cleanPhone, campaignId);
        
        if (suppressionCheck) {
            // Save validation failure to new dedicated table
            await saveValidationFailure({
                phone: cleanPhone,
                agent_id: agentId,
                center_id: centerId,
                campaign_id: campaignId,
                validation_type: 'phone',
                failure_reason: `Client suppression: Added on ${new Date(suppressionCheck.added_at).toLocaleDateString()}`,
                phone_status: 'suppressed',
                validation_details: JSON.stringify(suppressionCheck)
            });
            
            return res.json({
                success: false,
                status: 'suppressed',
                message: '❌ DNC Customer',
                details: {
                    phone: cleanPhone,
                    message: 'This number is on the client\'s do-not-call list.'
                }
            });
        }
        
        // 2. Campaign-Specific Duplicate Check
        const duplicateCheck = await checkCampaignDuplicate(cleanPhone, campaignId);
        
        if (duplicateCheck) {
            // Save validation failure to new dedicated table
            const denialReason = `Duplicate customer: Used by ${duplicateCheck.center_name} (${duplicateCheck.center_code}) on ${new Date(duplicateCheck.created_at).toLocaleDateString()}`;
            
            await saveValidationFailure({
                phone: cleanPhone,
                agent_id: agentId,
                center_id: centerId,
                campaign_id: campaignId,
                validation_type: 'phone',
                failure_reason: denialReason,
                phone_status: 'duplicate',
                duplicate_details: JSON.stringify({
                    previous_submission: duplicateCheck.created_at,
                    center: duplicateCheck.center_name,
                    campaign: duplicateCheck.campaign_name,
                    center_id: duplicateCheck.center_id,
                    agent_id: duplicateCheck.agent_id
                })
            });
            
            // Different messages based on user role
            const userRole = req.user.role;
            let message, details;
            
            if (userRole === 'super_admin') {
                // Super Admin sees full details
                message = `❌ DUPLICATE CUSTOMER: Used by ${duplicateCheck.center_name} (${duplicateCheck.center_code}) on ${new Date(duplicateCheck.created_at).toLocaleDateString()}`;
                details = {
                    phone: cleanPhone,
                    previousCenter: duplicateCheck.center_name,
                    previousCenterCode: duplicateCheck.center_code,
                    previousAgent: duplicateCheck.first_name && duplicateCheck.last_name 
                        ? `${duplicateCheck.first_name} ${duplicateCheck.last_name}` 
                        : 'Unknown Agent',
                    previousDate: new Date(duplicateCheck.created_at).toLocaleDateString(),
                    campaign: duplicateCheck.campaign_name || 'Unknown Campaign'
                };
            } else {
                // Agents and Center Admins see generic message
                message = `❌ Already a customer`;
                details = {
                    phone: cleanPhone,
                    message: 'This phone number was already used by another center/campaign.'
                };
            }
            
            return res.json({
                success: false,
                status: 'duplicate',
                message: message,
                details: details,
                verificationId
            });
        }
        
        // No duplicate found - run TCPA and blacklist checks
        const validation = await validatePhoneComplete(cleanPhone, agentId, centerId);
        
        // Save pre-verification result
        const verificationId = await new Promise((resolve, reject) => {
            const insertQuery = `
                INSERT INTO phone_pre_verification 
                (phone, agent_id, center_id, verification_status, validation_passed, 
                 blacklist_status, blacklist_message, blacklist2_status, blacklist2_message,
                 tcpa_status, denial_reason, blacklist_raw_response, blacklist2_raw_response, 
                 tcpa_raw_response, expires_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+30 minutes'))
            `;
            
            const status = validation.allowed ? 'approved' : 'rejected';
            
            db.run(insertQuery, [
                cleanPhone, agentId, centerId, status, validation.allowed,
                validation.blacklist_status, validation.blacklist_message,
                validation.blacklist2_status, validation.blacklist2_message,
                validation.tcpa_status, validation.reason,
                validation.blacklist_raw_response, validation.blacklist2_raw_response,
                validation.tcpa_raw_response
            ], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
        
        if (validation.allowed) {
            res.json({
                success: true,
                status: 'approved',
                message: '✅ PHONE APPROVED - Ready to call!',
                details: {
                    phone: cleanPhone,
                    blacklist: validation.blacklist_message || validation.blacklist_status,
                    blacklist2: validation.blacklist2_message || validation.blacklist2_status,
                    tcpa: validation.tcpa_status,
                    expiresIn: '30 minutes'
                },
                verificationId
            });
        } else {
            res.json({
                success: false,
                status: 'rejected',
                message: '❌ PHONE REJECTED - Do not call!',
                details: {
                    phone: cleanPhone,
                    reason: validation.reason,
                    blacklist: validation.blacklist_message || validation.blacklist_status,
                    blacklist2: validation.blacklist2_message || validation.blacklist2_status,
                    tcpa: validation.tcpa_status
                },
                verificationId
            });
        }
        
    } catch (error) {
        console.error('Pre-verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Verification system error'
        });
    }
});

// GET /api/centers/:id/agents - Get agents for a specific center
app.get('/api/centers/:id/agents', authenticateToken, checkRole(['super_admin', 'center_admin']), (req, res) => {
    const centerId = req.params.id;
    
    const query = `
        SELECT id, first_name, last_name, username, email, created_at
        FROM users 
        WHERE role = 'agent' AND center_id = ? AND status = 'active'
        ORDER BY first_name, last_name
    `;
    
    db.all(query, [centerId], (err, agents) => {
        if (err) {
            console.error('Error fetching center agents:', err);
            return res.status(500).json({ success: false, error: 'Failed to fetch agents' });
        }
        
        res.json({ success: true, data: agents });
    });
});

// GET /api/campaigns/:id/suppression/stats - Get suppression statistics for a campaign
app.get('/api/campaigns/:id/suppression/stats', authenticateToken, checkRole(['super_admin']), async (req, res) => {
    const campaignId = req.params.id;
    
    try {
        // Get total suppressed numbers for this campaign
        const totalNumbers = await new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) as count FROM campaign_suppression WHERE campaign_id = ?`, [campaignId], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        
        // Get last upload info
        const lastUpload = await new Promise((resolve, reject) => {
            db.get(`
                SELECT su.uploaded_at, su.filename, su.valid_numbers_added, su.duplicate_numbers_skipped, su.invalid_numbers_rejected
                FROM suppression_uploads su
                WHERE su.campaign_id = ?
                ORDER BY su.uploaded_at DESC
                LIMIT 1
            `, [campaignId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        res.json({
            success: true,
            data: {
                totalNumbers,
                lastUpload: lastUpload?.uploaded_at || null,
                lastFilename: lastUpload?.filename || null,
                lastUploadStats: lastUpload ? {
                    validNumbersAdded: lastUpload.valid_numbers_added,
                    duplicateNumbersSkipped: lastUpload.duplicate_numbers_skipped,
                    invalidNumbersRejected: lastUpload.invalid_numbers_rejected
                } : null
            }
        });
    } catch (error) {
        console.error('Error fetching suppression stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch suppression statistics' });
    }
});

// POST /api/campaigns/:id/suppression/upload - Upload suppression file for a campaign
app.post('/api/campaigns/:id/suppression/upload', authenticateToken, checkRole(['super_admin']), upload.single('suppressionFile'), async (req, res) => {
    const campaignId = req.params.id;
    const uploadedBy = req.user.id;
    
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const file = req.file;
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
        // Read and parse CSV file
        const fileContent = fs.readFileSync(file.path, 'utf8');
        const lines = fileContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        let totalRowsProcessed = 0;
        let validNumbersAdded = 0;
        let duplicateNumbersSkipped = 0;
        let invalidNumbersRejected = 0;
        
        // Process each line
        for (const line of lines) {
            totalRowsProcessed++;
            
            // Clean phone number (remove any formatting)
            const cleanPhone = line.replace(/\D/g, '');
            
            // Validate: must be exactly 10 digits
            if (cleanPhone.length !== 10) {
                invalidNumbersRejected++;
                continue;
            }
            
            // Check if already exists for this campaign
            const exists = await new Promise((resolve, reject) => {
                db.get(`SELECT id FROM campaign_suppression WHERE campaign_id = ? AND phone = ?`, [campaignId, cleanPhone], (err, row) => {
                    if (err) reject(err);
                    else resolve(!!row);
                });
            });
            
            if (exists) {
                duplicateNumbersSkipped++;
                continue;
            }
            
            // Insert new suppression number
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO campaign_suppression 
                    (campaign_id, phone, upload_batch_id, source_filename, uploaded_by)
                    VALUES (?, ?, ?, ?, ?)
                `, [campaignId, cleanPhone, batchId, file.originalname, uploadedBy], function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
            });
            
            validNumbersAdded++;
        }
        
        // Save upload record
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO suppression_uploads 
                (campaign_id, batch_id, filename, total_rows_processed, valid_numbers_added, 
                 duplicate_numbers_skipped, invalid_numbers_rejected, uploaded_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [campaignId, batchId, file.originalname, totalRowsProcessed, validNumbersAdded, 
                duplicateNumbersSkipped, invalidNumbersRejected, uploadedBy], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
        
        // Clean up uploaded file
        fs.unlinkSync(file.path);
        
        res.json({
            success: true,
            data: {
                batchId,
                totalRowsProcessed,
                validNumbersAdded,
                duplicateNumbersSkipped,
                invalidNumbersRejected,
                filename: file.originalname
            }
        });
        
    } catch (error) {
        console.error('Error processing suppression file:', error);
        
        // Clean up uploaded file on error
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }
        
        res.status(500).json({ success: false, error: 'Failed to process suppression file' });
    }
});

// GET /api/campaigns/:id/postcodes/stats - Get postcode statistics for a campaign
app.get('/api/campaigns/:id/postcodes/stats', authenticateToken, checkRole(['super_admin']), async (req, res) => {
    const campaignId = req.params.id;
    
    try {
        // Get total postcodes for this campaign
        const totalPostcodes = await new Promise((resolve, reject) => {
            db.get(`SELECT COUNT(*) as count FROM campaign_postcodes WHERE campaign_id = ?`, [campaignId], (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            });
        });
        
        // Get last upload info
        const lastUpload = await new Promise((resolve, reject) => {
            db.get(`
                SELECT pu.uploaded_at, pu.filename, pu.valid_postcodes_added, pu.duplicate_postcodes_skipped, pu.invalid_postcodes_rejected
                FROM postcode_uploads pu
                WHERE pu.campaign_id = ?
                ORDER BY pu.uploaded_at DESC
                LIMIT 1
            `, [campaignId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        res.json({
            success: true,
            data: {
                totalPostcodes,
                lastUpload: lastUpload?.uploaded_at || null,
                lastFilename: lastUpload?.filename || null,
                lastUploadStats: lastUpload ? {
                    validPostcodesAdded: lastUpload.valid_postcodes_added,
                    duplicatePostcodesSkipped: lastUpload.duplicate_postcodes_skipped,
                    invalidPostcodesRejected: lastUpload.invalid_postcodes_rejected
                } : null
            }
        });
    } catch (error) {
        console.error('Error fetching postcode stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch postcode statistics' });
    }
});

// POST /api/campaigns/:id/postcodes/upload - Upload postcode file for a campaign
app.post('/api/campaigns/:id/postcodes/upload', authenticateToken, checkRole(['super_admin']), upload.single('postcodeFile'), async (req, res) => {
    const campaignId = req.params.id;
    const uploadedBy = req.user.id;
    
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const file = req.file;
    const batchId = `postcode_batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
        // Read and parse CSV/TXT file
        const fileContent = fs.readFileSync(file.path, 'utf8');
        const lines = fileContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        let totalRowsProcessed = 0;
        let validPostcodesAdded = 0;
        let duplicatePostcodesSkipped = 0;
        let invalidPostcodesRejected = 0;
        
        // Helper function to validate US ZIP code format
        const isValidZipCode = (zipcode) => {
            // US ZIP code validation (5 digits or 5+4 format)
            const zipcodeRegex = /^[0-9]{5}(-[0-9]{4})?$/;
            return zipcodeRegex.test(zipcode.trim());
        };
        
        // Helper function to normalize ZIP code format
        const normalizeZipCode = (zipcode) => {
            return zipcode.replace(/\s+/g, '').trim();
        };
        
        // Process each line
        for (const line of lines) {
            totalRowsProcessed++;
            
            // Clean and validate ZIP code
            const cleanZipCode = line.replace(/[^0-9\-]/g, '').trim();
            
            if (!cleanZipCode || cleanZipCode.length < 5) {
                invalidPostcodesRejected++;
                continue;
            }
            
            if (!isValidZipCode(cleanZipCode)) {
                invalidPostcodesRejected++;
                continue;
            }
            
            const normalizedZipCode = normalizeZipCode(cleanZipCode);
            
            // Check for duplicates in this campaign
            const existingZipCode = await new Promise((resolve, reject) => {
                db.get(`SELECT id FROM campaign_postcodes WHERE campaign_id = ? AND postcode = ?`, 
                    [campaignId, normalizedZipCode], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            if (existingZipCode) {
                duplicatePostcodesSkipped++;
                continue;
            }
            
            // Insert new ZIP code
            await new Promise((resolve, reject) => {
                db.run(`
                    INSERT INTO campaign_postcodes (campaign_id, postcode, upload_batch_id, uploaded_by)
                    VALUES (?, ?, ?, ?)
                `, [campaignId, normalizedZipCode, batchId, uploadedBy], function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
            });
            
            validPostcodesAdded++;
        }
        
        // Save upload record
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO postcode_uploads 
                (campaign_id, batch_id, filename, total_rows_processed, valid_postcodes_added, 
                 duplicate_postcodes_skipped, invalid_postcodes_rejected, uploaded_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [campaignId, batchId, file.originalname, totalRowsProcessed, validPostcodesAdded, 
                duplicatePostcodesSkipped, invalidPostcodesRejected, uploadedBy], function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
        
        // Clean up uploaded file
        fs.unlinkSync(file.path);
        
        res.json({
            success: true,
            data: {
                batchId,
                totalRowsProcessed,
                validPostcodesAdded,
                duplicatePostcodesSkipped,
                invalidPostcodesRejected,
                filename: file.originalname
            }
        });
        
    } catch (error) {
        console.error('Error processing postcode file:', error);
        
        // Clean up uploaded file on error
        if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }
        
        res.status(500).json({ success: false, error: 'Failed to process postcode file' });
    }
});

// POST /api/campaigns/:id/check-zipcode - Check if ZIP code is serviceable
app.post('/api/campaigns/:id/check-zipcode', authenticateToken, async (req, res) => {
    const campaignId = req.params.id;
    const { zipcode } = req.body;
    
    if (!zipcode) {
        return res.status(400).json({ success: false, error: 'ZIP code is required' });
    }
    
    try {
        // Normalize the input ZIP code (remove spaces, convert to uppercase)
        const normalizedZipCode = zipcode.replace(/\s+/g, '').trim();
        
        // Get the first 5 digits for matching
        const zipPrefix = normalizedZipCode.substring(0, 5);
        
        if (zipPrefix.length < 5) {
            return res.json({
                success: true,
                data: {
                    serviceable: false,
                    message: 'ZIP code must be at least 5 digits',
                    zipcode: normalizedZipCode
                }
            });
        }
        
        // Check if any ZIP code in the campaign starts with the same 5 digits
        const matchingZipCode = await new Promise((resolve, reject) => {
            db.get(`
                SELECT postcode FROM campaign_postcodes 
                WHERE campaign_id = ? AND postcode LIKE ?
                LIMIT 1
            `, [campaignId, zipPrefix + '%'], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        const serviceable = !!matchingZipCode;
        
        res.json({
            success: true,
            data: {
                serviceable,
                message: serviceable ? 'ZIP Code Serviceable' : 'ZIP Code Unserviceable',
                zipcode: normalizedZipCode,
                matchedPrefix: zipPrefix,
                matchingZipCode: matchingZipCode?.postcode || null
            }
        });
        
    } catch (error) {
        console.error('Error checking ZIP code serviceability:', error);
        res.status(500).json({ success: false, error: 'Failed to check ZIP code serviceability' });
    }
});

// GET /api/phone/pre-verification-logs - Get pre-verification logs (Super Admin only)
app.get('/api/phone/pre-verification-logs', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const { start_date, end_date, center_id, status, phone } = req.query;
    
    let whereConditions = [];
    let params = [];
    
    if (start_date) {
        whereConditions.push('DATE(pv.checked_at) >= ?');
        params.push(start_date);
    }
    if (end_date) {
        whereConditions.push('DATE(pv.checked_at) <= ?');
        params.push(end_date);
    }
    if (center_id) {
        whereConditions.push('pv.center_id = ?');
        params.push(center_id);
    }
    if (status) {
        whereConditions.push('pv.verification_status = ?');
        params.push(status);
    }
    if (phone) {
        whereConditions.push('pv.phone LIKE ?');
        params.push(`%${phone}%`);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    const query = `
        SELECT 
            pv.*,
            c.name as center_name,
            c.code as center_code,
            u.first_name as agent_first_name,
            u.last_name as agent_last_name,
            u.username as agent_username,
            dc.name as duplicate_center_name,
            dc.code as duplicate_center_code,
            du.first_name as duplicate_agent_first_name,
            du.last_name as duplicate_agent_last_name,
            camp.campaign_name as duplicate_campaign_name
        FROM phone_pre_verification pv
        LEFT JOIN centers c ON pv.center_id = c.id
        LEFT JOIN users u ON pv.agent_id = u.id
        LEFT JOIN centers dc ON pv.duplicate_center_id = dc.id
        LEFT JOIN users du ON pv.duplicate_agent_id = du.id
        LEFT JOIN campaigns camp ON pv.duplicate_campaign_id = camp.id
        ${whereClause}
        ORDER BY pv.checked_at DESC
        LIMIT 1000
    `;
    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching pre-verification logs:', err);
            return res.status(500).json({ success: false, error: 'Failed to fetch logs' });
        }
        
        const logs = rows.map(row => ({
            ...row,
            agent_name: `${row.agent_first_name || ''} ${row.agent_last_name || ''}`.trim(),
            duplicate_agent_name: row.duplicate_agent_first_name && row.duplicate_agent_last_name 
                ? `${row.duplicate_agent_first_name} ${row.duplicate_agent_last_name}` 
                : null
        }));
        
        res.json({ success: true, data: logs });
    });
});

// PUT /api/sales-logs/:id/assign-agent - Assign agent to existing lead (Super Admin only)
app.put('/api/sales-logs/:id/assign-agent', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const leadId = req.params.id;
    const { agent_id } = req.body;
    
    // Validate agent exists and belongs to the same center as the lead
    const query = `
        UPDATE lead_submissions 
        SET agent_id = ?
        WHERE id = ? AND EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = ? AND u.role = 'agent' 
            AND u.center_id = (SELECT center_id FROM lead_submissions WHERE id = ?)
        )
    `;
    
    db.run(query, [agent_id, leadId, agent_id, leadId], function(err) {
        if (err) {
            console.error('Error assigning agent:', err);
            return res.status(500).json({ success: false, error: 'Failed to assign agent' });
        }
        
        if (this.changes === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid lead or agent assignment' 
            });
        }
        
        res.json({ success: true, message: 'Agent assigned successfully' });
    });
});

// Update sales status (Center Admin & Agent only)
app.post('/api/sales-logs/:id/update-status', authenticateToken, checkRole(['center_admin', 'agent']), (req, res) => {
    const leadId = req.params.id;
    const { sales_status, status_notes } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    const userCenterId = req.user.center_id;

    // Validate status
    const validStatuses = ['transferred', 'paid', 'dropped', 'installed', 'cancelled', 'follow-up'];
    if (!validStatuses.includes(sales_status)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Invalid status. Valid options: ' + validStatuses.join(', ') 
        });
    }

    // First verify the lead belongs to the user
    const checkQuery = `
        SELECT ls.id, ls.center_id, ls.agent_id 
        FROM lead_submissions ls 
        WHERE ls.id = ?
    `;

    db.get(checkQuery, [leadId], (err, lead) => {
        if (err) {
            console.error('Error checking lead ownership:', err);
            return res.status(500).json({ success: false, error: 'Database error' });
        }

        if (!lead) {
            return res.status(404).json({ success: false, error: 'Lead not found' });
        }

        // Verify access based on role
        if (userRole === 'center_admin' && lead.center_id !== userCenterId) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        } else if (userRole === 'agent' && lead.agent_id !== userId) {
            return res.status(403).json({ success: false, error: 'Access denied - you can only update your own leads' });
        }

        // Update the sales status
        const updateQuery = `
            UPDATE lead_submissions 
            SET sales_status = ?, 
                status_updated_at = CURRENT_TIMESTAMP, 
                status_updated_by = ?, 
                status_notes = ?
            WHERE id = ?
        `;

        db.run(updateQuery, [sales_status, userId, status_notes || null, leadId], function(updateErr) {
            if (updateErr) {
                console.error('Error updating sales status:', updateErr);
                return res.status(500).json({ success: false, error: 'Failed to update status' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ success: false, error: 'Lead not found' });
            }

            res.json({ 
                success: true, 
                message: 'Sales status updated successfully',
                data: {
                    id: leadId,
                    sales_status: sales_status,
                    status_notes: status_notes,
                    updated_by: userId,
                    updated_at: new Date().toISOString()
                }
            });
        });
    });
});

// CAMPAIGN ENDPOINTS
// GET /api/campaigns - Get all campaigns with client details and center assignments
app.get('/api/campaigns', authenticateToken, checkRole(['super_admin']), (req, res) => {
    console.log('[API] GET /campaigns: Starting to fetch campaigns');
    
    const query = `
        SELECT c.*, cl.client_name
        FROM campaigns c
        LEFT JOIN clients cl ON c.client_id = cl.id
        WHERE c.status != 'deleted'
        ORDER BY c.created_at DESC
    `;
    
    console.log('[API] Executing campaigns query:', query);
    
    db.all(query, [], (err, campaigns) => {
        if (err) {
            console.error('Error fetching campaigns - Database error:', err.message);
            console.error('Full error:', err);
            return res.status(500).json({ success: false, error: 'Internal server error' });
        }
        
        console.log(`[API] Found ${campaigns.length} campaigns`);
        
        if (campaigns.length === 0) {
            console.log('[API] No campaigns found, returning empty array');
            return res.json({ success: true, data: [] });
        }

        // For each campaign, get its center assignments
        const campaignPromises = campaigns.map(campaign => {
            return new Promise((resolve, reject) => {
                console.log(`[API] Fetching assignments for campaign ${campaign.id}`);
                
                const assignmentQuery = `
                    SELECT 
                        cca.center_id,
                        cca.center_commission,
                        cca.assigned_date,
                        cca.status as assignment_status,
                        cent.center_name,
                        cent.center_code
                    FROM campaign_center_assignments cca
                    JOIN centers cent ON cca.center_id = cent.id
                    WHERE cca.campaign_id = ? AND cca.status = 'active'
                    ORDER BY cca.assigned_date DESC
                `;
                
                db.all(assignmentQuery, [campaign.id], (err, assignments) => {
                    if (err) {
                        console.error(`[API] Error fetching assignments for campaign ${campaign.id}:`, err.message);
                        // Don't reject, just set empty assignments and continue
                        campaign.center_assignments = [];
                        resolve(campaign);
                    } else {
                        console.log(`[API] Found ${assignments.length} assignments for campaign ${campaign.id}`);
                        campaign.center_assignments = assignments;
                        resolve(campaign);
                    }
                });
            });
        });

        Promise.all(campaignPromises)
            .then(campaignsWithAssignments => {
                console.log(`[API] Successfully processed ${campaignsWithAssignments.length} campaigns with assignments`);
                res.json({ success: true, data: campaignsWithAssignments });
            })
            .catch(err => {
                console.error('Error processing campaign assignments:', err.message);
                console.error('Full error:', err);
                res.status(500).json({ success: false, error: 'Internal server error' });
            });
    });
});

// POST /api/campaigns - Create new campaign
app.post('/api/campaigns', authenticateToken, checkRole(['super_admin']), upload.single('campaignPhoto'), (req, res) => {
    try {
        console.log('Campaign creation request received');
        console.log('Request body:', req.body);
        console.log('File:', req.file ? 'Present' : 'None');
        
        const {
            campaignName,
            campaignType,
            clientId,
            mainClientName,
            country,
            transferNumber,
            collectPayment,
            closeSale,
            transferToDepartment,
            departmentTransferNumber,
            paymentType,
            clientRate,
            paymentFrequency
        } = req.body;

    // Validate required fields
    if (!campaignName || !campaignType || !clientId || !country) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields' 
        });
    }

    // Handle photo upload
    let photoUrl = null;
    if (req.file) {
        const fileName = `campaign_${Date.now()}_${req.file.originalname}`;
        const finalPath = path.join(__dirname, 'uploads', fileName);
        
        // Ensure uploads directory exists
        if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
            fs.mkdirSync(path.join(__dirname, 'uploads'));
        }
        
        try {
            fs.renameSync(req.file.path, finalPath);
            photoUrl = `/uploads/${fileName}`;
        } catch (error) {
            console.error('Error saving campaign photo:', error);
            return res.status(500).json({ success: false, error: 'Failed to save photo' });
        }
    }

    const query = `
        INSERT INTO campaigns (
            campaign_name, campaign_type, client_id, main_client_name, country,
            transfer_number, collect_payment, close_sale, transfer_to_department,
            department_transfer_number, photo_url, payment_type, client_rate, 
            payment_frequency, created_by, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `;

    db.run(query, [
        campaignName,
        campaignType, 
        clientId,
        mainClientName || null,
        country,
        transferNumber || null,
        collectPayment || null,
        closeSale || null,
        transferToDepartment || null,
        departmentTransferNumber || null,
        photoUrl,
        paymentType || 'per_sale',
        clientRate || 0.00,
        paymentFrequency || 'per_transaction',
        req.user.id
    ], async function(err) {
        if (err) {
            console.error('Error creating campaign:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to create campaign' });
        }

        const campaignId = this.lastID;
        
        // Get client name for better AI configuration
        db.get('SELECT client_name FROM clients WHERE id = ?', [clientId], async (clientErr, client) => {
            const clientName = client ? client.client_name : (mainClientName || '');
            
            // Auto-configure AI settings for the new campaign
            try {
                await autoConfigureCampaignAI(campaignId, campaignType, paymentType || 'per_sale', clientName);
            } catch (configError) {
                console.error('Error auto-configuring campaign AI:', configError);
                // Don't fail the campaign creation if AI config fails
        }

        res.status(201).json({
            success: true,
                campaignId: campaignId,
            message: 'Campaign created successfully'
            });
        });
    });
    } catch (error) {
        console.error('Unexpected error in campaign creation:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// PUT /api/campaigns/:id - Update campaign
app.put('/api/campaigns/:id', authenticateToken, checkRole(['super_admin']), upload.single('campaignPhoto'), (req, res) => {
    const campaignId = req.params.id;
    const {
        campaignName,
        campaignType,
        clientId,
        mainClientName,
        country,
        transferNumber,
        collectPayment,
        closeSale,
        transferToDepartment,
        departmentTransferNumber
    } = req.body;

    // Validate required fields
    if (!campaignName || !campaignType || !clientId || !country) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields' 
        });
    }

    // Handle photo upload
    let photoUrl = null;
    if (req.file) {
        const fileName = `campaign_${Date.now()}_${req.file.originalname}`;
        const finalPath = path.join(__dirname, 'uploads', fileName);
        
        // Ensure uploads directory exists
        if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
            fs.mkdirSync(path.join(__dirname, 'uploads'));
        }
        
        try {
            fs.renameSync(req.file.path, finalPath);
            photoUrl = `/uploads/${fileName}`;
        } catch (error) {
            console.error('Error saving campaign photo:', error);
            return res.status(500).json({ success: false, error: 'Failed to save photo' });
        }
    }

    let query, params;
    if (photoUrl) {
        query = `
            UPDATE campaigns SET
                campaign_name = ?, campaign_type = ?, client_id = ?, main_client_name = ?,
                country = ?, transfer_number = ?, collect_payment = ?, close_sale = ?,
                transfer_to_department = ?, department_transfer_number = ?, photo_url = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        params = [
            campaignName, campaignType, clientId, mainClientName || null, country,
            transferNumber || null, collectPayment || null, closeSale || null,
            transferToDepartment || null, departmentTransferNumber || null, photoUrl,
            campaignId
        ];
    } else {
        query = `
            UPDATE campaigns SET
                campaign_name = ?, campaign_type = ?, client_id = ?, main_client_name = ?,
                country = ?, transfer_number = ?, collect_payment = ?, close_sale = ?,
                transfer_to_department = ?, department_transfer_number = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        params = [
            campaignName, campaignType, clientId, mainClientName || null, country,
            transferNumber || null, collectPayment || null, closeSale || null,
            transferToDepartment || null, departmentTransferNumber || null,
            campaignId
        ];
    }

    db.run(query, params, function(err) {
        if (err) {
            console.error('Error updating campaign:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to update campaign' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }

        res.json({
            success: true,
            message: 'Campaign updated successfully'
        });
    });
});

// DELETE /api/campaigns/:id - Delete campaign (soft delete)
app.delete('/api/campaigns/:id', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const campaignId = req.params.id;

    const query = `
        UPDATE campaigns 
        SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;

    db.run(query, [campaignId], function(err) {
        if (err) {
            console.error('Error deleting campaign:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to delete campaign' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }

        res.json({
            success: true,
            message: 'Campaign deleted successfully'
        });
    });
});

// PUT /api/campaigns/:id/commission - Update campaign commission
app.put('/api/campaigns/:id/commission', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const campaignId = req.params.id;
    const { commission } = req.body;

    // Validate commission
    if (commission === undefined || commission === null) {
        return res.status(400).json({ 
            success: false, 
            error: 'Commission amount is required' 
        });
    }

    const query = `
        UPDATE campaigns 
        SET commission = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;

    db.run(query, [commission, campaignId], function(err) {
        if (err) {
            console.error('Error updating campaign commission:', err.message);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to update commission' 
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Campaign not found' 
            });
        }

        // Log the commission update
        db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
            [req.user.id, 'update_commission', `Commission updated for campaign ID ${campaignId} to ${commission}`]);

        res.json({ 
            success: true, 
            message: 'Commission updated successfully',
            commission: commission
        });
    });
});

// PUT /api/campaigns/:id/status - Update campaign status (active/paused)
app.put('/api/campaigns/:id/status', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const campaignId = req.params.id;
    const { status } = req.body;

    // Validate status
    if (!status || !['active', 'paused'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status. Must be "active" or "paused"' });
    }

    const updateQuery = `UPDATE campaigns SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    
    db.run(updateQuery, [status, campaignId], function(err) {
        if (err) {
            console.error('Error updating campaign status:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to update campaign status' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }

        // Log activity
        db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
            [req.user.id, 'campaign_status_update', `Campaign ${campaignId} status changed to ${status}`]);

        res.json({ 
            success: true, 
            message: `Campaign status updated to ${status}`,
            status: status
        });
    });
});

// PUT /api/campaigns/:id/payment-terms - Update campaign payment terms
app.put('/api/campaigns/:id/payment-terms', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const campaignId = req.params.id;
    const { paymentType, clientRate, paymentFrequency } = req.body;

    // Validate required fields
    if (!paymentType || !clientRate || !paymentFrequency) {
        return res.status(400).json({ 
            success: false, 
            error: 'All payment term fields are required' 
        });
    }

    const query = `
        UPDATE campaigns 
        SET payment_type = ?, client_rate = ?, payment_frequency = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;

    db.run(query, [paymentType, clientRate, paymentFrequency, campaignId], function(err) {
        if (err) {
            console.error('Error updating campaign payment terms:', err.message);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to update payment terms' 
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Campaign not found' 
            });
        }

        // Log the payment terms update
        db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
            [req.user.id, 'update_payment_terms', `Payment terms updated for campaign ID ${campaignId}`]);

        res.json({ 
            success: true, 
            message: 'Payment terms updated successfully'
        });
    });
});

// =====================================================
// CAMPAIGN-CENTER ASSIGNMENT ENDPOINTS
// =====================================================

// POST /api/campaign-assignments - Assign campaign to center with commission
app.post('/api/campaign-assignments', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const { campaignId, centerId, centerCommission } = req.body;

    // Validate required fields
    if (!campaignId || !centerId || centerCommission === undefined) {
        return res.status(400).json({ 
            success: false, 
            error: 'Campaign ID, Center ID, and commission are required' 
        });
    }

    // Check if assignment already exists
    db.get(`SELECT id FROM campaign_center_assignments WHERE campaign_id = ? AND center_id = ?`, 
        [campaignId, centerId], (err, existing) => {
        if (err) {
            console.error('Error checking existing assignment:', err.message);
            return res.status(500).json({ success: false, error: 'Database error' });
        }

        if (existing) {
            return res.status(400).json({ 
                success: false, 
                error: 'Campaign is already assigned to this center' 
            });
        }

        // Create new assignment
        const query = `
            INSERT INTO campaign_center_assignments (campaign_id, center_id, center_commission, created_by)
            VALUES (?, ?, ?, ?)
        `;

        db.run(query, [campaignId, centerId, centerCommission, req.user.id], function(err) {
            if (err) {
                console.error('Error creating campaign assignment:', err.message);
                return res.status(500).json({ success: false, error: 'Failed to assign campaign' });
            }

            // Log the assignment
            db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
                [req.user.id, 'assign_campaign', `Campaign ${campaignId} assigned to center ${centerId} with commission ${centerCommission}`]);

            res.status(201).json({ 
                success: true, 
                assignmentId: this.lastID,
                message: 'Campaign assigned to center successfully'
            });
        });
    });
});

// GET /api/centers/:id/campaigns - Get all campaigns for a center
app.get('/api/centers/:id/campaigns', authenticateToken, checkRole(['super_admin', 'center_admin', 'agent']), (req, res) => {
    const centerId = req.params.id;

    // Verify center admin and agents can only access their own center
    if ((req.user.role === 'center_admin' || req.user.role === 'agent') && req.user.center_id != centerId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Different query based on user role - hide sensitive client info from center admins
    const isRestrictedUser = req.user.role === 'center_admin' || req.user.role === 'agent';

    const query = `
        SELECT 
            c.id as campaign_id,
            c.campaign_name,
            c.campaign_type,
            c.country,
            ${isRestrictedUser ? 'NULL as client_rate,' : 'c.client_rate,'}
            c.payment_type,
            c.payment_frequency,
            c.status as campaign_status,
            c.photo_url,
            c.created_at,
            cca.center_commission,
            cca.assigned_date,
            cca.status as assignment_status,
            ${isRestrictedUser ? 'NULL as client_name,' : 'cl.client_name,'}
            lf.slug as form_id
        FROM campaign_center_assignments cca
        JOIN campaigns c ON cca.campaign_id = c.id
        LEFT JOIN clients cl ON c.client_id = cl.id
        LEFT JOIN lead_forms lf ON c.id = lf.campaign_id AND lf.status = 'active'
        WHERE cca.center_id = ? AND cca.status = 'active'
        ORDER BY cca.assigned_date DESC
    `;

    db.all(query, [centerId], (err, campaigns) => {
        if (err) {
            console.error('Error fetching center campaigns:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to fetch campaigns' });
        }

        res.json({ success: true, data: campaigns });
    });
});

// GET /api/campaigns/:id/centers - Get all centers for a campaign
app.get('/api/campaigns/:id/centers', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const campaignId = req.params.id;

    const query = `
        SELECT 
            ce.id as center_id,
            ce.center_name,
            ce.center_code,
            ce.country,
            ce.manager_name,
            ce.status as center_status,
            cca.center_commission,
            cca.assigned_date,
            cca.status as assignment_status
        FROM campaign_center_assignments cca
        JOIN centers ce ON cca.center_id = ce.id
        WHERE cca.campaign_id = ? AND cca.status = 'active'
        ORDER BY cca.assigned_date DESC
    `;

    db.all(query, [campaignId], (err, centers) => {
        if (err) {
            console.error('Error fetching campaign centers:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to fetch centers' });
        }

        res.json({ success: true, data: centers });
    });
});

// GET /api/campaigns/:id/agents - Get all agents for a campaign (for center admins)
app.get('/api/campaigns/:id/agents', authenticateToken, checkRole(['center_admin']), (req, res) => {
    const campaignId = req.params.id;
    const userCenterId = req.user.center_id;

    const query = `
        SELECT DISTINCT
            u.id,
            u.first_name,
            u.last_name,
            u.username,
            u.email
        FROM users u
        JOIN campaign_center_assignments cca ON u.center_id = cca.center_id
        WHERE cca.campaign_id = ? 
        AND u.center_id = ?
        AND u.role = 'agent'
        AND u.status = 'active'
        AND cca.status = 'active'
        ORDER BY u.first_name, u.last_name
    `;

    db.all(query, [campaignId, userCenterId], (err, agents) => {
        if (err) {
            console.error('Error fetching campaign agents:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to fetch agents' });
        }

        res.json({ success: true, data: agents });
    });
});

// PUT /api/campaign-assignments/:campaignId/:centerId/commission - Update commission for specific assignment
app.put('/api/campaign-assignments/:campaignId/:centerId/commission', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const { campaignId, centerId } = req.params;
    const { commission } = req.body;

    if (commission === undefined || commission < 0) {
        return res.status(400).json({ 
            success: false, 
            error: 'Valid commission amount is required' 
        });
    }

    const query = `
        UPDATE campaign_center_assignments 
        SET center_commission = ?, created_at = CURRENT_TIMESTAMP
        WHERE campaign_id = ? AND center_id = ?
    `;

    db.run(query, [commission, campaignId, centerId], function(err) {
        if (err) {
            console.error('Error updating assignment commission:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to update commission' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Campaign assignment not found' 
            });
        }

        // Log the commission update
        db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
            [req.user.id, 'update_assignment_commission', `Commission updated to ${commission} for campaign ${campaignId} and center ${centerId}`]);

        res.json({ 
            success: true, 
            message: 'Commission updated successfully',
            commission: commission
        });
    });
});

// GET /api/centers/:id/profit-summary - Get profit summary per campaign for a center
app.get('/api/centers/:id/profit-summary', authenticateToken, checkRole(['super_admin', 'center_admin']), (req, res) => {
    const centerId = req.params.id;
    const { startDate, endDate } = req.query;

    // Verify center admin can only access their own center
    if (req.user.role === 'center_admin' && req.user.center_id != centerId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const query = `
        SELECT 
            c.id as campaign_id,
            c.campaign_name,
            c.client_rate,
            c.payment_type,
            c.payment_frequency,
            cca.center_commission,
            (c.client_rate - cca.center_commission) as profit_per_transaction,
            COUNT(rt.id) as total_transactions,
            SUM(rt.quantity) as total_quantity,
            SUM(rt.client_payment) as total_client_revenue,
            SUM(rt.center_cost) as total_center_earnings,
            SUM(rt.profit) as total_profit
        FROM campaign_center_assignments cca
        JOIN campaigns c ON cca.campaign_id = c.id
        LEFT JOIN revenue_tracking rt ON rt.campaign_id = c.id AND rt.center_id = cca.center_id
            AND (? IS NULL OR rt.transaction_date >= ?)
            AND (? IS NULL OR rt.transaction_date <= ?)
        WHERE cca.center_id = ? AND cca.status = 'active'
        GROUP BY c.id, cca.center_commission
        ORDER BY total_profit DESC NULLS LAST
    `;

    db.all(query, [startDate, startDate, endDate, endDate, centerId], (err, results) => {
        if (err) {
            console.error('Error fetching profit summary:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to fetch profit summary' });
        }

        // Calculate overall totals
        const summary = {
            campaigns: results,
            totals: {
                total_campaigns: results.length,
                total_transactions: results.reduce((sum, r) => sum + (r.total_transactions || 0), 0),
                total_client_revenue: results.reduce((sum, r) => sum + (r.total_client_revenue || 0), 0),
                total_center_earnings: results.reduce((sum, r) => sum + (r.total_center_earnings || 0), 0),
                total_profit: results.reduce((sum, r) => sum + (r.total_profit || 0), 0)
            }
        };

        res.json({ success: true, data: summary });
    });
});

// DELETE /api/campaign-assignments/:campaignId/:centerId - Remove campaign from center
app.delete('/api/campaign-assignments/:campaignId/:centerId', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const { campaignId, centerId } = req.params;

    const query = `
        DELETE FROM campaign_center_assignments 
        WHERE campaign_id = ? AND center_id = ?
    `;

    db.run(query, [campaignId, centerId], function(err) {
        if (err) {
            console.error('Error removing campaign assignment:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to remove campaign assignment' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Campaign assignment not found' 
            });
        }

        // Log the removal
        db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
            [req.user.id, 'remove_campaign_assignment', `Campaign ${campaignId} removed from center ${centerId}`]);

        res.json({ 
            success: true, 
            message: 'Campaign assignment removed successfully'
        });
    });
});

// PUT /api/centers/:id/commission - Update center commission
app.put('/api/centers/:id/commission', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const centerId = req.params.id;
    const { commission } = req.body;

    // Validate commission
    if (commission === undefined || commission === null) {
        return res.status(400).json({ 
            success: false, 
            error: 'Commission amount is required' 
        });
    }

    const query = `
        UPDATE centers 
        SET campaign_commission = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;

    db.run(query, [commission, centerId], function(err) {
        if (err) {
            console.error('Error updating center commission:', err.message);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to update commission' 
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Center not found' 
            });
        }

        // Log the commission update
        db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
            [req.user.id, 'update_center_commission', `Commission updated for center ID ${centerId} to ${commission}`]);

        res.json({ 
            success: true, 
            message: 'Center commission updated successfully',
            commission: commission
        });
    });
});

// ==================== CENTERS API ROUTES ====================

// GET /api/centers - Get all centers
app.get('/api/centers', authenticateToken, (req, res) => {
    const query = `
        SELECT c.*, camp.campaign_name, camp.id as campaign_id
        FROM centers c
        LEFT JOIN campaigns camp ON c.campaign_id = camp.id
        WHERE c.status != 'deleted'
        ORDER BY c.created_at DESC
    `;

    db.all(query, [], (err, centers) => {
        if (err) {
            console.error('Error fetching centers:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to fetch centers' });
        }

        res.json(centers);
    });
});

// DUPLICATE ENDPOINT REMOVED - Using the main endpoint at line 2049

// PUT /api/centers/:id - Update center
app.put('/api/centers/:id', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const centerId = req.params.id;
    const { 
        centerName, centerCode, country, address, adminName, adminEmail, 
        campaignId, status, admin_username, admin_password 
    } = req.body;

    const query = `
        UPDATE centers SET
            center_name = ?, center_code = ?, country = ?, address = ?, 
            manager_name = ?, admin_email = ?, campaign_id = ?, status = ?,
            admin_username = ?, admin_password = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;

    db.run(query, [
        centerName, centerCode, country, address, adminName, adminEmail, 
        campaignId, status, admin_username, admin_password, centerId
    ], function(err) {
        if (err) {
            console.error('Error updating center:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to update center' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'Center not found' });
        }

        res.json({
            success: true,
            message: 'Center updated successfully'
        });
    });
});

// PUT /api/centers/:id/reset-password - Reset center admin password
app.put('/api/centers/:id/reset-password', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const centerId = req.params.id;
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ success: false, error: 'Password is required' });
    }

    const query = `
        UPDATE centers SET
            admin_password = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;

    db.run(query, [password, centerId], function(err) {
        if (err) {
            console.error('Error resetting center password:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to reset password' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'Center not found' });
        }

        res.json({
            success: true,
            message: 'Password reset successfully'
        });
    });
});

// DELETE /api/centers/:id - Delete center (soft delete)
app.delete('/api/centers/:id', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const centerId = req.params.id;

    const query = `
        UPDATE centers 
        SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;

    db.run(query, [centerId], function(err) {
        if (err) {
            console.error('Error deleting center:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to delete center' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'Center not found' });
        }

        res.json({
            success: true,
            message: 'Center deleted successfully'
        });
    });
});

// ==================== CENTER ADMIN API ROUTES ====================

// GET /api/center-admin/dashboard - Get center admin dashboard data
app.get('/api/center-admin/dashboard', authenticateToken, checkRole(['center_admin']), (req, res) => {
    const userId = req.user.id;
    
    // Get center info for the logged-in center admin
    const centerQuery = `
        SELECT c.*, camp.campaign_name 
        FROM centers c
        LEFT JOIN campaigns camp ON c.campaign_id = camp.id
        WHERE c.id = (SELECT center_id FROM users WHERE id = ?)
    `;
    
    db.get(centerQuery, [userId], (err, center) => {
        if (err) {
            console.error('Error fetching center data:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to fetch center data' });
        }
        
        if (!center) {
            return res.status(404).json({ success: false, error: 'Center not found for this admin' });
        }
        
        console.log('Center data fetched for user', userId, ':', center);
        
        // Get real metrics from database
        
        // Get total agents count
        const totalAgentsQuery = `SELECT COUNT(*) as count FROM users 
                                  WHERE center_id = ? AND role IN ('agent', 'team_leader', 'manager', 'sme') 
                                  AND status != 'deleted'`;
        
        // Get active agents count
        const activeAgentsQuery = `SELECT COUNT(*) as count FROM users 
                                   WHERE center_id = ? AND role IN ('agent', 'team_leader', 'manager', 'sme') 
                                   AND status = 'active'`;
        
        // Get active campaigns count
        const activeCampaignsQuery = `SELECT COUNT(DISTINCT c.id) as count 
                                      FROM campaigns c
                                      JOIN campaign_center_assignments cca ON c.id = cca.campaign_id
                                      WHERE cca.center_id = ? AND cca.status = 'active' AND c.status = 'active'`;
        
        // Get actual total revenue earned from all campaigns
        const revenueQuery = `SELECT SUM(rt.center_cost) as total_revenue
                              FROM revenue_tracking rt
                              WHERE rt.center_id = ?`;
        
        // Execute all queries
        Promise.all([
            new Promise((resolve, reject) => {
                db.get(totalAgentsQuery, [center.id], (err, result) => {
                    if (err) reject(err);
                    else resolve(result.count);
                });
            }),
            new Promise((resolve, reject) => {
                db.get(activeAgentsQuery, [center.id], (err, result) => {
                    if (err) reject(err);
                    else resolve(result.count);
                });
            }),
            new Promise((resolve, reject) => {
                db.get(activeCampaignsQuery, [center.id], (err, result) => {
                    if (err) reject(err);
                    else resolve(result.count);
                });
            }),
            new Promise((resolve, reject) => {
                db.get(revenueQuery, [center.id], (err, result) => {
                    if (err) reject(err);
                    else resolve(result.total_revenue || 0);
                });
            })
        ]).then(([totalAgents, activeAgents, activeCampaigns, totalRevenue]) => {
            // Get real leads count for today
            const todaysLeadsQuery = `SELECT COUNT(*) as count FROM lead_submissions ls 
                                      JOIN users u ON ls.agent_id = u.id 
                                      WHERE u.center_id = ? AND DATE(ls.created_at) = DATE('now')`;
            
            db.get(todaysLeadsQuery, [center.id], (err, leadsResult) => {
                const todaysLeads = leadsResult ? leadsResult.count : 0;
                
                // Calculate real conversion rate from leads
                const conversionQuery = `SELECT 
                    COUNT(*) as total_leads,
                    COUNT(CASE WHEN ls.sales_status IN ('installed', 'sold', 'closed') THEN 1 END) as conversions
                    FROM lead_submissions ls 
                    JOIN users u ON ls.agent_id = u.id 
                    WHERE u.center_id = ? AND DATE(ls.created_at) >= DATE('now', '-30 days')`;
                
                db.get(conversionQuery, [center.id], (convErr, convResult) => {
                    const conversionRate = convResult && convResult.total_leads > 0 
                        ? ((convResult.conversions / convResult.total_leads) * 100).toFixed(1)
                        : 0;
            
            const metrics = {
                totalAgents: totalAgents,
                activeAgents: activeAgents,
                activeCampaigns: activeCampaigns,
                        todaysLeads: todaysLeads,
                        conversionRate: parseFloat(conversionRate),
                revenue: totalRevenue,
                centerStatus: center.status || 'active'
            };
            
            console.log('Sending response with center:', center);
            console.log('Center name being sent:', center.center_name);
            
            res.json({
                success: true,
                center: center,
                metrics: metrics
                    });
                });
            });
        }).catch(error => {
            console.error('Error calculating metrics:', error);
            // Fallback to mock data if queries fail
            const metrics = {
                totalAgents: 0,
                activeAgents: 0,
                activeCampaigns: 0,
                todaysCalls: 0,
                todaysLeads: 0,
                conversionRate: 0,
                revenue: 0,
                avgCallDuration: '0:00',
                centerStatus: center.status || 'active'
            };
            
            res.json({
                success: true,
                center: center,
                metrics: metrics
            });
        });
    });
});

// GET /api/center-admin/agents - Get all agents for the center admin
app.get('/api/center-admin/agents', authenticateToken, checkRole(['center_admin']), (req, res) => {
    const userId = req.user.id;
    
    // Get center_id for the logged-in center admin
    db.get('SELECT center_id FROM users WHERE id = ?', [userId], (err, adminUser) => {
        if (err || !adminUser) {
            return res.status(500).json({ success: false, error: 'Failed to get center information' });
        }
        
        const query = `
            SELECT u.id, u.user_id as agent_id, u.username, u.title, u.name, u.alias, u.email, u.phone, 
                   u.role, u.status, u.created_at, u.last_login, u.temp_password, u.first_login, u.current_password, u.campaign_id,
                   u.date_of_birth, c.campaign_name
            FROM users u
            LEFT JOIN campaigns c ON u.campaign_id = c.id
            WHERE u.center_id = ? 
            AND u.role IN ('agent', 'team_leader', 'manager', 'sme')
            AND u.status != 'deleted'
            ORDER BY u.created_at DESC
        `;
        
        db.all(query, [adminUser.center_id], (err, agents) => {
            if (err) {
                console.error('Error fetching agents:', err.message);
                return res.status(500).json({ success: false, error: 'Failed to fetch agents' });
            }
            
            res.json({ success: true, agents: agents || [] });
        });
    });
});

// POST /api/center-admin/agents - Create new agent
app.post('/api/center-admin/agents', authenticateToken, checkRole(['center_admin']), async (req, res) => {
    const { title, name, alias, email, phone, role, agent_id, temp_password, campaign_id, date_of_birth } = req.body;
    const userId = req.user.id;
    
    await SystemLogger.info('system', 'POST /api/center-admin/agents', 'Agent creation request received', {
        agentName: name,
        agentId: agent_id,
        alias,
        email,
        campaignId: campaign_id,
        centerId: req.user.center_id,
        createdBy: req.user.username
    }, req);
    
    if (!name || !email || !agent_id || !temp_password || !title || !campaign_id) {
        return res.status(400).json({ success: false, error: 'Name, email, agent ID, password, title, and campaign are required' });
    }
    
    try {
        // Get center_id for the logged-in center admin
        const adminUser = await new Promise((resolve, reject) => {
            db.get('SELECT center_id FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) reject(err);
                else resolve(user);
            });
        });
        
        if (!adminUser) {
            return res.status(500).json({ success: false, error: 'Failed to get center information' });
        }
        
        // Check for duplicate alias globally within the same campaign
        if (alias && alias.trim()) {
            const existingAlias = await new Promise((resolve, reject) => {
                db.get('SELECT id, name FROM users WHERE campaign_id = ? AND alias = ? AND alias IS NOT NULL AND alias != ""', 
                    [campaign_id, alias.trim()], (err, user) => {
                    if (err) reject(err);
                    else resolve(user);
                });
            });
            
            if (existingAlias) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Alias "${alias}" is already taken by another agent (${existingAlias.name}) in this campaign. Please choose a different alias.` 
                });
            }
        }
        
        // Hash the temporary password
        const hashedPassword = await bcrypt.hash(temp_password, 10);
        
        // Insert new agent
        const insertQuery = `
            INSERT INTO users (user_id, username, password, title, name, alias, email, phone, role, center_id, status, temp_password, first_login, campaign_id, date_of_birth, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, 1, ?, ?, CURRENT_TIMESTAMP)
        `;
        
        db.run(insertQuery, [agent_id, agent_id, hashedPassword, title, name, alias || '', email, phone || '', role, adminUser.center_id, temp_password, campaign_id, date_of_birth || null], function(err) {
            if (err) {
                console.error('Error creating agent:', err.message);
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ success: false, error: 'Agent ID already exists' });
                }
                return res.status(500).json({ success: false, error: 'Failed to create agent' });
            }
            
            res.json({ 
                success: true, 
                agent: {
                    id: this.lastID,
                    agent_id,
                    title,
                    name,
                    alias,
                    email,
                    phone,
                    role,
                    temp_password,
                    campaign_id,
                    date_of_birth
                }
            });
        });
    } catch (error) {
        console.error('Error creating agent:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// POST /api/center-admin/generate-alias - Generate AI alias suggestions
app.post('/api/center-admin/generate-alias', authenticateToken, checkRole(['center_admin']), async (req, res) => {
    const { agentName, agentTitle, campaignId } = req.body;
    const userId = req.user.id;
    
    if (!agentName) {
        return res.status(400).json({ success: false, error: 'Agent name is required' });
    }
    
    try {
        // Get center_id for the logged-in center admin
        const adminUser = await new Promise((resolve, reject) => {
            db.get('SELECT center_id FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) reject(err);
                else resolve(user);
            });
        });
        
        if (!adminUser) {
            return res.status(500).json({ success: false, error: 'Failed to get center information' });
        }
        
        // Get existing aliases GLOBALLY for the specific campaign to avoid duplicates
        let existingAliases = [];
        if (campaignId) {
            // Campaign-specific global alias check
            existingAliases = await new Promise((resolve, reject) => {
                db.all('SELECT DISTINCT alias FROM users WHERE campaign_id = ? AND alias IS NOT NULL AND alias != ""', 
                    [campaignId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.map(row => row.alias));
                });
            });
            console.log(`Found ${existingAliases.length} existing aliases globally for campaign ${campaignId}:`, existingAliases);
        } else {
            // Fallback to center-level check if no campaign specified
            existingAliases = await new Promise((resolve, reject) => {
                db.all('SELECT DISTINCT alias FROM users WHERE center_id = ? AND alias IS NOT NULL AND alias != ""', 
                    [adminUser.center_id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows.map(row => row.alias));
                });
            });
            console.log(`Found ${existingAliases.length} existing aliases for center ${adminUser.center_id}:`, existingAliases);
        }
        
        // Get campaign target country if campaign is selected
        let targetCountry = 'United States'; // Default
        if (campaignId) {
            const campaign = await new Promise((resolve, reject) => {
                db.get('SELECT country FROM campaigns WHERE id = ?', [campaignId], (err, campaign) => {
                    if (err) reject(err);
                    else resolve(campaign);
                });
            });
            if (campaign && campaign.country) {
                targetCountry = campaign.country;
            }
        }
        
        // Generate AI-powered alias suggestions using OpenRouter
        const aiSuggestions = await generateAIAliasSuggestions(agentName, agentTitle, targetCountry, existingAliases);
        
        res.json({ 
            success: true, 
            suggestions: aiSuggestions,
            targetCountry: targetCountry
        });
        
    } catch (error) {
        console.error('Error generating alias suggestions:', error);
        res.status(500).json({ success: false, error: 'Failed to generate alias suggestions' });
    }
});

// AI-powered alias suggestions using OpenRouter API
async function generateAIAliasSuggestions(agentName, agentTitle, targetCountry, existingAliases) {
    const OPENROUTER_API_KEY = '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';
    
    // Try multiple free models in order of preference
    const freeModels = [
        'mistralai/mistral-7b-instruct:free',
        'google/gemma-7b-it:free', 
        'meta-llama/llama-3.2-1b-instruct:free',
        'huggingfaceh4/zephyr-7b-beta:free',
        'openchat/openchat-7b:free'
    ];
    
    try {
        const existingAliasesText = existingAliases.length > 0 
            ? `Avoid these existing aliases: ${existingAliases.join(', ')}. ` 
            : '';
        
        const titleText = agentTitle ? `Agent's title: "${agentTitle}"` : '';
        const genderHint = agentTitle === 'Mr' ? 'male' : 
                          agentTitle === 'Ms' || agentTitle === 'Mrs' ? 'female' : 
                          agentTitle === 'Mx' ? 'gender-neutral' :
                          'appropriate gender based on the name';
        
        const prompt = `You are an expert at generating professional alias names for call center agents. 

Agent's real name: "${agentName}"
${titleText}
Target country for calls: "${targetCountry}"
${existingAliasesText}

Generate exactly 3 professional, culturally appropriate ${genderHint} alias names for this agent to use when calling customers in ${targetCountry}. The aliases should:
1. Match the ${agentTitle ? `gender indicated by the title "${agentTitle}"` : 'likely gender of the agent based on their name'}
2. Be common, trustworthy names in ${targetCountry}
3. Be suitable for business/sales calls
4. Be different from any existing aliases listed above
5. Be short and easy to pronounce

Respond with ONLY the 3 names separated by commas, nothing else. Example format: "Mike, John, David"`;

        // Try each model until one works
        for (const model of freeModels) {
            console.log(`Trying AI model: ${model}`);
            
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'Vertex CRM Alias Generator'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 100,
                    temperature: 0.7,
                    top_p: 1,
                    frequency_penalty: 0,
                    presence_penalty: 0
                })
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`✅ AI model ${model} worked! Response:`, JSON.stringify(data, null, 2));
                
                const aiResponse = data.choices[0]?.message?.content?.trim();
                
                if (aiResponse) {
                    console.log('AI Response Content:', aiResponse);
                    // Parse the AI response and clean up the names
                    const suggestions = aiResponse
                        .split(',')
                        .map(name => name.trim().replace(/['"]/g, ''))
                        .filter(name => name && name.length > 0)
                        .slice(0, 3);
                    
                    console.log('Parsed AI Suggestions:', suggestions);
                    
                    // If AI returned valid suggestions, use them
                    if (suggestions.length > 0) {
                        return suggestions;
                    }
                }
            } else {
                const errorData = await response.text();
                console.error(`❌ Model ${model} failed - Status:`, response.status);
                console.error(`❌ Model ${model} error:`, errorData);
                // Continue to next model
                continue;
            }
        }
        
        // If all models failed, fallback to mock suggestions
        console.log('🔄 All AI models failed, falling back to mock suggestions');
        return generateMockAliasSuggestions(agentName, agentTitle, targetCountry, existingAliases);
        
    } catch (error) {
        console.error('Error calling OpenRouter API:', error);
        // Fallback to mock suggestions if AI fails
        return generateMockAliasSuggestions(agentName, agentTitle, targetCountry, existingAliases);
    }
}

// Fallback mock function for when AI API fails
function generateMockAliasSuggestions(agentName, agentTitle, targetCountry, existingAliases) {
    // Determine gender based on title first, then fallback to name patterns
    let isMale = false;
    let isFemale = false;
    
    if (agentTitle) {
        // Use title for accurate gender determination
        isMale = agentTitle === 'Mr';
        isFemale = agentTitle === 'Ms' || agentTitle === 'Mrs';
        const isNeutral = agentTitle === 'Mx';
        console.log(`Gender detection using title "${agentTitle}": isMale=${isMale}, isFemale=${isFemale}, isNeutral=${isNeutral}`);
    } else {
        // Fallback to name-based detection if no title
        const firstName = agentName.split(' ')[0].toLowerCase();
        const maleNames = ['raj', 'amit', 'rohit', 'vikash', 'suresh', 'ramesh', 'kumar', 'dev', 'arjun', 'ravi', 'anil', 'deepak', 'manoj', 'sanjay', 'vinod', 'ashok', 'rakesh', 'mukesh', 'dinesh', 'mahesh', 'vineet'];
        const femaleNames = ['priya', 'sunita', 'kavita', 'meera', 'sita', 'geeta', 'rani', 'devi', 'maya', 'rita', 'rachna', 'pooja', 'neha', 'anjali', 'shweta', 'sapna', 'ritu', 'nisha', 'seema', 'rekha', 'anita', 'mamta', 'kiran', 'jyoti', 'preeti', 'swati', 'bharti', 'deepika', 'nikita', 'komal', 'sushila', 'sushma', 'usha', 'lata', 'mala', 'kamala', 'radha', 'shanti', 'lakshmi', 'saraswati', 'parvati', 'durga', 'kalpana', 'vandana', 'archana', 'asha', 'suman', 'pushpa', 'sunanda', 'savita'];
        
        isMale = maleNames.some(name => firstName.includes(name) || name.includes(firstName));
        isFemale = femaleNames.some(name => firstName.includes(name) || name.includes(firstName));
        console.log(`Gender detection using name "${firstName}": isMale=${isMale}, isFemale=${isFemale}`);
    }
    
    let suggestions = [];
    const isNeutral = agentTitle === 'Mx';
    
    if (targetCountry.toLowerCase().includes('united states') || targetCountry.toLowerCase().includes('usa')) {
        if (isNeutral) {
            suggestions = ['Alex', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Avery', 'Quinn', 'Cameron', 'Drew', 'Sage'];
        } else if (isFemale) {
            suggestions = ['Sarah', 'Emily', 'Jessica', 'Ashley', 'Amanda', 'Lisa', 'Michelle', 'Jennifer', 'Amy', 'Nicole'];
        } else {
            suggestions = ['Mike', 'John', 'David', 'Chris', 'Brad', 'Nick', 'Steve', 'Mark', 'Tom', 'Dan'];
        }
    } else if (targetCountry.toLowerCase().includes('united kingdom') || targetCountry.toLowerCase().includes('uk')) {
        if (isNeutral) {
            suggestions = ['Alex', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Avery', 'Quinn', 'Cameron', 'Drew', 'Sage'];
        } else if (isFemale) {
            suggestions = ['Emma', 'Olivia', 'Sophie', 'Charlotte', 'Grace', 'Lily', 'Emily', 'Chloe', 'Mia', 'Lucy'];
        } else {
            suggestions = ['James', 'Oliver', 'Harry', 'Charlie', 'George', 'William', 'Thomas', 'Henry', 'Jack', 'Luke'];
        }
    } else if (targetCountry.toLowerCase().includes('australia')) {
        if (isNeutral) {
            suggestions = ['Alex', 'Jordan', 'Taylor', 'Casey', 'Riley', 'Avery', 'Quinn', 'Cameron', 'Drew', 'Sage'];
        } else if (isFemale) {
            suggestions = ['Charlotte', 'Olivia', 'Ava', 'Amelia', 'Mia', 'Grace', 'Zoe', 'Ella', 'Sophie', 'Ruby'];
        } else {
            suggestions = ['Liam', 'Noah', 'Jack', 'Luke', 'Mason', 'Cooper', 'Max', 'Ryan', 'Alex', 'Sam'];
        }
    } else {
        // Default to US names
        if (isNeutral) {
            suggestions = ['Alex', 'Jordan', 'Taylor', 'Casey', 'Riley'];
        } else if (isFemale) {
            suggestions = ['Sarah', 'Emily', 'Jessica', 'Ashley', 'Amanda'];
        } else {
            suggestions = ['Mike', 'John', 'David', 'Chris', 'Brad'];
        }
    }
    
    // Filter out existing aliases and return 3 unique suggestions
    const availableSuggestions = suggestions.filter(name => 
        !existingAliases.some(existing => existing.toLowerCase() === name.toLowerCase())
    );
    
    return availableSuggestions.slice(0, 3);
}

// PUT /api/center-admin/agents/:id/reset-password - Reset agent password
app.put('/api/center-admin/agents/:id/reset-password', authenticateToken, checkRole(['center_admin']), async (req, res) => {
    const agentId = req.params.id;
    const { temp_password } = req.body;
    const userId = req.user.id;
    
    if (!temp_password) {
        return res.status(400).json({ success: false, error: 'New password is required' });
    }
    
    try {
        // Get center_id for the logged-in center admin
        const adminUser = await new Promise((resolve, reject) => {
            db.get('SELECT center_id FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) reject(err);
                else resolve(user);
            });
        });
        
        if (!adminUser) {
            return res.status(500).json({ success: false, error: 'Failed to get center information' });
        }
        
        // Hash the new password
        const hashedPassword = await bcrypt.hash(temp_password, 10);
        
        // Update agent password (only for agents in the same center)
        const updateQuery = `
            UPDATE users 
            SET password = ?, temp_password = ?, first_login = 1, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND center_id = ?
        `;
        
        db.run(updateQuery, [hashedPassword, temp_password, agentId, adminUser.center_id], function(err) {
            if (err) {
                console.error('Error resetting password:', err.message);
                return res.status(500).json({ success: false, error: 'Failed to reset password' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ success: false, error: 'Agent not found or access denied' });
            }
            
            res.json({ success: true, message: 'Password reset successfully' });
        });
    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// GET /api/center-admin/agents/:id/password - Get agent's temporary password
app.get('/api/center-admin/agents/:id/password', authenticateToken, checkRole(['center_admin']), async (req, res) => {
    const agentId = req.params.id;
    const userId = req.user.id;
    
    try {
        // Get center_id for the logged-in center admin
        const adminUser = await new Promise((resolve, reject) => {
            db.get('SELECT center_id FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) reject(err);
                else resolve(user);
            });
        });
        
        if (!adminUser) {
            return res.status(500).json({ success: false, error: 'Failed to get center information' });
        }
        
        // Get agent's temporary password (only for agents in the same center)
        const query = `
            SELECT temp_password 
            FROM users 
            WHERE id = ? AND center_id = ? AND role IN ('agent', 'team_leader', 'manager', 'sme')
        `;
        
        db.get(query, [agentId, adminUser.center_id], (err, agent) => {
            if (err) {
                console.error('Error fetching agent password:', err.message);
                return res.status(500).json({ success: false, error: 'Failed to fetch password' });
            }
            
            if (!agent) {
                return res.status(404).json({ success: false, error: 'Agent not found or access denied' });
            }
            
            res.json({ 
                success: true, 
                temp_password: agent.temp_password 
            });
        });
    } catch (error) {
        console.error('Error fetching agent password:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch password' });
    }
});

// PUT /api/center-admin/agents/:id - Update agent details
app.put('/api/center-admin/agents/:id', authenticateToken, checkRole(['center_admin']), async (req, res) => {
    const agentId = req.params.id;
    const { email, phone, campaign_id, date_of_birth } = req.body;
    const userId = req.user.id;
    
    if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required' });
    }
    
    try {
        // Get center_id for the logged-in center admin
        const adminUser = await new Promise((resolve, reject) => {
            db.get('SELECT center_id FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) reject(err);
                else resolve(user);
            });
        });
        
        if (!adminUser) {
            return res.status(500).json({ success: false, error: 'Failed to get center information' });
        }
        
        // Update agent details (only for agents in the same center)
        const updateQuery = `
            UPDATE users 
            SET email = ?, phone = ?, campaign_id = ?, date_of_birth = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND center_id = ? AND role IN ('agent', 'team_leader', 'manager', 'sme')
        `;
        
        db.run(updateQuery, [email, phone || '', campaign_id || null, date_of_birth || null, agentId, adminUser.center_id], function(err) {
            if (err) {
                console.error('Error updating agent:', err.message);
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ success: false, error: 'Email already exists' });
                }
                return res.status(500).json({ success: false, error: 'Failed to update agent' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ success: false, error: 'Agent not found or access denied' });
            }
            
            // Log activity
            db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
                [userId, 'update_agent', `Agent with ID ${agentId} updated`]);
            
            res.json({ success: true, message: 'Agent updated successfully' });
        });
    } catch (error) {
        console.error('Error updating agent:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// GET /api/center-admin/agent-performance - Get agent performance data for center admin
app.get('/api/center-admin/agent-performance', authenticateToken, checkRole(['center_admin']), (req, res) => {
    const userId = req.user.id;
    const campaignId = req.query.campaign_id;
    
    // Get center_id for the logged-in center admin
    db.get('SELECT center_id FROM users WHERE id = ?', [userId], (err, adminUser) => {
        if (err || !adminUser) {
            return res.status(500).json({ success: false, error: 'Failed to get center information' });
        }
        
        let query = `
            SELECT 
                u.id as agent_id,
                u.name as agent_name,
                u.username,
                COUNT(DISTINCT ls.id) as total_leads,
                COUNT(DISTINCT CASE WHEN ls.validation_status = 'clean' THEN ls.id END) as successful_submissions,
                COUNT(DISTINCT CASE WHEN ls.sales_status = 'installed' THEN ls.id END) as conversions,
                COALESCE(SUM(CASE WHEN ls.sales_status = 'installed' THEN COALESCE(cca.center_commission, 0) ELSE 0 END), 0) as revenue,
                COUNT(DISTINCT CASE WHEN DATE(ls.created_at) = DATE('now') THEN ls.id END) as today_leads,
                COUNT(DISTINCT CASE WHEN DATE(ls.created_at) >= DATE('now', '-7 days') THEN ls.id END) as week_leads
            FROM users u
            LEFT JOIN lead_submissions ls ON u.id = ls.agent_id
            LEFT JOIN lead_forms lf ON ls.form_id = lf.id
            LEFT JOIN campaigns c ON lf.campaign_id = c.id
            LEFT JOIN campaign_center_assignments cca ON c.id = cca.campaign_id AND u.center_id = cca.center_id
            WHERE u.center_id = ? 
            AND u.role IN ('agent', 'team_leader', 'manager', 'sme')
            AND u.status = 'active'
        `;
        
        let params = [adminUser.center_id];
        
        // Add campaign filter if specified
        if (campaignId && campaignId !== 'all') {
            query += ' AND c.id = ?';
            params.push(campaignId);
        }
        
        query += `
            GROUP BY u.id, u.name, u.username
            ORDER BY total_leads DESC, successful_submissions DESC
        `;
        
        db.all(query, params, (err, agents) => {
            if (err) {
                console.error('Error fetching agent performance:', err.message);
                return res.status(500).json({ success: false, error: 'Failed to fetch agent performance data' });
            }
            
            // If no real data, return empty array
            if (!agents || agents.length === 0) {
                return res.json({ success: true, agents: [] });
            }
            
            res.json({ success: true, agents: agents });
        });
    });
});

// GET /api/center-admin/daily-activity - Get daily activity data for center admin
app.get('/api/center-admin/daily-activity', authenticateToken, checkRole(['center_admin']), (req, res) => {
    const userId = req.user.id;
    const days = parseInt(req.query.days) || 30;
    
    // Get center_id for the logged-in center admin
    db.get('SELECT center_id FROM users WHERE id = ?', [userId], (err, adminUser) => {
        if (err || !adminUser) {
            return res.status(500).json({ success: false, error: 'Failed to get center information' });
        }
        
        const query = `
            SELECT 
                DATE(ls.created_at) as date,
                COUNT(DISTINCT ls.id) as total_leads,
                COUNT(DISTINCT CASE WHEN ls.validation_status = 'clean' THEN ls.id END) as successful_submissions,
                COUNT(DISTINCT CASE 
                    WHEN c.payment_type = 'per_install' AND ls.sales_status = 'installed' THEN ls.id
                    WHEN c.payment_type = 'per_sale' AND (ls.sales_status IN ('sold', 'closed') OR ls.forwarded_to_client = 1) THEN ls.id
                    WHEN c.payment_type = 'per_lead' AND ls.validation_status = 'clean' THEN ls.id
                    WHEN LOWER(c.campaign_name) LIKE '%vivint%' AND ls.sales_status = 'installed' THEN ls.id
                    WHEN LOWER(c.campaign_name) LIKE '%home security%' AND ls.sales_status = 'installed' THEN ls.id
                    WHEN LOWER(c.campaign_name) LIKE '%security system%' AND ls.sales_status = 'installed' THEN ls.id
                    WHEN c.campaign_type = 'home_security' AND ls.sales_status = 'installed' THEN ls.id
                    WHEN c.campaign_type = 'solar' AND ls.sales_status = 'installed' THEN ls.id
                    WHEN c.campaign_type = 'insurance' AND ls.sales_status IN ('policy_active', 'sold') THEN ls.id
                    WHEN c.campaign_type = 'telecom' AND ls.sales_status = 'service_activated' THEN ls.id
                    WHEN c.campaign_type = 'lead_generation' AND ls.forwarded_to_client = 1 THEN ls.id
                    WHEN ls.sales_status = 'installed' THEN ls.id  -- Default fallback
                END) as conversions
            FROM lead_submissions ls
            LEFT JOIN lead_forms lf ON ls.form_id = lf.id
            LEFT JOIN campaigns c ON lf.campaign_id = c.id
            WHERE ls.center_id = ?
            AND DATE(ls.created_at) >= DATE('now', '-${days} days')
            GROUP BY DATE(ls.created_at)
            ORDER BY DATE(ls.created_at) ASC
        `;
        
        db.all(query, [adminUser.center_id], (err, results) => {
            if (err) {
                console.error('Error fetching daily activity:', err.message);
                return res.status(500).json({ success: false, error: 'Failed to fetch daily activity data' });
            }
            
            // If no real data, return empty array
            if (!results || results.length === 0) {
                return res.json({ success: true, activity: [] });
            }
            
            // Fill in missing dates with zero values
            const activityMap = new Map();
            results.forEach(row => {
                activityMap.set(row.date, row);
            });
            
            const completeData = [];
            const today = new Date();
            
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                
                if (activityMap.has(dateStr)) {
                    completeData.push(activityMap.get(dateStr));
                } else {
                    completeData.push({
                        date: dateStr,
                        total_leads: 0,
                        successful_submissions: 0,
                        conversions: 0
                    });
                }
            }
            
            res.json({ success: true, activity: completeData });
        });
    });
});

// GET /api/campaigns/:id/conversion-rules - Get conversion rules for a campaign
app.get('/api/campaigns/:id/conversion-rules', authenticateToken, checkRole(['super_admin', 'center_admin']), (req, res) => {
    const campaignId = req.params.id;
    
    const query = `
        SELECT ccr.*, c.campaign_name, c.campaign_type, c.payment_type, c.conversion_strategy
        FROM campaign_conversion_rules ccr
        LEFT JOIN campaigns c ON ccr.campaign_id = c.id
        WHERE ccr.campaign_id = ? AND ccr.is_active = 1
        ORDER BY ccr.priority ASC
    `;
    
    db.all(query, [campaignId], (err, rules) => {
        if (err) {
            console.error('Error fetching conversion rules:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to fetch conversion rules' });
        }
        
        res.json({ success: true, rules: rules || [] });
    });
});

// POST /api/campaigns/:id/conversion-rules - Create conversion rule for a campaign
app.post('/api/campaigns/:id/conversion-rules', authenticateToken, checkRole(['super_admin']), (req, res) => {
    const campaignId = req.params.id;
    const { conversion_type, conversion_criteria, priority } = req.body;
    
    if (!conversion_type || !conversion_criteria) {
        return res.status(400).json({ 
            success: false, 
            error: 'Conversion type and criteria are required' 
        });
    }
    
    const query = `
        INSERT INTO campaign_conversion_rules (campaign_id, conversion_type, conversion_criteria, priority)
        VALUES (?, ?, ?, ?)
    `;
    
    db.run(query, [campaignId, conversion_type, JSON.stringify(conversion_criteria), priority || 1], function(err) {
        if (err) {
            console.error('Error creating conversion rule:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to create conversion rule' });
        }
        
        res.json({ 
            success: true, 
            rule_id: this.lastID,
            message: 'Conversion rule created successfully' 
        });
    });
});

// PUT /api/leads/:id/status - Update lead sales status (for conversion tracking)
app.put('/api/leads/:id/status', authenticateToken, checkRole(['center_admin', 'super_admin']), (req, res) => {
    const leadId = req.params.id;
    const { sales_status, notes } = req.body;
    const userId = req.user.id;
    
    if (!sales_status) {
        return res.status(400).json({ 
            success: false, 
            error: 'Sales status is required' 
        });
    }
    
    // Valid status values for home security campaigns
    const validStatuses = [
        'transferred', 'follow-up', 'installed', 'cancelled', 
        'no_show', 'not_interested', 'callback_scheduled'
    ];
    
    if (!validStatuses.includes(sales_status)) {
        return res.status(400).json({ 
            success: false, 
            error: `Invalid status. Valid options: ${validStatuses.join(', ')}` 
        });
    }
    
    const query = `
        UPDATE lead_submissions 
        SET sales_status = ?, 
            status_updated_at = CURRENT_TIMESTAMP,
            status_updated_by = ?,
            status_notes = ?
        WHERE id = ?
    `;
    
    db.run(query, [sales_status, userId, notes || null, leadId], function(err) {
        if (err) {
            console.error('Error updating lead status:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to update lead status' });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ success: false, error: 'Lead not found' });
        }
        
        // Log the status change
        db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
            [userId, 'update_lead_status', `Lead ${leadId} status updated to ${sales_status}`]);
        
        res.json({ 
            success: true, 
            message: `Lead status updated to ${sales_status}`,
            lead_id: leadId,
            new_status: sales_status
        });
    });
});

// GET /api/leads/conversion-pipeline - Get leads in conversion pipeline for Vivint/Home Security
app.get('/api/leads/conversion-pipeline', authenticateToken, checkRole(['center_admin', 'super_admin']), (req, res) => {
    const userId = req.user.id;
    
    // Get center_id for center admin, or allow super admin to see all
    let centerFilter = '';
    let params = [];
    
    if (req.user.role === 'center_admin') {
        centerFilter = 'AND ls.center_id = (SELECT center_id FROM users WHERE id = ?)';
        params.push(userId);
    }
    
    const query = `
        SELECT 
            ls.id,
            ls.first_name,
            ls.last_name,
            ls.phone,
            ls.sales_status,
            ls.created_at,
            ls.status_updated_at,
            c.campaign_name,
            c.campaign_type,
            u.name as agent_name,
            CASE 
                WHEN ls.sales_status = 'transferred' THEN 'Pending Installation'
                WHEN ls.sales_status = 'follow-up' THEN 'Follow-up Required'
                WHEN ls.sales_status = 'installed' THEN 'Successfully Installed'
                WHEN ls.sales_status = 'cancelled' THEN 'Cancelled'
                ELSE ls.sales_status
            END as status_display
        FROM lead_submissions ls
        LEFT JOIN lead_forms lf ON ls.form_id = lf.id
        LEFT JOIN campaigns c ON lf.campaign_id = c.id
        LEFT JOIN users u ON ls.agent_id = u.id
        WHERE (
            LOWER(c.campaign_name) LIKE '%vivint%' 
            OR LOWER(c.campaign_name) LIKE '%home security%'
            OR LOWER(c.campaign_name) LIKE '%security system%'
            OR c.campaign_type = 'home_security'
        )
        ${centerFilter}
        AND ls.validation_status = 'clean'
        ORDER BY ls.created_at DESC
        LIMIT 100
    `;
    
    db.all(query, params, (err, leads) => {
        if (err) {
            console.error('Error fetching conversion pipeline:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to fetch conversion pipeline' });
        }
        
        // Group by status for easy overview
        const pipeline = {
            transferred: leads.filter(l => l.sales_status === 'transferred'),
            follow_up: leads.filter(l => l.sales_status === 'follow-up'),
            installed: leads.filter(l => l.sales_status === 'installed'),
            cancelled: leads.filter(l => l.sales_status === 'cancelled'),
            other: leads.filter(l => !['transferred', 'follow-up', 'installed', 'cancelled'].includes(l.sales_status))
        };
        
        res.json({ 
            success: true, 
            pipeline: pipeline,
            total_leads: leads.length,
            conversion_rate: leads.length > 0 ? (pipeline.installed.length / leads.length * 100).toFixed(2) : 0
        });
    });
});

// GET /api/center-admin/agent-attendance-heatmap - Agent attendance heatmap data
app.get('/api/center-admin/agent-attendance-heatmap', authenticateToken, checkRole(['center_admin', 'super_admin']), (req, res) => {
    const userId = req.user.id;
    const days = parseInt(req.query.days) || 90; // Default 90 days for good heatmap view
    
    // Get center_id for center admin, or allow super admin to see all
    let centerFilter = '';
    let params = [days, days, days]; // days parameter used 3 times in the query
    
    if (req.user.role === 'center_admin') {
        centerFilter = 'AND u.center_id = (SELECT center_id FROM users WHERE id = ?)';
        params.push(userId);
    }
    
    const query = `
        WITH RECURSIVE date_range AS (
            SELECT DATE('now') as date, 0 as day_offset
            UNION ALL
            SELECT DATE('now', '-' || (day_offset + 1) || ' days'), day_offset + 1
            FROM date_range
            WHERE day_offset < ?
        ),
        agent_list AS (
            SELECT DISTINCT u.id, u.name, u.username
            FROM users u
            WHERE u.role IN ('agent', 'team_leader', 'manager', 'sme')
            AND u.status = 'active'
            ${centerFilter}
        ),
        daily_attendance AS (
            SELECT 
                u.id as agent_id,
                u.name as agent_name,
                DATE(ats.login_time) as date,
                COUNT(DISTINCT ats.id) as login_sessions,
                MIN(ats.login_time) as first_login,
                MAX(COALESCE(ats.logout_time, CURRENT_TIMESTAMP)) as last_activity,
                ROUND(
                    (JULIANDAY(MAX(COALESCE(ats.logout_time, CURRENT_TIMESTAMP))) - 
                     JULIANDAY(MIN(ats.login_time))) * 24, 2
                ) as hours_worked
            FROM users u
            LEFT JOIN attendance_sessions ats ON u.id = ats.user_id 
                AND DATE(ats.login_time) >= DATE('now', '-' || ? || ' days')
            WHERE u.role IN ('agent', 'team_leader', 'manager', 'sme')
            AND u.status = 'active'
            ${centerFilter}
            GROUP BY u.id, u.name, DATE(ats.login_time)
        ),
        daily_productivity AS (
            SELECT 
                ls.agent_id,
                DATE(ls.created_at) as date,
                COUNT(DISTINCT ls.id) as leads_submitted,
                COUNT(DISTINCT CASE WHEN ls.validation_status = 'clean' THEN ls.id END) as successful_submissions,
                COUNT(DISTINCT CASE WHEN ls.sales_status = 'installed' THEN ls.id END) as conversions
            FROM lead_submissions ls
            LEFT JOIN users u ON ls.agent_id = u.id
            WHERE DATE(ls.created_at) >= DATE('now', '-' || ? || ' days')
            ${centerFilter.replace('u.center_id', 'u.center_id')}
            GROUP BY ls.agent_id, DATE(ls.created_at)
        )
        SELECT 
            al.id as agent_id,
            al.name as agent_name,
            al.username,
            dr.date,
            COALESCE(da.login_sessions, 0) as login_sessions,
            COALESCE(da.hours_worked, 0) as hours_worked,
            da.first_login,
            da.last_activity,
            COALESCE(dp.leads_submitted, 0) as leads_submitted,
            COALESCE(dp.successful_submissions, 0) as successful_submissions,
            COALESCE(dp.conversions, 0) as conversions,
            CASE 
                WHEN da.login_sessions > 0 AND dp.leads_submitted > 0 THEN 'high_productivity'
                WHEN da.login_sessions > 0 AND dp.leads_submitted = 0 THEN 'present_low_productivity'
                WHEN da.login_sessions > 0 THEN 'present_only'
                ELSE 'absent'
            END as activity_level
        FROM agent_list al
        CROSS JOIN date_range dr
        LEFT JOIN daily_attendance da ON al.id = da.agent_id AND dr.date = da.date
        LEFT JOIN daily_productivity dp ON al.id = dp.agent_id AND dr.date = dp.date
        ORDER BY al.name, dr.date DESC
    `;
    

    
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error('Error fetching attendance heatmap:', err.message);
            return res.status(500).json({ success: false, error: 'Failed to fetch attendance data' });
        }
        
        // If no real data, return empty data
        if (rows.length === 0) {
            return res.json({
                    success: true, 
                agents: [],
                dates: [],
                totalAgents: 0,
                avgAttendance: '0.0%',
                mostActive: 'N/A',
                avgProductivity: 0
            });
        } else {
            // Process real data
            const processedData = processHeatmapData(rows, days);
            res.json({ 
                success: true, 
                ...processedData,
                is_demo: false
            });
        }
    });
});

// Helper function to process heatmap data
function processHeatmapData(rows, days) {
    // Group by agent
    const agentData = {};
    rows.forEach(row => {
        if (!agentData[row.agent_id]) {
            agentData[row.agent_id] = {
                agent_id: row.agent_id,
                agent_name: row.agent_name,
                username: row.username,
                daily_data: []
            };
        }
        
        agentData[row.agent_id].daily_data.push({
            date: row.date,
            login_sessions: row.login_sessions,
            hours_worked: row.hours_worked,
            first_login: row.first_login,
            last_activity: row.last_activity,
            leads_submitted: row.leads_submitted,
            successful_submissions: row.successful_submissions,
            conversions: row.conversions,
            activity_level: row.activity_level,
            // Calculate intensity for heatmap (0-1)
            intensity: calculateIntensity(row)
        });
    });
    
    // Convert to array and calculate summary stats
    const agents = Object.values(agentData);
    
    // Calculate overall stats
    const totalDays = days;
    const stats = {
        total_agents: agents.length,
        avg_attendance_rate: 0,
        avg_productivity_score: 0,
        most_active_agent: null,
        least_active_agent: null
    };
    
    if (agents.length > 0) {
        let totalAttendanceDays = 0;
        let totalProductivityScore = 0;
        let maxActivity = 0;
        let minActivity = Infinity;
        
        agents.forEach(agent => {
            const attendanceDays = agent.daily_data.filter(d => d.login_sessions > 0).length;
            const productivityScore = agent.daily_data.reduce((sum, d) => sum + d.leads_submitted, 0);
            
            totalAttendanceDays += attendanceDays;
            totalProductivityScore += productivityScore;
            
            if (productivityScore > maxActivity) {
                maxActivity = productivityScore;
                stats.most_active_agent = agent.agent_name;
            }
            if (productivityScore < minActivity) {
                minActivity = productivityScore;
                stats.least_active_agent = agent.agent_name;
            }
        });
        
        stats.avg_attendance_rate = ((totalAttendanceDays / (agents.length * totalDays)) * 100).toFixed(1);
        stats.avg_productivity_score = (totalProductivityScore / agents.length).toFixed(1);
    }
    
    return {
        agents: agents,
        stats: stats,
        date_range: {
            start_date: rows.length > 0 ? rows[rows.length - 1]?.date : null,
            end_date: rows.length > 0 ? rows[0]?.date : null,
            total_days: totalDays
        }
    };
}

// Helper function to calculate heatmap intensity
function calculateIntensity(row) {
    let intensity = 0;
    
    // Base intensity from attendance (0-0.3)
    if (row.login_sessions > 0) {
        intensity += Math.min(row.login_sessions * 0.1, 0.3);
    }
    
    // Hours worked contribution (0-0.3)
    if (row.hours_worked > 0) {
        intensity += Math.min(row.hours_worked / 8 * 0.3, 0.3);
    }
    
    // Productivity contribution (0-0.4)
    if (row.leads_submitted > 0) {
        intensity += Math.min(row.leads_submitted / 20 * 0.4, 0.4);
    }
    
    return Math.min(intensity, 1.0);
}

// =====================================================
// TEAM LEADER ASSIGNMENT ENDPOINTS
// =====================================================

// POST /api/center-admin/team-assignments - Assign agent to team leader
app.post('/api/center-admin/team-assignments', authenticateToken, checkRole(['center_admin']), async (req, res) => {
    const { team_leader_id, agent_id, campaign_id } = req.body;
    const userId = req.user.id;
    
    if (!team_leader_id || !agent_id) {
        return res.status(400).json({ success: false, error: 'Team leader ID and agent ID are required' });
    }
    
    try {
        // Get center_id for the logged-in center admin
        const adminUser = await new Promise((resolve, reject) => {
            db.get('SELECT center_id FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) reject(err);
                else resolve(user);
            });
        });
        
        if (!adminUser) {
            return res.status(500).json({ success: false, error: 'Failed to get center information' });
        }
        
        // Verify both team leader and agent belong to the same center
        const verifyQuery = `
            SELECT COUNT(*) as count FROM users 
            WHERE id IN (?, ?) AND center_id = ? AND status = 'active'
        `;
        
        const verification = await new Promise((resolve, reject) => {
            db.get(verifyQuery, [team_leader_id, agent_id, adminUser.center_id], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
        
        if (verification.count !== 2) {
            return res.status(400).json({ success: false, error: 'Team leader or agent not found in this center' });
        }
        
        // Check if assignment already exists
        const existingQuery = `
            SELECT id FROM team_leaders 
            WHERE team_leader_id = ? AND agent_id = ? AND status = 'active'
        `;
        
        const existing = await new Promise((resolve, reject) => {
            db.get(existingQuery, [team_leader_id, agent_id], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
        
        if (existing) {
            return res.status(400).json({ success: false, error: 'Agent is already assigned to this team leader' });
        }
        
        // Create team assignment
        const insertQuery = `
            INSERT INTO team_leaders (team_leader_id, agent_id, center_id, campaign_id, created_by)
            VALUES (?, ?, ?, ?, ?)
        `;
        
        db.run(insertQuery, [team_leader_id, agent_id, adminUser.center_id, campaign_id || null, userId], function(err) {
            if (err) {
                console.error('Error creating team assignment:', err.message);
                return res.status(500).json({ success: false, error: 'Failed to create team assignment' });
            }
            
            // Log activity
            db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
                [userId, 'assign_team', `Agent ${agent_id} assigned to team leader ${team_leader_id}`]);
            
            res.json({ 
                success: true, 
                assignmentId: this.lastID,
                message: 'Team assignment created successfully'
            });
        });
    } catch (error) {
        console.error('Error creating team assignment:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// GET /api/center-admin/team-assignments - Get team assignments for center
app.get('/api/center-admin/team-assignments', authenticateToken, checkRole(['center_admin']), async (req, res) => {
    const userId = req.user.id;
    
    try {
        // Get center_id for the logged-in center admin
        const adminUser = await new Promise((resolve, reject) => {
            db.get('SELECT center_id FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) reject(err);
                else resolve(user);
            });
        });
        
        if (!adminUser) {
            return res.status(500).json({ success: false, error: 'Failed to get center information' });
        }
        
        const query = `
            SELECT 
                tl.id,
                tl.team_leader_id,
                tl.agent_id,
                tl.campaign_id,
                tl.assigned_date,
                tl.status,
                leader.name as team_leader_name,
                leader.user_id as team_leader_user_id,
                agent.name as agent_name,
                agent.user_id as agent_user_id,
                c.campaign_name
            FROM team_leaders tl
            JOIN users leader ON tl.team_leader_id = leader.id
            JOIN users agent ON tl.agent_id = agent.id
            LEFT JOIN campaigns c ON tl.campaign_id = c.id
            WHERE tl.center_id = ? AND tl.status = 'active'
            ORDER BY tl.assigned_date DESC
        `;
        
        db.all(query, [adminUser.center_id], (err, assignments) => {
            if (err) {
                console.error('Error fetching team assignments:', err.message);
                return res.status(500).json({ success: false, error: 'Failed to fetch team assignments' });
            }
            
            res.json({ success: true, assignments: assignments || [] });
        });
    } catch (error) {
        console.error('Error fetching team assignments:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// DELETE /api/center-admin/team-assignments/:id - Remove team assignment
app.delete('/api/center-admin/team-assignments/:id', authenticateToken, checkRole(['center_admin']), async (req, res) => {
    const assignmentId = req.params.id;
    const userId = req.user.id;
    
    try {
        // Get center_id for the logged-in center admin
        const adminUser = await new Promise((resolve, reject) => {
            db.get('SELECT center_id FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) reject(err);
                else resolve(user);
            });
        });
        
        if (!adminUser) {
            return res.status(500).json({ success: false, error: 'Failed to get center information' });
        }
        
        // Remove team assignment (only for assignments in the same center)
        const deleteQuery = `
            UPDATE team_leaders 
            SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND center_id = ?
        `;
        
        db.run(deleteQuery, [assignmentId, adminUser.center_id], function(err) {
            if (err) {
                console.error('Error removing team assignment:', err.message);
                return res.status(500).json({ success: false, error: 'Failed to remove team assignment' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ success: false, error: 'Team assignment not found or access denied' });
            }
            
            // Log activity
            db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
                [userId, 'remove_team_assignment', `Team assignment ${assignmentId} removed`]);
            
            res.json({ success: true, message: 'Team assignment removed successfully' });
        });
    } catch (error) {
        console.error('Error removing team assignment:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// DELETE /api/center-admin/agents/:id - Delete agent
app.delete('/api/center-admin/agents/:id', authenticateToken, checkRole(['center_admin']), async (req, res) => {
    const agentId = req.params.id;
    const userId = req.user.id;
    
    try {
        // Get center_id for the logged-in center admin
        const adminUser = await new Promise((resolve, reject) => {
            db.get('SELECT center_id FROM users WHERE id = ?', [userId], (err, user) => {
                if (err) reject(err);
                else resolve(user);
            });
        });
        
        if (!adminUser) {
            return res.status(500).json({ success: false, error: 'Failed to get center information' });
        }
        
        // Soft delete agent (only for agents in the same center)
        const deleteQuery = `
            UPDATE users 
            SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND center_id = ? AND role IN ('agent', 'team_leader', 'manager', 'sme')
        `;
        
        db.run(deleteQuery, [agentId, adminUser.center_id], function(err) {
            if (err) {
                console.error('Error deleting agent:', err.message);
                return res.status(500).json({ success: false, error: 'Failed to delete agent' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ success: false, error: 'Agent not found or access denied' });
            }
            
            // Log activity
            db.run(`INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)`,
                [userId, 'delete_agent', `Agent with ID ${agentId} deleted`]);
            
            res.json({ success: true, message: 'Agent deleted successfully' });
        });
    } catch (error) {
        console.error('Error deleting agent:', error);
        res.status(500).json({ success: false, error: 'Failed to delete agent' });
    }
});

// GET /api/analytics/attendance - Get attendance data for charts with timezone support
app.get('/api/analytics/attendance', authenticateToken, checkRole(['agent', 'center_admin', 'super_admin']), async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { days = 7 } = req.query; // Default to last 7 days
        
        // Get center timezone information
        let centerTimezone = 'UTC';
        let centerCountry = 'US';
        
        if (req.user.center_id) {
            try {
                const centerInfo = await new Promise((resolve, reject) => {
                    db.get(`SELECT timezone, country FROM centers WHERE id = ?`, [req.user.center_id], (err, center) => {
                        if (err) reject(err);
                        else resolve(center);
                    });
                });
                
                if (centerInfo) {
                    centerTimezone = centerInfo.timezone || getTimezoneByCountry(centerInfo.country);
                    centerCountry = centerInfo.country || 'US';
                }
            } catch (error) {
                console.log('Could not fetch center timezone, using default');
            }
        }
        
        let query = `
            SELECT 
                DATE(login_time) as date,
                login_time,
                logout_time,
                session_duration,
                is_active,
                u.first_name,
                u.last_name,
                u.username,
                c.timezone as center_timezone,
                c.country as center_country
            FROM attendance_sessions ats
            LEFT JOIN users u ON ats.user_id = u.id
            LEFT JOIN centers c ON u.center_id = c.id
            WHERE DATE(login_time) >= DATE('now', '-${parseInt(days)} days')
        `;
        
        let params = [];
        
        // Filter by user role
        if (userRole === 'agent') {
            query += ` AND ats.user_id = ?`;
            params.push(userId);
        } else if (userRole === 'center_admin') {
            query += ` AND u.center_id = ?`;
            params.push(req.user.center_id || req.user.center?.id);
        }
        // super_admin sees all data
        
        query += ` ORDER BY login_time DESC`;
        
        const attendanceData = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Process data for charts - Daily hours worked with timezone conversion
        const dailySummary = {};
        
        attendanceData.forEach(session => {
            // Convert UTC time to center timezone
            const sessionTimezone = session.center_timezone || centerTimezone;
            const loginTimeLocal = convertToTimezone(session.login_time, sessionTimezone);
            const logoutTimeLocal = session.logout_time ? convertToTimezone(session.logout_time, sessionTimezone) : null;
            
            const localDate = loginTimeLocal ? loginTimeLocal.split('T')[0] : session.date;
            const dayOfWeek = new Date(localDate).getDay(); // 0 = Sunday, 6 = Saturday
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            if (!dailySummary[localDate]) {
                dailySummary[localDate] = {
                    date: localDate,
                    totalMinutes: 0,
                    sessions: [],
                    isWeekend: isWeekend,
                    dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
                    timezone: sessionTimezone
                };
            }
            
            const duration = session.session_duration || 0;
            dailySummary[localDate].totalMinutes += duration;
            dailySummary[localDate].sessions.push({
                loginTime: loginTimeLocal,
                logoutTime: logoutTimeLocal,
                loginTimeUTC: session.login_time,
                logoutTimeUTC: session.logout_time,
                duration: duration,
                username: session.username,
                isActive: session.is_active
            });
        });
        
        // Convert to array and fill missing dates with realistic weekend patterns
        const dailyArray = [];
        
        for (let i = parseInt(days) - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const displayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
            
            // Use real data if available
            if (dailySummary[dateStr]) {
                const hoursWorked = Math.round((dailySummary[dateStr].totalMinutes / 60) * 10) / 10;
                dailyArray.push({
                    date: dateStr,
                    displayDate,
                    hoursWorked,
                    sessions: dailySummary[dateStr].sessions,
                    isWeekend,
                    dayOfWeek: dayName,
                    timezone: dailySummary[dateStr].timezone,
                    country: centerCountry
                });
            } else {
                // No data available - add empty entry
                dailyArray.push({
                    date: dateStr,
                    displayDate,
                    hoursWorked: 0,
                    sessions: [],
                    isWeekend,
                    dayOfWeek: dayName,
                    timezone: centerTimezone,
                    country: centerCountry
                });
            }
        }
        
        res.json({
            success: true,
            data: dailyArray,
            timezone: centerTimezone,
            country: centerCountry
        });
        
    } catch (error) {
        console.error('Error fetching attendance data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch attendance data'
        });
    }
});

// Helper function to get timezone by country
function getTimezoneByCountry(country) {
    const timezoneMap = {
        'US': 'America/New_York',
        'USA': 'America/New_York', 
        'UK': 'Europe/London',
        'CA': 'America/Toronto',
        'AU': 'Australia/Sydney',
        'IN': 'Asia/Kolkata',
        'PH': 'Asia/Manila',
        'MX': 'America/Mexico_City',
        'BR': 'America/Sao_Paulo',
        'DE': 'Europe/Berlin',
        'FR': 'Europe/Paris',
        'IT': 'Europe/Rome',
        'ES': 'Europe/Madrid',
        'NL': 'Europe/Amsterdam',
        'BE': 'Europe/Brussels',
        'CH': 'Europe/Zurich',
        'AT': 'Europe/Vienna',
        'SE': 'Europe/Stockholm',
        'NO': 'Europe/Oslo',
        'DK': 'Europe/Copenhagen',
        'FI': 'Europe/Helsinki',
        'PL': 'Europe/Warsaw',
        'CZ': 'Europe/Prague',
        'HU': 'Europe/Budapest',
        'RO': 'Europe/Bucharest',
        'BG': 'Europe/Sofia',
        'GR': 'Europe/Athens',
        'TR': 'Europe/Istanbul',
        'RU': 'Europe/Moscow',
        'JP': 'Asia/Tokyo',
        'KR': 'Asia/Seoul',
        'CN': 'Asia/Shanghai',
        'SG': 'Asia/Singapore',
        'MY': 'Asia/Kuala_Lumpur',
        'TH': 'Asia/Bangkok',
        'VN': 'Asia/Ho_Chi_Minh',
        'ID': 'Asia/Jakarta',
        'ZA': 'Africa/Johannesburg',
        'EG': 'Africa/Cairo',
        'NG': 'Africa/Lagos',
        'KE': 'Africa/Nairobi',
        'AR': 'America/Argentina/Buenos_Aires',
        'CL': 'America/Santiago',
        'CO': 'America/Bogota',
        'PE': 'America/Lima',
        'VE': 'America/Caracas',
        'UY': 'America/Montevideo',
        'PY': 'America/Asuncion',
        'BO': 'America/La_Paz',
        'EC': 'America/Guayaquil',
        'NZ': 'Pacific/Auckland',
        'FJ': 'Pacific/Fiji'
    };
    
    return timezoneMap[country] || 'UTC';
}

// Helper function to convert UTC time to specific timezone
function convertToTimezone(utcTimeString, timezone) {
    try {
        if (!utcTimeString) return null;
        
        const utcDate = new Date(utcTimeString + (utcTimeString.includes('Z') ? '' : 'Z'));
        
        // Use Intl.DateTimeFormat for timezone conversion
        const options = {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        };
        
        const formatter = new Intl.DateTimeFormat('en-CA', options);
        const parts = formatter.formatToParts(utcDate);
        
        const year = parts.find(p => p.type === 'year').value;
        const month = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;
        const hour = parts.find(p => p.type === 'hour').value;
        const minute = parts.find(p => p.type === 'minute').value;
        const second = parts.find(p => p.type === 'second').value;
        
        return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    } catch (error) {
        console.error('Error converting timezone:', error);
        return utcTimeString; // Fallback to UTC
    }
}

// GET /api/analytics/conversion-funnel - Get conversion funnel data
app.get('/api/analytics/conversion-funnel', authenticateToken, checkRole(['agent', 'center_admin', 'super_admin']), async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        const { days = 30 } = req.query; // Default to last 30 days
        
        let whereClause = `WHERE DATE(vf.checked_at) >= DATE('now', '-${parseInt(days)} days')`;
        let submissionWhereClause = `WHERE DATE(ls.created_at) >= DATE('now', '-${parseInt(days)} days')`;
        let params = [];
        let submissionParams = [];
        
        // Filter by user role
        if (userRole === 'agent') {
            whereClause += ` AND vf.agent_id = ?`;
            submissionWhereClause += ` AND ls.agent_id = ?`;
            params.push(userId);
            submissionParams.push(userId);
        } else if (userRole === 'center_admin') {
            whereClause += ` AND vf.center_id = ?`;
            submissionWhereClause += ` AND ls.center_id = ?`;
            const centerId = req.user.center_id || req.user.center?.id;
            params.push(centerId);
            submissionParams.push(centerId);
        }
        
        // 1. Get phone validation attempts (both successful and failed)
        const phoneValidationsQuery = `
            SELECT COUNT(*) as total_validations
            FROM validation_failures vf
            ${whereClause}
        `;
        
        const phoneValidations = await new Promise((resolve, reject) => {
            db.get(phoneValidationsQuery, params, (err, row) => {
                if (err) reject(err);
                else resolve(row?.total_validations || 0);
            });
        });
        
        // Also count successful phone validations (leads that were submitted)
        const successfulValidationsQuery = `
            SELECT COUNT(*) as successful_validations
            FROM lead_submissions ls
            LEFT JOIN lead_forms lf ON ls.form_id = lf.id
            ${submissionWhereClause}
        `;
        
        const successfulValidations = await new Promise((resolve, reject) => {
            db.get(successfulValidationsQuery, submissionParams, (err, row) => {
                if (err) reject(err);
                else resolve(row?.successful_validations || 0);
            });
        });
        
        // Total phone checks = failed validations + successful submissions
        let totalPhoneChecks = phoneValidations + successfulValidations;
        
        // No demo data - use actual values only
        
        // 2. Get form submissions
        const submissionsQuery = `
            SELECT COUNT(*) as total_submissions
            FROM lead_submissions ls
            LEFT JOIN lead_forms lf ON ls.form_id = lf.id
            ${submissionWhereClause}
        `;
        
        let totalSubmissions = await new Promise((resolve, reject) => {
            db.get(submissionsQuery, submissionParams, (err, row) => {
                if (err) reject(err);
                else resolve(row?.total_submissions || 0);
            });
        });
        
        // No demo data - use actual values only
        
        // 3. Get transfers (leads with sales_status = 'transferred' or forwarded_to_client = 1)
        const transfersQuery = `
            SELECT COUNT(*) as total_transfers
            FROM lead_submissions ls
            LEFT JOIN lead_forms lf ON ls.form_id = lf.id
            ${submissionWhereClause} AND (ls.sales_status = 'transferred' OR ls.forwarded_to_client = 1)
        `;
        
        let totalTransfers = await new Promise((resolve, reject) => {
            db.get(transfersQuery, submissionParams, (err, row) => {
                if (err) reject(err);
                else resolve(row?.total_transfers || 0);
            });
        });
        
        // No demo data - use actual values only
        
        // 4. Get installs
        const installsQuery = `
            SELECT COUNT(*) as total_installs
            FROM lead_submissions ls
            LEFT JOIN lead_forms lf ON ls.form_id = lf.id
            ${submissionWhereClause} AND ls.sales_status = 'installed'
        `;
        
        let totalInstalls = await new Promise((resolve, reject) => {
            db.get(installsQuery, submissionParams, (err, row) => {
                if (err) reject(err);
                else resolve(row?.total_installs || 0);
            });
        });
        
        // No demo data - use actual values only
        
        // Calculate conversion rates
        const phoneToSubmission = totalPhoneChecks > 0 ? Math.round((totalSubmissions / totalPhoneChecks) * 100) : 0;
        const submissionToTransfer = totalSubmissions > 0 ? Math.round((totalTransfers / totalSubmissions) * 100) : 0;
        const transferToInstall = totalTransfers > 0 ? Math.round((totalInstalls / totalTransfers) * 100) : 0;
        const overallConversion = totalPhoneChecks > 0 ? Math.round((totalInstalls / totalPhoneChecks) * 100) : 0;
        
        // Format data for funnel chart
        const funnelData = [
            {
                stage: 'Phone Checks',
                value: totalPhoneChecks,
                percentage: 100,
                color: '#fb923c', // orange-400
                nextStageRate: phoneToSubmission
            },
            {
                stage: 'Form Submissions',
                value: totalSubmissions,
                percentage: phoneToSubmission,
                color: '#f97316', // orange-500
                nextStageRate: submissionToTransfer
            },
            {
                stage: 'Transfers',
                value: totalTransfers,
                percentage: submissionToTransfer,
                color: '#ea580c', // orange-600
                nextStageRate: transferToInstall
            },
            {
                stage: 'Installs',
                value: totalInstalls,
                percentage: transferToInstall,
                color: '#10b981', // green-500 (success)
                nextStageRate: null
            }
        ];
        
        res.json({
            success: true,
            data: {
                funnel: funnelData,
                summary: {
                    totalPhoneChecks,
                    totalSubmissions,
                    totalTransfers,
                    totalInstalls,
                    overallConversion,
                    period: `${days} days`
                }
            }
        });
        
    } catch (error) {
        console.error('Error fetching conversion funnel data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch conversion funnel data'
        });
    }
});

// GET /api/agent/welcome-message - Get personalized welcome message for agent
app.get('/api/agent/welcome-message', authenticateToken, checkRole(['agent', 'team_leader', 'manager', 'sme']), async (req, res) => {
    const userId = req.user.id;
    
    try {
        // Get agent's profile with campaign info
        const agentProfile = await new Promise((resolve, reject) => {
            const query = `
                SELECT u.name, u.alias, u.last_login, u.created_at, c.country as campaign_country, c.campaign_name
                FROM users u
                LEFT JOIN campaigns c ON u.campaign_id = c.id
                WHERE u.id = ?
            `;
            db.get(query, [userId], (err, agent) => {
                if (err) reject(err);
                else resolve(agent);
            });
        });
        
        if (!agentProfile) {
            return res.status(404).json({ success: false, error: 'Agent profile not found' });
        }
        
        // Generate dynamic welcome message
        const welcomeMessage = generateWelcomeMessage(agentProfile);
        
        // Update last_login timestamp
        db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [userId], (err) => {
            if (err) console.error('Error updating last login:', err);
        });
        
        res.json({ 
            success: true, 
            message: welcomeMessage,
            agentName: agentProfile.alias || agentProfile.name.split(' ')[0],
            campaignCountry: agentProfile.campaign_country
        });
        
    } catch (error) {
        console.error('Error generating welcome message:', error);
        res.status(500).json({ success: false, error: 'Failed to generate welcome message' });
    }
});

// Function to generate dynamic welcome message based on agent profile and timing
function generateWelcomeMessage(agentProfile) {
    const agentName = agentProfile.alias || agentProfile.name.split(' ')[0];
    const campaignCountry = agentProfile.campaign_country || 'United States';
    const lastLogin = agentProfile.last_login;
    const createdAt = agentProfile.created_at;
    
    // Get current time in campaign timezone
    const campaignTime = getCampaignTime(campaignCountry);
    const currentHour = campaignTime.getHours();
    
    // Check if this is first login ever
    if (!lastLogin) {
        const firstTimeMessages = [
            `Welcome to Vertex CRM, **${agentName}**! Ready to make your mark?`,
            `Hello **${agentName}**! Let's get you started on your journey.`,
            `Welcome aboard, **${agentName}**! Your dashboard is ready.`,
            `Great to have you here, **${agentName}**! Time to shine.`
        ];
        return getRandomMessage(firstTimeMessages);
    }
    
    // Check if returning same day (in campaign timezone)
    const lastLoginDate = new Date(lastLogin);
    const campaignTimeDate = new Date(campaignTime.toDateString());
    const lastLoginCampaignDate = new Date(convertToCampaignTimezone(lastLoginDate, campaignCountry).toDateString());
    
    if (campaignTimeDate.getTime() === lastLoginCampaignDate.getTime()) {
        // Same day return
        const returnMessages = [
            `Welcome back, **${agentName}**! Ready to continue where you left off?`,
            `Back again, **${agentName}**? Let's keep the momentum going.`,
            `Good to see you again today, **${agentName}**!`,
            `**${agentName}**, you're on fire today! Welcome back.`,
            `Ready for round two, **${agentName}**? Let's do this!`
        ];
        return getRandomMessage(returnMessages);
    }
    
    // Different day - time-based greeting
    let timeBasedMessages = [];
    
    if (currentHour >= 6 && currentHour < 12) {
        // Morning messages
        timeBasedMessages = [
            `Good morning, **${agentName}**! Ready to conquer the day?`,
            `Morning **${agentName}**! Let's make today count.`,
            `Rise and shine, **${agentName}**! Your leads are waiting.`,
            `Good morning, **${agentName}**! Time to start strong.`,
            `Morning **${agentName}**! Today's full of opportunities.`
        ];
    } else if (currentHour >= 12 && currentHour < 18) {
        // Afternoon messages
        timeBasedMessages = [
            `Good afternoon, **${agentName}**! Hope your day is going great.`,
            `Afternoon **${agentName}**! Time to power through.`,
            `Hello **${agentName}**! Ready for the afternoon push?`,
            `Good afternoon, **${agentName}**! Let's make it productive.`,
            `Afternoon **${agentName}**! Your prospects are waiting.`
        ];
    } else if (currentHour >= 18 && currentHour < 22) {
        // Evening messages
        timeBasedMessages = [
            `Good evening, **${agentName}**! Finishing strong today?`,
            `Evening **${agentName}**! Let's close some deals.`,
            `Hello **${agentName}**! Time for the evening shift.`,
            `Good evening, **${agentName}**! Ready to wrap up successfully?`,
            `Evening **${agentName}**! Let's make these hours count.`
        ];
    } else {
        // Late night/early morning
        timeBasedMessages = [
            `Working late, **${agentName}**? Dedication pays off!`,
            `Hello **${agentName}**! Burning the midnight oil?`,
            `**${agentName}**, your commitment is impressive! Welcome back.`,
            `Late night hustle, **${agentName}**? Let's make it worthwhile.`
        ];
    }
    
    return getRandomMessage(timeBasedMessages);
}

// Helper function to get random message from array
function getRandomMessage(messages) {
    return messages[Math.floor(Math.random() * messages.length)];
}

// Helper function to get current time in campaign timezone
function getCampaignTime(campaignCountry) {
    const now = new Date();
    
    // Map campaign countries to timezones
    const timezoneMap = {
        'United States': 'America/New_York', // EST as default
        'USA': 'America/New_York',
        'United Kingdom': 'Europe/London',
        'UK': 'Europe/London',
        'Australia': 'Australia/Sydney',
        'Canada': 'America/Toronto',
        'Germany': 'Europe/Berlin',
        'France': 'Europe/Paris',
        'India': 'Asia/Kolkata'
    };
    
    const timezone = timezoneMap[campaignCountry] || 'America/New_York';
    
    try {
        return new Date(now.toLocaleString("en-US", {timeZone: timezone}));
    } catch (error) {
        console.error('Timezone conversion error:', error);
        return now; // Fallback to server time
    }
}

// Helper function to convert timestamp to campaign timezone
function convertToCampaignTimezone(date, campaignCountry) {
    const timezoneMap = {
        'United States': 'America/New_York',
        'USA': 'America/New_York',
        'United Kingdom': 'Europe/London',
        'UK': 'Europe/London',
        'Australia': 'Australia/Sydney',
        'Canada': 'America/Toronto',
        'Germany': 'Europe/Berlin',
        'France': 'Europe/Paris',
        'India': 'Asia/Kolkata'
    };
    
    const timezone = timezoneMap[campaignCountry] || 'America/New_York';
    
    try {
        return new Date(date.toLocaleString("en-US", {timeZone: timezone}));
    } catch (error) {
        console.error('Timezone conversion error:', error);
        return date;
    }
}

// AI TARGET MANAGEMENT SYSTEM
// =====================================================

// POST /api/super-admin/seed-targets - Super Admin sets initial campaign targets
app.post('/api/super-admin/seed-targets', authenticateToken, checkRole(['super_admin']), async (req, res) => {
    const { campaign_id, targets } = req.body;
    const userId = req.user.id;
    
    if (!campaign_id || !targets || !Array.isArray(targets)) {
        return res.status(400).json({ 
            success: false, 
            error: 'Campaign ID and targets array are required' 
        });
    }
    
    try {
        // Insert campaign targets
        const insertPromises = targets.map(target => {
            return new Promise((resolve, reject) => {
                const query = `
                    INSERT INTO campaign_targets (campaign_id, target_type, target_value, target_period, created_by, ai_reasoning)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                db.run(query, [
                    campaign_id, 
                    target.type, 
                    target.value, 
                    target.period || 'daily',
                    userId,
                    `Initial seed target set by Super Admin: ${target.reasoning || 'Base target for campaign'}`
                ], function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, ...target });
                });
            });
        });
        
        const results = await Promise.all(insertPromises);
        
        // Trigger AI analysis for center-level target generation
        setTimeout(() => {
            generateCenterTargetsFromCampaign(campaign_id);
        }, 1000);
        
        res.json({
            success: true,
            message: 'Campaign targets seeded successfully',
            targets: results
        });
        
    } catch (error) {
        console.error('Error seeding targets:', error);
        res.status(500).json({ success: false, error: 'Failed to seed targets' });
    }
});

// GET /api/targets/campaign/:campaignId - Get campaign targets and performance
app.get('/api/targets/campaign/:campaignId', authenticateToken, checkRole(['super_admin', 'center_admin']), async (req, res) => {
    const { campaignId } = req.params;
    
    try {
        // Get campaign targets
        const targets = await new Promise((resolve, reject) => {
            db.all(`
                SELECT ct.*, c.campaign_name, c.campaign_type
                FROM campaign_targets ct
                JOIN campaigns c ON ct.campaign_id = c.id
                WHERE ct.campaign_id = ? AND ct.is_active = 1
                ORDER BY ct.created_at DESC
            `, [campaignId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Get performance data
        const performanceData = await collectPerformanceData('campaign', campaignId);
        
        // Get AI insights if available
        const aiInsights = await new Promise((resolve, reject) => {
            db.get(`
                SELECT * FROM ai_performance_analysis 
                WHERE analysis_type = 'campaign' AND entity_id = ?
                ORDER BY created_at DESC LIMIT 1
            `, [campaignId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        res.json({
            success: true,
            targets: targets,
            performance: performanceData,
            ai_insights: aiInsights ? JSON.parse(aiInsights.ai_insights) : null
        });
        
    } catch (error) {
        console.error('Error fetching campaign targets:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch campaign targets' });
    }
});

// GET /api/targets/center/:centerId - Get center targets and performance
app.get('/api/targets/center/:centerId', authenticateToken, checkRole(['super_admin', 'center_admin']), async (req, res) => {
    const { centerId } = req.params;
    const userRole = req.user.role;
    const userCenterId = req.user.center_id;
    
    // Center admins can only see their own center
    if (userRole === 'center_admin' && userCenterId != centerId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    try {
        // Get center targets
        const targets = await new Promise((resolve, reject) => {
            db.all(`
                SELECT ct.*, c.name as center_name, camp.campaign_name
                FROM center_targets ct
                JOIN centers c ON ct.center_id = c.id
                JOIN campaigns camp ON ct.campaign_id = camp.id
                WHERE ct.center_id = ? AND ct.is_active = 1
                ORDER BY ct.created_at DESC
            `, [centerId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Get performance data
        const performanceData = await collectPerformanceData('center', centerId);
        
        // Get AI insights
        const aiInsights = await new Promise((resolve, reject) => {
            db.get(`
                SELECT * FROM ai_performance_analysis 
                WHERE analysis_type = 'center' AND entity_id = ?
                ORDER BY created_at DESC LIMIT 1
            `, [centerId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        res.json({
            success: true,
            targets: targets,
            performance: performanceData,
            ai_insights: aiInsights ? JSON.parse(aiInsights.ai_insights) : null
        });
        
    } catch (error) {
        console.error('Error fetching center targets:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch center targets' });
    }
});

// GET /api/targets/agent/:agentId - Get agent targets and performance
app.get('/api/targets/agent/:agentId', authenticateToken, checkRole(['super_admin', 'center_admin', 'agent']), async (req, res) => {
    const { agentId } = req.params;
    const userRole = req.user.role;
    const userId = req.user.id;
    const userCenterId = req.user.center_id;
    
    // Agents can only see their own targets
    if (userRole === 'agent' && userId != agentId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    // Center admins can only see agents in their center
    if (userRole === 'center_admin') {
        const agentCenter = await new Promise((resolve, reject) => {
            db.get('SELECT center_id FROM users WHERE id = ?', [agentId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!agentCenter || agentCenter.center_id !== userCenterId) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
    }
    
    try {
        // Get agent targets
        const targets = await new Promise((resolve, reject) => {
            db.all(`
                SELECT at.*, u.name as agent_name, u.alias, camp.campaign_name
                FROM agent_targets at
                JOIN users u ON at.agent_id = u.id
                JOIN campaigns camp ON at.campaign_id = camp.id
                WHERE at.agent_id = ? AND at.is_active = 1
                ORDER BY at.created_at DESC
            `, [agentId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Get performance data
        const performanceData = await collectPerformanceData('agent', agentId);
        
        // Get AI insights
        const aiInsights = await new Promise((resolve, reject) => {
            db.get(`
                SELECT * FROM ai_performance_analysis 
                WHERE analysis_type = 'agent' AND entity_id = ?
                ORDER BY created_at DESC LIMIT 1
            `, [agentId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        res.json({
            success: true,
            targets: targets,
            performance: performanceData,
            ai_insights: aiInsights ? JSON.parse(aiInsights.ai_insights) : null
        });
        
    } catch (error) {
        console.error('Error fetching agent targets:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch agent targets' });
    }
});

// POST /api/ai/analyze-performance - Trigger AI performance analysis
app.post('/api/ai/analyze-performance', authenticateToken, checkRole(['super_admin', 'center_admin']), async (req, res) => {
    const { entity_type, entity_id, days = 30, campaign_id } = req.body;
    
    if (!entity_type || !entity_id) {
        return res.status(400).json({ 
            success: false, 
            error: 'Entity type and ID are required' 
        });
    }
    
    try {
        // Collect performance data
        const performanceData = await collectPerformanceData(entity_type, entity_id, days, campaign_id);
        
        // Run AI analysis
        const aiResult = await analyzePerformanceWithAI(performanceData, entity_type, campaign_id);
        
        if (aiResult.success) {
            // Store AI analysis results
            const analysisId = await new Promise((resolve, reject) => {
                const query = `
                    INSERT INTO ai_performance_analysis 
                    (analysis_type, entity_id, analysis_period_start, analysis_period_end, 
                     performance_data, ai_insights, recommendations, confidence_score, model_used)
                    VALUES (?, ?, DATE('now', '-${days} days'), DATE('now'), ?, ?, ?, ?, ?)
                `;
                
                db.run(query, [
                    entity_type,
                    entity_id,
                    JSON.stringify(performanceData),
                    JSON.stringify(aiResult.analysis),
                    JSON.stringify(aiResult.analysis.action_items || []),
                    aiResult.confidence,
                    aiResult.model
                ], function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
                });
            });
            
            res.json({
                success: true,
                analysis_id: analysisId,
                analysis: aiResult.analysis,
                confidence: aiResult.confidence,
                model: aiResult.model
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'AI analysis failed' 
            });
        }
        
    } catch (error) {
        console.error('Error running AI analysis:', error);
        res.status(500).json({ success: false, error: 'Failed to run AI analysis' });
    }
});

// POST /api/ai/generate-targets - Generate AI-recommended targets
app.post('/api/ai/generate-targets', authenticateToken, checkRole(['super_admin', 'center_admin']), async (req, res) => {
    const { entity_type, entity_id, campaign_id } = req.body;
    
    try {
        // Get performance data
        const performanceData = await collectPerformanceData(entity_type, entity_id, 30, campaign_id);
        
        // Run AI analysis
        const aiResult = await analyzePerformanceWithAI(performanceData, entity_type, campaign_id);
        
        if (aiResult.success && aiResult.analysis.target_recommendations) {
            const recommendations = aiResult.analysis.target_recommendations;
            
            // Generate target records based on AI recommendations
            const targetTypes = ['leads_per_day', 'quality_rate', 'conversion_rate'];
            const generatedTargets = [];
            
            for (const targetType of targetTypes) {
                if (recommendations[targetType]) {
                    let tableName, targetId;
                    
                    if (entity_type === 'agent') {
                        tableName = 'agent_targets';
                        targetId = await new Promise((resolve, reject) => {
                            db.run(`
                                INSERT INTO agent_targets 
                                (agent_id, campaign_id, target_type, target_value, ai_confidence, ai_reasoning)
                                VALUES (?, ?, ?, ?, ?, ?)
                            `, [
                                entity_id, 
                                campaign_id, 
                                targetType, 
                                recommendations[targetType],
                                aiResult.confidence,
                                `AI-generated target based on performance analysis using ${aiResult.model}`
                            ], function(err) {
                                if (err) reject(err);
                                else resolve(this.lastID);
                            });
                        });
                    } else if (entity_type === 'center') {
                        tableName = 'center_targets';
                        targetId = await new Promise((resolve, reject) => {
                            db.run(`
                                INSERT INTO center_targets 
                                (center_id, campaign_id, target_type, target_value, ai_confidence, ai_reasoning)
                                VALUES (?, ?, ?, ?, ?, ?)
                            `, [
                                entity_id, 
                                campaign_id, 
                                targetType, 
                                recommendations[targetType],
                                aiResult.confidence,
                                `AI-generated target based on performance analysis using ${aiResult.model}`
                            ], function(err) {
                                if (err) reject(err);
                                else resolve(this.lastID);
                            });
                        });
                    }
                    
                    generatedTargets.push({
                        id: targetId,
                        type: targetType,
                        value: recommendations[targetType],
                        confidence: aiResult.confidence
                    });
                }
            }
            
            res.json({
                success: true,
                targets: generatedTargets,
                analysis: aiResult.analysis,
                model: aiResult.model
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Failed to generate AI targets' 
            });
        }
        
    } catch (error) {
        console.error('Error generating AI targets:', error);
        res.status(500).json({ success: false, error: 'Failed to generate AI targets' });
    }
});

// =====================================================
// CAMPAIGN AI CONFIGURATION ENDPOINTS
// =====================================================

// GET /api/campaigns/:id/ai-config - Get campaign AI configuration
app.get('/api/campaigns/:id/ai-config', authenticateToken, checkRole(['super_admin', 'center_admin']), async (req, res) => {
    const campaignId = req.params.id;
    
    try {
        const config = await getCampaignAIConfig(campaignId);
        
        if (config) {
            // Parse JSON fields for frontend
            const response = {
                ...config,
                success_criteria: JSON.parse(config.success_criteria || '[]'),
                baseline_expectations: JSON.parse(config.baseline_expectations || '{}'),
                industry_benchmarks: JSON.parse(config.industry_benchmarks || '{}'),
                performance_weights: JSON.parse(config.performance_weights || '{}'),
                target_structure: JSON.parse(config.target_structure || '{}')
            };
            
            res.json({ success: true, config: response });
        } else {
            res.status(404).json({ success: false, error: 'Campaign AI configuration not found' });
        }
    } catch (error) {
        console.error('Error fetching campaign AI config:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch AI configuration' });
    }
});

// PUT /api/campaigns/:id/ai-config - Update campaign AI configuration
app.put('/api/campaigns/:id/ai-config', authenticateToken, checkRole(['super_admin']), async (req, res) => {
    const campaignId = req.params.id;
    const { 
        success_criteria, 
        primary_metric, 
        baseline_expectations, 
        industry_benchmarks,
        custom_prompt_additions,
        performance_weights,
        ai_model_preference
    } = req.body;
    
    try {
        const query = `
            UPDATE campaign_ai_config SET
                success_criteria = ?,
                primary_metric = ?,
                baseline_expectations = ?,
                industry_benchmarks = ?,
                custom_prompt_additions = ?,
                performance_weights = ?,
                ai_model_preference = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE campaign_id = ?
        `;
        
        await new Promise((resolve, reject) => {
            db.run(query, [
                JSON.stringify(success_criteria || []),
                primary_metric || 'lead_quality',
                JSON.stringify(baseline_expectations || {}),
                JSON.stringify(industry_benchmarks || {}),
                custom_prompt_additions || '',
                JSON.stringify(performance_weights || {}),
                ai_model_preference || 'mistralai/mistral-7b-instruct:free',
                campaignId
            ], function(err) {
                if (err) reject(err);
                else resolve();
            });
        });
        
        res.json({ 
            success: true, 
            message: 'Campaign AI configuration updated successfully' 
        });
    } catch (error) {
        console.error('Error updating campaign AI config:', error);
        res.status(500).json({ success: false, error: 'Failed to update AI configuration' });
    }
});

// POST /api/campaigns/:id/ai-config/regenerate - Regenerate AI configuration
app.post('/api/campaigns/:id/ai-config/regenerate', authenticateToken, checkRole(['super_admin']), async (req, res) => {
    const campaignId = req.params.id;
    
    try {
        // Get campaign details
        const campaign = await new Promise((resolve, reject) => {
            db.get(`
                SELECT c.*, cl.client_name 
                FROM campaigns c 
                LEFT JOIN clients cl ON c.client_id = cl.id 
                WHERE c.id = ?
            `, [campaignId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }
        
        // Regenerate AI configuration
        const config = await autoConfigureCampaignAI(
            campaignId, 
            campaign.campaign_type, 
            campaign.payment_type || 'per_sale',
            campaign.client_name || campaign.main_client_name || ''
        );
        
        if (config) {
            res.json({ 
                success: true, 
                message: 'Campaign AI configuration regenerated successfully',
                config: config
            });
        } else {
            res.status(500).json({ success: false, error: 'Failed to regenerate AI configuration' });
        }
    } catch (error) {
        console.error('Error regenerating campaign AI config:', error);
        res.status(500).json({ success: false, error: 'Failed to regenerate AI configuration' });
    }
});

// POST /api/ai/calculate-intelligent-targets - Calculate intelligent targets based on data availability
app.post('/api/ai/calculate-intelligent-targets', authenticateToken, checkRole(['super_admin', 'center_admin']), async (req, res) => {
    const { entity_type, entity_id, campaign_id } = req.body;
    
    if (!entity_type || !entity_id || !campaign_id) {
        return res.status(400).json({ 
            success: false, 
            error: 'Entity type, ID, and campaign ID are required' 
        });
    }
    
    try {
        const targets = await calculateIntelligentTargets(entity_type, entity_id, campaign_id);
        
        if (targets) {
            res.json({
                success: true,
                targets: targets,
                message: 'Intelligent targets calculated successfully'
            });
        } else {
            res.status(500).json({ 
                success: false, 
                error: 'Failed to calculate intelligent targets' 
            });
        }
    } catch (error) {
        console.error('Error calculating intelligent targets:', error);
        res.status(500).json({ success: false, error: 'Failed to calculate intelligent targets' });
    }
});

// GET /api/targets/centers/:campaignId - Get all center targets for a campaign
app.get('/api/targets/centers/:campaignId', authenticateToken, checkRole(['super_admin', 'center_admin']), async (req, res) => {
    const campaignId = req.params.campaignId;
    
    try {
        const targets = await new Promise((resolve, reject) => {
            db.all(`
                SELECT ct.*, c.name as center_name,
                       (SELECT COUNT(*) FROM users WHERE center_id = ct.center_id AND role = 'agent' AND status = 'active') as agent_count
                FROM center_targets ct
                JOIN centers c ON ct.center_id = c.id
                WHERE ct.campaign_id = ? AND ct.is_active = 1
                ORDER BY c.name, ct.target_type
            `, [campaignId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        res.json({ success: true, targets: targets });
    } catch (error) {
        console.error('Error fetching center targets:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch center targets' });
    }
});

// GET /api/targets/agents/:campaignId - Get all agent targets for a campaign
app.get('/api/targets/agents/:campaignId', authenticateToken, checkRole(['super_admin', 'center_admin']), async (req, res) => {
    const campaignId = req.params.campaignId;
    
    try {
        const targets = await new Promise((resolve, reject) => {
            db.all(`
                SELECT at.*, u.name as agent_name, u.alias as agent_alias, u.center_id
                FROM agent_targets at
                JOIN users u ON at.agent_id = u.id
                WHERE at.campaign_id = ? AND at.is_active = 1
                ORDER BY u.name, at.target_type
            `, [campaignId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        res.json({ success: true, targets: targets });
    } catch (error) {
        console.error('Error fetching agent targets:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch agent targets' });
    }
});

// GET /api/campaigns/:campaignId/centers - Get centers assigned to a campaign
app.get('/api/campaigns/:campaignId/centers', authenticateToken, checkRole(['super_admin', 'center_admin']), async (req, res) => {
    const campaignId = req.params.campaignId;
    
    console.log(`[API] Fetching centers for campaign ${campaignId}`);
    
    try {
        const centers = await new Promise((resolve, reject) => {
            const query = `
                SELECT DISTINCT c.id, c.name, c.country
                FROM centers c
                JOIN campaign_center_assignments cca ON c.id = cca.center_id
                WHERE cca.campaign_id = ? AND cca.status = 'active'
                ORDER BY c.name
            `;
            console.log(`[API] Executing query:`, query, 'with campaignId:', campaignId);
            
            db.all(query, [campaignId], (err, rows) => {
                if (err) {
                    console.error('[API] Database error:', err);
                    reject(err);
                } else {
                    console.log(`[API] Query returned ${rows.length} centers:`, rows);
                    resolve(rows);
                }
            });
        });
        
        console.log(`[API] Sending response with ${centers.length} centers`);
        res.json({ success: true, centers: centers });
    } catch (error) {
        console.error('Error fetching campaign centers:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch campaign centers' });
    }
});

// TEST ENDPOINT - Remove after debugging
app.get('/api/test/centers/:campaignId', (req, res) => {
    const campaignId = req.params.campaignId;
    console.log(`[TEST] Fetching centers for campaign ${campaignId}`);
    
    db.all(`
        SELECT DISTINCT c.id, c.name, c.country
        FROM centers c
        JOIN campaign_center_assignments cca ON c.id = cca.center_id
        WHERE cca.campaign_id = ? AND cca.status = 'active'
        ORDER BY c.name
    `, [campaignId], (err, rows) => {
        if (err) {
            console.error('[TEST] Database error:', err);
            res.status(500).json({ success: false, error: err.message });
        } else {
            console.log(`[TEST] Query returned ${rows.length} centers:`, rows);
            res.json({ success: true, centers: rows });
        }
    });
});

// =====================================================
// SYSTEM LOGS API ENDPOINTS
// =====================================================

// GET /api/logs - Get system logs with filtering and pagination
app.get('/api/logs', authenticateToken, checkRole(['super_admin']), async (req, res) => {
    try {
        const {
            page = 1,
            limit = 100,
            level,
            category,
            source,
            user_id,
            start_date,
            end_date,
            search
        } = req.query;

        const offset = (page - 1) * limit;
        let whereConditions = [];
        let params = [];

        // Build WHERE conditions
        if (level) {
            whereConditions.push('level = ?');
            params.push(level);
        }
        if (category) {
            whereConditions.push('category = ?');
            params.push(category);
        }
        if (source) {
            whereConditions.push('source LIKE ?');
            params.push(`%${source}%`);
        }
        if (user_id) {
            whereConditions.push('user_id = ?');
            params.push(user_id);
        }
        if (start_date) {
            whereConditions.push('timestamp >= ?');
            params.push(start_date);
        }
        if (end_date) {
            whereConditions.push('timestamp <= ?');
            params.push(end_date);
        }
        if (search) {
            whereConditions.push('(message LIKE ? OR details LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

        // Get total count
        const countQuery = `SELECT COUNT(*) as total FROM system_logs ${whereClause}`;
        const totalResult = await new Promise((resolve, reject) => {
            db.get(countQuery, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        // Get logs with user information
        const logsQuery = `
            SELECT 
                sl.*,
                u.username,
                u.name as user_name,
                u.role as user_role
            FROM system_logs sl
            LEFT JOIN users u ON sl.user_id = u.id
            ${whereClause}
            ORDER BY sl.timestamp DESC
            LIMIT ? OFFSET ?
        `;

        const logs = await new Promise((resolve, reject) => {
            db.all(logsQuery, [...params, limit, offset], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Parse JSON details for each log
        const processedLogs = logs.map(log => ({
            ...log,
            details: log.details ? JSON.parse(log.details) : null
        }));

        await SystemLogger.info('system', 'GET /api/logs', 'System logs retrieved', {
            totalLogs: totalResult.total,
            returnedLogs: logs.length,
            filters: { level, category, source, user_id, start_date, end_date, search }
        }, req);

        res.json({
            success: true,
            logs: processedLogs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalResult.total,
                pages: Math.ceil(totalResult.total / limit)
            }
        });

    } catch (error) {
        await SystemLogger.error('system', 'GET /api/logs', 'Failed to retrieve system logs', {
            error: error.message
        }, req, error);
        res.status(500).json({ success: false, error: 'Failed to retrieve logs' });
    }
});

// GET /api/logs/stats - Get log statistics
app.get('/api/logs/stats', authenticateToken, checkRole(['super_admin']), async (req, res) => {
    try {
        const { hours = 24 } = req.query;
        const startTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

        // Get stats by level
        const levelStats = await new Promise((resolve, reject) => {
            db.all(`
                SELECT level, COUNT(*) as count
                FROM system_logs
                WHERE timestamp >= ?
                GROUP BY level
                ORDER BY count DESC
            `, [startTime], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Get stats by category
        const categoryStats = await new Promise((resolve, reject) => {
            db.all(`
                SELECT category, COUNT(*) as count
                FROM system_logs
                WHERE timestamp >= ?
                GROUP BY category
                ORDER BY count DESC
            `, [startTime], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Get recent errors
        const recentErrors = await new Promise((resolve, reject) => {
            db.all(`
                SELECT sl.*, u.username
                FROM system_logs sl
                LEFT JOIN users u ON sl.user_id = u.id
                WHERE sl.level = 'error' AND sl.timestamp >= ?
                ORDER BY sl.timestamp DESC
                LIMIT 10
            `, [startTime], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        // Get hourly activity
        const hourlyActivity = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    strftime('%H', timestamp) as hour,
                    COUNT(*) as count
                FROM system_logs
                WHERE timestamp >= ?
                GROUP BY strftime('%H', timestamp)
                ORDER BY hour
            `, [startTime], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        res.json({
            success: true,
            stats: {
                levelStats,
                categoryStats,
                recentErrors: recentErrors.map(log => ({
                    ...log,
                    details: log.details ? JSON.parse(log.details) : null
                })),
                hourlyActivity
            }
        });

    } catch (error) {
        await SystemLogger.error('system', 'GET /api/logs/stats', 'Failed to retrieve log statistics', {
            error: error.message
        }, req, error);
        res.status(500).json({ success: false, error: 'Failed to retrieve log statistics' });
    }
});

// DELETE /api/logs/cleanup - Clean up old logs
app.delete('/api/logs/cleanup', authenticateToken, checkRole(['super_admin']), async (req, res) => {
    try {
        const { days = 30 } = req.body;
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        const result = await new Promise((resolve, reject) => {
            db.run(`DELETE FROM system_logs WHERE timestamp < ?`, [cutoffDate], function(err) {
                if (err) reject(err);
                else resolve({ deletedCount: this.changes });
            });
        });

        await SystemLogger.info('system', 'DELETE /api/logs/cleanup', 'Log cleanup completed', {
            deletedCount: result.deletedCount,
            cutoffDate,
            daysRetained: days
        }, req);

        res.json({
            success: true,
            message: `Deleted ${result.deletedCount} log entries older than ${days} days`
        });

    } catch (error) {
        await SystemLogger.error('system', 'DELETE /api/logs/cleanup', 'Log cleanup failed', {
            error: error.message
        }, req, error);
        res.status(500).json({ success: false, error: 'Failed to cleanup logs' });
    }
});

// POST /api/logs/frontend - Receive frontend logs
app.post('/api/logs/frontend', async (req, res) => {
    try {
        const { logs } = req.body;
        
        if (!Array.isArray(logs)) {
            return res.status(400).json({ success: false, error: 'Logs must be an array' });
        }

        // Process each log entry
        const promises = logs.map(async (log) => {
            try {
                // Validate log object
                if (!log || typeof log !== 'object') {
                    console.warn('Invalid log entry:', log);
                    return;
                }

                await SystemLogger.log(
                    log.level || 'info',
                    log.category || 'frontend',
                    log.source || 'unknown',
                    log.message || 'Frontend log',
                    {
                        ...(log.details || {}),
                        url: log.url,
                        userAgent: log.userAgent,
                        sessionId: log.sessionId,
                        frontendTimestamp: log.timestamp
                    },
                    req,
                    log.error ? new Error(
                        typeof log.error === 'string' 
                            ? log.error 
                            : (log.error && log.error.message) 
                                ? log.error.message 
                                : (log.error ? JSON.stringify(log.error) : 'Unknown error')
                    ) : null
                );
            } catch (logError) {
                console.error('Failed to process frontend log:', logError);
            }
        });

        try {
            await Promise.all(promises.filter(p => p !== undefined));
            res.json({ success: true, message: `Processed ${logs.length} frontend logs` });
        } catch (promiseError) {
            console.error('Error processing frontend logs:', promiseError);
            res.json({ success: true, message: `Partially processed ${logs.length} frontend logs with some errors` });
        }

    } catch (error) {
        console.error('Error processing frontend logs:', error);
        res.status(500).json({ success: false, error: 'Failed to process frontend logs' });
    }
});

// GET /api/targets/center/:centerId - Get targets for a specific center
app.get('/api/targets/center/:centerId', authenticateToken, checkRole(['super_admin', 'center_admin']), async (req, res) => {
    const centerId = req.params.centerId;
    const campaignId = req.query.campaign_id;
    
    if (!campaignId) {
        return res.status(400).json({ success: false, error: 'Campaign ID is required' });
    }
    
    try {
        const targets = await new Promise((resolve, reject) => {
            db.all(`
                SELECT ct.*, c.name as center_name,
                       (SELECT COUNT(*) FROM users WHERE center_id = ct.center_id AND role = 'agent' AND status = 'active') as agent_count
                FROM center_targets ct
                JOIN centers c ON ct.center_id = c.id
                WHERE ct.center_id = ? AND ct.campaign_id = ? AND ct.is_active = 1
                ORDER BY ct.target_type
            `, [centerId, campaignId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        res.json({ success: true, targets: targets });
    } catch (error) {
        console.error('Error fetching center targets:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch center targets' });
    }
});

// GET /api/targets/agents/center/:centerId - Get agent targets for a specific center
app.get('/api/targets/agents/center/:centerId', authenticateToken, checkRole(['super_admin', 'center_admin']), async (req, res) => {
    const centerId = req.params.centerId;
    const campaignId = req.query.campaign_id;
    
    if (!campaignId) {
        return res.status(400).json({ success: false, error: 'Campaign ID is required' });
    }
    
    try {
        const targets = await new Promise((resolve, reject) => {
            db.all(`
                SELECT at.*, u.name as agent_name, u.alias as agent_alias, u.center_id
                FROM agent_targets at
                JOIN users u ON at.agent_id = u.id
                WHERE u.center_id = ? AND at.campaign_id = ? AND at.is_active = 1
                ORDER BY u.name, at.target_type
            `, [centerId, campaignId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        res.json({ success: true, targets: targets });
    } catch (error) {
        console.error('Error fetching agent targets for center:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch agent targets for center' });
    }
});

// Function to generate center targets from campaign targets
async function generateCenterTargetsFromCampaign(campaignId) {
    try {
        console.log(`Generating center targets for campaign ${campaignId}`);
        
        // Get all centers assigned to this campaign
        const centers = await new Promise((resolve, reject) => {
            db.all(`
                SELECT DISTINCT c.id, c.name 
                FROM centers c
                JOIN campaign_center_assignments cca ON c.id = cca.center_id
                WHERE cca.campaign_id = ?
            `, [campaignId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Get campaign targets
        const campaignTargets = await new Promise((resolve, reject) => {
            db.all(`
                SELECT * FROM campaign_targets 
                WHERE campaign_id = ? AND is_active = 1
            `, [campaignId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Generate center targets for each center
        for (const center of centers) {
            for (const campaignTarget of campaignTargets) {
                // Get center performance data
                const performanceData = await collectPerformanceData('center', center.id, 30, campaignId);
                
                // Run AI analysis for center-specific adjustment
                const aiResult = await analyzePerformanceWithAI(performanceData, 'center', campaignId);
                
                let adjustmentFactor = 1.0;
                if (aiResult.success && aiResult.analysis.target_recommendations) {
                    // Calculate adjustment based on AI recommendations vs campaign target
                    const aiRecommendation = aiResult.analysis.target_recommendations[campaignTarget.target_type];
                    if (aiRecommendation) {
                        adjustmentFactor = aiRecommendation / campaignTarget.target_value;
                        adjustmentFactor = Math.max(0.5, Math.min(2.0, adjustmentFactor)); // Cap between 50% and 200%
                    }
                }
                
                // Insert center target
                await new Promise((resolve, reject) => {
                    db.run(`
                        INSERT INTO center_targets 
                        (center_id, campaign_id, target_type, target_value, base_target_id, 
                         adjustment_factor, ai_confidence, ai_reasoning)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        center.id,
                        campaignId,
                        campaignTarget.target_type,
                        campaignTarget.target_value * adjustmentFactor,
                        campaignTarget.id,
                        adjustmentFactor,
                        aiResult.confidence || 0.7,
                        `AI-adjusted target for ${center.name}: ${Math.round((adjustmentFactor - 1) * 100)}% adjustment from campaign baseline`
                    ], function(err) {
                        if (err) reject(err);
                        else resolve(this.lastID);
                    });
                });
            }
        }
        
        console.log(`Generated center targets for ${centers.length} centers`);
    } catch (error) {
        console.error('Error generating center targets:', error);
    }
}

// =====================================================
// CAMPAIGN AI CONFIGURATION FUNCTIONS
// =====================================================

// Auto-configure AI settings when a campaign is created
async function autoConfigureCampaignAI(campaignId, campaignType, paymentType, clientName = '') {
    try {
        const config = generateCampaignAIConfig(campaignType, paymentType, clientName);
        
        const query = `
            INSERT OR REPLACE INTO campaign_ai_config (
                campaign_id, success_criteria, primary_metric, baseline_expectations,
                industry_benchmarks, custom_prompt_additions, performance_weights, target_structure
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        await new Promise((resolve, reject) => {
            db.run(query, [
                campaignId,
                JSON.stringify(config.success_criteria),
                config.primary_metric,
                JSON.stringify(config.baseline_expectations),
                JSON.stringify(config.industry_benchmarks),
                config.custom_prompt_additions,
                JSON.stringify(config.performance_weights),
                JSON.stringify(config.target_structure)
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
        
        console.log(`✅ Auto-configured AI settings for campaign ${campaignId} (${campaignType})`);
        return config;
    } catch (error) {
        console.error('Error auto-configuring campaign AI:', error);
        return null;
    }
}

// Generate campaign-specific AI configuration
function generateCampaignAIConfig(campaignType, paymentType, clientName = '') {
    const config = {
        success_criteria: [],
        primary_metric: '',
        baseline_expectations: {},
        industry_benchmarks: {},
        custom_prompt_additions: '',
        performance_weights: {},
        target_structure: {}
    };
    
    // Detect industry from client name
    const industry = detectIndustry(clientName, campaignType);
    
    switch (campaignType) {
        case 'sales':
            if (paymentType === 'per_install') {
                // Special handling for Vivint-style campaigns
                if (industry === 'home_security' || clientName.toLowerCase().includes('vivint')) {
                    config.success_criteria = ['transferred', 'installed'];
                    config.primary_metric = 'transfer_to_install_rate';
                    config.baseline_expectations = {
                        min_transfers_per_agent: 1,
                        min_installs_per_agent: 1,
                        transfer_to_install_ratio: 0.10, // 10% conversion from transfer to install
                        quality_threshold: 0.85
                    };
                    config.target_structure = {
                        base_targets: {
                            transfers_per_agent: 1,
                            installs_per_agent: 1
                        },
                        center_multiplier: true, // 10 agents = 10 transfers + 10 installs minimum
                        payout_metric: 'installed',
                        pipeline_metric: 'transferred',
                        success_flow: ['lead_generated', 'transferred', 'installed', 'paid']
                    };
                    config.performance_weights = { pipeline: 0.4, conversion: 0.6 };
                } else {
                    config.success_criteria = ['installed', 'paid'];
                    config.primary_metric = 'installation_rate';
                    config.baseline_expectations = {
                        daily_target: 1.5,
                        conversion_rate: 0.15,
                        quality_threshold: 0.85
                    };
                    config.performance_weights = { quality: 0.6, quantity: 0.4 };
                }
            } else {
                config.success_criteria = ['sold', 'closed', 'paid'];
                config.primary_metric = 'conversion_rate';
                config.baseline_expectations = {
                    daily_target: 2,
                    conversion_rate: 0.20,
                    quality_threshold: 0.80
                };
                config.performance_weights = { quality: 0.5, quantity: 0.5 };
            }
            break;
            
        case 'lead_generation':
        case 'lead_generation_hotkey':
            config.success_criteria = ['clean', 'forwarded_to_client'];
            config.primary_metric = 'lead_quality';
            config.baseline_expectations = {
                daily_target: 8,
                quality_rate: 0.75,
                client_acceptance_rate: 0.80
            };
            config.performance_weights = { quality: 0.7, quantity: 0.3 };
            break;
            
        default:
            config.success_criteria = ['completed', 'satisfied'];
            config.primary_metric = 'completion_rate';
            config.baseline_expectations = {
                daily_target: 5,
                completion_rate: 0.85
            };
            config.performance_weights = { quality: 0.6, quantity: 0.4 };
    }
    
    // Industry-specific adjustments
    if (industry) {
        applyIndustryBenchmarks(config, industry);
        config.custom_prompt_additions = generateIndustryPromptAdditions(industry);
    }
    
    return config;
}

// Detect industry from client name and campaign type
function detectIndustry(clientName, campaignType) {
    const name = clientName.toLowerCase();
    
    if (name.includes('vivint') || name.includes('security') || name.includes('alarm')) {
        return 'home_security';
    } else if (name.includes('solar') || name.includes('energy') || name.includes('sunrun')) {
        return 'solar';
    } else if (name.includes('insurance') || name.includes('policy')) {
        return 'insurance';
    } else if (name.includes('telecom') || name.includes('wireless') || name.includes('verizon') || name.includes('att')) {
        return 'telecom';
    } else if (campaignType === 'sales') {
        return 'general_sales';
    } else if (campaignType.includes('lead_generation')) {
        return 'lead_generation';
    }
    
    return null;
}

// Apply industry-specific benchmarks
function applyIndustryBenchmarks(config, industry) {
    const benchmarks = {
        home_security: {
            conversion_rate: 0.18,
            installation_rate: 0.85,
            cycle_days: 5,
            quality_threshold: 0.90
        },
        solar: {
            conversion_rate: 0.12,
            installation_rate: 0.75,
            cycle_days: 14,
            quality_threshold: 0.95
        },
        insurance: {
            conversion_rate: 0.25,
            policy_activation_rate: 0.90,
            cycle_days: 3,
            quality_threshold: 0.85
        },
        telecom: {
            conversion_rate: 0.30,
            activation_rate: 0.95,
            cycle_days: 2,
            quality_threshold: 0.80
        },
        lead_generation: {
            quality_rate: 0.75,
            client_acceptance_rate: 0.80,
            daily_volume: 10,
            quality_threshold: 0.85
        }
    };
    
    if (benchmarks[industry]) {
        config.industry_benchmarks = benchmarks[industry];
        
        // Adjust baseline expectations based on industry benchmarks
        if (benchmarks[industry].conversion_rate) {
            config.baseline_expectations.conversion_rate = benchmarks[industry].conversion_rate;
        }
        if (benchmarks[industry].quality_threshold) {
            config.baseline_expectations.quality_threshold = benchmarks[industry].quality_threshold;
        }
    }
}

// Generate industry-specific prompt additions
function generateIndustryPromptAdditions(industry) {
    const additions = {
        home_security: `
INDUSTRY CONTEXT - HOME SECURITY:
- Focus on installation completion rates and customer satisfaction
- Consider seasonal trends (higher demand in fall/winter)
- Installation scheduling and technician availability affects targets
- Quality over quantity - each lead is high-value`,
        solar: `
INDUSTRY CONTEXT - SOLAR:
- Long sales cycles (2-4 weeks typical)
- Heavy regulation and permit requirements
- Weather and seasonal factors affect installation
- High-value transactions requiring careful nurturing`,
        insurance: `
INDUSTRY CONTEXT - INSURANCE:
- Quick decision cycles but high compliance requirements
- Policy activation rates are crucial success metric
- Regulatory compliance affects lead quality standards
- Customer lifetime value considerations`,
        telecom: `
INDUSTRY CONTEXT - TELECOM:
- Fast-paced environment with quick activations
- Service availability by location affects conversion
- Competitive market with price sensitivity
- Technical support quality impacts retention`,
        lead_generation: `
INDUSTRY CONTEXT - LEAD GENERATION:
- Quality validation is paramount
- Client satisfaction drives long-term success
- Volume consistency important for client planning
- Data accuracy and completeness critical`
    };
    
    return additions[industry] || '';
}

// Get campaign AI configuration
async function getCampaignAIConfig(campaignId) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT cac.*, c.campaign_name, c.campaign_type, c.payment_type
            FROM campaign_ai_config cac
            JOIN campaigns c ON cac.campaign_id = c.id
            WHERE cac.campaign_id = ?
        `, [campaignId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Intelligent target calculation based on data availability and performance
async function calculateIntelligentTargets(entityType, entityId, campaignId) {
    try {
        // Get campaign configuration
        const campaignConfig = await getCampaignAIConfig(campaignId);
        if (!campaignConfig) {
            throw new Error('Campaign configuration not found');
        }
        
        const config = JSON.parse(campaignConfig.target_structure || '{}');
        const baseExpectations = JSON.parse(campaignConfig.baseline_expectations || '{}');
        
        // Get historical performance data
        const performanceData = await collectPerformanceData(entityType, entityId, 30, campaignId);
        
        let targets = {};
        
        if (entityType === 'agent') {
            targets = await calculateAgentTargets(performanceData, config, baseExpectations, campaignConfig);
        } else if (entityType === 'center') {
            targets = await calculateCenterTargets(performanceData, config, baseExpectations, campaignConfig);
        }
        
        return targets;
    } catch (error) {
        console.error('Error calculating intelligent targets:', error);
        return null;
    }
}

// Calculate agent-specific targets
async function calculateAgentTargets(performanceData, targetStructure, baseExpectations, campaignConfig) {
    const targets = {};
    
    // Check if we have sufficient historical data (at least 7 days of activity)
    const hasHistoricalData = performanceData.total_leads > 7;
    
    if (targetStructure.base_targets) {
        // For Vivint-style campaigns with transfer + install flow
        if (targetStructure.payout_metric === 'installed' && targetStructure.pipeline_metric === 'transferred') {
            
            if (!hasHistoricalData) {
                // No data available - use base minimums
                targets.transfers_per_day = baseExpectations.min_transfers_per_agent || 1;
                targets.installs_per_day = baseExpectations.min_installs_per_agent || 1;
                targets.reasoning = "Base minimum targets applied - no historical data available";
            } else {
                // Has data - AI-driven adaptive targets
                const currentTransferRate = performanceData.daily_leads || 0;
                const currentInstallRate = performanceData.sales_closed || 0;
                const conversionRate = currentInstallRate / Math.max(currentTransferRate, 1);
                
                // Adaptive logic based on performance
                if (conversionRate >= baseExpectations.transfer_to_install_ratio) {
                    // Good conversion - can push for more transfers
                    targets.transfers_per_day = Math.max(
                        Math.ceil(currentTransferRate * 1.1), 
                        baseExpectations.min_transfers_per_agent
                    );
                    targets.installs_per_day = Math.max(
                        Math.ceil(currentInstallRate * 1.05), 
                        baseExpectations.min_installs_per_agent
                    );
                    targets.reasoning = "Performance-based increase - good conversion rate";
                } else {
                    // Poor conversion - focus on quality, maintain minimums
                    targets.transfers_per_day = baseExpectations.min_transfers_per_agent;
                    targets.installs_per_day = baseExpectations.min_installs_per_agent;
                    targets.reasoning = "Quality focus - conversion rate below threshold";
                }
            }
        }
    } else {
        // Standard target calculation for other campaign types
        targets.daily_target = baseExpectations.daily_target || 5;
        targets.quality_rate = baseExpectations.quality_threshold || 0.80;
    }
    
    return targets;
}

// Calculate center-specific targets  
async function calculateCenterTargets(performanceData, targetStructure, baseExpectations, campaignConfig) {
    // Get number of agents in the center
    const agentCount = await new Promise((resolve, reject) => {
        db.get(`
            SELECT COUNT(*) as agent_count 
            FROM users 
            WHERE center_id = ? AND role = 'agent' AND status = 'active'
        `, [performanceData.center_id || performanceData.id], (err, row) => {
            if (err) reject(err);
            else resolve(row.agent_count || 10); // Default to 10 if not found
        });
    });
    
    const targets = {};
    
    if (targetStructure.center_multiplier && targetStructure.base_targets) {
        // Center targets = base targets × number of agents
        targets.min_transfers_per_day = (baseExpectations.min_transfers_per_agent || 1) * agentCount;
        targets.min_installs_per_day = (baseExpectations.min_installs_per_agent || 1) * agentCount;
        targets.agent_count = agentCount;
        targets.reasoning = `Center minimum: ${agentCount} agents × base targets`;
    } else {
        // Standard center calculation
        targets.daily_target = (baseExpectations.daily_target || 5) * agentCount;
        targets.agent_count = agentCount;
    }
    
    return targets;
}

// =====================================================
// AI PERFORMANCE ANALYSIS FUNCTIONS
// =====================================================

// AI Performance Analysis Functions
async function analyzePerformanceWithAI(performanceData, analysisType = 'agent', campaignId = null) {
    const OPENROUTER_API_KEY = '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';
    const freeModels = [
        'mistralai/mistral-7b-instruct:free',
        'google/gemma-7b-it:free', 
        'meta-llama/llama-3.2-1b-instruct:free',
        'huggingfaceh4/zephyr-7b-beta:free',
        'openchat/openchat-7b:free'
    ];

    const prompt = await generateAIPrompt(performanceData, analysisType, campaignId);
    
    for (const model of freeModels) {
        try {
            console.log(`Attempting AI analysis with model: ${model}`);
            
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'Vertex CRM AI Target System'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert sales performance analyst AI for a CRM system. Analyze performance data and provide actionable insights and target recommendations in JSON format.'
                        },
                        {
                            role: 'user', 
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 2000
                })
            });

            if (response.ok) {
                const data = await response.json();
                const aiResponse = data.choices[0].message.content;
                console.log(`AI analysis successful with model: ${model}`);
                
                try {
                    return {
                        success: true,
                        analysis: parseAIResponse(aiResponse),
                        model: model,
                        confidence: calculateConfidence(aiResponse)
                    };
                } catch (parseError) {
                    console.log(`Parse error with ${model}, trying next model...`);
                    continue;
                }
            } else {
                console.log(`API error with ${model}: ${response.status}`);
                continue;
            }
        } catch (error) {
            console.log(`Error with ${model}:`, error.message);
            continue;
        }
    }

    // Fallback to rule-based analysis if all AI models fail
    console.log('All AI models failed, using fallback analysis');
    return generateFallbackAnalysis(performanceData, analysisType);
}

async function generateAIPrompt(performanceData, analysisType, campaignId = null) {
    let campaignConfig = null;
    
    // Get campaign-specific AI configuration if available
    if (campaignId) {
        try {
            campaignConfig = await getCampaignAIConfig(campaignId);
        } catch (error) {
            console.log('No campaign config found, using default prompt');
        }
    }
    
    // Build campaign-specific context
    let campaignContext = '';
    let successCriteria = ['leads generated', 'lead quality', 'conversion rates'];
    let primaryMetric = 'lead_quality';
    
    if (campaignConfig) {
        const criteria = JSON.parse(campaignConfig.success_criteria || '[]');
        const expectations = JSON.parse(campaignConfig.baseline_expectations || '{}');
        const benchmarks = JSON.parse(campaignConfig.industry_benchmarks || '{}');
        
        successCriteria = criteria.length > 0 ? criteria : successCriteria;
        primaryMetric = campaignConfig.primary_metric || primaryMetric;
        
        campaignContext = `
CAMPAIGN CONTEXT:
- Campaign: ${campaignConfig.campaign_name} (${campaignConfig.campaign_type})
- Payment Model: ${campaignConfig.payment_type}
- Primary Success Metric: ${primaryMetric}
- Success Criteria: ${successCriteria.join(', ')}
- Baseline Expectations: ${JSON.stringify(expectations)}
- Industry Benchmarks: ${JSON.stringify(benchmarks)}`;
        
        // Add custom industry context if available
        if (campaignConfig.custom_prompt_additions) {
            campaignContext += `\n${campaignConfig.custom_prompt_additions}`;
        }
    }
    
    const basePrompt = `
Analyze this ${analysisType} performance data and provide insights in JSON format:

PERFORMANCE DATA:
${JSON.stringify(performanceData, null, 2)}
${campaignContext}

ANALYSIS CONTEXT:
- This is a lead generation CRM (no dialer integration)
- Key metrics: ${successCriteria.join(', ')}
- Primary focus: ${primaryMetric}
- Focus on realistic, achievable targets
- Consider performance trends and patterns

PROVIDE RESPONSE IN THIS EXACT JSON FORMAT:
{
  "performance_summary": {
    "current_performance": "description",
    "trend_analysis": "description", 
    "key_strengths": ["strength1", "strength2"],
    "improvement_areas": ["area1", "area2"]
  },
  "target_recommendations": {
    "leads_per_day": number,
    "quality_rate": number,
    "conversion_rate": number,
    "confidence_level": number
  },
  "insights": {
    "patterns_identified": ["pattern1", "pattern2"],
    "risk_factors": ["risk1", "risk2"],
    "opportunities": ["opportunity1", "opportunity2"]
  },
  "action_items": [
    {
      "priority": "high|medium|low",
      "action": "description",
      "timeline": "timeframe"
    }
  ]
}`;

    if (analysisType === 'agent') {
        return basePrompt + `

AGENT-SPECIFIC CONSIDERATIONS:
- Individual performance patterns
- Skill development opportunities  
- Personalized target setting
- Peer comparison insights`;
    } else if (analysisType === 'center') {
        return basePrompt + `

CENTER-SPECIFIC CONSIDERATIONS:
- Team performance dynamics
- Resource allocation optimization
- Training needs identification
- Center-wide target setting`;
    } else if (analysisType === 'campaign') {
        return basePrompt + `

CAMPAIGN-SPECIFIC CONSIDERATIONS:
- Cross-center performance comparison
- Market condition impact
- Campaign optimization opportunities
- Strategic target adjustments`;
    }

    return basePrompt;
}

function parseAIResponse(aiResponse) {
    try {
        // Try to extract JSON from the response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        
        // If no JSON found, create structured response from text
        return {
            performance_summary: {
                current_performance: aiResponse.substring(0, 200),
                trend_analysis: "Analysis provided in text format",
                key_strengths: ["Performance data analyzed"],
                improvement_areas: ["Structured data needed"]
            },
            target_recommendations: {
                leads_per_day: 10,
                quality_rate: 85,
                conversion_rate: 15,
                confidence_level: 0.6
            },
            insights: {
                patterns_identified: ["Text-based analysis provided"],
                risk_factors: ["JSON parsing needed"],
                opportunities: ["Improve AI response format"]
            },
            action_items: [
                {
                    priority: "medium",
                    action: "Review AI response format",
                    timeline: "next week"
                }
            ]
        };
    } catch (error) {
        console.error('Error parsing AI response:', error);
        throw error;
    }
}

function calculateConfidence(aiResponse) {
    // Simple confidence calculation based on response quality
    let confidence = 0.5; // Base confidence
    
    if (aiResponse.includes('leads_per_day')) confidence += 0.1;
    if (aiResponse.includes('quality_rate')) confidence += 0.1;
    if (aiResponse.includes('conversion_rate')) confidence += 0.1;
    if (aiResponse.includes('performance_summary')) confidence += 0.1;
    if (aiResponse.includes('target_recommendations')) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
}

function generateFallbackAnalysis(performanceData, analysisType) {
    // Rule-based fallback when AI fails
    const analysis = {
        performance_summary: {
            current_performance: "Analysis based on rule-based calculations",
            trend_analysis: "Calculated from historical data patterns",
            key_strengths: ["Consistent data tracking"],
            improvement_areas: ["AI analysis enhancement needed"]
        },
        target_recommendations: {
            leads_per_day: calculateFallbackTarget(performanceData, 'leads'),
            quality_rate: calculateFallbackTarget(performanceData, 'quality'),
            conversion_rate: calculateFallbackTarget(performanceData, 'conversion'),
            confidence_level: 0.7
        },
        insights: {
            patterns_identified: ["Rule-based pattern detection"],
            risk_factors: ["Limited AI analysis"],
            opportunities: ["Implement AI model improvements"]
        },
        action_items: [
            {
                priority: "high",
                action: "Review performance data quality",
                timeline: "this week"
            }
        ]
    };

    return {
        success: true,
        analysis: analysis,
        model: 'fallback-rules',
        confidence: 0.7
    };
}

function calculateFallbackTarget(performanceData, targetType) {
    // Simple rule-based target calculation
    if (!performanceData || !performanceData.current_metrics) {
        return targetType === 'leads' ? 10 : targetType === 'quality' ? 85 : 15;
    }

    const current = performanceData.current_metrics;
    
    switch (targetType) {
        case 'leads':
            return Math.max(5, Math.round((current.total_leads || 0) * 1.1));
        case 'quality':
            return Math.min(95, Math.max(80, (current.success_rate || 85) + 2));
        case 'conversion':
            return Math.min(25, Math.max(10, (current.conversion_rate || 15) + 1));
        default:
            return 10;
    }
}

// Collect performance data for AI analysis
async function collectPerformanceData(entityType, entityId, days = 30, campaignId = null) {
    return new Promise((resolve, reject) => {
        let query = '';
        let params = [];

        if (entityType === 'agent') {
            // Get campaign-specific success criteria
            let successCriteria = `
                COUNT(CASE WHEN ls.validation_status = 'clean' THEN 1 END) as clean_leads,
                COUNT(CASE WHEN ls.sales_status = 'installed' THEN 1 END) as sales_closed,
                COUNT(CASE WHEN ls.sales_status = 'cancelled' THEN 1 END) as sales_lost,
                COUNT(CASE WHEN ls.sales_status = 'paid' THEN 1 END) as paid_sales,
                COUNT(CASE WHEN ls.sales_status = 'sold' THEN 1 END) as sold_leads,
                COUNT(CASE WHEN ls.sales_status = 'closed' THEN 1 END) as closed_sales,
                COUNT(CASE WHEN ls.forwarded_to_client = 1 THEN 1 END) as forwarded_leads,
                AVG(CASE WHEN ls.validation_status = 'clean' THEN 1.0 ELSE 0.0 END) * 100 as quality_rate,
                AVG(CASE WHEN ls.sales_status IN ('installed', 'paid', 'sold', 'closed') THEN 1.0 ELSE 0.0 END) * 100 as conversion_rate`;
            
            query = `
                SELECT 
                    COUNT(*) as total_leads,
                    COUNT(CASE WHEN DATE(ls.created_at) >= DATE('now', '-1 day') THEN 1 END) as daily_leads,
                    COUNT(CASE WHEN DATE(ls.created_at) >= DATE('now', '-7 days') THEN 1 END) as weekly_leads,
                    ${successCriteria},
                    u.name, u.alias, u.created_at as agent_start_date,
                    u.campaign_id, c.campaign_name, c.campaign_type, c.payment_type
                FROM users u
                LEFT JOIN lead_submissions ls ON u.id = ls.agent_id 
                    AND DATE(ls.created_at) >= DATE('now', '-${days} days')
                    ${campaignId ? `AND ls.form_id IN (SELECT id FROM lead_forms WHERE campaign_id = ${campaignId})` : ''}
                LEFT JOIN campaigns c ON u.campaign_id = c.id
                WHERE u.id = ?
                GROUP BY u.id
            `;
            params = [entityId];
        } else if (entityType === 'center') {
            query = `
                SELECT 
                    COUNT(DISTINCT ls.agent_id) as active_agents,
                    COUNT(*) as total_leads,
                    COUNT(CASE WHEN ls.validation_status = 'clean' THEN 1 END) as clean_leads,
                    COUNT(CASE WHEN ls.sales_status = 'installed' THEN 1 END) as sales_closed,
                    AVG(CASE WHEN ls.validation_status = 'clean' THEN 1.0 ELSE 0.0 END) * 100 as success_rate,
                    c.name as center_name, c.center_code
                FROM centers c
                LEFT JOIN lead_submissions ls ON c.id = ls.center_id 
                    AND DATE(ls.created_at) >= DATE('now', '-${days} days')
                WHERE c.id = ?
                GROUP BY c.id
            `;
            params = [entityId];
        } else if (entityType === 'campaign') {
            query = `
                SELECT 
                    COUNT(DISTINCT ls.center_id) as active_centers,
                    COUNT(DISTINCT ls.agent_id) as active_agents,
                    COUNT(*) as total_leads,
                    COUNT(CASE WHEN ls.validation_status = 'clean' THEN 1 END) as clean_leads,
                    COUNT(CASE WHEN ls.sales_status = 'installed' THEN 1 END) as sales_closed,
                    AVG(CASE WHEN ls.validation_status = 'clean' THEN 1.0 ELSE 0.0 END) * 100 as success_rate,
                    camp.campaign_name, camp.campaign_type
                FROM campaigns camp
                LEFT JOIN lead_forms lf ON camp.id = lf.campaign_id
                LEFT JOIN lead_submissions ls ON lf.id = ls.form_id 
                    AND DATE(ls.created_at) >= DATE('now', '-${days} days')
                WHERE camp.id = ?
                GROUP BY camp.id
            `;
            params = [entityId];
        }

        db.get(query, params, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve({
                    entity_type: entityType,
                    entity_id: entityId,
                    analysis_period: `${days} days`,
                    current_metrics: result || {},
                    collected_at: new Date().toISOString()
                });
            }
        });
    });
}

// ==================== NOTIFICATIONS API ROUTES ====================

// POST /api/notifications - Create a new notification
app.post('/api/notifications', authenticateToken, checkRole(['super_admin', 'center_admin']), async (req, res) => {
    try {
        const { title, message, type, priority, target_type, target_centers, target_agents, campaign_id, expires_at } = req.body;
        const sender_id = req.user.id;
        const sender_role = req.user.role;

        // Validate required fields
        if (!title || !message || !target_type) {
            return res.status(400).json({ 
                success: false, 
                error: 'Title, message, and target_type are required' 
            });
        }

        // Validate sender permissions
        if (sender_role === 'center_admin' && target_type === 'all') {
            return res.status(403).json({ 
                success: false, 
                error: 'Center admins cannot send notifications to all users' 
            });
        }

        // Create notification
        const notificationQuery = `
            INSERT INTO notifications (title, message, type, priority, sender_id, sender_role, 
                                     target_type, target_centers, target_agents, campaign_id, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(notificationQuery, [
            title, message, type || 'info', priority || 'medium', sender_id, sender_role,
            target_type, JSON.stringify(target_centers || []), JSON.stringify(target_agents || []),
            campaign_id || null, expires_at || null
        ], function(err) {
            if (err) {
                console.error('Error creating notification:', err);
                return res.status(500).json({ success: false, error: 'Failed to create notification' });
            }

            const notificationId = this.lastID;

            // Determine recipients based on target_type
            let recipientQuery = '';
            let recipientParams = [];

            if (target_type === 'all') {
                // Super admin only - send to all users
                recipientQuery = `SELECT id FROM users WHERE status = 'active' AND id != ?`;
                recipientParams = [sender_id];
            } else if (target_type === 'campaign') {
                // Send to all center admins assigned to the specified campaign
                if (campaign_id) {
                    recipientQuery = `
                        SELECT DISTINCT u.id 
                        FROM users u 
                        JOIN centers c ON u.center_id = c.id 
                        JOIN campaign_centers cc ON c.id = cc.center_id 
                        WHERE u.status = 'active' 
                        AND u.role = 'center_admin' 
                        AND cc.campaign_id = ? 
                        AND u.id != ?`;
                    recipientParams = [campaign_id, sender_id];
                }
            } else if (target_type === 'centers') {
                // Send to all users in specified centers
                const centerIds = target_centers || [];
                if (centerIds.length > 0) {
                    recipientQuery = `SELECT id FROM users WHERE status = 'active' AND center_id IN (${centerIds.map(() => '?').join(',')}) AND id != ?`;
                    recipientParams = [...centerIds, sender_id];
                }
            } else if (target_type === 'agents') {
                // Send to agents in sender's center (for center admin) or specified centers (for super admin)
                if (sender_role === 'center_admin') {
                    recipientQuery = `SELECT id FROM users WHERE status = 'active' AND role IN ('agent', 'team_leader', 'manager', 'sme') AND center_id = (SELECT center_id FROM users WHERE id = ?) AND id != ?`;
                    recipientParams = [sender_id, sender_id];
                } else {
                    const centerIds = target_centers || [];
                    if (centerIds.length > 0) {
                        recipientQuery = `SELECT id FROM users WHERE status = 'active' AND role IN ('agent', 'team_leader', 'manager', 'sme') AND center_id IN (${centerIds.map(() => '?').join(',')}) AND id != ?`;
                        recipientParams = [...centerIds, sender_id];
                    }
                }
            } else if (target_type === 'specific') {
                // Send to specific users
                const agentIds = target_agents || [];
                if (agentIds.length > 0) {
                    recipientQuery = `SELECT id FROM users WHERE status = 'active' AND id IN (${agentIds.map(() => '?').join(',')}) AND id != ?`;
                    recipientParams = [...agentIds, sender_id];
                }
            }

            // Insert recipients
            if (recipientQuery) {
                db.all(recipientQuery, recipientParams, (err, recipients) => {
                    if (err) {
                        console.error('Error fetching recipients:', err);
                        return res.status(500).json({ success: false, error: 'Failed to determine recipients' });
                    }

                    if (recipients.length === 0) {
                        return res.json({ 
                            success: true, 
                            notification_id: notificationId,
                            recipients_count: 0,
                            message: 'Notification created but no recipients found'
                        });
                    }

                    // Insert recipient records
                    const recipientInserts = recipients.map(recipient => 
                        new Promise((resolve, reject) => {
                            db.run(
                                'INSERT INTO notification_recipients (notification_id, user_id) VALUES (?, ?)',
                                [notificationId, recipient.id],
                                (err) => err ? reject(err) : resolve(null)
                            );
                        })
                    );

                    Promise.all(recipientInserts)
                        .then(() => {
                            res.json({ 
                                success: true, 
                                notification_id: notificationId,
                                recipients_count: recipients.length,
                                message: 'Notification sent successfully'
                            });
                        })
                        .catch(err => {
                            console.error('Error inserting recipients:', err);
                            res.status(500).json({ success: false, error: 'Failed to send to recipients' });
                        });
                });
            } else {
                res.json({ 
                    success: true, 
                    notification_id: notificationId,
                    recipients_count: 0,
                    message: 'Notification created but no recipients specified'
                });
            }
        });
    } catch (error) {
        console.error('Error in notification creation:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// GET /api/notifications - Get notifications for current user
app.get('/api/notifications', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { limit = 50, offset = 0, unread_only = false } = req.query;

    const query = `
        SELECT 
            n.id,
            n.title,
            n.message,
            n.type,
            n.priority,
            n.sender_id,
            n.sender_role,
            n.campaign_id,
            n.created_at,
            nr.is_read,
            nr.read_at,
            sender.name as sender_name,
            c.campaign_name
        FROM notifications n
        JOIN notification_recipients nr ON n.id = nr.notification_id
        LEFT JOIN users sender ON n.sender_id = sender.id
        LEFT JOIN campaigns c ON n.campaign_id = c.id
        WHERE nr.user_id = ? 
        AND n.is_active = 1
        AND (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)
        ${unread_only === 'true' ? 'AND nr.is_read = 0' : ''}
        ORDER BY n.priority = 'urgent' DESC, n.priority = 'high' DESC, n.created_at DESC
        LIMIT ? OFFSET ?
    `;

    db.all(query, [userId, parseInt(limit), parseInt(offset)], (err, notifications) => {
        if (err) {
            console.error('Error fetching notifications:', err);
            return res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
        }

        // Get unread count
        db.get(
            `SELECT COUNT(*) as unread_count FROM notification_recipients nr 
             JOIN notifications n ON nr.notification_id = n.id 
             WHERE nr.user_id = ? AND nr.is_read = 0 AND n.is_active = 1 
             AND (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)`,
            [userId],
            (err, countResult) => {
                if (err) {
                    console.error('Error fetching unread count:', err);
                    return res.status(500).json({ success: false, error: 'Failed to fetch unread count' });
                }

                res.json({
                    success: true,
                    notifications: notifications,
                    unread_count: countResult.unread_count || 0,
                    total_shown: notifications.length
                });
            }
        );
    });
});

// PUT /api/notifications/:id/read - Mark notification as read
app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
    const notificationId = req.params.id;
    const userId = req.user.id;

    db.run(
        'UPDATE notification_recipients SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE notification_id = ? AND user_id = ?',
        [notificationId, userId],
        function(err) {
            if (err) {
                console.error('Error marking notification as read:', err);
                return res.status(500).json({ success: false, error: 'Failed to mark as read' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ success: false, error: 'Notification not found' });
            }

            res.json({ success: true, message: 'Notification marked as read' });
        }
    );
});

// PUT /api/notifications/read-all - Mark all notifications as read
app.put('/api/notifications/read-all', authenticateToken, (req, res) => {
    const userId = req.user.id;

    db.run(
        'UPDATE notification_recipients SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_read = 0',
        [userId],
        function(err) {
            if (err) {
                console.error('Error marking all notifications as read:', err);
                return res.status(500).json({ success: false, error: 'Failed to mark all as read' });
            }

            res.json({ 
                success: true, 
                message: 'All notifications marked as read',
                updated_count: this.changes
            });
        }
    );
});

// GET /api/notifications/unread-count - Get unread notification count
app.get('/api/notifications/unread-count', authenticateToken, (req, res) => {
    const userId = req.user.id;

    db.get(
        `SELECT COUNT(*) as count FROM notification_recipients nr 
         JOIN notifications n ON nr.notification_id = n.id 
         WHERE nr.user_id = ? AND nr.is_read = 0 AND n.is_active = 1 
         AND (n.expires_at IS NULL OR n.expires_at > CURRENT_TIMESTAMP)`,
        [userId],
        (err, result) => {
            if (err) {
                console.error('Error fetching unread count:', err);
                return res.status(500).json({ success: false, error: 'Failed to fetch unread count' });
            }

            res.json({ 
                success: true, 
                unread_count: result.count || 0 
            });
        }
    );
});

// Static files are now served at the top of the middleware stack

// Catch-all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // Skip asset requests that should have been handled by static middleware
    if (req.path.startsWith('/assets/')) {
        return res.status(404).json({ error: 'Asset not found' });
    }
    
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down VERTEX CRM...');
    db.close(() => {
        console.log('Database connection closed.');
        process.exit(0);
    });
});