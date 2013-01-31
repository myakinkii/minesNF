function Client(){
  this.initHandlers();
  var self=this;
  window.now.dispatchEvent=function(e){self.dispatchEvent.call(self,e)};
    render.call(this,['#warning',['span','warning','This site works with websockets only. '+
       'If this message doesn\'t disappear, you are probably behind proxy '+
       'or your browser doesnt\'t support websockets. Sorry.']],toTag('body'));
};

Client.prototype.sendMessage=function(e){
  var key=e.keyCode||e.which;
  if(key==13){
    window.now.processCommand(this.view.command.value);
    this.view.command.value='';
  }
};

Client.prototype.registerHandler=function(eventName,contextId,func,context){
  this.eventHandlers[contextId+eventName]={func:func,context:context};
};

Client.prototype.dispatchEvent=function(e){
  if (this.eventHandlers[e.contextId+e.func]){
    var eH=this.eventHandlers[e.contextId+e.func];
    eH.func.call(eH.context,e.arg);
  }
};

Client.prototype.initHandlers=function(){
  this.eventHandlers={};
  this.registerHandler('InitClient','auth',this.initClient,this);
  this.registerHandler('Authorize','auth',this.authorize,this);
  this.registerHandler('AuthFail','auth',this.authFail,this);
  this.registerHandler('Logoff','auth',this.logOff,this);
  this.registerHandler('Error','system',this.errorHandler,this);
  this.registerHandler('Message','system',this.systemMessageHandler,this);
  this.registerHandler('Message','chat',this.messageHandler,this);
  this.registerHandler('PartyMessage','chat',this.partyMessageHandler,this);
  this.registerHandler('PrivateMessage','chat',this.privateMessageHandler,this);
  this.registerHandler('NAMessages','chat',this.NAMessagesHandler,this);
  this.registerHandler('Welcome','chat',this.showWelcomeMessage,this);
  this.registerHandler('Help','chat',this.showHelp,this);
  this.registerHandler('UpdateParties','chat',this.partiesHandler,this);
  this.registerHandler('UpdatePlayers','chat',this.playersHandler,this);
  this.registerHandler('ShowResultCoop','game',this.showResultCoop,this);
  this.registerHandler('ShowResultVersus','game',this.showResultVersus,this);
  this.registerHandler('ShowResultRank','game',this.showResultRank,this);
  this.registerHandler('StartGame','game',this.startGame,this);
  this.registerHandler('EndGame','game',this.endGame,this);
};

Client.prototype.initClient=function(){
  this.binds={command:{0:'execCommand'},
              message:{0:'sendPM'},
              shout:{0:'sendPM'},
              PM:{0:'sendPM'},
              partyPM:{0:'sendPartyPM'},
              user:{0:'sendPM',
                    75:'kickUserFromParty'},
              joinParty:{0:'joinParty'},
              specPlayer:{0:'specPlayer'},
              party:{0:'sendPartyPM',
                     68:'dismissParty' }
             };
  this.key=0;
  this.view={};
  var self=this;
  getTag('body').onkeydown=function(e){self.keyDown.call(self,e)};
  getTag('body').onkeyup=function(e){self.keyUp.call(self,e)};

  getTag('body').removeChild(getId('warning'));
  render.call(this,['#Main',
                     ['#auth','#filter',
                        ['select',{all:'all',coop:'coop',rank:'rank',versus:'versus'},
                                  {'onchange':this.filterParty},0,'mode',
                         'select',{small:'small',M:'medium',B:'big'},{'onchange':this.filterParty},0,'bSize',
                         'select',{0:'*',1:1,2:2,3:3,4:4},{'onchange':this.filterParty},0,'maxPlayers',
                         'a','+','addParty',null,{'onclick':this.addParty}],
                      '#parties','#game','#chat',
                        ['input',30,'','command',null,
                        {'onkeypress':this.sendMessage},'br']],
                    '#Side',['#players'],
                   ],toTag('body'));
};

Client.prototype.authorize=function(auth){
  this.user=auth.user;
  if (this.view.auth.firstChild)
    this.view.auth.removeChild(this.view.auth.firstChild);
  if (auth.flag=='temp'){
    render.call(this,
                ['#ID'+this.user,
                ['input',5,this.user,'login',null,{'onkeypress':this.logIn},
                 'input',5,'','passwd',null,{'onkeypress':this.logIn}]],
                this.view.auth);
  } else {
    render.call(this,
                ['#ID'+this.user,
                  ['a','[x]',null,null,
                   {'onclick':function(){window.now.processCommand('/logoff')}},
                   '/'+this.user]],
                this.view.auth);
  }
};

Client.prototype.authFail=function(message){
  this.renderMessage(message);
  this.view.passwd.value='';
};

Client.prototype.logOff=function(message){
  if (message) 
    this.renderMessage(message);
  this.view.auth.removeChild(this.view.auth.firstChild);
  window.now.initAuth();
};

Client.prototype.logIn=function(e){
  var key=e.keyCode||e.which;
  if(key==13)
    window.now.processCommand('/login '+this.view.login.value+' '+this.view.passwd.value);
};

Client.prototype.renderTextMessage=function(message,spanClass){
  var mb=document.createElement('div');
  mb.className='messageBlock';
  render.call(this,['p',message,spanClass],mb);
//  render.call(this,['span',spanClass,message],mb);
  this.view.chat.insertBefore(mb,this.view.command.nextSibling);
};

Client.prototype.errorHandler=function(e){
  this.renderMessage(['error: ',e.text]);
};

Client.prototype.systemMessageHandler=function(text){
  this.renderMessage(['system: ',text])
};

Client.prototype.messageHandler=function(m){
//  this.renderTextMessage(m.from+': '+m.text,m.type);
  this.renderMessage([{val:m.from,type:m.type},': ',m.text]);
};

Client.prototype.partyMessageHandler=function(m){
  this.renderMessage(['party pm from ',{val:m.from,type:m.type},': ',m.text]);
};

Client.prototype.privateMessageHandler=function(m){
  if (this.user==m.to)
    var message=['pm from ',{val:m.from,type:'PM'},': ',m.text];
  else
    var message=['pm to ',{val:m.to,type:'PM'},': ',m.text];
  this.renderMessage(message);
};

Client.prototype.NAMessagesHandler=function(messages){
  for (var i in messages)
    this.renderMessage(messages[i]);
};

Client.prototype.showWelcomeMessage=function(m){
  this.renderMessage(['Type ',{val:'/help',type:'command'},
                      ' to get commands info.']);
};

Client.prototype.showHelp=function(help){
  for (var i in help)
    this.renderMessage([help[i].d]);
  this.renderMessage(['Available commands:']);
};

Client.prototype.addParty=function(e){
  var modeSI=this.view.mode.selectedIndex;
  var mode='rank';
  var bSize='';
  var maxPlayers=1;
  if (this.view.bSize.selectedIndex!=0)
    bSize=this.view.bSize.options[this.view.bSize.selectedIndex].value;
  if (this.view.maxPlayers.selectedIndex!=0)
    maxPlayers=this.view.maxPlayers.options[this.view.maxPlayers.selectedIndex].value;
  if (modeSI!=0)
    mode=this.view.mode.options[modeSI].value
  window.now.processCommand('/create '+mode+bSize+' '+maxPlayers);
};

Client.prototype.filterParty=function(e){
//alert(e.target.id);
};

Client.prototype.playersHandler=function(players){
   if (this.view.players.firstChild)
    this.view.players.removeChild(this.view.players.firstChild)
  var message=[];
  for (var i in players){
    var p=players[i];
    message.push({val:i,type:'user'});
    if (p.state=='game')  
      message.push(' ',{val:'>>',user:i,type:'specPlayer'},'\n');
    message.push('\n');
  }
  if (message.length){
    var playersDiv=crEl('div');
    render.call(this,['#playersWrapper',this.transformMessage(message)],
                playersDiv);
    this.view.players.appendChild(playersDiv);
  } 
};

Client.prototype.partiesHandler=function(parties){
  if (this.view.parties.firstChild)
    this.view.parties.removeChild(this.view.parties.firstChild)
  var message=[];
  for (var i in parties){
    var p=parties[i];
    message.push({val:p.name,id:p.id,type:'party'},' [');
    for (var u in p.users)
      message.push({val:u,type:'user'},' ');
    for (var i=0;i<p.maxPlayers-p.curPlayers;i++)
      message.push('<free> ');
    message.push('] ',{val:'>>',id:p.id,type:'joinParty'},'\n');
  }
  if (message.length){
    var partiesDiv=crEl('div');
    render.call(this,['#partiesWrapper',this.transformMessage(message)],
                partiesDiv);
    this.view.parties.appendChild(partiesDiv);
  }
};

Client.prototype.startGame=function(pars){
  this.boardParams=pars;
  if(!getId('gameStat')) 
    render.call(this,['#gameStat',['#quit',[
        'a','quit game',null,null,
          {'onclick':function(){window.now.processCommand('/quit')}}],'#results']
                     ],this.view.game);
  if(getId('board')) 
  this.view.game.removeChild(getId('board'));
  var boardDiv=document.createElement('div');
  boardDiv.id='board';
  this.board=new Board(this,pars.boardId,pars.r,pars.c,boardDiv);
  this.registerHandler('CellValues','game',this.board.getCellValues,this.board);
  this.registerHandler('OpenLog','game',this.board.openLog,this.board);
  this.view.game.appendChild(boardDiv);
};

Client.prototype.endGame=function(){
  this.view.game.removeChild(getId('gameStat'));
  this.view.game.removeChild(getId('board'));
};

Client.prototype.showResultCoop=function(e){
  if (e.result=='win'){
    var message='Win! Time: '+e.time+'s. Score: ';
    for (var i in e.score)
      message+=i+'-'+e.score[i]+' ';
  } else {
    var message='Fail! Time played: '+e.time+'s. User to blame: '+e.lastClick;
  }
//var message=JSON.stringify(e);
  this.view.results.innerHTML=message;
  if (e.result=='win'&& (e.streak==3||e.streak==5|| e.streak==10))
    this.view.results.innerHTML+=e.streak+' in a row!';
};

Client.prototype.showResultRank=function(e){
  if (e.result=='win'){
    var message='Current time: '+e.time+'s.'+'Best time: '+e.bestTime+'s.';
    this.view.results.innerHTML=message;
  }
};

Client.prototype.showResultVersus=function(e){
    var message='Current time: '+e.time+'s.'+'Total time: '+e.totalTime+'s. Score: ';
    for (var i in e.score)
      message+=i+'-'+e.score[i]+' ';
  this.view.results.innerHTML=message;
};

Client.prototype.keyDown=function(e){
  var key=e.keyCode||e.which;
  this.key=key;
};

Client.prototype.keyUp=function(e){
  if (document.activeElement!=this.view.command){
    if (this.key==192){
        this.view.command.value='';
        this.view.command.focus();
    }
    if (this.key==32)
      this.view.command.focus();
  } else 
    if (this.key==27) 
      this.view.command.blur();
  this.key=0;
};

Client.prototype.handleClick=function(o,e){
  if (this.binds[o.type])
    if (this.binds[o.type][this.key]){
      this[this.binds[o.type][this.key]].call(this,o);
    }
};

Client.prototype.execCommand=function(o){
  this.view.command.value=o.val;
  this.view.command.focus();
};

Client.prototype.joinParty=function(o){
  window.now.processCommand('/join '+o.id);
};

Client.prototype.specPlayer=function(o){
  window.now.processCommand('/spec '+o.user);
};

Client.prototype.dismissParty=function(o){
  window.now.processCommand('/dismiss');
};

Client.prototype.sendPM=function(o){
  this.view.command.value='/to '+o.val+' ';
  this.view.command.focus();
}

Client.prototype.kickUserFromParty=function(o){
  window.now.processCommand('/kick '+o.val);
};

Client.prototype.sendPartyPM=function(o){
  this.view.command.value='# ';
  this.view.command.focus();
}

Client.prototype.transformMessage=function(m){
  var tm=[];
  for (var i in m){
    if (typeof m[i]=='object')
      tm.push('{}',{func:'handleClick',style:m[i].type,o:m[i]});
    else if (m[i]=='\n')
      tm.push('br');
    else 
      tm.push('/'+m[i]);
  }
  return tm;
};

Client.prototype.renderMessage=function(message){
  var mb=document.createElement('div');
  mb.className='messageBlock';
  render.call(this,this.transformMessage(message),mb);
  this.view.chat.insertBefore(mb,this.view.command.nextSibling);
};


