#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying build output...');

const distPath = path.join(__dirname, 'dist');
const assetsPath = path.join(distPath, 'assets');
const indexPath = path.join(distPath, 'index.html');

// Check if dist folder exists
if (!fs.existsSync(distPath)) {
    console.error('❌ dist/ folder does not exist');
    process.exit(1);
}

// Check if index.html exists
if (!fs.existsSync(indexPath)) {
    console.error('❌ dist/index.html does not exist');
    process.exit(1);
}

// Check if assets folder exists
if (!fs.existsSync(assetsPath)) {
    console.error('❌ dist/assets/ folder does not exist');
    process.exit(1);
}

// List assets
const assets = fs.readdirSync(assetsPath);
console.log('📁 Assets found:', assets);

// Check for required assets
const hasJS = assets.some(file => file.endsWith('.js'));
const hasCSS = assets.some(file => file.endsWith('.css'));

if (!hasJS) {
    console.error('❌ No JavaScript files found in assets');
    process.exit(1);
}

if (!hasCSS) {
    console.error('❌ No CSS files found in assets');
    process.exit(1);
}

// Read and verify index.html
const indexContent = fs.readFileSync(indexPath, 'utf8');
if (!indexContent.includes('<div id="root">')) {
    console.error('❌ index.html missing root div');
    process.exit(1);
}

console.log('✅ Build verification successful!');
console.log('📊 Build stats:');
console.log(`   - Assets: ${assets.length} files`);
console.log(`   - JS files: ${assets.filter(f => f.endsWith('.js')).length}`);
console.log(`   - CSS files: ${assets.filter(f => f.endsWith('.css')).length}`);
console.log(`   - Index.html: ${Math.round(indexContent.length / 1024)}KB`);
