(() => {
 const node=id=>document.getElementById(id);
 for(const id of ['recruiterDraft','recruiterInsert','recruiterCopy','recruiterAnalysis'])if(node(id))node(id).hidden=true;
 if(node('recruiterStatus'))node('recruiterStatus').textContent='AI подгружает доступную историю активного чата, учитывает связанную вакансию/отклик/CV и готовит черновик. Ничего не отправляется.';
 node('recruiterAnalyze')?.addEventListener('click',async()=>{try{await sendToPage({type:'vjaCopilotPage',action:'ai'});}catch{if(node('recruiterStatus'))node('recruiterStatus').textContent='Откройте чат и нажмите ✎ AI возле поля ответа.';}});
})();
