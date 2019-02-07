var dbPath=process.env.NODE_DBPATH||'mines';
var singleThread=process.env.NODE_SINGLETHREAD||0;
var express=require("express");
var nowjs=require('now');
var http=require('http');
var net=require('net');
var app=express();
//var db=require('mongojs').connect(dbPath,['users']);
var mongojs = require('mongojs')
var db=mongojs(dbPath,['users']);
var Server=require('./Server.js');
var server=new Server(db,singleThread);

var util = require('util');
var DEBUG=process.argv[2]?true:false;

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
everyone.now.processCommand = function(s){
  if(DEBUG) console.log("\nDBG_WS_REQUEST >>",s);
  server.processCommandWs(this.user,s);
};

var tcpServ = net.createServer(function (socket) {
//  server.userConnectedTcp(socket);
  var sockName=socket.remoteAddress + "_" + socket.remotePort;
  socket.on('data',function (data){
    if(DEBUG) console.log("\nDBG_TCP_REQUEST >>",data.toString('utf8'));
    server.processCommandTcp(socket,data.toString('utf8'));});
  socket.on('end',function (){server.userDisconnectedTcp(sockName)});
  socket.on('error',function (err){server.userDisconnectedTcp(sockName)});
});
//tcpServ.listen(8081);

console.log('\nserver started in',singleThread?'single':'muliti','thread mode');
console.log('path to DB is: '+dbPath+'\n');

server.on('addToGroup',function(uName,groupId){
  server.addUserToGroup(uName,groupId)
});

server.on('removeFromGroup',function(uName,groupId){
  server.removeUserFromGroup(uName,groupId)
});

server.on('event',function(e){

  if(DEBUG) console.log("\nDBG_EVENT_RESPONSE >>");
  if(DEBUG) console.log(util.inspect(e,{colors:true}),"\n");

  if (e.dst=='client')
    sendEvent(e.usr,e);

  if (e.dst=='party')
    for (var name in server.groups[e.partyId].users)
      sendEvent(name,e);

  if (e.dst=='everyone'){
    if (everyone.now.dispatchEvent) // there are only tcp clients
      everyone.now.dispatchEvent(e);
    for (var name in server.connections)
      if(server.connections[name].type=='tcp')
        sendEvent(name,e);
  }

  function sendEvent(userName,e){
    var con=server.connections[userName];
    if (con)
    if(!con.NA )
      if (con.type=='tcp'){
        var data=JSON.stringify(e);
	try {
	  con.sock.write(data+"\n");
	} catch (e) {
	  console.log(e);
	}
      } else
        nowjs.getClient(con.clientId,function(){
          if(this.now)
            this.now.dispatchEvent(e);
        });
    else if (e.dst=='client')
      server.userNA(e);
  };

});

