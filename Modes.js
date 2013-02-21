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

module.exports.ranks={
/*    s:{1:30,2:20,3:15,4:11,5:8,6:5,7:3,8:2},
    m:{1:100,2:60,3:50,4:40,5:30,6:25,7:20,8:15},
    b:{1:300,2:200,3:150,4:120,5:100,6:80,7:70,8:60}*/
    'small':[2,3,5,8,11,15,20,30],
    'medium':[15,20,25,30,40,50,60,100],
    'big':[60,70,80,100,120,150,200,300]
  };

