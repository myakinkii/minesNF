var dbPath=process.env.NODE_DBPATH||'mines';
var singleThread=process.env.NODE_SINGLETHREAD||0;
var express=require("express");
var nowjs=require('now');
var http=require('http');
var net=require('net');
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

everyone.connected(function(){server.userConnectedWs(this.user)});
everyone.disconnected(function(){server.userDisconnectedWs(this.user)});
everyone.now.processCommand = function(s){server.processCommandWs(this.user,s);};

var tcpServ = net.createServer(function (socket) {
  server.userConnectedTcp(socket);
  socket.on('data',function (data){server.processCommandTcp(socket,data.toString('utf8'));});
  socket.on('end',function (){server.userDisconnectedTcp(socket)});
});
tcpServ.listen(8081);

console.log('\nserver started in',singleThread?'single':'muliti','thread mode');
console.log('path to DB is: '+dbPath+'\n');

server.on('addToGroup',function(uName,groupId){
  server.addUserToGroup(uName,groupId)
});

server.on('removeFromGroup',function(uName,groupId){
  server.removeUserFromGroup(uName,groupId)
});

server.on('event',function(e){

  if (e.dst=='client')
    sendEvent(e.usr,e);

  if (e.dst=='party')
    for (var i in server.groups[e.partyId].users)
      sendEvent(i,e);

  if (e.dst=='everyone'){
    if (everyone.now.dispatchEvent) // there are only tcp clients
      everyone.now.dispatchEvent(e);
    for (var c in server.connections)
      if(server.connections[c].type=='tcp')
      server.connections[c].sock.write(JSON.stringify(e)+"\n");
  }

  function sendEvent(user,e){
    var user=server.connections[user];
    if (user.type=='tcp')
      user.sock.write(JSON.stringify(e)+"\n");
    else {
      nowjs.getClient(user.clientId,function(){
        if(this.now){
          this.now.dispatchEvent(e);
        } else
        server.userNA(e);
      });
    }
  };

});

