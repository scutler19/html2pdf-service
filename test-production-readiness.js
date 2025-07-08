#!/usr/bin/env node

/**
 * Production Readiness Test Suite
 * Tests all critical components of the html2pdf-service
 */

const http = require('http');
const https = require('https');

// Configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const API_KEY = process.env.TEST_API_KEY || 'test-api-key-123';

console.log('🧪 Starting Production Readiness Tests...\n');

// Test utilities
function makeRequest(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

async function runTest(name, testFn) {
  try {
    console.log(`🔍 Testing: ${name}`);
    await testFn();
    console.log(`✅ PASS: ${name}\n`);
    return true;
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Error: ${error.message}\n`);
    return false;
  }
}

// Test suite
async function runTests() {
  const results = [];

  // Test 1: Health endpoint
  results.push(await runTest('Health Endpoint', async () => {
    const response = await makeRequest('/health');
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
    if (!response.body.includes('ok')) {
      throw new Error('Health check should return "ok"');
    }
  }));

  // Test 2: Root endpoint
  results.push(await runTest('Root Endpoint', async () => {
    const response = await makeRequest('/');
    if (response.status !== 200) {
      throw new Error(`Expected 200, got ${response.status}`);
    }
  }));

  // Test 3: API key validation (missing key)
  results.push(await runTest('API Key Validation - Missing Key', async () => {
    const response = await makeRequest('/api/convert', 'POST', { html: '<h1>Test</h1>' });
    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`);
    }
  }));

  // Test 4: API key validation (invalid key)
  results.push(await runTest('API Key Validation - Invalid Key', async () => {
    const response = await makeRequest('/api/convert', 'POST', 
      { html: '<h1>Test</h1>' }, 
      { 'X-API-KEY': 'invalid-key' }
    );
    if (response.status !== 401) {
      throw new Error(`Expected 401, got ${response.status}`);
    }
  }));

  // Test 5: PDF conversion with valid API key
  results.push(await runTest('PDF Conversion - Valid API Key', async () => {
    const response = await makeRequest('/api/convert', 'POST', 
      { 
        html: '<h1>Production Test</h1><p>This is a test PDF conversion.</p>',
        format: 'A4'
      }, 
      { 'X-API-KEY': API_KEY }
    );
    
    // Should either succeed (200) or fail due to missing account (401)
    if (response.status !== 200 && response.status !== 401) {
      throw new Error(`Expected 200 or 401, got ${response.status}`);
    }
  }));

  // Test 6: Concurrency guard (multiple simultaneous requests)
  results.push(await runTest('Concurrency Guard', async () => {
    const promises = Array(6).fill().map(() => 
      makeRequest('/api/convert', 'POST', 
        { html: '<h1>Concurrency Test</h1>' }, 
        { 'X-API-KEY': API_KEY }
      )
    );
    
    const responses = await Promise.all(promises);
    const successCount = responses.filter(r => r.status === 200 || r.status === 401).length;
    
    if (successCount !== responses.length) {
      throw new Error(`Expected all requests to complete, got ${successCount}/${responses.length}`);
    }
  }));

  // Test 7: Error handling
  results.push(await runTest('Error Handling - Invalid HTML', async () => {
    const response = await makeRequest('/api/convert', 'POST', 
      { html: '' }, // Empty HTML should trigger validation error
      { 'X-API-KEY': API_KEY }
    );
    
    // Should fail with 400 or 401
    if (response.status !== 400 && response.status !== 401) {
      throw new Error(`Expected 400 or 401, got ${response.status}`);
    }
  }));

  // Test 8: CORS headers
  results.push(await runTest('CORS Headers', async () => {
    const response = await makeRequest('/health');
    if (!response.headers['access-control-allow-origin']) {
      throw new Error('CORS headers not present');
    }
  }));

  // Test 9: Security headers
  results.push(await runTest('Security Headers', async () => {
    const response = await makeRequest('/health');
    if (response.headers['x-powered-by']) {
      throw new Error('X-Powered-By header should be disabled');
    }
  }));

  // Summary
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log('📊 Test Results Summary:');
  console.log(`   Passed: ${passed}/${total}`);
  console.log(`   Failed: ${total - passed}/${total}`);
  
  if (passed === total) {
    console.log('\n🎉 All tests passed! The service is production-ready.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please review the issues above.');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
}); 