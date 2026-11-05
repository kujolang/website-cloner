// Screenshot rasterization can outlive the interaction timeout under browser
// load. Retry that operation once; never turn a missing capture into a pass.
export async function verificationScreenshot(page,file,{fullPage=false}={}){
 let retries=0;
 for(;;){
  try{await page.screenshot({path:file,fullPage,animations:'disabled',timeout:30000});return {retries};}
  catch(error){if(retries||error.name!=='TimeoutError')throw error;retries++;}
 }
}
