const fetch = global.fetch || require('node-fetch');

async function run() {
  try {
    // login with provided credentials
    const loginRes = await fetch('http://localhost:5000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'JNBtest@JNB.com', password: '8143772362' })
    });

    const loginBody = await loginRes.json().catch(()=>null);
    console.log('login status', loginRes.status, 'body', loginBody);

    if (!loginBody || !loginBody.token) {
      console.error('Login failed or did not return token');
      return;
    }

    const token = loginBody.token;

    // request workspaces
    const wsRes = await fetch('http://localhost:5000/api/workspaces', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const wsBody = await wsRes.json().catch(()=>null);
    console.log('\n/api/workspaces status', wsRes.status);
    console.log('body:', JSON.stringify(wsBody, null, 2));
  } catch (e) {
    console.error(e);
  }
}

run();
