var fork=require('child_process').fork;
var EventEmitter=require('events').EventEmitter;
var crypto=require('crypto');

function Server(db,st){
  this.singleThread=st;
  this.db=db;
  this.users={}; // user profiles
  this.playersList={}; // to send to clients
  this.NaMessages={};
  this.partyCounter=0;
  this.maxPartyId=100;
  this.parties={};
  this.games={};

  this.idCounter=0;
  this.maxCount=100;
  this.connections={};
  this.groups={};
  this.connectSids={};
  this.sockNames={};
  this.iamHashes={};
  this.salt=crypto.randomBytes(16).toString('base64');
  this.killTimers={};

  this.modes=require('./Modes.js').modes;
  this.boards=require('./Modes.js').boards;
  this.ranks=require('./Modes.js').ranks;
  this.gameCommands=require('./Commands.js').game;
  this.chatCommands=require('./Commands.js').chat;
};

Server.prototype=EventEmitter.prototype;

Server.prototype.showHelp=function(user){
  this.sendEvent('client',user,'chat','Help',this.chatCommands);
  if (this.users[user].state=='game')
    this.sendEvent('client',user,'chat','Help',this.gameCommands);
};

Server.prototype.init=function(user,profile){ 

  if (!this.users[user]){
    this.users[user]={};
    this.users[user].type='temp';
    this.users[user].profile={level:0,score:0,rankTotal:0,
                              muted:{},rank:{},coop:{},versus:{}};
    this.playersList[user]={};
    this.playersList[user].level=0;
    this.sendEvent('client',user,'chat','Welcome');
    this.changeUserState(user,'online');
  }

  if (profile){
    this.users[user].type='registered';
    this.users[user].profile=profile;
    this.playersList[user].level=profile.level;
  }

  if (this.users[user].type=='registered'){
    this.sendEvent('everyone',null,'system','Message',user+' connected.');
  }
  this.sendEvent('client',user,'auth','Authorize',
                 {user:user,type:this.users[user].type,profile:this.users[user].profile});
  this.sendEvent('client',user,'chat','UpdateParties',this.parties);

  if (this.NaMessages[user]){
    this.sendEvent('client',user,'chat','NAMessages',this.NaMessages[user]);
    delete this.NaMessages[user];
  }

  if (this.users[user].partyId){
    this.sendEvent('party',this.users[user].partyId,'system','Message',user+' connected');
    this.addToGroup(user,this.users[user].partyId);
  }

  if (this.users[user].state=='game')
    this.execGameCommand(this.users[user].partyId,user,'initGUI');

  this.updatePlayersList();
  console.log(user+'.'+this.users[user].type+' connected');
};

Server.prototype.kill=function(user){

  if (this.users[user].state=='party')
    this.leaveParty(user);

  if (this.users[user].state=='game')
    this.execGameCommand(this.users[user].partyId,user,'quitGame'); // can be async call 

  if (this.users[user].state=='online'){  // in singleThread mode always true
    delete this.users[user];
    delete this.playersList[user];
    this.updatePlayersList();
  }
  else { // because in multithread mode we cannot delete user synchronously
    var self=this;
    var wait=setInterval(function(){
          if (self.users[user].state=='online'){
            delete self.users[user];
            delete self.playersList[user];
            self.updatePlayersList.call(self);
            clearInterval(wait);
          }
        },50);
  }
};

Server.prototype.disableDb=function(err,user){
  delete this.db;
  console.log(err.toString());
  this.sendEvent('client',user,'system','Error',
                 'Seems we have some problems with DB. Sry.');
};

Server.prototype.updatePlayersList=function(){
  this.sendEvent('everyone',null,'chat','UpdatePlayers',this.playersList);
};

Server.prototype.updatePartiesList=function(){
  this.sendEvent('everyone',null,'chat','UpdateParties',this.parties);
};

Server.prototype.sendPrivateMessage=function(user,userTo){
  if (userTo==user)
    this.sendEvent('client',user,'system','Error','Such a stupid thing.');
  else {
    if (this.users[userTo]){
      var mes=Array.prototype.slice.call(arguments,2).join(' ');
      this.sendEvent('client',user,'chat','Message',
                     {from:user,to:userTo,type:'private',text:mes});
      this.sendEvent('client',userTo,'chat','Message',
                     {from:user,to:userTo,type:'private',text:mes});
    } else {
     this.sendEvent('client',user,'system','Error',userTo+' is offline.');
      }
  }
};

Server.prototype.processCommand=function(user,s){
//console.log(s);
  var pars=s.split(' ');
  var command=pars[0];
  var isCommand=0;
  if (this.chatCommands[command]){
      pars[0]=user;
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
      this.sendEvent('client',user,'system','Error','Not in game now');
    isCommand=1;
  }
  var shortCommand=s.slice(0,1);
  if (shortCommand=='/' && isCommand==0){
    this.sendEvent('client',user,'system','Error','No such command.');
    isCommand=1;
  }
  if (shortCommand=='!' && isCommand==0){
    this.sendEvent('everyone',null,'chat','Message',
                    {from:user,type:'shout',text:s.slice(1,s.length)});
    isCommand=1;
  }
  if (shortCommand=='#' && isCommand==0){
    if (this.users[user].partyId)
      this.sendEvent('party',this.users[user].partyId,'chat','Message',
                      {from:user,type:'party',text:s.slice(1,s.length)});
    else
      this.sendEvent('client',user,'system','Error','Not in party');
    isCommand=1;
  }
  var mes=this.prepareMessage(s);
  if (isCommand==0 && mes)
    this.sendEvent('everyone',null,'chat','Message',
                    {from:user,type:'message',text:mes});
};

Server.prototype.prepareMessage=function(s){
  var notEmpty=s.length>0?1:0;
  var reg=/(^ +$)/ig;
  var notSpaces=reg.test(s)?0:1;
  if (notEmpty && notSpaces) 
    return s;
  else 
    return null;
};

Server.prototype.getPartyId=function(){
  do {
    if (this.partyCounter==this.maxPartyId)
      this.partyCounter=0;
    this.partyCounter++;
  } while (this.parties[this.partyCounter] || this.games[this.partyCounter])
  return this.partyCounter;
};

Server.prototype.createParty=function(user,mode,bSize,m,min,max){
  if (this.users[user].state=='online'){
    if (this.modes[mode] && this.boards[bSize]){
      var partyId=this.getPartyId();

      var maxPlayers=parseInt(m)||this.modes[mode][bSize].min;
      if (maxPlayers<this.modes[mode][bSize].min)
        maxPlayers=this.modes[mode][bSize].min;
      if (maxPlayers>this.modes[mode][bSize].max)
        maxPlayers=this.modes[mode][bSize].max;

      var minLevel=parseInt(min)||0;
      var maxLevel=parseInt(max)||8;
      if (minLevel<0 || minLevel>8)
        minLevel=0;
      if(minLevel>this.users[user].profile.level)
        minLevel=this.users[user].profile.level;
      if (maxLevel<0 || maxLevel>8)
        maxLevel=8;
      if (maxLevel<minLevel)
        maxLevel=minLevel;

      this.parties[partyId]={
        id:partyId,
        name:mode+partyId,
        mode:mode,
        bSize:bSize,
        leader:user,
        maxPlayers:maxPlayers,
        minLevel:minLevel,
        maxLevel:maxLevel,
        curPlayers:0,
        users:{}
        };
        this.sendEvent('client',user,'system','Message',mode+partyId+' created.');
      this.addPlayerToParty(user,partyId);
    } else 
      this.sendEvent('client',user,'system','Error','No such mode or board size.');
  } else
    this.sendEvent('client',user,'system','Error','You cannot do this now');
};

Server.prototype.publishParty=function(user){
  if (this.users[user].state=='party'){
    var p=this.parties[this.users[user].partyId];
    this.sendEvent('everyone',null,'chat','PublishParty',{user:user,party:p});
  }
};

Server.prototype.joinParty=function(user,partyId){
  if (this.users[user].state=='online' && this.parties[partyId]){
    var p=this.parties[partyId];
    var level=this.users[user].profile.level;
    if (p.minLevel<=level && p.maxLevel>=level)
      this.addPlayerToParty(user,partyId);
    else
      this.sendEvent('client',user,'system','Error',
                     'Cannot join due to level restrictions.');
  } else
    this.sendEvent('client',user,'system','Error',
                   'No such party or you are already in a party or a game.');
};

Server.prototype.dismissParty=function(user){
  if (this.users[user].state=='party'){
    var pId=this.users[user].partyId;
    if (this.parties[pId].leader==user){
      var p=this.parties[pId];
      for(var u in p.users){
        this.removeFromGroup(u,pId);
        this.changeUserState(u,'online');
        delete this.users[u].partyId;
        this.sendEvent('client',u,'system','Message','Party dismissed.');
      }
      delete this.parties[pId];
      this.updatePlayersList();
      this.updatePartiesList();
    }
  } else    
    this.sendEvent('client',user,'system','Error','Not in a party now');
};

Server.prototype.leaveParty=function(user){
  if (this.users[user].state=='party'){
    var p=this.parties[this.users[user].partyId];
    if (p.leader==user)
      this.dismissParty(user)
    else {
        p.curPlayers--;
        delete p.users[user];
        delete this.users[user].partyId;
        this.changeUserState(user,'online');
        this.updatePLayersList();
        this.updatePartiesList();
        this.sendEvent('party',p.id,'system','Message',user+' left party.');
        this.removeFromGroup(user,p.id);
    }
  } else    
    this.sendEvent('client',user,'system','Error','Not in a party now');
}

Server.prototype.showRanks=function(user){
  this.sendEvent('client',user,'chat','Ranks',this.ranks)
};

Server.prototype.testPing=function(user,time){
  this.sendEvent('client',user,'chat','Ping',time)
};

Server.prototype.playerInfo=function(user,infoUsr){
  if (this.db && infoUsr){
    var self=this;
    var fields={_id:0,user:1,
                "profile.level":1,
                "profile.rank":1,
                "profile.rankTotal":1,
                "profile.score":1};
    this.db.users.find({user:infoUsr},fields,function(err,res){
      if (!err){
        if (res[0])
          self.sendEvent('client',user,'chat','Info',res[0])
        else
          self.sendEvent('client',user,'system','Error',
                         'No such registered user.');
      } else {
        self.disableDb(err,user);
      }
    });
  }
};

Server.prototype.topPlayers=function(user){
  var where=[{"profile.rankTotal":{"$ne":0}},
             {}];
  var fields=[{_id:0,
               user:1,
               "profile.level":1,
               "profile.rank":1,
               "profile.rankTotal":1},
              {_id:0,
               user:1,
               "profile.level":1,
               "profile.score":1}];
  var sort=[{"profile.rankTotal":1},
            {"profile.score":-1}];
  var self=this;
  for (var i=0;i<2;i++)
    if (this.db)
      this.db.users.find(where[i],fields[i]).limit(10).sort(sort[i],function(err,res){
        if (err)
          self.disableDb(err,user);
        else if (res[0])
          self.sendEvent('client',user,'chat','Top',res);
    });
};

Server.prototype.mutePlayer=function(user,muteUsr){
  if(muteUsr){
    this.users[user].profile.muted[muteUsr]=1;
    this.syncDbProfile(user);
    if (user==muteUsr)
      this.sendEvent('client',user,'system','Message','Very clever. You muted yourself.');
    this.sendEvent('client',user,'chat','UpdateMuted',this.users[user].profile.muted);
  } else
    this.sendEvent('client',user,'chat','Muted',this.users[user].profile.muted);
};

Server.prototype.umutePlayer=function(user,muteUsr){
  if(muteUsr){
    delete this.users[user].profile.muted[muteUsr];
    this.syncDbProfile(user);
    this.sendEvent('client',user,'chat','UpdateMuted',this.users[user].profile.muted);
  }
};

Server.prototype.kickPlayerFromParty=function(user,userToKick){
  if (this.users[user].state=='party' && this.users[userToKick] && user!=userToKick){
    var p=this.parties[this.users[user].partyId];
    if (p.leader==user && p.users[userToKick]){
      p.curPlayers--;
      delete p.users[userToKick];
      this.changeUserState(userToKick,'online');
      this.updatePlayersList();
      this.updatePartiesList();
      this.sendEvent('client',userToKick,'system','Message','You were kicked from party.');
      this.removeFromGroup(userToKick,p.id);
    }
  }
};

Server.prototype.addPlayerToParty=function(user,pId){
  var p=this.parties[pId];
  p.users[user]=1;
  p.curPlayers++;
  this.changeUserState(user,'party');
  this.users[user].partyId=pId;
  this.addToGroup(user,pId);
      this.sendEvent('client',user,'system','Message','You have joined the party.');
  if (p.maxPlayers>1){
    this.updatePlayersList();
    this.updatePartiesList();
  }
  if (p.curPlayers==p.maxPlayers)
    this.createGame(p);
};

Server.prototype.addSpectator=function(spectator,user){
  if (this.users[spectator].state=='online' && spectator!=user){
    if (this.users[user]){
      if (this.users[user].state=='game'){
        var pId=this.users[user].partyId;
        this.changeUserState(spectator,'game');
        this.updatePlayersList();
        this.users[spectator].partyId=pId;
        this.execGameCommand(pId,spectator,'addSpectator');
        this.addToGroup(spectator,pId);
      } else
      this.sendEvent('client',user,'system','Error',user+' not in a game now');
    } else
      this.sendEvent('client',spectator,'system','Error','No such user.');
  } else
    this.sendEvent('client',user,'system','Error',
                   'You are already in a party or a game.');
};

Server.prototype.createGame=function(args){
  delete this.parties[args.id];
  args.board=this.boards[args.bSize];
  args.minPlayers=this.modes[args.mode][args.bSize].min;
  args.profiles={};
  for (var u in args.users){
    args.profiles[u]=this.users[u].profile[args.mode];
    this.changeUserState(u,'game');
    console.log(u+' has joined the game '+ args.name);
  }

  if (this.singleThread)
    this.games[args.id]=new this.modes[args.mode].constr(args);
  else
    this.games[args.id]=fork(__dirname+'/GameWrapper.js',[JSON.stringify(args)]);
  var self=this;
  this.games[args.id].on('message',function(e){
    self.getGameCommandResult.call(self,e)
  });
  this.execGameCommand(args.id,null,'startBoard');
  this.updatePlayersList();
  this.updatePartiesList();
  this.sendEvent('party',args.id,'system','Message',args.name+' started.');
  console.log('Game '+args.name+' started');
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

Server.prototype.versusGameResult=function(e){
 var score=0;
  for (var i in e.score)
    if (e.score[i]>0) 
      score+=e.score[i];
  this.users[e.winner].profile.score+=score;
  this.sendEvent('client',e.winner,'system','Message',
      'You earned '+score+' points. Your score is '+this.users[e.winner].profile.score);
  this.syncDbProfile(e.winner);
  this.sendEvent('party',e.partyId,'game','ShowResultVersus',e);
};

Server.prototype.coopGameResult=function(e){
  if (e.result=='win')
    for (var i in e.score){
      this.users[i].profile.score+=e.score[i];
      this.sendEvent('client',i,'system','Message',
          'You earned '+e.score[i]+' points. Your score is '+this.users[i].profile.score);
      this.syncDbProfile(i);
    };
  this.sendEvent('party',e.partyId,'game','ShowResultCoop',e);
};

Server.prototype.userNewBestTime=function(e){
  this.users[e.user].profile.rank[e.bSize]=e.time;
  var times=this.users[e.user].profile['rank'];
  var newRank=8;
  var rankTotal=0;
  for (var bSize in this.ranks)
  if (!times[bSize] || times[bSize]>=this.ranks[bSize][7]){
    newRank=0;
    rankTotal=0;
    break;
  } else {
    for (var i=0;i<this.ranks[bSize].length;i++)
      if (times[bSize]<this.ranks[bSize][i]){
        if (newRank>=8-i)
          newRank=8-i;
        break;
       };
    rankTotal+=times[bSize];
  }

  if (newRank>0){
    this.users[e.user].profile.level=newRank;
    this.playersList[e.user].level=newRank;
    this.updatePlayersList();
  }

  if (rankTotal>0)
    this.users[e.user].profile.rankTotal=parseFloat(rankTotal).toFixed(3);

  if (this.db && this.users[e.user].type=='temp')
    this.sendEvent('client',e.user,'system','Message',
                   'Register with /login command to save your achievements');
  this.syncDbProfile(e.user);
};

Server.prototype.syncDbProfile=function(user){
  var set={};
  set['$set']={};
  set['$set'].profile=this.users[user].profile;
  if (this.db)
    this.db.users.update({user:user},set);
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
    this.removeFromGroup(u,game.partyId);
    console.log(u+' left '+game.name);
  }
};

Server.prototype.userExitGame=function(e){
  var usr={};
  usr[e.user]=1;
  this.usersLeaveGame(usr,e);
  this.sendEvent('party',e.partyId,'system','Message',e.user+' left game');
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

Server.prototype.addToGroup=function(user,partyId){
  this.emit('addToGroup',user,partyId);
};

Server.prototype.removeFromGroup=function(user,partyId){
  this.emit('removeFromGroup',user,partyId);
};

Server.prototype.sendEvent=function(dst,dstId,contextId,func,arg){
  var e={dst:dst,contextId:contextId,func:func,arg:arg}
  if (dst=='client') e.usr=dstId;
  if (dst=='party') e.partyId=dstId;
  this.emit('event',e);
};


Server.prototype.addUserToGroup=function(name,gId){
  if (!this.groups[gId])
    this.groups[gId]={users:{},n:0};
  this.groups[gId].users[name]=this.connections[name].type;
  this.groups[gId].n++;
};

Server.prototype.removeUserFromGroup=function(name,gId){
  delete this.groups[gId].users[name];
  this.groups[gId].n--;
  if (this.groups[gId].n==0)
    delete this.groups[gId];
};

Server.prototype.createTempUser=function(){
  var name='';

  do {
    if (this.idCounter==this.maxCount)
      this.idCounter=0;
    name ='user'+this.idCounter++;
  } while (this.connections[name])

  return name;
};

Server.prototype.userConnectedTcp=function(socket){
  var user=this.createTempUser();
  this.connections[user]={};
  this.connections[user].NA=0;
  this.connections[user].type='tcp';
  this.connections[user].sock=socket;
  var sockName=socket.remoteAddress+"_"+socket.remotePort 
  this.sockNames[sockName]=user;
  this.connections[user].sockName=sockName;
  var hash=crypto.createHash('md5').update(sockName+this.salt).digest("hex");
  this.iamHashes[hash]=user;
  this.connections[user].iamHash=hash;
  this.sendEvent('client',user,'auth','IamHash',hash);
  this.userConnected(user);
};

Server.prototype.userDisconnectedTcp=function(sockName){
  var user=this.sockNames[sockName]; 
  if (user)
    this.userDisconnected(user);
};

Server.prototype.processCommandTcp=function(socket,s){
  var sockName=socket.remoteAddress + "_" + socket.remotePort;
  var cmds=s.split('\n'); //cuz we can get multiline data from socket
  for (var c in cmds){
    var pars=cmds[c].split(' ');
    var command=pars[0];
    var iam=pars[1]||"";
    if (command == '/iam'){
      if (this.iamHashes[iam]){
	var user=this.iamHashes[iam];
	var oldSockName=this.connections[user].sockName;
	this.connections[user].sockName=sockName;
	this.connections[user].sock=socket;
	this.connections[user].NA=0;
	this.sockNames[sockName]=user;
	delete this.sockNames[oldSockName];
	this.userConnected(user);
      } else
	this.userConnectedTcp(socket)
    } else if (command && this.sockNames[sockName]){
      var user=this.sockNames[sockName]; 
      this.processCommand(user,cmds[c]);
    }
  }
};

Server.prototype.processCommandWs=function(caller,s){
  this.processCommand(this.connectSids[caller.cookie['connect.sid']],s);
};

Server.prototype.userConnectedWs=function(caller){
  if (this.connectSids[caller.cookie['connect.sid']])
    var user=this.connectSids[caller.cookie['connect.sid']];
  else {
    var user=this.createTempUser();
    this.connections[user]={};
  }
  this.connections[user].NA=0;
  this.connections[user].type='ws';
  this.connections[user].clientId=caller.clientId;
  this.connectSids[caller.cookie['connect.sid']]=user;
  this.connections[user].connectSid=caller.cookie['connect.sid'];
  this.sendEvent('client',user,'auth','InitClient');
  this.userConnected(user);
};

Server.prototype.userDisconnectedWs=function(caller){
  var user=this.connectSids[caller.cookie['connect.sid']];
  if (user)
    this.userDisconnected(user);
};

Server.prototype.bind=function(user,newUser){
  var u=this.connections[user];
  this.connections[newUser]={};
  for (var i in u)
    this.connections[newUser][i]=u[i];

  if (u.type=='ws')
    this.connectSids[u.connectSid]=newUser;
  else
    this.sockNames[u.sockName]=newUser;

  delete this.connections[user];
};

Server.prototype.deleteConnection=function(user){
  var c=this.connections[user];
  if (c.type=='ws')
    delete this.connectSids[c.connectSid];
  else {
    delete this.sockNames[c.sockName];
    delete this.iamHashes[c.iamHash];
  }
  delete this.connections[user];
};

Server.prototype.userConnected=function(user){
  if (this.killTimers[user]){
    clearTimeout(this.killTimers[user]);
    delete this.killTimers[user];
  }
  this.init(user);  
};

Server.prototype.userDisconnected=function(user){
    this.connections[user].NA=1;
    var self=this;
    this.killTimers[user]=setTimeout(function(){self.killPlayerByTimeout.call(self,user)},30000);
    if (self.users[user].partyId)
      this.sendEvent('party',this.users[user].partyId,'system','Message',user+' disconnected');
    console.log(user+' disconnected');
};

Server.prototype.killPlayerByTimeout=function(user){
  if (this.connections[user]){
    if (this.users[user].partyId)
     this.sendEvent('party',this.users[user].partyId,'system','Message',user+' killed by timeout');
    this.kill(user);
    this.deleteConnection(user);
    console.log(user+' klled by timeout');
  }
};

Server.prototype.logIn=function(callerName,user,passwd){
  var reg=/(^user\d+$)/ig; // to check if temp names e.g. user0 being used
  if (this.users[callerName].state=='online' && user!='' && passwd!='' && !reg.test(user)  && this.db){
    var self=this;
    this.db.users.find({user:user},{user:1,passwd:1,profile:1},function(err,res){
      if (err)
        self.disableDb(err,user);
      else {
        if(res[0]){
          if (res[0].passwd==passwd){
            if (self.users[user]){
              self.sendEvent('client',user,'system','Error','Someone kicked your ass');
              self.sendEvent('client',user,'auth','Reauth');
              self.deleteConnection.call(self,user)
              self.bind.call(self,callerName,user);
              console.log(user+' kicked');
            } else{
              self.bind.call(self,callerName,user);
              self.init.call(self,user,res[0].profile);
            }
            self.kill.call(self,callerName);
          } else
            self.sendEvent('client',callerName,'auth','AuthFail',
              'Auth for user "'+user+'" failed or user is already registered.');
        } else if(self.db) {
          var profile=self.users[callerName].profile;
          self.db.users.insert({user:user,passwd:passwd,profile:profile},function(err){
            if (!err){
              self.kill.call(self,callerName);
              self.bind.call(self,callerName,user);
              self.init.call(self,user,profile);
            }
          });
        }
      }});
  } else
    this.sendEvent('client',callerName,'system','Error','Wrong state, empty user or password, or temp name used.');
};

Server.prototype.logOff=function(user){
  if (this.users[user].state=='online' && this.users[user].type=='registered'){
    this.sendEvent('everyone',null,'system','Message',user+' has logged off.');
    this.sendEvent('client',user,'auth','Reauth');
    this.kill(user);
    this.deleteConnection(user);
    console.log(user+' has logged off.');
  } else
    this.sendEvent('client',user,'system','Error','You cannot do this.');
};

module.exports=Server;
