function Board(name,pars){
  this.tabId=name;
  this.sizeX=pars.c;
  this.sizeY=pars.r;
  this.bombs=pars.b;
}

Board.prototype.init=function (Xinit,Yinit,r){
  var maxDigit=0,curVal;
  this.board=[];
  this.mines={};
  this.checked={};
  this.empty=this.sizeX*this.sizeY-this.bombs;
  for (var i=0;i<this.sizeY+2;i++){
    this.board[i]=[];
    for (var j=0;j<this.sizeX+2;j++)
      this.board[i][j]=0;
  }
  var steps=this.bombs;
  while (steps>0){
    var x = Math.floor(Math.random()*this.sizeX)+1;
    var y = Math.floor(Math.random()*this.sizeY)+1;
    if (this.board[y][x]>8 || (Math.abs(x-Xinit)<r && Math.abs(y-Yinit)<r)) continue
    else {
      this.mines[this.tabId+'_'+x+'_'+y]=-8;
      for (var n1=-1;n1<2;n1++)
        for (var n2=-1;n2<2;n2++){
          curVal=++this.board[y+n1][x+n2];
          if (curVal<9 && curVal>maxDigit) maxDigit=curVal;
        }
      this.board[y][x]=9;
      steps--;
    }
  }
  this.maxDigit=maxDigit;
};

Board.prototype.checkCell=function(x,y,user){
  if (!this.checked[x+'_'+y]){
    var val=this.board[y][x]<9?this.board[y][x]:-8;
    var re={id:this.tabId,user:user,coords:[x,y],value:val,points:val,cells:{}};
    re.cells[this.tabId+'_'+x+'_'+y]=val;
    if (val>=0){
      this.empty--;
      this.checked[x+'_'+y]=1;
      if (val==0)
        this.addNeighbors(re,x,y);
    }
    re.flag='Cells'
    if (val==-8)
      re.flag='Bomb'
    if (this.empty==0)
      re.flag='Complete'
    return re;
  }
};

Board.prototype.addNeighbors=function(re,x,y){
  for (var ni=-1;ni<2;ni++)
    for (var nj=-1;nj<2;nj++){
      var xCur=x+nj;
      var yCur=y+ni;
      if (xCur>0 && xCur<this.sizeX+1 && yCur>0 && yCur<this.sizeY+1){
        if (this.checked[xCur+'_'+yCur]) continue
        else { 
          this.checked[xCur+'_'+yCur]=1;
          this.empty--;
          re.points+=this.board[yCur][xCur];
          re.cells[this.tabId+'_'+xCur+'_'+yCur]=this.board[yCur][xCur];
          if (this.board[yCur][xCur]==0)
            this.addNeighbors(re,xCur,yCur);
        }
      }
    }
};

module.exports=Board;
