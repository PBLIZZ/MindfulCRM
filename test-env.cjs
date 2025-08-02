require('dotenv').config();

console.log('Environment Variables Check:');
console.log('OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('OPENROUTER_API_KEY exists:', !!process.env.OPENROUTER_API_KEY);
console.log('GOOGLE_API_KEY exists:', !!process.env.GOOGLE_API_KEY);

if (process.env.OPENAI_API_KEY) {
  console.log('OPENAI_API_KEY starts with:', process.env.OPENAI_API_KEY.substring(0, 10) + '...');
}
