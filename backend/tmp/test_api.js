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
    console.log('Logging in...');
    const login = await request('POST','/api/login',{username:'jnbtest', password:'8143772362'});
    console.log('Login status', login.status);
    console.log(login.body);
    const token = login.body && login.body.token;
    if(!token){ console.error('No token returned'); process.exit(1); }

    console.log('Fetching workspaces...');
    const ws = await request('GET','/api/workspaces', null, { Authorization: `Bearer ${token}` });
    console.log('Workspaces status', ws.status);
    console.log(JSON.stringify(ws.body, null, 2));

    if(Array.isArray(ws.body) && ws.body.length>0){
      const wid = ws.body[0].id;
      console.log('Fetching projects for workspace', wid);
      const pr = await request('GET', `/api/projects/workspace/${wid}`, null, { Authorization: `Bearer ${token}` });
      console.log('Projects status', pr.status);
      console.log(JSON.stringify(pr.body, null, 2));
    }
  }catch(err){
    console.error('Error', err);
    process.exit(1);
  }
})();
