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

var clients = {};
var tcpServ = net.createServer(function (socket) {

  socket.name = socket.remoteAddress + "_" + socket.remotePort 
  clients[socket.name]=socket;

  socket.write("Welcome " + socket.name + "\n");
  //broadcast(socket.name + " joined the chat\n", socket);

  socket.on('data', function (data) {
    server.processTcpCommand(socket.name,data.toString('utf8'));
//    server.processTcpCommand(socket.name,data.toString('utf8').slice(0,-2));
    //broadcast(socket.name + " >> " + data+"\n", socket);
  });

  socket.on('end', function () {
    delete clients[socket.name];
    //broadcast(socket.name + " left the chat.\n");
  });
});
tcpServ.listen(8081);

console.log('\nserver started in',singleThread?'single':'muliti','thread mode');
console.log('path to DB is: '+dbPath+'\n');

everyone.connected(function(){server.userConnected(this.user)});
everyone.disconnected(function(){server.userDisconnected(this.user)});
everyone.now.initAuth = function(){server.initAuth(this.user)};
everyone.now.processCommand = function(s){server.processCommand(this.user,s)};

server.on('event',function(e){
  if (e.dst=='client' || e.dst=='clientId'){
    if (clients[e.usr])
      clients[e.usr].write(JSON.stringify(e)+"\n");
    else {
    nowjs.getClient(e.clientId,function(){
      if(this.now){
        this.now.dispatchEvent(e);
      } else
      server.userNA(e);
    });
    }

  }
  if (e.dst=='party'){
    nowjs.getGroup(e.partyId).now.dispatchEvent(e);
}
  if (e.dst=='everyone'){
    everyone.now.dispatchEvent(e);
    for (var s in clients)
      clients[s].write(JSON.stringify(e)+"\n");
  }
});

server.on('addToGroup',function(clientId,groupId){
 nowjs.getGroup(groupId).addUser(clientId);
});

server.on('removeFromGroup',function(clientId,groupId){
 nowjs.getGroup(groupId).removeUser(clientId);
});

