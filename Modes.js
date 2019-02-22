var Coop=require('./Coop.js');
var Versus=require('./Versus.js');
var Rank=require('./Rank.js');
var RPGCoop=require('./RPGCoop.js');

module.exports.modes={
     rank:{constr:Rank,s:{min:1,max:1},m:{min:1,max:1},b:{min:1,max:1}},
     soloRPG:{constr:RPGCoop,s:{min:1,max:1},m:{min:1,max:1},b:{min:1,max:1}},
     coop:{constr:Coop,s:{min:2,max:2},m:{min:2,max:3},b:{min:2,max:4}},
     coopRPG:{constr:RPGCoop,s:{min:1,max:2},m:{min:1,max:3},b:{min:1,max:4}},
     versus:{constr:Versus,s:{min:2,max:2},m:{min:2,max:3},b:{min:2,max:4}}
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

