// Quick test script for new agent management endpoints
const fetch = require('node-fetch');

async function testEndpoints() {
    try {
        // First login as center admin
        const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'FI_IN_CA_SATYA',
                password: 'Test123'
            })
        });
        
        const loginData = await loginResponse.json();
        
        if (!loginData.success) {
            console.log('❌ Login failed:', loginData.error);
            return;
        }
        
        console.log('✅ Login successful');
        const token = loginData.token;
        
        // Test getting agents
        const agentsResponse = await fetch('http://localhost:3000/api/center-admin/agents', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const agentsData = await agentsResponse.json();
        console.log('📝 Agents:', agentsData);
        
        if (agentsData.success && agentsData.agents.length > 0) {
            const agentId = agentsData.agents[0].id;
            
            // Test getting agent password
            const passwordResponse = await fetch(`http://localhost:3000/api/center-admin/agents/${agentId}/password`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const passwordData = await passwordResponse.json();
            console.log('🔑 Agent password:', passwordData);
        }
        
    } catch (error) {
        console.error('❌ Test error:', error);
    }
}

testEndpoints();
