var Game=require('./Game.js');
var game=new Game(JSON.parse(process.argv[2]));

game.startGame=function(){
  this.gamesPlayed=0;
  this.won=0;
  this.lost=0;
  this.winStreak=0;
  this.loseStreak=0;
  this.startBoard();
};

game.onStartBoard=function(){
  this.resetScore();
};

game.onResetBoard=function(e){
  this.gamesPlayed++;
  if (e.win){
    this.winStreak++;
    this.loseStreak=0;
    this.won++;
  } else{
    this.winStreak=0;
    this.loseStreak++;
    this.lost++;
  }
  var stat=this.getGenericStat();
  stat.result=e.win?'win':'fail',
  stat.lastClick=e.user,
  stat.score=this.score,
  stat.gamesPlayed=this.gamesPlayed,
  stat.won=this.won,
  stat.lost=this.lost,
  stat.winPercentage=Math.round(100*this.won/this.gamesPlayed)+'%',
  stat.streak=this.winStreak?this.winStreak:this.loseStreak;
  this.sendEvent('party',this.id,'game','ShowResultCoop',stat);
};

game.onCells=function(re){
  this.addPoints(re);
  this.openCells(re.cells);
};

game.onBomb=function(re){
  this.openCells(this.board.mines);
  this.resetBoard(re);
};

game.onComplete=function(re){
  this.addPoints(re);
  this.openCells(re.cells);
  this.openCells(this.board.mines);
  re.win=1;
  this.resetBoard(re);
};

process.on('message', function(e) {
  game.dispatchEvent(e);
});

game.startGame();

