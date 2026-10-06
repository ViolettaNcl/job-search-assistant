/* Global safety policy. No network or DOM actions in this module. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaAutomationPolicy=api;})(globalThis,function(){
  'use strict';const KEY='vjaAutomationPolicyV1',MODES=['manual','assist','autopilot'];
  const EXPLICIT_SUBMIT_INTENTS=new Set(['quick-list-apply-letter','vacancy-page-apply-letter','popup-apply-letter']);
  function normalize(p={}){return {...p,mode:MODES.includes(p.mode)?p.mode:'assist',explicitOptIn:p.explicitOptIn===true,paused:p.paused===true,approvedCategories:Array.isArray(p.approvedCategories)?p.approvedCategories.filter(x=>typeof x==='string').slice(0,30):[],dailyLimit:[10,20,30,0].includes(p.dailyLimit)?p.dailyLimit:20};}
  function decide(policy={},context={}){const p=normalize(policy);const stop=['legal','unknownRequiredFact','captcha','suspiciousOrigin','payment','identityVerification','unexpectedUpload','unresolvedReview'].filter(k=>context[k]);
    if(stop.length)return {allowed:false,reason:'review-required',stop};
    if(context.action==='analyze'||context.action==='draft')return {allowed:true,reason:'read-only'};
    if(context.action==='fill'&&context.userInitiated===true)return {allowed:true,reason:'explicit-fill'};
    // The dedicated Apply + letter controls are one-shot, explicit user actions.
    // They are allowed even when background automation is paused, but never bypass the hard stops above.
    if(context.action==='submit'&&context.userInitiated===true&&EXPLICIT_SUBMIT_INTENTS.has(String(context.intent||'')))return {allowed:true,reason:'explicit-user-submit'};
    if(p.paused)return {allowed:false,reason:'automation-paused'};
    if(p.mode==='manual')return {allowed:false,reason:'manual-mode'};
    if(context.action==='fill'&&p.mode==='assist')return {allowed:true,reason:'assist-fill'};
    if(p.mode!=='autopilot'||!p.explicitOptIn)return {allowed:false,reason:'final-submission-requires-user'};
    if(!p.approvedCategories.includes(context.category))return {allowed:false,reason:'category-not-approved'};
    if(Number(context.confidence)<.9||!Number.isFinite(Number(context.confidence)))return {allowed:false,reason:'low-confidence'};
    if(p.dailyLimit&&Number(context.appliedToday||0)>=p.dailyLimit)return {allowed:false,reason:'daily-limit'};
    return {allowed:true,reason:'explicit-autopilot'};
  }
  function pageRisks({text='',url='',knownOrigins=[],knownHostSuffixes=[]}={}){let suspiciousOrigin=true;try{const u=new URL(url),host=u.hostname.toLowerCase();const trustedOrigin=knownOrigins.includes(u.origin);const trustedHost=knownHostSuffixes.some(value=>{const suffix=String(value||'').toLowerCase().replace(/^\./,'');return suffix&&(host===suffix||host.endsWith('.'+suffix));});suspiciousOrigin=u.protocol!=='https:'||!(trustedOrigin||trustedHost);}catch{}
    return {suspiciousOrigin,captcha:/captcha|капч[аи]|я не робот|not a robot/i.test(text),payment:/внесите оплату|оплатите|переведите деньги|pay (?:a |the )?fee|payment required/i.test(text),identityVerification:/загрузите паспорт|скан паспорта|identity verification|upload.*passport/i.test(text)};
  }
  return {KEY,MODES,EXPLICIT_SUBMIT_INTENTS,normalize,decide,pageRisks};
});
