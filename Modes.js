var CoopGame=require('./Coop');
var VersusGame=require('./Versus');
var RankGame=require('./Rank');
var RPGCoopGame=require('./RPGCoop');
var RPGVersusGame=require('./RPGVersus');

module.exports.Board=require('./Board');

module.exports.RPGMechanics=require('./RPGMechanics');

module.exports.modes={
     rank:{constr:RankGame,s:{min:1,max:1},m:{min:1,max:1},b:{min:1,max:1}},
     soloRPG:{constr:RPGCoopGame,s:{min:1,max:1},m:{min:1,max:1},b:{min:1,max:1}},
     coop:{constr:CoopGame,s:{min:2,max:2},m:{min:2,max:3},b:{min:2,max:4}},
     coopRPG:{constr:RPGCoopGame,s:{min:1,max:2},m:{min:1,max:3},b:{min:1,max:4}},
     versus:{constr:VersusGame,s:{min:2,max:2},m:{min:2,max:3},b:{min:2,max:4}},
     versusRPG:{constr:RPGVersusGame,s:{min:2,max:2},m:{min:2,max:3},b:{min:2,max:4}}
  };

module.exports.boards={
    s:{bSize:'small',r:8,c:8,b:10},
    m:{bSize:'medium',r:16,c:16,b:40},
    b:{bSize:'big',c:30,r:16,b:99}
  };

module.exports.ranks={
    'small':[2,3,4,5,7,10,15,20],
    'medium':[15,20,25,30,40,50,60,100],
    'big':[60,70,85,100,120,150,200,300]
  };

