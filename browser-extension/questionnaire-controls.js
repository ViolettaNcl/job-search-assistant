/* Exact-match choice filling. No guessed options, consent checks or final form submission. */
(function(root){
  'use strict';const clean=x=>String(x??'').replace(/\s+/g,' ').trim(),norm=x=>clean(x).toLocaleLowerCase('ru-RU');
  const label=el=>clean(el.labels?.[0]?.textContent||el.getAttribute('aria-label')||el.textContent||el.value);
  function radioGroup(el){if(el.getAttribute('role')==='radiogroup')return [...el.querySelectorAll('[role="radio"],input[type="radio"]')];if(el.type!=='radio')return [];if(!el.name)return [el];
    const scope=el.form||el.closest('fieldset')||el.getRootNode();return [...scope.querySelectorAll('input[type="radio"]')].filter(x=>x.name===el.name&&x.form===el.form);}
  function groupFields(fields){const seen=new Set(),groups=new Set(fields.filter(el=>el.getAttribute('role')==='radiogroup'));return fields.filter(el=>{if(el.type==='radio'&&groups.has(el.closest('[role="radiogroup"]')))return false;const group=radioGroup(el);if(!group.length)return true;if(group.some(x=>seen.has(x)))return false;group.forEach(x=>seen.add(x));return true;});}
  function value(el){const radios=radioGroup(el);if(radios.length){const x=radios.find(x=>x.checked||x.getAttribute('aria-checked')==='true');return x?label(x):'';}
    if(el.tagName==='SELECT')return el.multiple?JSON.stringify([...el.selectedOptions].map(x=>x.value)):el.value;
    if(el.type==='checkbox'||el.getAttribute('role')==='checkbox')return el.checked||el.getAttribute('aria-checked')==='true'?'true':'false';
    if(el.getAttribute('role')==='combobox'){if(el.value)return el.value;return clean(el.getAttribute('aria-valuetext')||el.textContent);}
    return clean(el.isContentEditable?el.textContent:el.value);
  }
  function describe(el,d){const radios=radioGroup(el);if(radios.length)return {...d,type:'radiogroup',label:clean(el.closest('fieldset')?.querySelector('legend')?.textContent||el.closest('[role="radiogroup"]')?.getAttribute('aria-label')||d.label),currentValue:value(el),required:radios.some(x=>x.required||x.getAttribute('aria-required')==='true'),options:radios.map(x=>({value:x.value||label(x),text:label(x)}))};return d;}
  function fire(el){for(const type of ['input','change','blur'])el.dispatchEvent(new Event(type,{bubbles:true}));}
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  async function set(el,answer){const radios=radioGroup(el);let expected=[];
    if(radios.length){const matches=radios.filter(x=>!x.disabled&&[x.value,label(x)].some(v=>norm(v)===norm(answer)));if(matches.length!==1)return false;const x=matches[0];if(x.getAttribute('role')==='radio')x.click();else{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'checked').set.call(x,true);fire(x);}expected=[label(x)];}
    else if(el.tagName==='SELECT'){
      let wanted=[clean(answer)];if(el.multiple){try{const arr=JSON.parse(answer);if(!Array.isArray(arr)||!arr.every(x=>typeof x==='string'))return false;wanted=arr;}catch{return false;}}
      const selections=[];for(const a of wanted){const matches=[...el.options].filter(o=>!o.disabled&&[o.value,o.textContent].some(v=>norm(v)===norm(a)));if(matches.length!==1)return false;selections.push(matches[0]);}
      if(el.multiple){for(const o of el.options)o.selected=selections.includes(o);expected=[JSON.stringify(selections.map(o=>o.value))];}else{Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,selections[0].value);expected=[selections[0].value];}fire(el);
    }else if(el.type==='checkbox'||el.getAttribute('role')==='checkbox'){
      const x=norm(answer);if(!['true','false','да','нет','yes','no'].includes(x))return false;const checked=['true','да','yes'].includes(x);
      if(el.type==='checkbox'){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'checked').set.call(el,checked);fire(el);}else if((el.getAttribute('aria-checked')==='true')!==checked)el.click();expected=[String(checked)];
    }else if(el.getAttribute('role')==='combobox'){
      const id=el.getAttribute('aria-controls')||el.getAttribute('aria-owns');if(!id)return false;
      el.click();await wait(75);const list=document.getElementById(id);if(!list)return false;
      const matches=[...list.querySelectorAll('[role="option"]')].filter(o=>o.getAttribute('aria-disabled')!=='true'&&norm(o.textContent)===norm(answer));if(matches.length!==1)return false;
      matches[0].click();fire(el);expected=[clean(answer)];
    }else return null;
    await wait(100);if(!el.isConnected||!expected.some(x=>norm(value(el))===norm(x)))return false;
    await wait(175);return el.isConnected&&expected.some(x=>norm(value(el))===norm(x));
  }
  root.vjaChoiceControls={groupFields,describe,value,set};
})(globalThis);
