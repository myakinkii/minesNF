var RPGGame=require('./RPGGame');
var Boss=require('./RPGBoss');
var RPGMechanics=require("./RPGMechanics");

function RPGCoopGame(pars) {
	RPGGame.call(this, pars);
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

RPGCoopGame.prototype.equipGear = function (e) {
	if (e.pars.length==0 || e.pars.length>8 ) return;
	var user=this.actors[e.user];
	
	if ( user.equip || this.inBattle ) return;
		
	user.equip=e.pars;
	this.emitEvent('client', e.user, 'system', 'Message','Equipped '+user.equip);
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
		this.emitEvent('party', this.id, 'game', 'StealSucceeded',  { user:e.user,chance:stealChance } );
		this.completeFloor({eventKey:'endBattleStole'});
	} else {
		this.emitEvent('party', this.id, 'system', 'Message', 'Stealing failed');
		this.emitEvent('party', this.id, 'game', 'StealFailed', { user:e.user,spotted:false,chance:stealChance } );
	}
};

RPGCoopGame.prototype.cancelAction = function (e) {
	if (!this.inBattle) return;
	var user=this.actors[e.user];
	if(user.profile.state!="cooldown") user.cancelAction();
};

RPGCoopGame.prototype.assistAttack = function (e) {

	if (!this.inBattle) return;
	var user=this.actors[e.user], tgt=this.actors[e.pars[0]||"boss"];

	if (user.profile.livesLost==8 || user.profile.hp==0) {
		this.emitEvent('client', e.user, 'system', 'Message','You are dead now, and cannot do that');
		return;
	}

	if (user.profile.name==tgt.profile.name) return;
	
	if (user.profile.state=="active" && tgt.profile.state=="attack") user.addAssist(tgt);
};

RPGCoopGame.prototype.hitTarget = function (e) {
	
	if (!this.inBattle) return;	
	var user=this.actors[e.user],tgt=this.actors[e.pars[0]||"boss"];
	
	if (user.profile.livesLost==8 || user.profile.hp==0) {
		this.emitEvent('client', e.user, 'system', 'Message','You are dead now, and cannot do that');
		return;
	}
	
	if (user.profile.state!="active") return;
	
	user.startAttack(tgt);
};

RPGCoopGame.prototype.resetFloor = function () {
	this.fledPreviousBattle=false;
	this.recipes=[];
	this.loot={};
	this.floor=1;
};

RPGCoopGame.prototype.sendUserVote = function (user, eventKey) {
	this.emitEvent('party', this.id, 'system', 'Message', user+'voted for '+eventKey);
	this.emitEvent('party', this.id, 'game', 'GameUserVote', {user:user,eventKey:eventKey});
};

RPGCoopGame.prototype.fleeBattle = function (e) {
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
	var effects=["maxhp","patk","pdef","speed"];
	if (this.knowledgePresence && e.eventKey!='endBattleStole'){
		var effect=effects[Math.floor(Math.random()*4)];
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
	this.emitEvent('party', this.id, 'game', 'ShowResultLocal', e);
};

RPGCoopGame.prototype.onCells = function (re) {
	this.addCells(re.cells);
	this.openCells(re.cells);
};

RPGCoopGame.prototype.addCells = function (cells) {
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
		var userProfile=this.actors[u].adjustProfile({
			"maxhp":0,"patk":0,"pdef":0,"speed":0,"armorEndurance":RPGMechanics.constants.ARMOR_ENDURANCE,
			"level":8, "name":u, "state":"active", "livesLost":this.profiles[u].livesLost
		});
		if (this.fledPreviousBattle) userProfile.pdef=this.profiles[u].pdef;
		if (userProfile.livesLost<8) userProfile.hp=userProfile.level-userProfile.livesLost+userProfile.maxhp;
		else userProfile.hp=0;
		this.totalHp+=userProfile.hp;
		this.profiles[u]=userProfile;
	}
	
	for (var p in this.profiles) if (!this.players[p]) delete this.profiles[p];
	
	this.actors.boss=new Boss(this, RPGMechanics.genBossEquip(this.floor,this.bossLevel,this.bSize,stat) );
	var bossProfile=this.actors.boss.adjustProfile({
		"maxhp":0,"patk":0,"pdef":0,"speed":0,"armorEndurance":RPGMechanics.constants.ARMOR_ENDURANCE,
		"level":this.bossLevel, "mob":1, "state":"active"
	});
	
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
	this.emitEvent('party', this.id, 'game', 'StartBattleLocal', {
		key:'startBattle',profiles:this.profiles,knowledgePresence:this.knowledgePresence,
		time:stat.time, floor:this.floor, livesLost:this.livesLost, bossName:bossProfile.name
	});
};

RPGCoopGame.prototype.onComplete = function (re) {
	this.addCells(re.cells);
	this.openCells(re.cells);
	this.openCells(this.board.mines);
	if (!this.inBattle) this.startBattle();
};

module.exports=RPGCoopGame;
