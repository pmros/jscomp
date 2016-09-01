var fsx = require("fs-extra")
var path = require("path")
var fm = require('front-matter')
var hljs = require('highlight.js')
var uniq = require('lodash/uniq')
var map = require('lodash/map')
var beautify = require('js-beautify')

var marked = require('marked')
marked.setOptions({
  highlight: function(code,lang) {
     if (lang){
      return hljs.highlight(lang,code).value
     }
     return hljs.highlightAuto(code).value
    }
});

var source = '../demos/'
var output = '../pages/'

function getDirs(srcpath) {
  return fsx.readdirSync(srcpath).filter(function(file) {
    return fsx.statSync(path.join(srcpath, file)).isDirectory();
  });
}

function getFiles(srcpath) {
  return fsx.readdirSync(srcpath).filter(function(file) {
    return file !== '.DS_Store'
  })
}

fsx.removeSync('../index.html')
fsx.removeSync(output);
fsx.mkdirSync(output);
fsx.mkdirSync(output+'scripts');

var data = {dcount:0,frameworks:[],icount:0,tlength:0,demos:[]}
getDirs(source).forEach(function(demoName){
  data.dcount += 1
  var demopath = source + demoName + '/'
  var demoReadme = fm(fsx.readFileSync(demopath+'README.md')+'')
  var demo = Object.assign({
    frameworks:[],
    filenames:[],
    description: marked(demoReadme.body),
    folderName: demoName
  },demoReadme.attributes)

  getDirs(demopath).forEach(function(frameworkName){
    data.frameworks = uniq(data.frameworks.concat(frameworkName))
    var niceFrameworkName = frameworkName[0].toUpperCase()+frameworkName.substr(1)
    var framework = {
      name: niceFrameworkName,
      folderName: frameworkName,
      implementations: []
    }
    var framepath = demopath + frameworkName + '/'
    getDirs(framepath).forEach(function(implName){
      data.icount += 1
      var implpath = framepath + implName + '/'
      var readme = fm(fsx.readFileSync(implpath+'README.md')+'')
      var impl = Object.assign(
        readme.attributes,{
          folderName: implName,
          demoName: demoName,
          framework: frameworkName,
          niceFrameworkName: niceFrameworkName,
          deps: map(require(implpath+'package.json').dependencies,function(v,pkg){
            return {package:pkg,version:v}
          }),
          explanation: marked( readme.body.replace(/^\s*|\s*$/g,'') ),
          files:[],
          bundleSize: (fsx.readFileSync(implpath+'bundle.js')+'').length,
          size:0,
          url: demoName+'_'+frameworkName+'_'+implName+'_info.html',
          bundleName: demoName+'_'+frameworkName+'_'+implName+'.js',
          githubUrl: 'http://www.github.com/krawaller/jscomp/tree/gh-pages/demos/'+demoName+'/'+frameworkName+'/'+implName
        }
      );
      getFiles(implpath + '/src').forEach(function(file){
        var content = fsx.readFileSync(implpath+'/src/'+file)+''
        var filebasename = file.replace(/\.[^.]*$/,'')
        var suffix = file.match(/\.([^.]*)$/,'')[1]
        demo.filenames = uniq(demo.filenames.concat(filebasename))
        impl.files.push({
          filename: filebasename,
          suffix: '.'+suffix,
          size: content.length,
          code: hljs.highlight(readme.attributes.language || 'javascript',content).value
        })
        impl.size += content.length
        data.tlength += content.length
      })
      framework.implementations.push(impl)
    })
    demo.frameworks.push(framework)
  })
  demo.frameworks.forEach(function(framework){
    framework.implementations.forEach(function(impl){

    })
  })
  data.demos.push(demo)
});

fsx.writeFileSync(output+'_data.json',beautify(JSON.stringify(data)))


/****** Create files *****/

var handlebars = require('handlebars');
var masterTmpl = handlebars.compile(fsx.readFileSync('templates/master.hbt')+'');
var implTmpl = handlebars.compile(fsx.readFileSync('templates/implementation.hbt')+'');
var indexTmpl = handlebars.compile(fsx.readFileSync('templates/index.hbt')+'');
var demoTmpl = handlebars.compile(fsx.readFileSync('templates/demo.hbt')+'');


var write = function(path,title,content,root){
  fsx.writeFileSync(path,beautify.html(masterTmpl({
    TITLE: title,
    root: root,
    MAINCONTENT: content
  })))
}



/***** Index file ******/
var indexCtx = Object.assign(data,{
  maintext: marked(fsx.readFileSync('mainpage.md')+''),
  isIndex: true
})
write('../index.html','JS Comp',indexTmpl(indexCtx),true)


data.demos.forEach(function(demo){
  write(output+demo.folderName+'.html',demo.name,demoTmpl(demo));
  demo.frameworks.forEach(function(framework){
    framework.implementations.forEach(function(impl){
      var files = [{
        filename: 'info',
        isInfo: true
      }].concat(impl.files)
      fsx.copySync(
        '../demos/'+demo.folderName+'/'+framework.folderName+'/'+impl.folderName+'/bundle.js',
        '../pages/scripts/'+demo.folderName+'_'+framework.folderName+'_'+impl.folderName+'.js'
      )
      files.forEach(function(file){
        var path = output+demo.folderName+'_'+impl.framework+'_'+impl.folderName+'_'+file.filename+'.html'
        var ctx = Object.assign({
          links: files.map(function(linkTo){
            return {
              to:linkTo.filename+(linkTo.suffix || ''),
              active:linkTo.filename===file.filename,
              url: demo.folderName+'_'+impl.framework+'_'+impl.folderName+'_'+linkTo.filename+'.html'
            };
          })
        },impl,file)
        write(path,framework.name+' - '+impl.title,implTmpl(ctx))
      })
    })
  })
})






/***** CSS files ****/



var highlightTheme = 'zenburn.css'
var codeFile = fsx.readFileSync('./node_modules/highlight.js/styles/'+highlightTheme)+''
fsx.writeFileSync(output+'code.css',codeFile.replace(/\.hljs\s*\{/,'pre > code {'))

fsx.copySync('./style.css',output+'style.css')




