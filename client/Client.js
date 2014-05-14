function Client(){
  this.eventHandlers={};
  this.registerHandler('InitClient','auth',this.initClient,this);
  var self=this;
  window.now.dispatchEvent=function(e){self.dispatchEvent.call(self,e)};
  render.call(this,['#warning',['span','warning','This site works with websockets only. '+
      'If this message doesn\'t disappear, you are probably behind proxy '+
      'or your browser doesnt\'t support websockets. Sorry.',
      'br','link','MinesNf@Github','https://github.com/myakinkii/minesNF']],toTag('body'));
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

Client.prototype.initClient=function(){
//                     a:65 b:66 c:67 d:68 e:69 f:70
// g:71 h:72 i:73 j:74 k:75 l:76 m:77 n:78 o:79 p:80
// q:81 r:82 s:83 t:84 u:85 v:86 w:87 x:88 y:89 z:90
  this.binds={command:{0:function(o){this.view.command.value=o.val;this.view.command.focus();}},
              user:{0:function(o){this.view.command.value='/to '+o.val+' ';this.view.command.focus();},
                    73:function(o){window.now.processCommand('/info '+o.val);},
                    75:function(o){window.now.processCommand('/kick '+o.val);},
                    77:function(o){window.now.processCommand('/mute '+o.val);},
                    85:function(o){window.now.processCommand('/umute '+o.val);}},
              specPlayer:{0:function(o){window.now.processCommand('/spec '+o.spec);}},
              party:{0:function(o){this.view.command.value='# ';this.view.command.focus();},
                     68:function(o){window.now.processCommand('/dismiss');}},
              joinParty:{0:function(o){window.now.processCommand('/join '+o.id);}}
             };
  this.key=0;
  this.mode=0;
  this.bSizes={s:'small',m:'medim',b:'big'};
  this.bSize=0;
  this.maxPlayers=0;
  this.minLevel=0;
  this.maxLevel=8;
  this.view={};
  var self=this;
  getTag('body').onkeydown=function(e){self.keyDown.call(self,e)};
  getTag('body').onkeyup=function(e){self.keyUp.call(self,e)};
  getTag('body').removeChild(getId('warning'));
  this.initHandlers();
  render.call(this,['#Main',
                     ['#auth',
                      '#filter',
                        ['select',{all:'mode: all',coop:'coop',rank:'rank',versus:'versus'},
                                  {'onchange':this.filterParamsChange},0,'mode',
                         'select',{all:'board: all',s:'small',m:'medium',b:'big'},
                                  {'onchange':this.filterParamsChange},0,'bSize',
                         'select',{0:'players: *',1:1,2:2,3:3,4:4},
                                  {'onchange':this.filterParamsChange},0,'maxPlayers',
                         'select',{0:'min level: 0',1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8},
                                  {'onchange':this.filterParamsChange},0,'minLevel',
                         'select',{0:'max level: *',1:1,2:2,3:3,4:4,5:5,6:6,7:7,8:8},
                                  {'onchange':this.filterParamsChange},0,'maxLevel',
                         'a','add party','addParty',null,{'onclick':this.addParty}],
                      '#parties',
                      '#game',
                      '#chat',
                        ['input',100,'','command',null,{'onkeypress':this.sendMessage},'br']],
                    '#Side',['#players'],
                   ],toTag('body'));
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
    if (this.key==32){
      if (this.state!='online')
        this.view.command.value='#';
      this.view.command.focus();
    }
  } else 
    if (this.key==27) 
      this.view.command.blur();
  this.key=0;
};

Client.prototype.sendMessage=function(e){
  var key=e.keyCode||e.which;
  if(key==13 && this.view.command.value.length>0){
    if (/^\/ping( |$)/.test(this.view.command.value))
      this.sendPing();
    else
      window.now.processCommand(this.view.command.value);
    this.view.command.value='';
  }
};

Client.prototype.addParty=function(e){
  window.now.processCommand('/create '+(this.mode||'rank')+' '+(this.bSize||'s')+' '
                            +(this.maxPlayers||1)+' '+this.minLevel+' '+(this.maxLevel||8));
};

Client.prototype.filterParamsChange=function(e){
  if (e.target.selectedIndex!=0)
    this[e.target.id]=e.target.options[e.target.selectedIndex].value
  else
    this[e.target.id]=0;
  this.filterParties();
};

Client.prototype.filterParties=function(){
  if (this.view.parties.firstChild)
    this.view.parties.removeChild(this.view.parties.firstChild)
  var list=[];
  for (var i in this.parties){
    var p=this.parties[i];
    var modeOK=this.mode==0||this.mode==p.mode;
    var bSizeOK=this.bSize==0||this.bSize==p.bSize;
    var maxPlayersOK=this.maxPlayers==0||this.maxPlayers==p.maxPlayers;
    if (this.maxLevel<this.minLevel)
      this.maxLevel=this.minLevel;
    var minLevelOK=this.minLevel==0||this.minLevel<=p.maxLevel;
    var maxLevelOK=this.maxLevel==0||this.maxLevel>=p.minLevel;
    if (modeOK && bSizeOK && maxPlayersOK && minLevelOK && maxLevelOK){
      list.push({val:p.name,id:p.id,type:'party'},' '+this.bSizes[p.bSize]+' board',' levels '+p.minLevel+'-'+p.maxLevel,' [');
      for (var u in p.users)
        list.push({val:u,type:'user'},' ');
      for (var i=0;i<p.maxPlayers-p.curPlayers;i++)
        list.push('<free> ');
      list.push('] ',{val:'>>',id:p.id,type:'joinParty'},'\n');
    }
  }

  if (list.length){
    var partiesDiv=crEl('div');
    render.call(this,['#partiesWrapper',this.transformToRender(list)],
                partiesDiv);
    this.view.parties.appendChild(partiesDiv);
  }
};

Client.prototype.initHandlers=function(){
  this.registerHandler('Authorize','auth',this.onAuthorize,this);
  this.registerHandler('AuthFail','auth',this.onAuthFail,this);
  this.registerHandler('Reauth','auth',this.onReauth,this);
  this.registerHandler('Error','system',this.onError,this);
  this.registerHandler('Message','system',this.onSystemMessage,this);
  this.registerHandler('Message','chat',this.onChatMessage,this);
  this.registerHandler('NAMessages','chat',this.onNAMessages,this);
  this.registerHandler('Welcome','chat',this.onWelcome,this);
  this.registerHandler('Help','chat',this.onHelp,this);
  this.registerHandler('Top','chat',this.onTop,this);
  this.registerHandler('Info','chat',this.onInfo,this);
  this.registerHandler('Ping','chat',this.onPing,this);
  this.registerHandler('Ranks','chat',this.onRanks,this);
  this.registerHandler('Muted','chat',this.onMuted,this);
  this.registerHandler('UpdateMuted','chat',this.onUpdateMuted,this);
  this.registerHandler('UpdateParties','chat',this.onUpdateParties,this);
  this.registerHandler('UpdatePlayers','chat',this.onUpdatePlayers,this);
  this.registerHandler('ShowResultCoop','game',this.onShowResultCoop,this);
  this.registerHandler('ShowResultVersus','game',this.onShowResultVersus,this);
  this.registerHandler('ShowResultRank','game',this.onShowResultRank,this);
  this.registerHandler('StartGame','game',this.onStartGame,this);
  this.registerHandler('EndGame','game',this.onEndGame,this);
};

Client.prototype.onAuthorize=function(auth){
  this.user=auth.user;
  this.state='online';
  this.muted=auth.profile.muted;
  if (this.view.auth.firstChild)
    this.view.auth.removeChild(this.view.auth.firstChild);
  if (auth.type=='temp'){
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

Client.prototype.logIn=function(e){
  var key=e.keyCode||e.which;
  if(key==13){
    window.now.processCommand('/login '+this.view.login.value+' '+this.view.passwd.value);
  }
};


Client.prototype.onAuthFail=function(m){
  this.renderTextMessage(m);
  this.view.passwd.value='';
};

Client.prototype.onReauth=function(){
//  window.now.initAuth();
  location.reload();
};

Client.prototype.onError=function(m){
  this.renderTextMessage(m);
};

Client.prototype.onSystemMessage=function(m){
  this.renderTextMessage(m);
};

Client.prototype.onChatMessage=function(m){
  if (!this.muted[m.from]){
    if (m.type=='shout')
      var message=[{span:['ShoutMessage',' ! ']},{val:m.from,type:'user'},': '+m.text];
    else if (m.type=='party')
      var message=[{span:['PartyMessage',' # ']},{val:m.from,type:'user'},': '+m.text];
    else if (m.type=='private'){
      if (this.user==m.to)
        var message=[{span:['PrivateMessage','>> ']},{val:m.from,type:'user'},': '+m.text];
      if (this.user==m.from)
        var message=[{val:m.to,type:'user'},{span:['PrivateMessage',' >> ']},': '+m.text];
    } else
      var message=[{val:m.from,type:'user'},': '+m.text];
    this.renderMessageT(message);
  }
};

Client.prototype.onNAMessages=function(messages){
  for (var i in messages)
    this.onChatMessage(messages[i]);
};

Client.prototype.onWelcome=function(m){
  this.renderMessageT([
    'Welcome.','\n',
    'Have fun, respect other players, or prepare to be muted.','\n',
    'Default chat language is English.','\n',
    'Type ', {val:'/ping',type:'command'},' to estimate latency.','\n',
    'High latency value can make your game uncomfortable, depending on your skill level.','\n',
    'Type ',{val:'/help',type:'command'},' to get help ;).']);
};

Client.prototype.onHelp=function(help){
  for (var i in help)
    this.renderMessageT([' ',{val:i,type:'command'},help[i].d]);
  this.renderMessageT([
    'Use dropdown lists to add and filter parties, or use commands described below.','\n',
    'Default \'add party\' mode is small rank board (single player mode).','\n',
    'Space to focus command input.','\n',
    'Some commands can be applied to hypertext objects with corresponding keys pressed on click','\n',
    'Available commands:']);
};

Client.prototype.onTop=function(top10){
  if (top10[0].profile.score){
    var message=['Top score players:','\n'];
    var n=1;
    for (var i=0;i<top10.length;i++){
      var p=top10[i].profile;
      message.push(' '+(i+1)+': ',{user:[top10[i].user,p.level]},' - '+p.score,'\n')
    }
    this.renderMessageT(message);
  }
  if (top10[0].profile.rankTotal){
    var message=['Top time players:','\n'];
    var n=1;
    for (var i=0;i<top10.length;i++){
      var p=top10[i].profile;
      message.push(' '+(i+1)+': ',{user:[top10[i].user,p.level]},
                   ' - '+p.rankTotal+'s ('+p.rank.small+'-'+p.rank.medium+'-'+p.rank.big+ ')','\n')
    }
    this.renderMessageT(message);
  }
};

Client.prototype.sendPing=function(){
  var n=1;
  window.now.processCommand('/ping '+Date.now());
  var ping=window.setInterval(function(){
    if (n++>2) 
      window.clearInterval(ping);
    else
      window.now.processCommand('/ping '+Date.now())},500);
};

Client.prototype.onPing=function(time){
  this.renderTextMessage('Got response in '+(Date.now()-time)+'ms');
};

Client.prototype.onInfo=function(info){
  var p=info.profile;
  var message=[{user:[info.user,p.level]},'\n',
               ' score: '+p.score,'\n',
               ' total: '+p.rankTotal+'s ('+p.rank.small+'-'+p.rank.medium+'-'+p.rank.big+ ')','\n'];
  this.renderMessageT(message);
};

Client.prototype.onRanks=function(ranks){
  var message=['In order to get a rank you have to get your times in:','\n'];
  for (var i=1; i<=8;i++) 
    message.push({span:['Rank'+i,i]},': '+ranks.small[8-i]+'-'+ranks.medium[8-i]+'-'+ranks.big[8-i]+'s ','\n')
  this.renderMessageT(message);
};

Client.prototype.onMuted=function(muted){
  var m=[];
  for (var i in muted)
    m.push({val:i,type:'user'},' ');
  if (m.length==0)
    this.renderTextMessage('No muted players.');
  else{
    m.unshift('Muted players: ')
    this.renderMessageT(m);
  }
};

Client.prototype.onUpdateMuted=function(muted){
  this.muted=muted;
  this.onMuted(muted);
};

Client.prototype.onUpdatePlayers=function(players){
   if (this.view.players.firstChild)
    this.view.players.removeChild(this.view.players.firstChild)
  var list=[];
  for (var i in players){
    if (this.user==i)
      this.state=players[i].state;
    list.push({user:[i,players[i].level]});
    if (players[i].state=='game')  
      list.push(' ',{val:'>>',spec:i,type:'specPlayer'});
    list.push('\n');
  }
  if (list.length){
    var playersDiv=crEl('div');
    render.call(this,['#playersWrapper',this.transformToRender(list)],
                playersDiv);
    this.view.players.appendChild(playersDiv);
  } 
};

Client.prototype.onUpdateParties=function(parties){
  this.parties=parties;
  this.filterParties();
};

Client.prototype.onShowResultCoop=function(e){
  if (this.view.results.firstChild)
    this.view.results.removeChild(this.view.results.firstChild);
  if (e.result=='win'){
    var res=['Win! Time: '+e.time+'s. Score: '];
    for (var i in e.score)
      res.push(i+'-'+e.score[i]+' ');
  } else {
    var res=['Fail! Time played: '+e.time+'s. User to blame: '+e.lastClick];
  }
  if (e.result=='win'&& (e.streak==3||e.streak==5|| e.streak==10))
    res.push(e.streak+' in a row!');
    render.call(this,['span','Result',null,this.transformToRender(res)],this.view.results)
};

Client.prototype.onShowResultVersus=function(e){
  if (this.view.results.firstChild)
    this.view.results.removeChild(this.view.results.firstChild);
    var res=['Current time: '+e.time+'s.'+'Total time: '+e.totalTime+'s. Score: '];
    for (var i in e.score)
      res.push(i+'-'+e.score[i]+' ');
    render.call(this,['span','Result',null,this.transformToRender(res)],this.view.results)
};

Client.prototype.onShowResultRank=function(e){
  if (this.view.results.firstChild)
    this.view.results.removeChild(this.view.results.firstChild);
  if (e.result=='win'){
    var res=['Current time: '+e.time+'s.'+'Best time: '+e.bestTime+'s.'];
    render.call(this,['span','Result',null,this.transformToRender(res)],this.view.results)
  }
};

Client.prototype.onStartGame=function(pars){
  this.boardParams=pars;
  if(!getId('gameStat')) 
    render.call(this,['#gameStat',['#quit',['a','quit game',null,null,
          {'onclick':function(){window.now.processCommand('/quit')}}],
                                   '#results']],this.view.game);
  if(getId('board')) 
  this.view.game.removeChild(getId('board'));
  var boardDiv=document.createElement('div');
  boardDiv.id='board';
  this.board=new Board(this,pars.boardId,pars.r,pars.c,boardDiv);
  this.registerHandler('CellValues','game',this.board.getCellValues,this.board);
  this.registerHandler('OpenLog','game',this.board.openLog,this.board);
  this.view.game.appendChild(boardDiv);
};

Client.prototype.onEndGame=function(){
  this.view.game.removeChild(getId('gameStat'));
  this.view.game.removeChild(getId('board'));
};

Client.prototype.renderTextMessage=function(text){
  this.renderMessage(['/'+text]);
};

Client.prototype.renderMessageT=function(message){
  this.renderMessage(this.transformToRender(message));
};

Client.prototype.renderMessage=function(message){
  var mb=document.createElement('div');
  mb.className='messageBlock';
  render.call(this,message,mb);
  this.view.chat.insertBefore(mb,this.view.command.nextSibling);
};

Client.prototype.transformToRender=function(m){
  var tm=[];
  for (var i in m){
    if (typeof m[i]=='object'){
      if (m[i].user){
        tm.push('/[','span','Rank'+m[i].user[1],''+m[i].user[1],'/]');
        tm.push('{}',{func:function(o,e){
                             if (this.binds[o.type][this.key])
                               this.binds[o.type][this.key].call(this,o);},
                      style:'user',
                      o:{val:m[i].user[0],type:'user'}});
      } else if (m[i].span)
        tm.push('span',m[i].span[0],''+m[i].span[1]);
      else if (this.binds[m[i].type])
        tm.push('{}',{func:function(o,e){
                             if (this.binds[o.type][this.key])
                               this.binds[o.type][this.key].call(this,o);},
                      style:m[i].type,
                      o:m[i]});
    } else if (m[i]=='\n')
      tm.push('br');
    else 
      tm.push('/'+m[i]);
  }
  return tm;
};

