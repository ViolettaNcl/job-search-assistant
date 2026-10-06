/* Additive schema migrations: never replace unrecognized user fields. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaProductMigrations=api;})(globalThis,function(){
  'use strict';const CURRENT=3;
  function plan(storage={},now=Date.now()){
    const from=Number(storage.vjaProductSchemaVersion||0);
    if(!Number.isInteger(from)||from<0||from>CURRENT)throw new Error('Unsupported data schema. Update the extension; downgrade migration is blocked.');
    const patch={},steps=[];
    if(from<2){steps.push('legacy-to-2');
      const r=storage.vjaModelRegistryV1;if(r&&Number(r.schemaVersion||1)<2)patch.vjaModelRegistryV1={...r,schemaVersion:2,activeModels:r.activeModels||{preference:r.activeModel||null,engagement:null}};
    }
    if(from<3){steps.push('2-to-3');patch.vjaAutomationPolicyV1={mode:'assist',explicitOptIn:false,approvedCategories:[],dailyLimit:20,...(storage.vjaAutomationPolicyV1||{}),paused:true,modeBeforeMigration:storage.vjaAutomationPolicyV1?.mode||null};}
    if(from<CURRENT){patch.vjaProductSchemaVersion=CURRENT;patch.vjaProductSettingsV1={...(storage.vjaProductSettingsV1||{}),schemaVersion:CURRENT,migratedAt:now};patch.vjaLastMigration={from,to:CURRENT,at:now,steps,status:'complete',legacyPreserved:true};}
    return {from,to:CURRENT,patch,steps,changed:Object.keys(patch).length>0};
  }
  function validate(before,after){if(after.vjaProductSchemaVersion!==CURRENT)throw new Error('Migration schema verification failed.');for(const key of Object.keys(before)){if(!(key in after))throw new Error('Migration lost a key: '+key);}return true;}
  return {CURRENT,plan,validate};
});
