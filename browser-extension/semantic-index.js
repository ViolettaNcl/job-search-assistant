/* Lightweight local semantic vector index. Deterministic hashed n-gram vectors; not a trained embedding model. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaSemanticIndex=api;})(globalThis,function(){
  'use strict';const DIM=128;
  const normalize=s=>String(s??'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9+#.]+/gi,' ').replace(/\s+/g,' ').trim();
  function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  const STOP=new Set(['какой','какая','какие','какого','укажите','есть','ли','вас','ваш','ваша','ваши','the','what','your','please','have','you']);
  function stem(token){let x=String(token);if(/[а-я]/i.test(x)&&x.length>5){for(const suf of ['иями','ями','ами','ого','ему','ому','ыми','ими','его','иях','ах','ях','ой','ей','ом','ем','ым','им','ую','юю','ая','яя','ые','ие','ых','их','а','я','ы','и','у','ю','е','о']){if(x.endsWith(suf)&&x.length-suf.length>=4){x=x.slice(0,-suf.length);break;}}}else if(/^[a-z]+$/i.test(x)&&x.length>5){for(const suf of ['ing','ed','es','s'])if(x.endsWith(suf)&&x.length-suf.length>=4){x=x.slice(0,-suf.length);break;}}return x;}
  function terms(text){const t=normalize(text).split(' ').map(stem).filter(x=>x.length>=2&&!STOP.has(x)),out=[...t];for(let i=0;i<t.length-1;i++)out.push(t[i]+' '+t[i+1]);return out;}
  function vector(text,dim=DIM){const v=Array(dim).fill(0);for(const term of terms(text)){const idx=hash(term)%dim;v[idx]+=1;}const n=Math.sqrt(v.reduce((s,x)=>s+x*x,0))||1;return v.map(x=>x/n);}
  function cosine(a,b){let s=0;for(let i=0;i<Math.min(a.length,b.length);i++)s+=a[i]*b[i];return s;}
  function similarity(a,b){return cosine(vector(a),vector(b));}
  function topK(query,items=[],getText=x=>x?.text||'',k=5){const q=vector(query);return (Array.isArray(items)?items:[]).map(item=>({item,score:cosine(q,vector(getText(item)))})).sort((a,b)=>b.score-a.score).slice(0,k);}
  return {DIM,normalize,terms,vector,cosine,similarity,topK};
});
