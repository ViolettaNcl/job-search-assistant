/* Cross-ID duplicate/repost detector for 5.0 foundation. Pure and explainable. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaDuplicateDetector=api;})(globalThis,function(){
  'use strict';const clean=v=>String(v??'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9+#.]+/gi,' ').replace(/\s+/g,' ').trim();
  const words=v=>new Set(clean(v).split(' ').filter(x=>x.length>=3));
  function jaccard(a,b){const A=words(a),B=words(b);if(!A.size&&!B.size)return 1;let i=0;for(const x of A)if(B.has(x))i++;return i/Math.max(1,A.size+B.size-i);}
  function fingerprint(v={}){return [clean(v.company),clean(v.title)].filter(Boolean).join('|');}
  function similarity(a={},b={}){const company=clean(a.company)===clean(b.company)&&clean(a.company)?1:jaccard(a.company,b.company);const title=jaccard(a.title,b.title);const body=jaccard([a.description,a.requirements].join(' '),[b.description,b.requirements].join(' '));const score=.35*company+.35*title+.30*body;return {score:Number(score.toFixed(3)),company,title,body,repost:company>.8&&title>.72&&score>=.78,exact:Boolean(a.vacancyId&&b.vacancyId&&String(a.vacancyId)===String(b.vacancyId))};}
  function bestMatch(target,records=[]){let best=null;for(const r of records||[]){const v=r?.vacancy||r;if(!v||v===target)continue;const s=similarity(target,v);if(!best||s.score>best.similarity.score)best={record:r,vacancy:v,similarity:s};}return best;}
  return {clean,jaccard,fingerprint,similarity,bestMatch};
});
