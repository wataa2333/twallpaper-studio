const esbuild = require('esbuild');
const fs = require('fs');
fs.mkdirSync('dist', {recursive:true});
fs.cpSync('public','dist',{recursive:true});
fs.copyFileSync('src/index.html','dist/index.html');
fs.copyFileSync('src/style.css','dist/style.css');
fs.writeFileSync('src/pattern-data.json',JSON.stringify(Object.fromEntries(fs.readdirSync('public/patterns').map(f=>[f,'data:image/svg+xml;base64,'+fs.readFileSync('public/patterns/'+f).toString('base64')]))));
esbuild.buildSync({entryPoints:['src/app.ts'],bundle:true,outfile:'dist/app.js',loader:{'.glsl':'text'},sourcemap:true});
