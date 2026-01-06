const { pool } = require('../db');

(async ()=>{
  try{
    const res = await pool.query('SELECT * FROM project_members WHERE user_id = $1', [7]);
    console.log('project_members for user 7:', res.rows);
    const res2 = await pool.query('SELECT * FROM project_members WHERE project_id IN (SELECT id FROM projects WHERE workspace_id = $1)', [7]);
    console.log('project_members in workspace 7:', res2.rows);
  }catch(err){
    console.error(err);
  }finally{
    pool.end();
  }
})();
