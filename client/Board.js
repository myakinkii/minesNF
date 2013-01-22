function Board(parent,id,r,c,div){
  this.parent=parent;
  this.id=id;
  this.r=r;
  this.c=c;
  this.view={};
  this.cells={};
  var self=this;
  render.call(this,['#'+this.id+'board',[
                      'table',this.id,null,this.r,this.c,function(tableId,r,c,tdEl){
                          var cell=new Cell(self,tableId,r+1,c+1,tdEl);
                          }]
                   ],div);

};

Board.prototype.endGame=function(message){
alert(message);
};

Board.prototype.checkCellValue=function(cellId){
  this.parent.checkCellValue(cellId);
};

Board.prototype.getCellValues=function(values){
  for (var i in values)
    this.cells[i].setCellValue(values[i]);
};

function Cell(parent,tableId,r,c,TDelement){
this.parent=parent;
this.TDelement=TDelement;
this.id=tableId+'_'+c+'_'+r;
this.r=r;
this.c=c;
this.view={};
render.call(this,['aimg','cell.png','x',15,15,this.id,'cell',{'onmousedown':this.clickCell}],TDelement);
this.parent.cells[this.id]=this;
}

Cell.prototype.clickCell=function(e){
  if (!this.parent.stopClicking)
  this.parent.checkCellValue(this.id);
};

Cell.prototype.setCellValue=function(value){
  if (value==-8)
    value='X';
  this.TDelement.removeChild(this.TDelement.firstChild);
  if (value!=0)
    render.call(this,['span','Cell'+value,value],this.TDelement);
};

