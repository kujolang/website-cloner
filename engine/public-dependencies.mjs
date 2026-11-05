// Exact, versioned public-package equivalents only. This does not proxy arbitrary
// source URLs or retry authenticated resources. The destination must pass the
// same network/robots policy, and the substitution remains in the run report.
export function publicPackageURL(value){
 const u=new URL(value);
 if(u.hostname!=='code.ionicframework.com'||u.port||u.username||u.password)return null;
 const match=/^\/ionicons\/(\d+\.\d+\.\d+)\/(css\/ionicons(?:\.min)?\.css|fonts\/ionicons\.(?:woff2?|ttf|eot|svg))$/.exec(u.pathname);
 if(u.search && (!match || u.search !== `?v=${match[1]}`))return null;
 return match?`https://cdn.jsdelivr.net/npm/ionicons@${match[1]}/${match[2]}`:null;
}
