const http = require('http');

const API_BASE = 'http://localhost:5000/api';

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const options = {
      method: method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         COMPREHENSIVE EVHELPER TEST SUITE                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  let passedTests = 0;
  let failedTests = 0;
  const testResults = [];

  // TEST 1: Invalid Login
  console.log('📋 TEST 1: Invalid Login Credentials');
  try {
    const res = await makeRequest('POST', '/auth/login', {
      email: 'invalid@test.com',
      password: 'wrongpass'
    });
    if (res.status !== 200) {
      console.log('✅ PASSED - Correctly rejected (' + res.status + ')\n');
      passedTests++;
    } else {
      console.log('❌ FAILED - Should reject invalid credentials\n');
      failedTests++;
    }
  } catch (err) {
    console.log('❌ FAILED - ' + err.message);
    console.log(err.stack + '\n');
    failedTests++;
  }

  // TEST 2: Register User in New York
  console.log('📋 TEST 2: Register User in New York');
  const alphaEmail = `alpha${Date.now()}@test.com`;
  let alphaToken;
  try {
    const res = await makeRequest('POST', '/auth/register', {
      name: 'Alpha User',
      email: alphaEmail,
      password: 'Test@123',
      city: 'New York'
    });
    if (res.data.token && res.data.user.city === 'New York') {
      console.log(`✅ PASSED - Registered: ${res.data.user.email}`);
      console.log(`   City: ${res.data.user.city}\n`);
      alphaToken = res.data.token;
      passedTests++;
    } else {
      console.log('❌ FAILED\n');
      failedTests++;
    }
  } catch (err) {
    console.log('❌ FAILED - ' + err.message + '\n');
    failedTests++;
  }

  // TEST 3: Valid Login
  console.log('📋 TEST 3: Valid Login');
  try {
    const res = await makeRequest('POST', '/auth/login', {
      email: alphaEmail,
      password: 'Test@123'
    });
    if (res.data.token && res.data.user.name === 'Alpha User') {
      console.log(`✅ PASSED - Login successful for ${res.data.user.name}\n`);
      passedTests++;
    } else {
      console.log('❌ FAILED\n');
      failedTests++;
    }
  } catch (err) {
    console.log('❌ FAILED - ' + err.message + '\n');
    failedTests++;
  }

  // TEST 4: Register Second User in Same City (Case-Insensitive)
  console.log('📋 TEST 4: Register Second User (same city, lowercase)');
  const betaEmail = `beta${Date.now()}@test.com`;
  let betaToken, betaId;
  try {
    const res = await makeRequest('POST', '/auth/register', {
      name: 'Beta User',
      email: betaEmail,
      password: 'Test@123',
      city: 'new york'
    });
    if (res.data.token) {
      console.log(`✅ PASSED - Registered: ${res.data.user.email}`);
      console.log(`   City: ${res.data.user.city} (lowercase input)\n`);
      betaToken = res.data.token;
      betaId = res.data.user._id;
      passedTests++;
    } else {
      console.log('❌ FAILED\n');
      failedTests++;
    }
  } catch (err) {
    console.log('❌ FAILED - ' + err.message + '\n');
    failedTests++;
  }

  // TEST 5: Register User in Different City
  console.log('📋 TEST 5: Register User in Different City (Toronto)');
  const gammaEmail = `gamma${Date.now()}@test.com`;
  let gammaToken;
  try {
    const res = await makeRequest('POST', '/auth/register', {
      name: 'Gamma User',
      email: gammaEmail,
      password: 'Test@123',
      city: 'Toronto'
    });
    if (res.data.token) {
      console.log(`✅ PASSED - Registered: ${res.data.user.email}`);
      console.log(`   City: ${res.data.user.city}\n`);
      gammaToken = res.data.token;
      passedTests++;
    } else {
      console.log('❌ FAILED\n');
      failedTests++;
    }
  } catch (err) {
    console.log('❌ FAILED - ' + err.message + '\n');
    failedTests++;
  }

  // TEST 6: Create Charging Request (Alpha in New York)
  console.log('📋 TEST 6: Create Charging Request (Alpha in New York)');
  let alphaRequestId;
  try {
    const headers = { ...{}, Authorization: `Bearer ${alphaToken}` };
    const url = new URL(API_BASE + '/charging/requests');
    const options = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${alphaToken}`
      }
    };

    const reqBody = {
      location: '123 Main St',
      urgency: 'high',
      message: 'Need charging urgently',
      phoneNumber: '+1234567890',
      timeAvailable: '2026-01-20T10:00:00Z'
    };

    const result = await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              data: JSON.parse(data)
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              data: data
            });
          }
        });
      });
      req.on('error', reject);
      req.write(JSON.stringify(reqBody));
      req.end();
    });

    if (result.data.charging && result.data.charging._id) {
      console.log(`✅ PASSED - Request created`);
      console.log(`   ID: ${result.data.charging._id}`);
      console.log(`   City: ${result.data.charging.city}\n`);
      alphaRequestId = result.data.charging._id;
      passedTests++;
    } else {
      console.log('❌ FAILED - ' + JSON.stringify(result.data) + '\n');
      failedTests++;
    }
  } catch (err) {
    console.log('❌ FAILED - ' + err.message + '\n');
    failedTests++;
  }

  // TEST 7: Beta User Fetches Requests (Same City - Case Insensitive)
  console.log('📋 TEST 7: Beta Fetches Requests (Same City, Case Insensitive)');
  try {
    const url = new URL(API_BASE + '/charging/requests/city/NEW YORK');
    const options = {
      method: 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Authorization': `Bearer ${betaToken}`
      }
    };

    const result = await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              data: JSON.parse(data)
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              data: data
            });
          }
        });
      });
      req.on('error', reject);
      req.end();
    });

    if (result.data.requests && result.data.requests.length > 0) {
      const foundAlphaRequest = result.data.requests.some(r => r._id === alphaRequestId);
      if (foundAlphaRequest) {
        console.log(`✅ PASSED - Beta can see Alpha's request`);
        console.log(`   Found ${result.data.requests.length} request(s) in NEW YORK\n`);
        passedTests++;
      } else {
        console.log(`❌ FAILED - Alpha's request not found\n`);
        failedTests++;
      }
    } else {
      console.log('❌ FAILED - No requests found\n');
      failedTests++;
    }
  } catch (err) {
    console.log('❌ FAILED - ' + err.message + '\n');
    failedTests++;
  }

  // TEST 8: Gamma User Fetches Requests (Different City Isolation)
  console.log('📋 TEST 8: Gamma Fetches Requests (Different City Isolation)');
  try {
    const url = new URL(API_BASE + '/charging/requests/city/Toronto');
    const options = {
      method: 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Authorization': `Bearer ${gammaToken}`
      }
    };

    const result = await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              data: JSON.parse(data)
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              data: data
            });
          }
        });
      });
      req.on('error', reject);
      req.end();
    });

    // City endpoint should only return Toronto requests; Gamma must NOT see New York requests.
    if (result.data.requests && result.data.requests.length > 0) {
      const foundAlphaRequest = result.data.requests.some(r => r._id === alphaRequestId);
      if (foundAlphaRequest) {
        console.log(`❌ FAILED - Gamma should NOT see Alpha's New York request via Toronto endpoint\n`);
        failedTests++;
      } else {
        console.log(`✅ PASSED - Gamma cannot see New York requests via Toronto endpoint`);
        console.log(`   Found ${result.data.requests.length} Toronto request(s)\n`);
        passedTests++;
      }
    } else {
      console.log(`✅ PASSED - No Toronto requests available (and none leaked from other cities)\n`);
      passedTests++;
    }
  } catch (err) {
    console.log('❌ FAILED - ' + err.message + '\n');
    failedTests++;
  }

  // SUMMARY
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                            ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Passed: ${passedTests}                                              ║`);
  console.log(`║  ❌ Failed: ${failedTests}                                              ║`);
  console.log(`║  📊 Total:  ${passedTests + failedTests}                                              ║`);
  const percentage = Math.round((passedTests / (passedTests + failedTests)) * 100);
  console.log(`║  📈 Score:  ${percentage}%                                           ║`);
  console.log('╚════════════════════════════════════════════════════════════╝');
}

runTests().catch(console.error);
