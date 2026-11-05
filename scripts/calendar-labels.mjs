// Translate only supported PHP date tokens; never execute source configuration.
export function calendarDatePattern(value){
 if(typeof value!=='string'||!value||value.length>80||/[\x00-\x1f\[\]]/.test(value))return null;
 const tokens={d:'dd',j:'d',m:'MM',n:'M',Y:'yyyy',y:'yy',F:'MMMM',M:'MMM',D:'EEE',l:'EEEE'};let result='',count=0;
 for(let i=0;i<value.length;i++){const c=value[i];if(c==='\\'){if(++i===value.length)return null;result+='['+value[i]+']';}else if(tokens[c]){result+=tokens[c];count++;}else if(/[a-zA-Z]/.test(c))return null;else result+=c;}
 return count?result:null;
}
