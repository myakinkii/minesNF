var Game=require('./Game.js');

function RankGame(pars){
  Game.call(this,pars);
  this.bestTime=this.profiles[this.partyLeader][this.bSize];
  this.gamesPlayed=0;
  this.won=0;
  this.lost=0;
  this.winStreak=0;
  this.loseStreak=0;
};

RankGame.prototype=new Game;

RankGame.prototype.onStartBoard=function(){
  this.resetScore();
};

RankGame.prototype.onResetBoard=function(e){
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
  stat.bestTime=this.bestTime;
  stat.result=e.win?'win':'fail',
  stat.gamesPlayed=this.gamesPlayed,
  stat.won=this.won,
  stat.lost=this.lost,
  stat.winPercentage=Math.round(100*this.won/this.gamesPlayed)+'%',
  stat.streak=this.winStreak?this.winStreak:this.loseStreak;
  this.emitEvent('party',this.id,'game','ShowResultRank',stat);
};

RankGame.prototype.onCells=function(re){
  this.openCells(re.cells);
};

RankGame.prototype.onBomb=function(re){
  this.openCells(this.board.mines);
  this.resetBoard(re);
};

RankGame.prototype.onComplete=function(re){
  this.openCells(re.cells);
  this.openCells(this.board.mines);
  re.win=1;
  var time=this.now/1000;
  if (!this.bestTime || time<this.bestTime){
    this.bestTime=time;
    this.emitEvent('server',null,null,'userNewBestTime',
                   {game:this.name,user:re.user,bSize:this.bSize,time:time,log:this.log});
  }
  this.resetBoard(re);
};

module.exports=RankGame;

