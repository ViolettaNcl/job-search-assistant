const assert=require('node:assert/strict');
const A=require('./application-analytics.js');
const apps=[
 {status:'Recruiter Replied',role:'technical_support',cvName:'support.pdf',timeline:[{type:'submitted'}]},
 {status:'HR Interview',role:'technical_support',cvName:'support.pdf',timeline:[{type:'submitted'}]},
 {status:'Rejected',role:'developer',cvName:'dev.pdf',timeline:[{type:'submitted'},{type:'status',meta:{status:'Recruiter Replied'}},{type:'status',meta:{status:'Rejected'}}]},
 {status:'Ready',role:'developer',cvName:'dev.pdf',timeline:[]}
];
const s=A.summarize(apps);
assert.equal(s.total.applications,4);
assert.equal(s.total.applied,3);
assert.equal(s.total.response,3);
assert.equal(s.total.interview,1);
assert.equal(s.total.rejected,1);
const support=s.cvs.find(x=>x.key==='support.pdf');assert.equal(support.applications,2);assert.equal(support.responseRate,100);assert.equal(support.interview,1);
const dev=s.roles.find(x=>x.key==='developer');assert.equal(dev.applications,2);assert.equal(dev.applied,1);
console.log('application-analytics tests passed');
