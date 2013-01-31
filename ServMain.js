var dbPath=process.env.NODE_DBPATH||'mines';
var singleThread=process.env.NODE_SINGLETHREAD||0;
var express=require("express");
var nowjs=require('now');
var http=require('http');
var app=express();
var db=require('mongojs').connect(dbPath,['users']);
var Server=require('./Server.js');
var server=new Server(db,singleThread);

app.configure(function(){
  app.use(express.cookieParser());
  app.use(express.session({secret:'secret_key'}));
  app.use(express.static(__dirname+'/client'));
});

var httpServ=http.createServer(app);
var everyone=nowjs.initialize(httpServ,{socketio:{transports:['websocket']}});
httpServ.listen(8080);

console.log('\nserver started in',singleThread?'single':'muliti','thread mode');
console.log('path to DB is: '+dbPath+'\n');

everyone.connected(function(){server.initAuth(this.user)});
everyone.disconnected(function(){server.userDisconnected(this.user)});
everyone.now.initAuth = function(){server.initAuth(this.user)};
everyone.now.processCommand = function(s){server.processCommand(this.user,s)};

server.on('event',function(e){
  if (e.dst=='client'){
    nowjs.getClient(e.clientId,function(){
      if(this.now){
        this.now.dispatchEvent(e);
      } else
      server.userNA(e);
    });
  }
  if (e.dst=='party'){
    nowjs.getGroup(e.partyId).now.dispatchEvent(e);
}
  if (e.dst=='everyone')
    everyone.now.dispatchEvent(e);
});

server.on('addToGroup',function(clientId,groupId){
 nowjs.getGroup(groupId).addUser(clientId);
});

server.on('removeFromGroup',function(clientId,groupId){
 nowjs.getGroup(groupId).removeUser(clientId);
});

