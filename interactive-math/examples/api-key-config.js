/**
 * Configuration file for OpenAI API key
 * Include this in your HTML files before loading the main application
 */

// Set the API key
window.OPENAI_API_KEY = "YOUR API KEY";

// Also set the version with VITE_ prefix for compatibility
window.VITE_OPENAI_API_KEY = window.OPENAI_API_KEY;

console.log("API key configuration loaded"); 