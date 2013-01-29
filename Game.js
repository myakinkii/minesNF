var Board=require('./Board.js');
var EventEmitter=require('events').EventEmitter;

function Game(pars){
  if (pars){
    this.id=pars.id;
    this.mode=pars.mode;
    this.bSize=pars.modePars.bSize;
    this.name=pars.name;
    this.players=pars.users;
    this.spectators={};
    this.partyLeader=pars.leader;
    this.playersInGame=pars.curPlayers;
    this.penalty={};
    this.resetScore();
    this.board=new Board(pars.name,pars.modePars.board);
  }
}

Game.prototype=EventEmitter.prototype;

Game.prototype.foo=function(){
console.log('Game');
};

Game.prototype.emitEvent=function(dst,dstId,contextId,func,arg){
  this.emit('message',{dst:dst,
                dstId:dstId,
                contextId:contextId,
                func:func,
                arg:arg});

};

Game.prototype.dispatchEvent=function(e){
  if (e.command=='checkCell' && this.players[e.user])
    this.checkCell(e);
  if (e.command=='startBoard')
    this.startBoard();
  if (e.command=='initGUI')
    this.initGUI(e.user);
  if (e.command=='addSpectator')
    this.addSpec(e.user);
  if (e.command=='quitGame')
    this.quitGame(e.user);
};

Game.prototype.addSpec=function(user){
  this.spectators[user]=1;
  this.emitEvent('party',this.id,'system','Message',
                 user+' joined '+this.name+' as a spectator');
  this.initGUI(user);
};

Game.prototype.initGUI=function(user){
  this.emitEvent('client',user,'game','StartGame',
                 {boardId:this.name,r:this.board.sizeY,c:this.board.sizeX});
  this.emitEvent('client',user,'game','OpenLog',this.log);
};

Game.prototype.startBoard=function(){
  this.pause=0;
  this.logStart=0;
  this.log={};
  this.emitEvent('party',this.id,'game','StartGame',
                 {boardId:this.name,r:this.board.sizeY,c:this.board.sizeX});
  if (this.onStartBoard)
    this.onStartBoard();
};

Game.prototype.resetBoard=function(e){
  this.pause=1;
  if (this.onResetBoard)
    this.onResetBoard(e);
  if (!e.noRestart){
    var self=this;
    setTimeout(function(){self.startBoard.call(self)},1000);
  }
};

Game.prototype.getGenericStat=function(){
return {mode:this.mode,
        name:this.name,
        partyId:this.id,
        bSize:this.bSize,
        partyLeader:this.partyLeader,
        users:this.players,
        start:this.logStart,
        time:this.now/1000,
        log:this.log,
        mines:this.board.mines};
};

Game.prototype.checkCell=function(e){
  var x=parseInt(e.pars[0])||0;
  var y=parseInt(e.pars[1])||0;

  if ( !(x<1 || x>this.board.sizeX) && !(y<1 || y>this.board.sizeY) ){ 
    if (this.logStart==0)
      this.board.init(x,y,2);
    if (!this.pause && !this.penalty[e.user])
      var re=this.board.checkCell(x,y,e.user);
  }
  if (re){
    this.logEvent(re);
    this['on'+re.flag].call(this,re);
  }
};

Game.prototype.resetScore=function(){
  this.score={};
  for (var p in this.players)
    this.score[p]=0;
};

Game.prototype.addPoints=function(re){
  this.score[re.user]+=re.points,
  this.log[this.now].points=re.points;
};

Game.prototype.openCells=function(cells){
  this.emitEvent('party',this.id,'game','CellValues',cells);
};

Game.prototype.setUserPenalty=function(user,time){
  this.penalty[user]=1;
  var self=this;
  setTimeout(function(){self.penalty[user]=0;},time);
};

Game.prototype.logEvent=function(re){
  var now=Date.now();
  if (this.logStart==0){
    this.logStart=now;
    this.now=0;
  }
  this.now=now-this.logStart;
  this.log[this.now]={user:re.user,
                      cellCoord:re.coords,
                      cellsOpened:re.cells,
                      val:re.value};
};

Game.prototype.quitGame=function(user){
  this.emitEvent('client',user,'game','EndGame');
  if (this.spectators[user]){
    delete this.spectators[user];
    this.emitEvent('server',null,null,'userLeftGame',
                   {partyId:this.id,name:this.name,user:user});
  } else {
    if (this.playersInGame==1){
      this.emitEvent('server',null,null,'childExit',
                     {partyId:this.id,name:this.name,
                      spectators:this.spectators,users:this.players});
//      process.exit(0);
    } else {
      this.playersInGame--;
      delete this.players[user];
      for (var i in this.players){
        this.partyLeader=i
        break;
      }
      this.emitEvent('server',null,null,'userLeftGame',
                     {partyId:this.id,name:this.name,user:user});
    }
  }
};

Game.prototype.endGame=function(){
  for (var i in this.players)
    this.emitEvent('client',i,'game','EndGame');
  this.emitEvent('server',null,null,'childExit',
                 {partyId:this.id,name:this.name,
                  spectators:this.spectators,users:this.players});
//  process.exit(0);
};

module.exports=Game;
