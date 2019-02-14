var Game=require('./Game.js');
	
function RPGGame(pars) {
	Game.call(this, pars);
	for (var u in this.players) if(!this.profiles[u]) this.profiles[u]={};
	this.floor=1;
	this.loot={};
	this.recipes=[];
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
	this.lostCoords={};
	this.digitPocket={};
	this.bossLevel=1;
};

RPGGame.prototype.adjustLivesLost=function(profile){
	if (profile.mob) return 1;
	return Math.sqrt((8-profile.livesLost)/9);
};

RPGGame.prototype.calcFloorCompleteRatio=function(bossLevel,bSize,stat){
	var ratio=1;
	var times={"small":10.0,"medium":40.0,"big":120.0};
	var bossLevelRatio={ 1:0.8, 2:0.9, 3:1, 4:1.1, 5:1.2, 6:1.3, 7:1.5, 8:2};
	ratio*=bossLevelRatio[bossLevel];
	var timeRatio=(times[bSize]-stat.time)/times[bSize];
	if (timeRatio<0) timeRatio=1;
	ratio*=Math.sqrt(timeRatio);
	return ratio;
};

RPGGame.prototype.adjustBossRatio=function(profile){
	if (profile.mob) return profile.bossRatio;
	return 1;
};	

RPGGame.prototype.calcAtk = function (atkProfile,defProfile) {
	var re={dmg:0,eventKey:'hitDamage',attack:atkProfile.name,defense:defProfile.name};
	var evadeChance=0.2;
	evadeChance+=0.1*(defProfile.speed-atkProfile.speed);
	evadeChance*=this.adjustLivesLost(defProfile);
	evadeChance*=this.adjustBossRatio(defProfile);
	if (Math.random()<=evadeChance) {
		re.eventKey='hitEvaded';
		re.chance=evadeChance;
		return re;
	}
	var parryChance=0.2;
	parryChance+=0.1*(defProfile.patk-atkProfile.patk);
	parryChance*=this.adjustLivesLost(defProfile);
	parryChance*=this.adjustBossRatio(defProfile);
	if (Math.random()<=parryChance){
		re.eventKey='hitParried';
		re.chance=parryChance;
		return re;
	}
	var atk=atkProfile.patk+1;
	var critChance=0.1;
	critChance+=0.1*(atkProfile.speed-defProfile.speed);
	critChance*=this.adjustLivesLost(atkProfile);
	critChance*=this.adjustBossRatio(atkProfile);
	if (Math.random()<=critChance){
		atk*=2;
		re.eventKey='hitDamageCrit';
		re.chance=critChance;
	}
	var armorEndureChance=0.5;
	armorEndureChance+=0.1*(atkProfile.patk-defProfile.pdef);
	if (defProfile.pdef+1>atk) {
		re.eventKey='hitBlocked';
		if (Math.random()<armorEndureChance) defProfile.armorEndurance--;
		if (defProfile.armorEndurance<1 && defProfile.pdef>0){
			re.eventKey='hitPdefDecrease';
			defProfile.pdef--;
			defProfile.armorEndurance=2;
		}
		return re;
	}
	re.dmg=atk;
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
	if (userProfile.speed>bossProfile.speed) fasterRatio=Math.sqrt((userProfile.speed+1)/(bossProfile.speed+1));
	
	var spotChance=0.2*bossProfile.stealAttempts/fasterRatio;
	if (Math.random()<spotChance){
		bossProfile.spottedStealing=true;
		bossProfile.patk=Math.ceil(1.3*(bossProfile.patk+1));
		bossProfile.speed=Math.ceil(1.3*(bossProfile.speed+1));
		this.emitEvent('party', this.id, 'system', 'Message', 'Stealing failed. Spotted');
		this.emitEvent('party', this.id, 'game', 'StealFailed', 
			{ user:e.user, spotted:true, profiles:this.profiles, chance:spotChance }
		);
		return;
	}
	
	var stealChance=fasterRatio/bossProfile.level*Math.sqrt(bossProfile.stealAttempts)/8;
	stealChance*=this.adjustLivesLost(userProfile);
	if (Math.random()<stealChance) {
		this.inBattle=false;
		this.emitEvent('party', this.id, 'game', 'StealSucceeded',  { user:e.user,chance:stealChance } );
		this.completeFloor({eventKey:'endBattleStole'});
	} else {
		this.emitEvent('party', this.id, 'system', 'Message', 'Stealing failed');
		this.emitEvent('party', this.id, 'game', 'StealFailed', { user:e.user,spotted:false,chance:stealChance } );
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
	this.recipes=[];
	this.loot={};
	this.floor=1;
};

RPGGame.prototype.sendUserVote = function (user, eventKey) {
	this.emitEvent('party', this.id, 'system', 'Message', user+'voted for '+eventKey);
	this.emitEvent('party', this.id, 'game', 'GameUserVote', {user:user,eventKey:eventKey});
};

RPGGame.prototype.fleeBattle = function (e) {
	if (!this.inBattle || this.profiles.boss.spottedStealing) return;
	this.voteFlee[e.user]=true;
	this.sendUserVote(e.user,"battleFlee");
	var voteFleeAccepted=true;
	for (var p in this.players) if(!this.voteFlee[p]) voteFleeAccepted=false;
	if (voteFleeAccepted) {
		this.fledPreviousBattle=true;
		this.resetBoard({eventKey:'endBattleFlee',result:"flee",floor:this.floor,lives:this.livesTotal});
	}
};

RPGGame.prototype.ascendToFloor1 = function (e) {
	if (!this.floorCompleted) return;
	this.voteAscend[e.user]=true;
	this.sendUserVote(e.user,"battleAscend");
	var voteAscendAccepted=true;
	for (var p in this.players) if(!this.voteAscend[p]) voteAscendAccepted=false;
	if (voteAscendAccepted) {
		this.resetBoard({eventKey:'completeFloorAscend',result:"win",floor:this.floor,loot:this.loot,recipes:this.recipes});
		this.resetFloor();
	}
};

RPGGame.prototype.descendToNextFloor = function (e) {
	if (!this.floorCompleted) return;
	// this.voteDescend[e.user]=true;
	this.sendUserVote(e.user,"battleDescend");
	var voteDescendAccepted=true;
	// for (var p in this.players) if(!this.voteDescend[p]) voteDescendAccepted=false;
	if (voteDescendAccepted) {
		this.floor++;
		this.resetBoard({result:"continue",floor:this.floor,eventKey:'completeFloorDescend',user:e.user});
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
	var effects=["maxhp","patk","pdef","speed"];
	if (this.knowledgePresence && e.eventKey!='endBattleStole'){
		var effect=effects[Math.floor(Math.random()*4)];
		this.recipes.push(effect);
		e.effect=effect;
	}
	this.emitEvent('party', this.id, 'game', 'CompleteFloor', e);
};

RPGGame.prototype.onResetBoard = function (e) {
	this.inBattle=false;
	this.floorCompleted=false;
	this.knowledgePresence=false;
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
		this.emitEvent('party', this.id, 'system', 'Message', re.user+' died');
		this.emitEvent('party', this.id, 'game', 'UserDied', {user:re.user});
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

RPGGame.prototype.genBossEquip=function(floor,bossLevel,bSize,stat){
	var equip=[];
	var effects=["maxhp","patk","pdef","speed"];
	var gemCount=floor;
	while (gemCount>0) {
		equip.push( "common_"+effects[Math.floor(Math.random()*4)] );
		gemCount--;
	}
	return equip;
};

RPGGame.prototype.adjustProfile=function(equip,template){
	template.equip=equip;
	var power={"common":1,"rare":2,"epic":3};
	var effects={"maxhp":1,"patk":1,"pdef":1,"speed":1};
	var skipPdef=this.fledPreviousBattle;
	return equip.reduce(function(prev,cur){
		var gem=cur.split("_");
		if (gem[1]=='pdef' && skipPdef) return prev;
		if (effects[gem[1]] && power[gem[0]] )prev[gem[1]]+=power[gem[0]];
		return prev;
	},template);
};

RPGGame.prototype.startBattle = function () {
	
	this.inBattle=true;
	
	var stat=this.getGenericStat();

	this.totalHp=0;

	for (var u in this.players){
		var userProfile=this.adjustProfile(
			this.profiles[u].equip||[],
			{"maxhp":0,"patk":0,"pdef":0,"speed":0,"armorEndurance":2,"level":8,"name":u,"livesLost":this.profiles[u].livesLost}
		);
		userProfile.hp=userProfile.level-userProfile.livesLost+userProfile.maxhp;
		if (userProfile.livesLost<8) this.totalHp+=userProfile.hp;
		this.profiles[u]=userProfile;
	}
	
	for (var p in this.profiles) if (!this.players[p]) delete this.profiles[p];
	
	var bossProfile=this.adjustProfile(
		this.genBossEquip(this.floor,this.bossLevel,this.bSize,stat),
		{"maxhp":0,"patk":0,"pdef":0,"speed":0,"armorEndurance":2,"level":this.bossLevel,"mob":1}
	);
	
	var recipeChance=0.1;
	if (this.fledPreviousBattle || this.floor<3) recipeChance=0;
	this.fledPreviousBattle=false;
	
	this.knowledgePresence=Math.random()<recipeChance;

	var names=['angry','hungry','greedy','grumpy'];
	bossProfile.name=(this.knowledgePresence?'wise':names[Math.floor(names.length*Math.random())])+' Phoenix';
	bossProfile.hp=bossProfile.level+bossProfile.maxhp;
	this.profiles.boss=bossProfile;
	bossProfile.bossRatio=this.calcFloorCompleteRatio(this.bossLevel,this.bSize,stat);
	
	this.emitEvent('party', this.id, 'system', 'Message', 'Start Battle vs '+ bossProfile.name);
	this.emitEvent('party', this.id, 'game', 'StartBattleLocal', {
		key:'startBattle',profiles:this.profiles,knowledgePresence:this.knowledgePresence,
		time:stat.time, floor:this.floor, livesLost:this.livesLost, bossName:bossProfile.name
	});
};

RPGGame.prototype.onComplete = function (re) {
	this.addCells(re.cells);
	this.openCells(re.cells);
	this.openCells(this.board.mines);
	if (!this.inBattle) this.startBattle();
};

module.exports=RPGGame;
