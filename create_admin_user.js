const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();

async function createAdminUser() {
    const password = 'YNrKeSf0'; // The password from your screenshot
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const db = new sqlite3.Database('./vertex_crm.db');
    
    const query = `
        INSERT INTO users (
            user_id, username, password, name, email, role, center_id, status, created_by, first_login, temp_password, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `;
    
    db.run(query, [
        'CA123456',
        'TT_EG_CA_JACOB',
        hashedPassword,
        'Jacob',
        '',
        'center_admin',
        6,
        'active',
        1,
        1,
        password
    ], function(err) {
        if (err) {
            console.error('Error creating user:', err.message);
        } else {
            console.log('✅ Center admin user created successfully!');
            console.log('Username: TT_EG_CA_JACOB');
            console.log('Password: YNrKeSf0');
        }
        db.close();
    });
}

createAdminUser().catch(console.error);
