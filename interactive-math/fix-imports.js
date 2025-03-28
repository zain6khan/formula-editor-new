#!/usr/bin/env node

/**
 * This script fixes import statements in compiled JavaScript files
 * to ensure they have .js extensions for browser ES modules
 */

const fs = require('fs');
const path = require('path');

// Directory to process
const distDir = path.join(__dirname, 'dist');

// Process all JavaScript files in a directory and its subdirectories
function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  
  files.forEach(file => {
    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      // Recursively process subdirectories
      processDirectory(filePath);
    } else if (file.endsWith('.js')) {
      // Process JavaScript files
      fixImports(filePath);
    }
  });
}

// Fix import statements in a file
function fixImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Regex to match import statements without .js extension
  // This looks for import statements like: import { x } from '../path/file'
  const importRegex = /from\s+(['"])([^'"]*?)(?:\.js)?(['"])/g;
  
  // Add .js extension to imports 
  let modified = content.replace(importRegex, (match, quote1, importPath, quote2) => {
    // Skip external packages and files that already have extensions
    if (importPath.startsWith('.') && !importPath.includes('.js')) {
      return `from ${quote1}${importPath}.js${quote2}`;
    }
    return match;
  });
  
  // Write modified content back to file if changed
  if (modified !== content) {
    console.log(`Fixing imports in: ${path.relative(__dirname, filePath)}`);
    fs.writeFileSync(filePath, modified);
  }
}

// Start processing from dist directory
console.log('Fixing import extensions in compiled files...');
processDirectory(distDir);
console.log('Done!'); 