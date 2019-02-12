var Game=require('./Game.js');

function RPGGame(pars) {
	Game.call(this, pars);
	for (var u in this.players) if(!this.profiles[u]) this.profiles[u]={};
	this.floor=1;
	this.loot={};
};

RPGGame.prototype = new Game;

RPGGame.prototype.onStartBoard = function () {
	this.voteFlee={};
	this.voteAscend={};
	this.voteDescend={};
	if (!this.fledPreviousBattle){
		this.livesLost=0;
		this.livesTotal=0;
		for (var u in this.players) {
			this.profiles[u].livesLost=0;
			this.livesTotal+=8;
		}
	}
	this.fledPreviousBattle=false;
	this.lostCoords={};
	this.digitPocket={};
	this.bossLevel=1;
};

RPGGame.prototype.calcAtk = function (atkProfile,defProfile) {
	var re={dmg:0,eventKey:'hitDamage',attack:atkProfile.name,defense:defProfile.name};
	var evadeChance=0.2;
	evadeChance+=0.1*(defProfile.speed-atkProfile.speed);
	if (Math.random()<=evadeChance) {
		re.eventKey='hitEvaded';
		return re;
	}
	var parryChance=0.2;
	parryChance+=0.1*(defProfile.patk-defProfile.patk);
	if (Math.random()<=parryChance){
		re.eventKey='hitParried';
		return re;
	}
	var atk=atkProfile.patk+1;
	var critChance=0.1;
	critChance+=0.1*(atkProfile.speed-defProfile.speed);
	if (Math.random()<=critChance){
		atk*=2;
		re.eventKey='hitDamageCrit';
	}
	if (defProfile.pdef+1>atk) re.eventKey='hitBlocked';
	else re.dmg=atk;
	return re;
};

RPGGame.prototype.equipGear = function (e) {
	if (e.pars.length==0 || e.pars.length>8 ) return;
	var userProfile=this.profiles[e.user];
	if (this.inBattle || userProfile.livesLost==8)  {
		this.emitEvent('client', e.user, 'system', 'Message','You are in either dead, or in battle now! No time for that stuff');
		return;
	}
	userProfile.equip=e.pars;
	this.emitEvent('client', e.user, 'system', 'Message','Equipped '+userProfile.equip);
};

RPGGame.prototype.stealLoot = function (e) {
	
	var userProfile=this.profiles[e.user],bossProfile=this.profiles.boss;
	
	if (!this.inBattle || bossProfile.wasHit || bossProfile.spottedStealing) return;

	if (userProfile.livesLost==8 || userProfile.hp==0) {
		this.emitEvent('client', e.user, 'system', 'Message','You are dead now, and cannot do that');
		return;
	}
	
	if (!bossProfile.stealAttempts) bossProfile.stealAttempts=0;
	bossProfile.stealAttempts++;
	
	var fasterRatio=1;
	if (userProfile.speed>bossProfile.speed) fasterRatio=(userProfile.speed+1)/(bossProfile.speed+1);
	
	var spotChance=0.2*bossProfile.stealAttempts/fasterRatio;
	if (Math.random()<spotChance){
		bossProfile.spottedStealing=true;
		bossProfile.patk+=2;
		bossProfile.speed+=2;
		this.emitEvent('party', this.id, 'system', 'Message', 'Stealing failed. Spotted');
		this.emitEvent('party', this.id, 'game', 'StealFailed', {user:e.user,spotted:true,profiles:this.profiles});
		return;
	}
	
	var stealChance=fasterRatio/bossProfile.level/Math.sqrt(bossProfile.stealAttempts)/8;

	if (Math.random()<stealChance) {
		this.inBattle=false;
		this.completeFloor({eventKey:'endBattleStole'});
	} else {
		this.emitEvent('party', this.id, 'system', 'Message', 'Stealing failed');
		this.emitEvent('party', this.id, 'game', 'StealFailed', {user:e.user,spotted:false});
	}
};


RPGGame.prototype.hitMob = function (e) {
	
	if (!this.inBattle) return;
	var userProfile=this.profiles[e.user],bossProfile=this.profiles.boss;

	if (userProfile.livesLost==8 || userProfile.hp==0) {
		this.emitEvent('client', e.user, 'system', 'Message','You are dead now, and cannot do that');
		return;
	}

	var re={};
	
	var hitResult=this.calcAtk(userProfile,bossProfile);
	if (hitResult.dmg) { 
		bossProfile.hp--;
		bossProfile.wasHit=true;
	}
	hitResult.profiles=this.profiles;
	this.emitEvent('party', this.id, 'game', 'ResultHitMob', hitResult);
	this.emitEvent('party', this.id, 'system', 'Message',[hitResult.eventKey,userProfile.name,'>',bossProfile.name,'(',bossProfile.hp,')'].join(' '));
	
	hitResult=this.calcAtk(bossProfile,userProfile);
	if (hitResult.dmg)  {
		userProfile.hp--;
		this.totalHp--;
	}
	hitResult.profiles=this.profiles;
	this.emitEvent('party', this.id, 'game', 'ResultHitMob', hitResult);
	this.emitEvent('party', this.id, 'system', 'Message',[hitResult.eventKey,bossProfile.name,'>',userProfile.name,'(',userProfile.hp,')'].join(' '));
	
	if (bossProfile.hp==0) {
		this.inBattle=false;
		re.eventKey='endBattleWin';
		this.completeFloor(re);
	} else if (this.totalHp==0){
		this.inBattle=false;
		re.eventKey='endBattleLose';
		re.floor=this.floor;
		this.resetBoard(re);
		this.resetFloor();
	}
};

RPGGame.prototype.resetFloor = function () {
	this.loot={};
	this.floor=1;
};

RPGGame.prototype.fleeBattle = function (e) {
	if (!this.inBattle) return;
	this.voteFlee[e.user]=true;
	var voteFleeAccepted=true;
	for (var p in this.players) if(!this.voteFlee[p]) voteFleeAccepted=false;
	if (voteFleeAccepted) {
		this.fledPreviousBattle=true;
		this.resetBoard({eventKey:'endBattleFlee'});
	}
};

RPGGame.prototype.ascendToFloor1 = function (e) {
	if (!this.floorCompleted) return;
	this.voteAscend[e.user]=true;
	var voteAscendAccepted=true;
	for (var p in this.players) if(!this.voteAscend[p]) voteAscendAccepted=false;
	if (voteAscendAccepted) {
		this.resetBoard({eventKey:'completeFloorAscend',result:"win",floor:this.floor,loot:this.loot});
		this.resetFloor();
	}
};

RPGGame.prototype.descendToNextFloor = function (e) {
	if (!this.floorCompleted) return;
	// this.voteDescend[e.user]=true;
	var voteDescendAccepted=true;
	// for (var p in this.players) if(!this.voteDescend[p]) voteDescendAccepted=false;
	if (voteDescendAccepted) {
		this.floor++;
		this.resetBoard({floor:this.floor,eventKey:'completeFloorDescend',user:e.user});
	}
};

RPGGame.prototype.completeFloor = function (e) {
	this.floorCompleted=true;
	for (var d in this.digitPocket){
		if (!this.loot[d]) this.loot[d]=0;
		this.loot[d]+=this.digitPocket[d];
	}
	e.loot=this.loot;
	e.floor=this.floor;
	this.emitEvent('party', this.id, 'game', 'CompleteFloor', e);
};

RPGGame.prototype.onResetBoard = function (e) {
	this.inBattle=false;
	this.floorCompleted=false;
	this.emitEvent('party', this.id, 'system', 'Message', 'Floor result: '+e.eventKey);
	this.emitEvent('party', this.id, 'game', 'ShowResultLocal', e);
};

RPGGame.prototype.onCells = function (re) {
	this.addCells(re.cells);
	this.openCells(re.cells);
};

RPGGame.prototype.addCells = function (cells) {
	var i,n;
	for (i in cells) {
		n=cells[i];
		if(n>0) {
			if (!this.digitPocket[n]) this.digitPocket[n]=0;
			this.digitPocket[n]++;
			if (n>this.bossLevel) this.bossLevel=n;
		}
	}
};

RPGGame.prototype.checkCell=function(e){
	var x=parseInt(e.pars[0])||0;
	var y=parseInt(e.pars[1])||0;
	var re;
	if ( !(x<1 || x>this.board.sizeX) && !(y<1 || y>this.board.sizeY) ){
	  if (this.logStart==0) this.board.init(x,y,2);
	  if (!this.pause && this.profiles[e.user].livesLost<8) re=this.board.checkCell(x,y,e.user);
	}
	if (re){
	  this.logEvent(re);
	  this['on'+re.flag].call(this,re);
	}
  };

RPGGame.prototype.onBomb = function (re) {
	var coord=re.coords[0]+"_"+re.coords[1];
	if (!this.lostCoords[coord]){
		this.lostCoords[coord]=0;
		this.livesLost++;
		this.profiles[re.user].livesLost++;
		this.livesTotal--;
	}
	if (this.profiles[re.user].livesLost==8) {
		this.emitEvent('client', re.user, 'system', 'Message', 'You have lost all your lives');
	}
	if (this.livesTotal==0){
		this.openCells(this.board.mines);
		re.lostBeforeBossBattle=true;
		re.eventKey="endBattleLostAllLives";
		// this.resetBoard(re);
		re.floor=this.floor;
		re.time=this.getGenericStat().time;
		this.resetBoard(re);
		this.resetFloor();
	} else {
		this.lostCoords[coord]++;
		this.openCells(re.cells);
	}
};

RPGGame.prototype.adjustProfile=function(equip,template){
	template.equip=equip;
	var power={"common":1,"rare":2,"epic":3};
	return equip.reduce(function(prev,cur){
		prev[cur.effect]+=power[cur.rarity];
		return prev;
	},template);
};

RPGGame.prototype.genBossEquip=function(bossLevel,bSize,stat){
	var equip=[];
	var rnd=["maxhp","patk","pdef","speed"];
	var rarities={small:['common','common'],medium:['rare','common'],big:['epic','rare']};
	var times={"s":10,"m":40,"b":120};
	while (bossLevel>0) {
		bossLevel--; 
		equip.push({
			effect:rnd[Math.floor(Math.random()*4)],
			rarity: (Math.random()<0.5*times[bSize]/stat.time)?rarities[bSize][0]:rarities[bSize][1]
		});
	}
	return equip;
};

RPGGame.prototype.adjustProfile=function(equip,template){
	template.equip=equip;
	var power={"common":1,"rare":2,"epic":3};
	var effects={"maxhp":1,"patk":1,"pdef":1,"speed":1};
	return equip.reduce(function(prev,cur){
		var gem=cur.split("_");
		if (effects[gem[1]] && power[gem[0]] )prev[gem[1]]+=power[gem[0]];
		return prev;
	},template);
};

RPGGame.prototype.genBossEquip=function(bossLevel,bSize,stat){
	var equip=[],effect,rarity;
	var rnd=["maxhp","patk","pdef","speed"];
	var rarities={small:['common','common'],medium:['rare','common'],big:['epic','rare']};
	var times={"s":10,"m":40,"b":120};
	while (bossLevel>0) {
		bossLevel--; 
		effect=rnd[Math.floor(Math.random()*4)];
		rarity=(Math.random()<0.5*times[bSize]/stat.time)?rarities[bSize][0]:rarities[bSize][1];
		equip.push(rarity+"_"+effect);
	}
	return equip;
};

RPGGame.prototype.startBattle = function () {
	
	this.inBattle=true;
	
	var stat=this.getGenericStat();

	this.totalHp=0;

	for (var u in this.players){
		var userProfile=this.adjustProfile(
			this.profiles[u].equip||[],
			{"maxhp":0,"patk":0,"pdef":0,"speed":0,"level":8,"name":u,"livesLost":this.profiles[u].livesLost}
		);
		userProfile.hp=userProfile.level-userProfile.livesLost+userProfile.maxhp;
		if (userProfile.livesLost<8) this.totalHp+=userProfile.hp;
		this.profiles[u]=userProfile;
	}
	
	var bossProfile=this.adjustProfile(
		this.genBossEquip(this.bossLevel,this.bSize,stat),
		{"maxhp":0,"patk":0,"pdef":0,"speed":0,"level":this.bossLevel,"mob":1}
	);

	var names=['angry','hungry','greedy','grumpy'];
	bossProfile.name=names[Math.floor(names.length*Math.random())]+' Phoenix';
	bossProfile.hp=bossProfile.level+bossProfile.maxhp;
	this.profiles.boss=bossProfile;
	
	var names=[]; 
	for (var p in this.players) names.push(p);
	this.emitEvent('party', this.id, 'system', 'Message', 'Start Battle: '+names.join(',')+' vs '+ bossProfile.name);
	this.emitEvent('party', this.id, 'game', 'StartBattleLocal', {
		key:'startBattle',time:stat.time, floor:this.floor, profiles:this.profiles,
		userName:names.join(','), livesLost:this.livesLost,
		bossName:bossProfile.name, bossLevel:bossProfile.level
	});
};

RPGGame.prototype.onComplete = function (re) {
	this.addCells(re.cells);
	this.openCells(re.cells);
	this.openCells(this.board.mines);
	if (!this.inBattle) this.startBattle();
};

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

module.exports=RPGGame;
