// v.0.1
function crEl(tag){return document.createElement(tag);}
function crText(text){return document.createTextNode(text);}
function getTag(tag){return document.getElementsByTagName(tag)[0];}
function toTag(tag){return document.getElementsByTagName(tag)[0];}
function getId(id){return document.getElementById(id);}
function toId(id){return document.getElementById(id);}

function render(tree,parent){
var element=function (tag,id,cN,context,events){
  var el=document.createElement(tag);
  if (id)
  el.id=id;
  if(cN)
  el.className=cN
  if (events)
    for (var i in events)
    if (events.hasOwnProperty(i))
      el[i]=function(e){
        var e=window.event?window.event:e;
        events['on'+e.type].call(context,e)
        }
  if (id&&context.view)
    context.view[id]=el;
  return el;
  };
var text=function(text){
  return document.createTextNode(text);
  };
var tags={
'div':function(id,cN){
  return element('div',id,cN,this);
  },
'br':function (){
  return element('br');
  },
'link':function (t,h){
  var a=element('a');
  a.appendChild(text(t));
  a.href=(h)?h:"#empty";
  return a;
  },
'{}':function (object){
  var a=element('a',null,object.style+'Object',this,
                {onclick:function(e){object.func.call(this,object.o,e)}});
  a.appendChild(text(object.o.val));
  a.href="#empty";
  return a;
  },
'aimg':function (src,alt,w,h,id,cN,events){
  var i=element('img',null,null,this);
  i.src=src;
  i.alt=alt;
  i.height=h;
  i.width=w;
  var a=element('a',id,cN,this,events);
  a.appendChild(i);
  a.href="#empty";
  return a;
  },
'a':function (t,id,cN,events){
  var a=element('a',id,cN,this,events);
  a.appendChild(text(t));
  a.href="#empty";
  return a;
  },
'table':function (id,cN,r,c,elFunc,header){
  var t=element('table',id,cN,this);
  if (header){
    var r0=element('tr',null,null,this);
    for (var i=0;i< c;i++){
      var rh=element('th',null,null,this);
      //var rh=element('th',id+'_th'+i,null,this);
      rh.appendChild(text(header[i]));
      r0.appendChild(rh);
    }
    t.appendChild(r0);
    r--;
  } 
  for (var jr=0;jr<r;jr++){
    var tr=element('tr',null,null,this);
    //var tr=element('tr',id+'_tr'+jr,null,this);
    for (var jd=0;jd<c;jd++){
      var td=element('td',null,null,this);
      //var td=element('td',id+'_td'+jr+'_'+jd,null,this);
      if (elFunc)
        elFunc(id,jr,jd,td);
      tr.appendChild(td);
    }
    t.appendChild(tr);
  }
  return t;
  },
'canvas':function (id,w,h){
  var c=element('canvas',id,null,this);
  c.height=h;
  c.width=w;
  return c;
  },
'button':function (val,id,cN,events){
  var b=element('input',id,cN,this,events)
  b.type='button';
  b.value=val;
  return b;
  },
'radio':function (checked,id,value,events){
  var r=element('input',id,null,this,events)
  r.type='radio';
  r.value=value;
  if (checked)
  r.checked=true;
  return r;
  },
'input':function (size,text,id,cN,events){
  var i=element('input',id,cN,this,events)
  i.type='text';
  if(text||text==0)
  i.value=text;
  if(size)
  i.size=size;
  return i;
  },
'check':function (checked,id,events){
  var c=element('input',id,null,this,events)
  c.type='checkbox';
  if (checked)
  c.checked=true;
  return c;
  },
'textarea':function (cols,rows,text,id,cN,wrap,events){
  var t=element('textarea',id,cN,this,events)
  if(text||text==0)
  t.value=text;
  if(cols)
  t.cols=cols;
  if(rows)
  t.rows=rows;
  if(wrap)
  t.wrap=wrap;
  return t;
  },
'p':function (t,cN){
  var p=element('p',null,cN);
  p.appendChild(text(t));
  return p;
  },
'span':function (cN,t){
  var s=element('span',null,cN);
  if (t)
    s.appendChild(text(t));
  return s;
  },
'img':function (src,alt,w,h){
  var i=element('img');
  i.src=src;
  i.alt=alt;
  i.height=h;
  i.width=w;
  return i;
  },
'select':function (opts,events,si,id,cN,size,mult){
  var s=element('select',id,cN,this,events);
  s.size=size||1;
  if(mult)
  s.milt='multiple';
  for (var i in opts)
  if (opts.hasOwnProperty(i)){
    var o=crEl('option');
    o.appendChild(text(opts[i]));
    o.value=i;
    s.appendChild(o);
    }
  s.selectedIndex=si;
  return s;
  }
};

var shortTag=function(word){
if (!word)
  return false;
else {
  var f=word.toString().substr(0,1);
  return  f == '/' || f == '#' || f == '.';
  }
}

var tag=tree.shift();
var pars=[];

while ( tree.length>0 ){
if(tree[0] instanceof Array)
break;
if (tags[tree[0]])
break;
if (shortTag(tree[0]))
break;
pars.push(tree.shift());
}

if (tags[tag])
el=tags[tag].apply(this,pars);
  else {
  var p=tag.substr(0,1);
  var val=tag.substr(1,tag.length-1);
  if (p == '/')
    el=text(val);
  else{
   var id= p== '#' ? val:null;
   var cN= p== '.' ? val:null;
   el=element('div',id,cN,this);
   }
}
parent.appendChild(el);
if (tree[0] instanceof Array)
  render.call(this,tree.shift(),el);
if(tree.length>0)
  render.call(this,tree,parent);
}

