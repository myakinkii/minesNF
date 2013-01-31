var Coop=require('./Coop.js');
var Versus=require('./Versus.js');
var Rank=require('./Rank.js');
var constr={
  coop:Coop,
  coopM:Coop,
  coopB:Coop,
  versus:Versus,
  versusM:Versus,
  versusB:Versus,
  rank:Rank,
  rankM:Rank,
  rankB:Rank};
var pars=JSON.parse(process.argv[2]);
pars.multiThread=1;
var game= new constr[pars.mode](pars)
game.on('message',function(e){process.send(e)});
process.on('message', function(e){game.dispatchEvent(e);});
