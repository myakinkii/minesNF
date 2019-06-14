var session=require("express-session");
var sessionParser=session({
	secret: '$eCuRiTy',
	saveUninitialized: true,
	resave: false
});

var express=require("express");
var app=express();
app.use(sessionParser);
app.use(express.static(__dirname+'/ui5')); // for regular backend deployment (same host)
// app.get('/', function(req, res){ res.send(req.session.id); }); // for hana xsa microservices 

var http=require('http');
var httpServ=http.createServer(app);

var websocket=require('ws');
var wss = new websocket.Server({
	server:httpServ,
	verifyClient: function(info, done) {
		sessionParser(info.req, {}, function(){
			var s=info.req.session;
			// console.log('Session is parsed for',s.id);
			s.clientId=s.id;
			s.cookie["connect.sid"]=s.id;
			done(s.clientId);
		});
	}
});

var Server=require('./Server.js');
var singleThread=process.env.NODE_SINGLETHREAD||0;
var server=new Server(null,singleThread);

var sockets={};

function sendEvent(userName,e){
	var con=server.connections[userName];
	if (con){
		if(!con.NA ){
			var data=JSON.stringify(e);
			if (con.type=='tcp'){
				try {
					con.sock.write(data+"\n");
				} catch (e) {
					console.log(e);
				}
			} else {
				if (sockets[con.clientId]) sockets[con.clientId].send(data);
			}
		} else if (e.dst=='client') server.userNA(e);
	}
}

wss.on('connection', function(ws,req) {
	ws.on('close', function (){ server.userDisconnectedWs(req.session); });
	ws.on('message', function(message){ server.processCommandWs(req.session, message); });
	sockets[req.session.id]=ws;
	server.userConnectedWs(req.session);
});

server.on('addToGroup',function(uName,groupId){
	server.addUserToGroup(uName,groupId);
});

server.on('removeFromGroup',function(uName,groupId){
	server.removeUserFromGroup(uName,groupId);
});

server.on('event',function(e){
	if (e.dst=='client') sendEvent(e.usr,e);
	if (e.dst=='party') for (var name in server.groups[e.partyId].users) sendEvent(name,e);
	if (e.dst=='everyone') for (var name in server.connections) sendEvent(name,e);
});

var PORT=process.env.PORT||8080;
httpServ.listen(PORT);
console.log('\nserver started on port '+PORT+' in',singleThread?'single':'muliti','thread mode');
