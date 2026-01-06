const http = require('http');

function request(method, path, body=null, headers={}){
  return new Promise((resolve,reject)=>{
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: Object.assign({'Content-Type':'application/json'}, headers),
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try{
          const parsed = JSON.parse(data);
          resolve({status: res.statusCode, body: parsed});
        }catch(e){
          resolve({status: res.statusCode, body: data});
        }
      });
    });

    req.on('error', (err) => reject(err));
    if(body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async ()=>{
  try{
    const adminLogin = await request('POST','/api/login',{username:'jnbtest', password:'8143772362'});
    const adminToken = adminLogin.body.token;
    console.log('Admin token obtained');

    // Create new user
    const email = 'temp1@example.com';
    const username = 'temp1';
    const password = 'password123';

    console.log('Signing up temp user...');
    const signup = await request('POST','/api/complete-signup',{email, username, password, first_name:'Temp', last_name:'User'});
    console.log('Signup status', signup.status);

    // Admin adds temp user to workspace 7
    const workspaceId = 7;
    console.log('Adding temp user to workspace as Member...');
    const add = await request('POST', `/api/workspaces/${workspaceId}/members`, {email, role: 'Member'}, {Authorization: `Bearer ${adminToken}`});
    console.log('Add member status', add.status, add.body);

    // Login as temp user
    const loginTemp = await request('POST','/api/login',{username: username, password});
    console.log('Temp login status', loginTemp.status, loginTemp.body);
    const tempToken = loginTemp.body.token;

    // Fetch projects for workspace as temp user
    const projects = await request('GET', `/api/projects/workspace/${workspaceId}`, null, { Authorization: `Bearer ${tempToken}` });
    console.log('Projects for temp user status', projects.status);
    console.log(JSON.stringify(projects.body, null, 2));

  }catch(err){
    console.error('Error', err);
  }
})();
