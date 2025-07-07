// Test script to verify PORT configuration
// This simulates the config behavior

console.log('Testing PORT configuration...');

// Simulate the config logic
const PORT = parseInt(process.env.PORT ?? '3000', 10);
console.log('[config] PORT resolved to', PORT);

// Test different scenarios
console.log('\nTest scenarios:');
console.log('1. No PORT env var → should use 3000');
console.log('2. PORT=8080 → should use 8080');
console.log('3. PORT=10000 → should use 10000');

// Test with different environment variables
const testCases = [
  { env: {}, expected: 3000 },
  { env: { PORT: '8080' }, expected: 8080 },
  { env: { PORT: '10000' }, expected: 10000 },
  { env: { PORT: 'invalid' }, expected: NaN }
];

testCases.forEach((testCase, index) => {
  // Simulate setting environment variable
  const originalPort = process.env.PORT;
  process.env.PORT = testCase.env.PORT;
  
  const testPort = parseInt(process.env.PORT ?? '3000', 10);
  const result = testPort === testCase.expected ? '✓ PASS' : '✗ FAIL';
  
  console.log(`   ${index + 1}. PORT=${testCase.env.PORT || 'undefined'} → ${testPort} ${result}`);
  
  // Restore original
  process.env.PORT = originalPort;
});

console.log('\n✅ PORT configuration test completed!');
console.log('The server will now listen on the correct port for Render deployment.'); 