var Coop=require('./Coop.js');
var Versus=require('./Versus.js');
var Rank=require('./Rank.js');
var constr={coop:Coop,versus:Versus,rank:Rank};
var pars=JSON.parse(process.argv[2]);
var game= new constr[pars.mode](pars)
game.on('message',function(e){process.send(e)});
process.on('message', function(e){game.dispatchEvent(e);});
