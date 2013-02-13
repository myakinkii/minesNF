var Coop=require('./Coop.js');
var Versus=require('./Versus.js');
var Rank=require('./Rank.js');
module.exports.modes={
     rank:{constr:Rank,s:{min:1,max:1},m:{min:1,max:1},b:{min:1,max:1}},
     coop:{constr:Coop,s:{min:2,max:2},m:{min:2,max:3},b:{min:2,max:4}},
     versus:{constr:Versus,s:{min:2,max:2},m:{min:2,max:3},b:{min:2,max:4}}
  };
module.exports.boards={
    s:{bSize:'small',r:8,c:8,b:10},
    m:{bSize:'medium',r:16,c:16,b:40},
    b:{bSize:'big',c:30,r:16,b:99}
  };
