#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 GPS App - Simple Deployment Helper\n');

// Check if dist folder exists
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
    console.log('❌ dist/ folder not found. Run: npm run build');
    process.exit(1);
}

// Check required files
const requiredFiles = [
    'index.html',
    'assets/index-Bck2Mrdz.js',
    'assets/index-B96Z72f2.css',
    'vite.svg',
    'map.svg'
];

console.log('📁 Checking build files...');
let allFilesExist = true;

requiredFiles.forEach(file => {
    const filePath = path.join(distPath, file);
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} - MISSING!`);
        allFilesExist = false;
    }
});

if (!allFilesExist) {
    console.log('\n❌ Some files are missing. Run: npm run build');
    process.exit(1);
}

console.log('\n✅ All files present!');
console.log('\n🌐 Deployment Options:');
console.log('1. Netlify: Drag and drop the dist/ folder to netlify.com/drop');
console.log('2. Vercel: Run npx vercel');
console.log('3. GitHub Pages: Run npx gh-pages -d dist');
console.log('4. Surge: Run npx surge dist');

console.log('\n📱 For mobile testing, use HTTPS hosting (Netlify/Vercel recommended)');
