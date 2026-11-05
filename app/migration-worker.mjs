import {migrate} from '../engine/pipeline.mjs';
let browserReady;
process.on('message',message=>{if(message.browserContinue&&browserReady){browserReady();browserReady=null;}});
process.once('message',async({url,dir,options})=>{
 try{await migrate(url,dir,{...options,browserConfirm:()=>new Promise(resolve=>{browserReady=resolve;}),event:(stage,counts)=>process.send?.({event:{stage,counts}})});process.send?.({done:true},()=>process.exit(0));}
 catch(error){process.send?.({error:{message:error.message,code:error.code,retryAfterMs:error.retryAfterMs,requiredFreeBytes:error.requiredFreeBytes}},()=>process.exit(1));}
});
