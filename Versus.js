var Game=require('./Game.js');
var game=new Game(JSON.parse(process.argv[2]));

game.startGame=function(){
  this.totalTime=0;
  this.startBoard();
};

game.resetGame=function(re){
  this.openCells(this.board.mines);
  this.totalTime+=this.now;
  var stat=this.getGenericStat();
  stat.winner=re.user;
  stat.totalTime=this.totalTime/1000,
  stat.score=this.score,
  this.sendEvent('party',this.id,'game','ShowResultVersus',stat);
  this.resetScore();
  this.resetBoard(re);
  this.totalTime=0;
};

game.onStartBoard=function(){
  var openX=Math.round(this.board.sizeX/2);
  var openY=Math.round(this.board.sizeY/2);
  this.checkCell({pars:[openX,openY],user:'system'});
};

game.onCells=function(re){
  this.openCells(re.cells);
  if (re.user!='system')
    this.addPoints(re);
  if (this.score[re.user]>=this.board.bombs*10){
    this.resetGame(re);
  }
};

game.onBomb=function(re){
  this.addPoints(re);
  this.openCells(re.cells);
  this.setUserPenalty(re.user,2000);
};

game.onComplete=function(re){
  this.totalTime+=this.now;
  this.addPoints(re);
  this.openCells(re.cells);
  this.openCells(this.board.mines);
  this.resetBoard(re);
};

process.on('message', function(e) {
  game.dispatchEvent(e);
});

game.startGame();

