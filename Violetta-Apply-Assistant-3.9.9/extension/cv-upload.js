function vjaBase64ToBytes(base64) { const b=atob(base64),bytes=new Uint8Array(b.length);for(let i=0;i<b.length;i++)bytes[i]=b.charCodeAt(i);return bytes; }
function vjaUploadLabel(input) {
  if(window.vjaSiteAdapters)return window.vjaSiteAdapters.label(input);
  const label=input.id?document.querySelector(`label[for="${CSS.escape(input.id)}"]`):input.closest('label');
  return [label?.textContent,input.name,input.id,input.getAttribute('aria-label')].filter(Boolean).join(' ');
}
function vjaIsResumeField(label){return /\b(resume|cv)\b|résumé|резюме|lebenslauf/i.test(label)&&!/portfolio|портфолио|cover.?letter|сопровод|other.?document|друг.*документ/i.test(label);}
function vjaFindResumeInput() {
  const candidates=[...document.querySelectorAll('input[type="file"]')].filter(el=>!el.disabled&&vjaIsResumeField(vjaUploadLabel(el))&&!window.vjaCopilotCore?.highRisk(vjaUploadLabel(el)));
  return candidates.length===1?candidates[0]:null;
}
function vjaUploadCv(fileData,explicitInput=null) {
  try {
    if(window.vjaCopilotCore&&!window.vjaCopilotCore.cvValid(fileData))return {success:false,error:'Проверьте PDF в CV Vault.'};
    const input=explicitInput||vjaFindResumeInput();
    if(!input||input.type!=='file'||input.disabled||!input.isConnected||!vjaIsResumeField(vjaUploadLabel(input))||window.vjaCopilotCore?.highRisk(vjaUploadLabel(input)))return {success:false,error:'Нет однозначного поля резюме.'};
    if(input.files?.length)return {success:false,error:'В поле уже есть файл; он сохранён без замены.'};
    if(input.accept&&!input.accept.split(',').some(s=>['.pdf','application/pdf','application/*','*/*'].includes(s.trim().toLowerCase())))return {success:false,error:'Поле не принимает PDF.'};
    const bytes=vjaBase64ToBytes(fileData.base64);
    if(bytes.length!==fileData.size||String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')return {success:false,error:'Неверный формат или размер PDF.'};
    const file=new File([bytes],fileData.name,{type:'application/pdf',lastModified:Date.now()}),transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;
    input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
    return {success:input.files?.[0]?.name===file.name,filename:file.name,size:file.size,fieldLabel:vjaUploadLabel(input)};
  }catch{return {success:false,error:'Сайт не разрешил прикрепить файл. Сделайте это вручную.'};}
}
chrome.runtime.onMessage.addListener((message,_sender,respond)=>{if(message?.type!=='uploadCv')return false;respond(vjaUploadCv(message.fileData));return false;});
