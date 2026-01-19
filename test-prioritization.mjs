import http from 'http';

const API_BASE = 'http://localhost:5000/api';

function makeRequest(method, path, body = null, token = null) {
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

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

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

async function testPrioritization() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   PRIORITIZED REQUEST FETCHING TEST                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Register user in Toronto
    console.log('📋 Registering Toronto user...');
    const regRes = await makeRequest('POST', '/auth/register', {
      name: 'Toronto Helper',
      email: `torontohelper${Date.now()}@test.com`,
      password: 'Test@123',
      city: 'Toronto'
    });

    const torontoToken = regRes.data.token;
    console.log(`✅ Registered: Toronto Helper\n`);

    // Fetch requests - should see all cities but Toronto requests first
    console.log('📋 Fetching requests for Toronto user (from any city)...\n');
    const fetchRes = await makeRequest('GET', '/charging/requests/city/Toronto', null, torontoToken);

    if (fetchRes.data.success && fetchRes.data.requests) {
      console.log(`Total requests available: ${fetchRes.data.pagination.totalRequests}\n`);
      console.log('📍 REQUESTS FETCHED (Toronto-prioritized):\n');

      fetchRes.data.requests.slice(0, 5).forEach((req, idx) => {
        const badge = req.isFromUserCity ? '🏠 OWN CITY' : '🌍 OTHER CITY';
        console.log(`${idx + 1}. [${badge}] ${req.city}`);
        console.log(`   Location: ${req.location}`);
        console.log(`   Urgency: ${req.urgency}`);
        console.log(`   Status: ${req.status}\n`);
      });

      // Count by city
      const cityCounts = {};
      fetchRes.data.requests.forEach(req => {
        cityCounts[req.city] = (cityCounts[req.city] || 0) + 1;
      });

      console.log('📊 CITY DISTRIBUTION IN RESULTS:');
      Object.entries(cityCounts).forEach(([city, count]) => {
        const isUserCity = city.toLowerCase() === 'toronto' ? ' 🏠' : '';
        console.log(`   ${city}: ${count} request(s)${isUserCity}`);
      });

      // Check first request is from user's city if any exist
      const torontoReqs = fetchRes.data.requests.filter(r => r.city.toLowerCase() === 'toronto');
      if (torontoReqs.length > 0) {
        const firstReq = fetchRes.data.requests[0];
        if (firstReq.city.toLowerCase() === 'toronto') {
          console.log('\n✅ PASS: User city requests prioritized at top');
        } else {
          console.log('\n⚠️  INFO: No Toronto requests in results currently');
        }
      }

    } else {
      console.log('❌ Failed to fetch requests\n');
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  console.log('\n');
}

testPrioritization();
