var RPGGame=require('./RPGGame');
var Boss=require('./RPGBoss');
var RPGMechanics=require("./RPGMechanics");

function RPGCoopGame(pars) {
	RPGGame.call(this, pars);
	this.boardPars=pars.board;
	this.boardDensityDelta={"small":1,"medium":2,"big":4}[pars.board.bSize];
	this.floor=1;
	this.recipes=[];
	this.loot={};
}

RPGCoopGame.prototype = new RPGGame;

RPGCoopGame.prototype.onStartBoard = function () {
	this.voteFlee={};
	this.voteAscend={};
	this.voteDescend={};
	if (!this.fledPreviousBattle) this.restoreLives();
	this.lostCoords={};
	this.digitPocket={};
	this.bossLevel=1;
};

RPGCoopGame.prototype.stealLoot = function (e) {
	
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
	if (RPGMechanics.rollDice("stealSpotted",spotChance)){
		bossProfile.spottedStealing=true;
		bossProfile.patk=Math.ceil(1.3*(bossProfile.patk+1));
		bossProfile.speed=Math.ceil(1.3*(bossProfile.speed+1));
		this.actors.boss.refreshApStats.call(this.actors.boss,bossProfile);
		this.emitEvent('party', this.id, 'system', 'Message', 'Stealing failed. Spotted');
		this.emitEvent('party', this.id, 'game', 'StealFailed', 
			{ user:e.user, spotted:true, profiles:this.profiles, chance:spotChance }
		);
		return;
	}
	
	var stealChance=fasterRatio/bossProfile.level*Math.sqrt(bossProfile.stealAttempts)/8;
	stealChance*=RPGMechanics.adjustLivesLost(userProfile);
	if (RPGMechanics.rollDice("stealSucceed",stealChance)){
		this.inBattle=false;
		this.stopBoss();
		this.emitEvent('party', this.id, 'game', 'StealSucceeded',  { user:e.user,chance:stealChance } );
		this.completeFloor({eventKey:'endBattleStole'});
	} else {
		this.emitEvent('party', this.id, 'system', 'Message', 'Stealing failed');
		this.emitEvent('party', this.id, 'game', 'StealFailed', { user:e.user,spotted:false,chance:stealChance } );
	}
};

RPGCoopGame.prototype.resetFloor = function () {
	this.fledPreviousBattle=false;
	this.recipes=[];
	this.loot={};
	this.orbs={};
	this.floor=1;
	this.board.bombs=this.boardPars.b;
};

RPGCoopGame.prototype.fleeBattle = function (e) {
	if (!this.inBattle || this.profiles.boss.spottedStealing) return;
	this.voteFlee[e.user]=true;
	this.sendUserVote(e.user,"battleFlee");
	var voteFleeAccepted=true;
	for (var p in this.players) if(!this.voteFlee[p]) voteFleeAccepted=false;
	if (voteFleeAccepted) {
		this.fledPreviousBattle=true;
		this.stopBoss();
		this.resetBoard({eventKey:'endBattleFlee',result:"flee",floor:this.floor,lives:this.livesTotal});
	}
};

RPGCoopGame.prototype.stopBoss = function () {
	// if (this.actors.boss.timer) clearTimeout(this.actors.boss.timer);
	clearTimeout(this.actors.boss.apTimer);
	this.actors.boss.apTimer=null;
};

RPGCoopGame.prototype.ascendToFloor1 = function (e) {
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

RPGCoopGame.prototype.descendToNextFloor = function (e) {
	if (!this.floorCompleted) return;
	// this.voteDescend[e.user]=true;
	this.sendUserVote(e.user,"battleDescend");
	var voteDescendAccepted=true;
	// for (var p in this.players) if(!this.voteDescend[p]) voteDescendAccepted=false;
	if (voteDescendAccepted) {
		this.floor++;
		this.board.bombs+=this.boardDensityDelta;
		this.resetBoard({result:"continue",floor:this.floor,eventKey:'completeFloorDescend',user:e.user});
	}
};

RPGCoopGame.prototype.completeFloor = function (e) {
	this.floorCompleted=true;
	for (var d in this.digitPocket){
		if (!this.loot[d]) this.loot[d]=0;
		this.loot[d]+=this.digitPocket[d];
	}
	e.loot=this.loot;
	e.floor=this.floor;
	var floorFilter=Math.ceil(this.floor/5);
	var effects=RPGMechanics.gems.filter(function(g){ return g.rarity>0 && g.rarity<=floorFilter }).map(function(g){ return g.eft; });
	if (this.knowledgePresence && e.eventKey!='endBattleStole'){
		var effect=effects[Math.floor(Math.random()*effects.length)];
		this.recipes.push(effect);
		e.effect=effect;
	}
	this.emitEvent('party', this.id, 'game', 'CompleteFloor', e);
};

RPGCoopGame.prototype.onResetBoard = function (e) {
	this.inBattle=false;
	this.floorCompleted=false;
	this.knowledgePresence=false;
	this.emitEvent('party', this.id, 'system', 'Message', 'Floor result: '+e.eventKey);
	this.emitEvent('party', this.id, 'game', 'ShowResultRPGCoop', e);
};

RPGCoopGame.prototype.onCells = function (re) {
	this.addCells(re.cells);
	this.addOrbs(re.user,this.calcOrbs(re.cells));
	this.openCells(re.cells);
};

RPGCoopGame.prototype.canCheckCell=function(genericCheckResult,user){
	return genericCheckResult && this.profiles[user].livesLost<8;
};

RPGCoopGame.prototype.onBomb = function (re) {
	var coord=re.coords[0]+"_"+re.coords[1];
	if (!this.lostCoords[coord]){
		this.lostCoords[coord]=0;
		this.livesLost++;
		this.profiles[re.user].livesLost++;
		this.livesTotal--;
		this.emitEvent('party', this.id, 'game', 'UserLostLife', {user:re.user,livesLost:this.profiles[re.user].livesLost});
	}
	if (this.profiles[re.user].livesLost==8) {
		this.emitEvent('client', re.user, 'system', 'Message', 'You have lost all your lives');
		this.emitEvent('party', this.id, 'system', 'Message', re.user+' died');
		this.emitEvent('party', this.id, 'game', 'UserDied', {user:re.user});
	}
	if (this.livesTotal==0){
		this.openCells(this.board.mines);
		re.eventKey="endBattleLostAllLives";
		re.floor=this.floor;
		re.time=this.getGenericStat().time;
		this.resetBoard(re);
		this.resetFloor();
	} else {
		this.lostCoords[coord]++;
		this.openCells(re.cells);
	}
};

RPGCoopGame.prototype.startBattle = function () {
	var rpg=RPGMechanics;
	
	this.inBattle=true;
	
	var stat=this.getGenericStat();

	this.totalHp=0;

	for (var u in this.players){
		var userProfile=this.actors[u].adjustProfile({ "level":8, "name":u, "livesLost":this.profiles[u].livesLost });
		if (this.fledPreviousBattle) userProfile.pdef=this.profiles[u].pdef;
		if (userProfile.livesLost<8) userProfile.hp=userProfile.level-userProfile.livesLost+userProfile.maxhp;
		else userProfile.hp=0;
		this.totalHp+=userProfile.hp;
		this.profiles[u]=userProfile;
	}
	
	for (var p in this.profiles) if (!this.players[p]) delete this.profiles[p];
	
	this.actors.boss=new Boss(this, RPGMechanics.genBossEquip(this.floor,this.bossLevel,this.bSize,stat) );
	var bossProfile=this.actors.boss.adjustProfile({ "level":this.bossLevel, "mob":1 });
	
	var recipeChance=0.1;
	var wiseBosses={ 
		small:{ 5:1.5, 6:2, 7:2, 8:3 },
		medium:{ 6:1.5, 7:2, 8:3 },
		big:{ 6:1.25, 7:2, 8:3 }
	};
	if (wiseBosses[this.bSize][this.bossLevel]) recipeChance*=wiseBosses[this.bSize][this.bossLevel];
	var wiseFloors={small:3,medium:2,big:1};
	if (this.fledPreviousBattle || this.floor<wiseFloors[this.bSize]) recipeChance=0;
	this.fledPreviousBattle=false;
	this.knowledgePresence=RPGMechanics.rollDice("recipeFind",recipeChance);

	var names=['angry','hungry','greedy','grumpy'];
	bossProfile.name=(this.knowledgePresence?'wise':names[Math.floor(names.length*Math.random())])+' Phoenix';
	bossProfile.hp=bossProfile.level+bossProfile.maxhp;
	this.profiles.boss=bossProfile;
	bossProfile.bossRatio=RPGMechanics.calcFloorCompleteRatio(this.bossLevel,this.bSize,stat);
	
	this.emitEvent('party', this.id, 'system', 'Message', 'Start Battle vs '+ bossProfile.name);
	this.emitEvent('party', this.id, 'game', 'StartBattleCoop', {
		key:'startBattle',profiles:this.profiles,knowledgePresence:this.knowledgePresence,
		time:stat.time, floor:this.floor, livesLost:this.livesLost, bossName:bossProfile.name
	});
};

RPGCoopGame.prototype.checkBattleComplete = function (re,atkProfile,defProfile) {
	if ( re.dmg && !defProfile.mob) this.totalHp--;
	if (defProfile.mob && defProfile.hp==0) {
		this.inBattle=false;
		this.stopBoss();
		this.completeFloor({eventKey:'endBattleWin'});
	} else if (!defProfile.mob && this.totalHp==0){
		this.inBattle=false;
		this.stopBoss();
		if (this.pauseOnBattleLost) {
			this.pauseOnBattleLost();
		} else {
			this.resetBoard({eventKey:'endBattleLose', floor:this.floor});
			this.resetFloor();
		}
	}
};

RPGCoopGame.prototype.onComplete = function (re) {
	this.addCells(re.cells);
	this.addOrbs(re.user,this.calcOrbs(re.cells));
	this.openCells(re.cells);
	this.openCells(this.board.mines);
	if (!this.inBattle) this.startBattle();
};

module.exports=RPGCoopGame;
