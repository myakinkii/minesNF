var Game=require('./Game.js');

function VersusGame(pars){
  Game.call(this,pars);
  this.totalTime=0;
//  this.startBoard();
};

VersusGame.prototype=new Game;

VersusGame.prototype.onResetBoard=function(re){
  //this.openCells(this.board.mines);
  this.totalTime+=this.now;
  var stat=this.getGenericStat();
  stat.winner=re.user;
  stat.totalTime=this.totalTime/1000,
  stat.score=this.score,
  this.emitEvent('server',null,null,'versusGameResult',stat);
  //this.resetScore();
  //this.resetBoard(re);
  this.totalTime=0;
};

VersusGame.prototype.onStartBoard=function(){
  this.resetScore();
  this.openFirstCell();
};

VersusGame.prototype.onCells=function(re){
  this.openCells(re.cells);
  if (re.user!='system')
    this.addPoints(re);
  //if (this.score[re.user]>=this.board.bombs*10){
  //  this.resetGame(re);
  //}
};

VersusGame.prototype.onBomb=function(re){
  this.addPoints(re);
  this.openCells(re.cells);
  this.setUserPenalty(re.user,2000);
};

VersusGame.prototype.onComplete=function(re){
  //this.totalTime+=this.now;
  this.addPoints(re);
  this.openCells(re.cells);
  this.openCells(this.board.mines);
  this.resetBoard(re);
};

module.exports=VersusGame;
