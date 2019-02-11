var pars=JSON.parse(process.argv[2]);
pars.multiThread=1;
var GameFN=require('./Modes.js').modes[pars.mode].constr;
var game= new GameFN(pars);
game.on('message',function(e){process.send(e)});
process.on('message', function(e){game.dispatchEvent(e);});
