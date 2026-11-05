import assert from 'node:assert/strict';
export async function selectCalendarDate(page,value){
 await page.locator('.tribe-events-c-top-bar__datepicker-button').click();
 await page.waitForFunction(()=>document.querySelector('.datepicker')||document.querySelector('[data-js="tribe-events-top-bar-date"]')?.getClientRects().length);
 const picker=page.locator('.datepicker');
 if(!await picker.count()){const input=page.locator('[data-js="tribe-events-top-bar-date"]');await input.fill(value);await input.dispatchEvent('change');return;}
 const [year,month]=value.split('-').map(Number);
 for(let i=0;i<2&&!await picker.locator('.year').count();i++)await picker.locator('.datepicker-switch').click();
 for(let i=0;i<50&&!await picker.getByRole('button',{name:String(year),exact:true}).count();i++){const first=Number(await picker.locator('.year').first().textContent());await picker.locator(year<first?'.prev':'.next').click();}
 await picker.getByRole('button',{name:String(year),exact:true}).click();await picker.locator('.month').nth(month-1).click();
 if(await picker.count()){const time=Date.parse(value+'T00:00:00Z');await picker.locator('.day[data-date="'+time+'"]').click();}else assert.ok(value.endsWith('-01'),'Month view selects the first day of a month');
}
