var fork = require('child_process').fork;
var EventEmitter=require('events').EventEmitter;

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
  this.modes=require('./Modes.js').modes;
  this.boards=require('./Modes.js').boards;
  this.ranks=require('./Modes.js').ranks;
  this.gameCommands=require('./Commands.js').game;
  this.chatCommands=require('./Commands.js').chat;
}

Server.prototype=EventEmitter.prototype;

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

Server.prototype.initNewUser=function(user,profile){
  this.users[user]={};
  this.playersList[user]={};
  if (profile){
    if (!profile.muted)
      profile.muted={};
    if (!profile.score)
      profile.score=0;
    this.users[user].profile=profile;
    this.playersList[user].level=profile.level;
  }
  else{
    this.users[user].profile={level:0,score:0,muted:{},rank:{},coop:{},versus:{}};
    this.playersList[user].level=0;
  }
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

  if (flag=='registered'){
    this.sendEvent('everyone',null,'system','Message',user+' connected.');
  }
  this.sendEvent('client',user,'auth','Authorize',{user:user,flag:flag,profile:this.users[user].profile});
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
  if (user!='' && passwd!='' && !reg.test(user)  && this.db){
    var self=this;
    this.db.users.find({user:user},{user:1,passwd:1,profile:1},function(err,res){
      if (err){
        delete self.db;
        console.log(err.toString());
        self.sendEvent('client',callerName,'system','Message','Login failed due to some problems with DB. Login disabled.');
      } else {
        if(res[0]){
          if (res[0].passwd==passwd){
            self.systemLogoff.call(self,callerName);
            if (self.users[user])
              self.kickUser.call(self,user);
            else
              self.initNewUser.call(self,user,res[0].profile);
            self.initUser.call(self,caller,user,'registered');
          }  else{
             self.sendEvent('client',callerName,'auth','AuthFail',
               'Auth for user "'+user+'" failed or user is already registered.');
             self.initAuth(caller);
          }
        } else if(self.db) {
          var profile=self.users[callerName].profile;
          self.db.users.insert({user:user,passwd:passwd,profile:profile},function(err){
            if (!err){
              self.systemLogoff.call(self,callerName);
              self.initNewUser.call(self,user,profile);
              self.initUser.call(self,caller,user,'registered');
            }
          });
        }
      }});
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

Server.prototype.createParty=function(user,mode,bSize,m,min,max){
  if (this.modes[mode] && this.boards[bSize]){
    if (this.users[user].state=='online'){
      var partyId=this.partyCounter++;

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
      this.sendEvent('client',user,'system','Error',
                      {text:'You cannot do this now'});
  } else
    this.sendEvent('client',user,'system','Error',{text:'No such mode or board size.'});
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
  if (this.parties[partyId]){
    var p=this.parties[partyId];
    var level=this.users[user].profile.level;
    if (p.minLevel<=level && p.maxLevel>=level)
      this.addPlayerToParty(user,partyId);
    else
      this.sendEvent('client',user,'system','Error',{text:'Cannot join due to level restrictions.'});
  } else
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

Server.prototype.mutePlayer=function(user,muteUsr){
  if(muteUsr){
    this.users[user].profile.muted[muteUsr]=1;
    this.syncDbProfile(user);
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
  delete this.parties[args.id];
  args.board=this.boards[args.bSize];
  args.minPlayers=this.modes[args.mode][args.bSize].min;
  args.profiles={};
  for (var u in args.users){
    args.profiles[u]=this.users[u].profile[args.mode];
    this.changeUserState(u,'game');
    this.sendEvent('client',u,'system','Message',args.name+' started.');
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
  console.log('Game '+args.name+' created');
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
  this.syncDbProfile(e.winner);
  this.sendEvent('party',e.partyId,'game','ShowResultVersus',e);
};

Server.prototype.coopGameResult=function(e){
  if (e.result=='win')
    for (var i in e.score){
      this.users[i].profile.score+=e.score[i];
      this.syncDbProfile(i);
    };
  this.sendEvent('party',e.partyId,'game','ShowResultCoop',e);
};

Server.prototype.userNewBestTime=function(e){
  this.users[e.user].profile.rank[e.bSize]=e.time;
  var times=this.users[e.user].profile['rank'];
  var newRank=8;
  for (var bSize in this.ranks)
  if (!times[bSize]){
    newRank=0;
    break;
  } else {
    for (var i=0;i<this.ranks[bSize].length;i++)
      if (times[bSize]<this.ranks[bSize][i]){
        if (newRank>=8-i)
          newRank=8-i;
        break;
       };
  }

  if (newRank>0){
    this.users[e.user].profile.level=newRank;
    this.playersList[e.user].level=newRank;
    this.updatePlayersList();
  }

  if (this.db && this.users[e.user].type=='temp')
    this.sendEvent('client',e.user,'system','Message','Register with /login command to save your achievements');
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
