// utils.js

// Characters allowed in a code: A–Z, a–z, 0–9
const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

// Code must be 6–8 characters, only A-Z, a-z, 0-9
const CODE_REGEX = /^[A-Za-z0-9]{6,8}$/;

// Generate a random code, e.g. "Ab3xZ9"
function generateCode(length = 6) {
  let code = "";
  for (let i = 0; i < length; i++) {
    const index = Math.floor(Math.random() * ALPHABET.length);
    code += ALPHABET[index];
  }
  return code;
}

// Check if code matches the pattern
function isValidCode(code) {
  return CODE_REGEX.test(code);
}

// Check if a URL string is valid
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  generateCode,
  isValidCode,
  isValidUrl,
};
