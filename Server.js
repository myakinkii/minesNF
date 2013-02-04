var fork = require('child_process').fork;
var EventEmitter=require('events').EventEmitter;
var Coop=require('./Coop.js');
var Versus=require('./Versus.js');
var Rank=require('./Rank.js');

function Server(db,st){
  this.singleThread=st;
  this.db=db;
  this.users={};
  this.playersList={};
  this.tempUsers=0;
  this.connectSids={};
  this.NaMessages={};
  this.killTimers={};
  this.partyCounter=1;
  this.parties={};
  this.games={};
  var smallBoard={r:8,c:8,b:10};
  var mediumBoard={r:16,c:16,b:40};
  var largeBoard={c:30,r:16,b:99};
  this.modes={
     coop:{constr:Coop,min:2,max:2,modePars:{bSize:'small',board:smallBoard}},
     coopM:{constr:Coop,min:2,max:3,modePars:{bSize:'medium',board:mediumBoard}},
     coopB:{constr:Coop,min:2,max:4,modePars:{bSize:'large',board:largeBoard}},
     versus:{constr:Versus,min:2,max:2,modePars:{bSize:'small',board:smallBoard}},
     versusM:{constr:Versus,min:2,max:3,modePars:{bSize:'medium',board:mediumBoard}},
     versusB:{constr:Versus,min:2,max:4,modePars:{bSize:'large',board:largeBoard}},
     rank:{constr:Rank,min:1,max:1,modePars:{bSize:'small',board:smallBoard}},
     rankM:{constr:Rank,min:1,max:1,modePars:{bSize:'medium',board:mediumBoard}},
     rankB:{constr:Rank,min:1,max:1,modePars:{bSize:'large',board:largeBoard}}
    };
  this.gameCommands={
    '/check':{f:'checkCell',d:'/check - check cell <x> <y>'},
    '/quit':{f:'quitGame',d:'/quit - quit current game'}
  };
  this.chatCommands={
    '/to':{f:'sendPrivateMessage',d:'/to <player> <text> - send private message'},
    '/join':{f:'joinParty',d:'/join <partyId> - join party'},
    '/spec':{f:'addSpectator',d:'/spec <user> - spectate user'},
    '/leave':{f:'leaveParty',d:'/leave - leave party'},
    '/create':{f:'createParty',d:'/create <template> <maxplayers> - create party'},
//  '/publish':{f:'publishParty',d:'/publish - publish party you are in info to players'},
    '/dismiss':{f:'dismissParty',d:'/dismiss - dismiss a party where you are a leader'},
    '/kick':{f:'kickPlayerFromParty',d:'/kick <player> - kick player from a party where you are a leader'},
    '/login':{f:'logIn',d:'/login <user> <passwd> - log in or register new user'},
    '/logoff':{f:'logOff',d:'/logoff - log off registered user'},
    '/help':{f:'showHelp',d:'/help - show this help'}
  };
}

Server.prototype=EventEmitter.prototype;

//Coop.prototype.foo()
Server.prototype.foo=function(){
console.log('Server');
};
//Coop.prototype.foo()

Server.prototype.userConnected=function(caller){
  this.sendEvent('clientId',caller.clientId,'auth','InitClient');
  this.initAuth(caller);
};

Server.prototype.userDisconnected=function(caller){
  if(this.connectSids[caller.cookie['connect.sid']]){
    var user=this.connectSids[caller.cookie['connect.sid']];
    if (this.users[user].type=='registered' || this.users[user].state!='online'){
      this.users[user].NA=1;
      var self=this;
      this.killTimers[user]=setTimeout(function(){self.killPlayerByTimeout.call(self,user)},30000);
      if (this.users[user].partyId)
        this.sendEvent('party',this.users[user].partyId,'system','Message',user+' disconnected');
    } else
      this.systemLogoff(user);
    console.log(user+' disconnected');
  }
};

Server.prototype.killPlayerByTimeout=function(user){
  if (this.users[user]){
    if (this.users[user].partyId)
     this.sendEvent('party',this.users[user].partyId,'system','Message',user+' killed by timeout');
    this.systemLogoff(user)
    console.log(user+' klled by timeout');
  }
};

Server.prototype.showHelp=function(user){
  if (this.users[user].state=='game')
    this.sendEvent('client',user,'chat','Help',this.gameCommands);
  else 
    this.sendEvent('client',user,'chat','Help',this.chatCommands);
};

Server.prototype.initAuth=function(caller){
  if (this.connectSids[caller.cookie['connect.sid']]){
    var user=this.connectSids[caller.cookie['connect.sid']];
    this.initUser(caller,user,this.users[user].type);
  } else {
    var user='user'+this.tempUsers++;
    this.initNewUser(user);
    this.initUser(caller,user,'temp');
    this.sendEvent('client',user,'chat','Welcome');
  }
};

Server.prototype.initNewUser=function(user){
  this.users[user]={};
  this.playersList[user]={};
  this.changeUserState(user,'online');
};

Server.prototype.initUser=function(caller,user,flag){
  this.users[user].clientId=caller.clientId;
  this.connectSids[caller.cookie['connect.sid']]=user;
  this.users[user].connectSid=caller.cookie['connect.sid'];
  this.users[user].type=flag;
  this.users[user].NA=0;

  if (this.killTimers[user]){
    clearTimeout(this.killTimers[user]);
    delete this.killTimers[user];
  }

  if (flag=='registered')
    this.sendEvent('everyone',null,'system','Message',user+' connected.');

  this.sendEvent('client',user,'auth','Authorize',{user:user,flag:flag});
  this.sendEvent('client',user,'chat','UpdateParties',this.parties);

  if (this.NaMessages[user]){
    this.sendEvent('client',user,'chat','NAMessages',this.NaMessages[user]);
    delete this.NaMessages[user];
  }

  if (this.users[user].partyId){
    this.sendEvent('party',this.users[user].partyId,'system','Message',user+' connected');
    this.emit('addToGroup',this.users[user].clientId,this.users[user].partyId);
  }

  if (this.users[user].state=='game')
    this.execGameCommand(this.users[user].partyId,user,'initGUI');

  this.updatePlayersList();
  console.log(user+'.'+flag+' connected');
};

Server.prototype.kickUser=function(user){
  this.sendEvent('client',user,'system','Error',{text:'Someone kicked your ass'});
  if (this.users[user].state=='game');
    this.sendEvent('client',user,'game','EndGame');
  delete this.connectSids[this.users[user].connectSid];
  this.sendEvent('client',user,'auth','Reauth');
  console.log(user+' kicked');
};

Server.prototype.logOff=function(user){
  if (this.users[user].type=='registered'){
    this.sendEvent('everyone',null,'system','Message',user+' has logged off.');
    this.systemLogoff(user,1);
    console.log(user+' has logged off.');
  }
};

Server.prototype.systemLogoff=function(user,reauth){
  var clientId=this.users[user].clientId;
  if (this.users[user].state=='party')
    this.leaveParty(user);
  if (this.users[user].state=='game')
    this.execGameCommand(this.users[user].partyId,user,'quitGame');
  if (this.users[user].state=='online')  // in singleThread mode always true
    this.deleteUser(user);
  else { // because in multithread mode we cannot call deleteUser synchronously
    var self=this;
    var wait=setInterval(function(){
          if (self.users[user].state=='online'){
            self.deleteUser.call(self,user);
            clearInterval(wait);
          }
        },50);
  }
  this.updatePlayersList();
  if (reauth)
    this.sendEvent('clientId',clientId,'auth','Reauth');
};

Server.prototype.logIn=function(caller,user,passwd){
  var callerName=this.connectSids[caller.cookie['connect.sid']];
  var reg=/(^user\d+$)/ig; // to check if temp names e.g. user0 being used
  if (user!='' && passwd!='' && !reg.test(user)){
    var self=this;
    this.db.users.find({user:user},{user:1,passwd:1},function(err,res){
      if(res[0]){
        if (res[0].passwd==passwd){
          self.systemLogoff.call(self,callerName);
          if (self.users[user])
            self.kickUser.call(self,user);
          else
            self.initNewUser.call(self,user);
          self.initUser.call(self,caller,user,'registered');
        }  else{
           self.sendEvent('client',callerName,'auth','AuthFail',
             'Auth for user "'+user+'" failed or user is already registered.');
           self.initAuth(caller);
        }
      } else {
        self.db.users.insert({user:user,passwd:passwd},function(err){
          if (!err){
            self.systemLogoff.call(self,callerName);
            self.initNewUser.call(self,user);
            self.initUser.call(self,caller,user,'registered');
          }
        });
      }
    });
  }
};

Server.prototype.updatePlayersList=function(){
  this.sendEvent('everyone',null,'chat','UpdatePlayers',this.playersList);
};

Server.prototype.updatePartiesList=function(){
  this.sendEvent('everyone',null,'chat','UpdateParties',this.parties);
};

Server.prototype.deleteUser=function(user){
  delete this.connectSids[this.users[user].connectSid];
  delete this.users[user];
  delete this.playersList[user];
  this.updatePlayersList();
};

Server.prototype.sendPrivateMessage=function(user,userTo){
  if (userTo==user)
    this.sendEvent('client',user,'system','Error',
                    {text:'Such a stupid thing.'});
  else {
    if (this.users[userTo]){
      var mes=Array.prototype.slice.call(arguments,2).join(' ');
      this.sendEvent('client',user,'chat','PrivateMessage',
                     {from:user,to:userTo,type:'PM',text:mes});
      this.sendEvent('client',userTo,'chat','PrivateMessage',
                     {from:user,to:userTo,type:'PM',text:mes});
    } else {
     this.sendEvent('client',user,'system','Error',
                     {text:userTo+'is offline.'});
      }
  }
};

Server.prototype.processCommand=function(caller,s){
  var pars=s.split(' ');
  var command=pars[0];
  var isCommand=0;
  var user=this.connectSids[caller.cookie['connect.sid']];
  if (this.chatCommands[command]){
    if (command=='/login')
      pars[0]=caller;
    else
      pars[0]=user;
    if (this.users[user].state=='game' && command!='/to')
      this.sendEvent('client',user,'system','Error',
                      {text:'You cannot do this now'});
    else
      this[this.chatCommands[command].f].apply(this,pars);
    isCommand=1;
  }
  if (this.gameCommands[command]){
    if (this.users[user].state=='game'){
      pars[0]=this.gameCommands[command].f; 
      pars.unshift(user);
      pars.unshift(this.users[user].partyId);
      this.execGameCommand.apply(this,pars);
    } else 
      this.sendEvent('client',user,'system','Error',
                      {text:'Not in game now'});
    isCommand=1;
  }
  var shortCommand=s.slice(0,1);
  if (shortCommand=='/' && isCommand==0){
    this.sendEvent('client',user,'system','Error',{text:'No such command.'});
    isCommand=1;
  }
  if (shortCommand=='!' && isCommand==0){
    this.sendEvent('everyone',null,'chat','Message',
                    {from:user,type:'shout',text:s.slice(1,s.length)});
    isCommand=1;
  }
  if (shortCommand=='#' && isCommand==0){
    if (this.users[user].partyId)
      this.sendEvent('party',this.users[user].partyId,'chat','PartyMessage',
                      {from:user,type:'partyPM',text:s.slice(1,s.length)});
    else
      this.sendEvent('client',user,'system','Error',{text:'Not in party'});
    isCommand=1;
  }
  if (isCommand==0)
    this.sendEvent('everyone',null,'chat','Message',
                    {from:user,type:'message',text:s});
};

Server.prototype.createParty=function(user,mode,m){
  if (this.modes[mode]){
    if (this.users[user].state=='online'){
      var partyId=this.partyCounter++;
      var maxPlayers=parseInt(m)||this.modes[mode].min;
      if (maxPlayers<this.modes[mode].min)
        maxPlayers=this.modes[mode].min;
      if (maxPlayers>this.modes[mode].max)
        maxPlayers=this.modes[mode].max;
      this.parties[partyId]={
        id:partyId,
        name:mode+partyId,
        mode:mode,
        leader:user,
        maxPlayers:maxPlayers,
        curPlayers:0,
        users:{}
        };
        this.sendEvent('client',user,'system','Message',mode+partyId+' created.');
      this.addPlayerToParty(user,partyId);
    } else 
      this.sendEvent('client',user,'system','Error',
                      {text:'You cannot do this now'});
  } else
    this.sendEvent('client',user,'system','Error',{text:'No such mode.'});
};

Server.prototype.publishParty=function(user){
  if (this.users[user].partyId)
    var partyId=this.users[user].partyId;
  if (this.parties[partyId]){
    var p=this.parties[partyId];
    this.sendEvent('everyone',null,'chat','PublishParty',{user:user,party:p});
  }
};

Server.prototype.sendPartyPM=function(user,m){
};

Server.prototype.joinParty=function(user,partyId){
  if (this.parties[partyId])
    this.addPlayerToParty(user,partyId);
  else
    this.sendEvent('client',user,'system','Error',{text:'No such party.'});
};

Server.prototype.dismissParty=function(user){
  if (this.users[user].partyId && this.parties[this.users[user].partyId]){
    var pId=this.users[user].partyId;
    if (this.parties[pId].leader==user){
      var p=this.parties[pId];
      for(var u in p.users){
        this.emit('removeFromGroup',this.users[u].clientId,pId);
        this.changeUserState(u,'online');
        delete this.users[u].partyId;
        this.sendEvent('client',u,'system','Message','Party dismissed.');
      }
      delete this.parties[pId];
      this.updatePlayersList();
      this.updatePartiesList();
    }
  }
};

Server.prototype.leaveParty=function(user){
  if (this.users[user].partyId){
    var pId=this.users[user].partyId;
    var p=this.parties[pId];
    var id=this.users[user].clientId;
    if (p.leader==user)
      this.dismissParty(user)
    else {
        p.curPlayers--;
        delete p.users[user];
        delete this.users[user].partyId;
        this.changeUserState(user,'online');
        this.updatePLayersList();
        this.updatePartiesList();
        this.sendEvent('client',user,'system','Message','You left party.');
        this.emit('removeFromGroup',id,pId);
    }
  }    
}

Server.prototype.kickPlayerFromParty=function(user,userToKick){
  if (this.users[user].partyId && this.users[userToKick]){
    var pId=this.users[user].partyId;
    var p=this.parties[pId];
    var kickId=this.users[userToKick].clientId;
    if (p.leader==user && p.curPlayers>1)
      if (p.users[userToKick] && user!=userToKick){
        p.curPlayers--;
        delete p.users[userToKick];
        this.changeUserState(userToKick,'online');
        this.updatePlayersList();
        this.updatePartiesList();
        this.sendEvent('client',user,'system','Message','You were kicked from party.');
        this.emit('removeFromGroup',kickId,pId);
      }
  }
};

Server.prototype.addPlayerToParty=function(user,pId){
  var p=this.parties[pId];
  if (this.users[user].state!='party'){
    p.users[user]=1;
    p.curPlayers++;
    this.changeUserState(user,'party');
    this.users[user].partyId=pId;
    this.emit('addToGroup',this.users[user].clientId,pId);
        this.sendEvent('client',user,'system','Message','You have joined the party.');
    if (p.maxPlayers>1){
      this.updatePlayersList();
      this.updatePartiesList();
    }
    if (p.curPlayers==p.maxPlayers)
      this.createGame(p);
  } else
    this.sendEvent('client',user,'system','Error',
                    {text:'You have already joined the party.'});
};

Server.prototype.addSpectator=function(spectator,user){
  if (spectator!=user)
    if (this.users[user]){
      if (this.users[user].state=='game'){
        var pId=this.users[user].partyId;
        this.changeUserState(spectator,'game');
        this.updatePlayersList();
        this.users[spectator].partyId=pId;
        this.execGameCommand(pId,spectator,'addSpectator');
        this.emit('addToGroup',this.users[spectator].clientId,pId);
      } else
      this.sendEvent('client',user,'system','Error',
                      {text:user+' not in a game now'});
    } else
      this.sendEvent('client',spectator,'system','Error',{text:'No such user.'});
};

Server.prototype.createGame=function(args){
  var query={};
  query['$or']=[];
  query['$or'].push({user:'default'});
  for (var i in args.users)
    query['$or'].push({user:i});
  var self=this;
  this.db.users.find(query,{user:1,profile:1},function(err,res){
    delete self.parties[args.id];
    var profiles={}
    for (var i in res)
      profiles[res[i].user]=res[i].profile;
    args.profiles=profiles;
    args.modePars=self.modes[args.mode].modePars;
    args.minPlayers=self.modes[args.mode].min;
    for (var u in args.users){
      self.changeUserState.call(self,u,'game');
      self.sendEvent('client',u,'system','Message',args.name+' started.');
      console.log(u+' has joined the game '+ args.name);
    }

    if (self.singleThread)
      self.games[args.id]=new self.modes[args.mode].constr(args);
    else
      self.games[args.id]=fork(__dirname+'/GameWrapper.js',[JSON.stringify(args)]);

    self.games[args.id].on('message',function(e){
      self.getGameCommandResult.call(self,e)
    });

    self.execGameCommand.call(self,args.id,null,'startBoard');

    self.updatePlayersList.call(self);
    self.updatePartiesList.call(self);
    console.log('Game '+args.name+' created');
  });

};

Server.prototype.execGameCommand=function(pId,user,command){
  var pars=Array.prototype.slice.call(arguments,3);
  if (this.singleThread)
    this.games[pId].dispatchEvent({user:user,command:command,pars:pars});
  else
    this.games[pId].send({user:user,command:command,pars:pars});
};

Server.prototype.getGameCommandResult=function(e){
  if (e.dst=='server')
    this[e.func](e.arg);
  else
    this.sendEvent(e.dst,e.dstId,e.contextId,e.func,e.arg);
};

Server.prototype.coopGameResult=function(result){
//  this.sendEvent('party',result.partyId,'game','ShowResult',result);
//console.log(result);
};

Server.prototype.changeUserState=function(user,state){
  this.users[user].state=state;
  this.playersList[user].state=state;
};

Server.prototype.usersLeaveGame=function(users,game){
  for (var u in users){
    this.changeUserState(u,'online');
    delete this.users[u].partyId;
    this.sendEvent('client',u,'game','EndGame');
    this.sendEvent('client',u,'system','Message','You have left '+game.name);
    this.emit('removeFromGroup',this.users[u].clientId,game.partyId);
    console.log(u+' left '+game.name);
  }
};

Server.prototype.userExitGame=function(e){
  var usr={};
  usr[e.user]=1;
  this.sendEvent('party',e.partyId,'system','Message',e.user+' left game');
  this.usersLeaveGame(usr,e);
  this.updatePlayersList();
};

Server.prototype.gameExit=function(e){
  this.usersLeaveGame(e.users,e)
  this.usersLeaveGame(e.spectators,e)
  this.updatePlayersList();
  delete this.games[e.partyId];
  console.log('Game '+e.name+' returned 0');
};

Server.prototype.userNA=function(e){
  if (this.users[e.usr].type=='registered' && 
      (e.contextId=='chat'|| e.contextId=='system')){
    this.users[e.usr].NA=1;
    if (!this.NaMessages[e.usr])
      this.NaMessages[e.usr]=[];
    this.NaMessages[e.usr].push(e);
  }
};

Server.prototype.sendEvent=function(dst,dstId,contextId,func,arg){
  var e={dst:dst,contextId:contextId,func:func,arg:arg}
  if (dst=='clientId'){
    e.clientId=dstId;
  }
  if (dst=='client'){
    e.usr=dstId;
    e.clientId=this.users[dstId].clientId;
  }
  if (dst=='party')
     e.partyId=dstId;
  this.emit('event',e);
};

module.exports=Server;
