const path=require('path');
const fs=require('fs');

const JOBS_FILE=path.join(__dirname,'..','jobs.json');

function loadJobs(){
    if(!fs.existsSync(JOBS_FILE)) return [];

    const data=fs.readFileSync(JOBS_FILE,'utf8');
    try{
        return JSON.parse(data);
    }catch(e){
        return [];
    }
}

function saveJobs(jobs){
    fs.writeFileSync(JOBS_FILE,JSON.stringify(jobs,null,2));
}

module.exports={saveJobs,loadJobs}

