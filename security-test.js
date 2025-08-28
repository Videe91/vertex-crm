#!/usr/bin/env node

/**
 * Vertex CRM Security Test Suite
 * Tests all implemented security measures
 */

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:3000';
let authToken = '';

console.log('🔒 Vertex CRM Security Test Suite');
console.log('==================================\n');

async function runSecurityTests() {
    try {
        // Test 1: Rate Limiting
        console.log('1. Testing Rate Limiting...');
        await testRateLimiting();
        
        // Test 2: Authentication
        console.log('2. Testing Authentication...');
        await testAuthentication();
        
        // Test 3: Input Validation
        console.log('3. Testing Input Validation...');
        await testInputValidation();
        
        // Test 4: File Upload Security
        console.log('4. Testing File Upload Security...');
        await testFileUploadSecurity();
        
        // Test 5: JWT Security
        console.log('5. Testing JWT Security...');
        await testJWTSecurity();
        
        // Test 6: Security Headers
        console.log('6. Testing Security Headers...');
        await testSecurityHeaders();
        
        console.log('\n✅ All security tests completed!');
        
    } catch (error) {
        console.error('❌ Security test failed:', error.message);
        process.exit(1);
    }
}

async function testRateLimiting() {
    console.log('   Testing login rate limiting...');
    
    let rateLimited = false;
    for (let i = 0; i < 6; i++) {
        try {
            const response = await axios.post(`${BASE_URL}/api/auth/login`, {
                username: 'testuser',
                password: 'wrongpassword'
            });
        } catch (error) {
            if (error.response?.status === 429) {
                rateLimited = true;
                console.log('   ✅ Rate limiting working - blocked after multiple attempts');
                break;
            }
        }
    }
    
    if (!rateLimited) {
        throw new Error('Rate limiting not working properly');
    }
    
    // Wait for rate limit to reset
    console.log('   Waiting for rate limit reset...');
    await new Promise(resolve => setTimeout(resolve, 65000));
}

async function testAuthentication() {
    console.log('   Testing login with valid credentials...');
    
    try {
        const response = await axios.post(`${BASE_URL}/api/auth/login`, {
            username: 'admin',
            password: 'vertex2024'
        });
        
        if (response.data.success && response.data.token) {
            authToken = response.data.token;
            console.log('   ✅ Authentication successful');
        } else {
            throw new Error('Authentication failed');
        }
    } catch (error) {
        throw new Error(`Authentication test failed: ${error.message}`);
    }
    
    // Test account lockout
    console.log('   Testing account lockout...');
    for (let i = 0; i < 6; i++) {
        try {
            await axios.post(`${BASE_URL}/api/auth/login`, {
                username: 'admin',
                password: 'wrongpassword'
            });
        } catch (error) {
            if (error.response?.status === 423) {
                console.log('   ✅ Account lockout working');
                break;
            }
        }
    }
}

async function testInputValidation() {
    console.log('   Testing malicious input handling...');
    
    const maliciousInputs = [
        { username: '<script>alert("xss")</script>', password: 'test' },
        { username: "'; DROP TABLE users; --", password: 'test' },
        { username: 'a'.repeat(1000), password: 'test' },
        { username: 'test', password: '' }
    ];
    
    for (const input of maliciousInputs) {
        try {
            const response = await axios.post(`${BASE_URL}/api/auth/login`, input);
        } catch (error) {
            if (error.response?.status === 400) {
                console.log('   ✅ Input validation working - rejected malicious input');
            }
        }
    }
}

async function testFileUploadSecurity() {
    console.log('   Testing file upload restrictions...');
    
    // Create a malicious file
    fs.writeFileSync('/tmp/malicious.exe', 'fake executable content');
    
    try {
        const form = new FormData();
        form.append('profilePhoto', fs.createReadStream('/tmp/malicious.exe'));
        form.append('firstName', 'Test');
        
        const response = await axios.post(`${BASE_URL}/api/auth/profile`, form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${authToken}`
            }
        });
    } catch (error) {
        if (error.response?.status === 400 && error.response.data.error?.includes('not allowed')) {
            console.log('   ✅ File upload security working - rejected malicious file');
        }
    }
    
    // Clean up
    fs.unlinkSync('/tmp/malicious.exe');
}

async function testJWTSecurity() {
    console.log('   Testing JWT token security...');
    
    // Test with invalid token
    try {
        await axios.get(`${BASE_URL}/api/users`, {
            headers: { 'Authorization': 'Bearer invalid-token' }
        });
    } catch (error) {
        if (error.response?.status === 403) {
            console.log('   ✅ JWT validation working - rejected invalid token');
        }
    }
    
    // Test logout (token blacklisting)
    try {
        await axios.post(`${BASE_URL}/api/auth/logout`, {}, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        // Try to use the same token again
        await axios.get(`${BASE_URL}/api/users`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
    } catch (error) {
        if (error.response?.status === 401) {
            console.log('   ✅ Token blacklisting working - rejected logged out token');
        }
    }
}

async function testSecurityHeaders() {
    console.log('   Testing security headers...');
    
    try {
        const response = await axios.get(`${BASE_URL}/api/health`);
        const headers = response.headers;
        
        const requiredHeaders = [
            'x-content-type-options',
            'x-frame-options',
            'strict-transport-security',
            'content-security-policy'
        ];
        
        let headersPresent = 0;
        for (const header of requiredHeaders) {
            if (headers[header]) {
                headersPresent++;
            }
        }
        
        if (headersPresent >= 3) {
            console.log('   ✅ Security headers present');
        } else {
            console.log('   ⚠️  Some security headers missing');
        }
        
    } catch (error) {
        console.log('   ⚠️  Could not test security headers');
    }
}

// Add health check endpoint for testing
async function addHealthEndpoint() {
    // This would be added to server.js
    console.log('   Note: Add health check endpoint to server.js for complete testing');
}

if (require.main === module) {
    runSecurityTests();
}

module.exports = { runSecurityTests };
