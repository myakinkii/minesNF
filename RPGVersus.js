var RPGGame=require('./RPGGame');
var RPGMechanics=require("./RPGMechanics");

function RPGVersusGame(pars) {
	RPGGame.call(this, pars);
}

RPGVersusGame.prototype = new RPGGame;

RPGVersusGame.prototype.onStartBoard = function () {
	this.restoreLives();
	this.digitPocket={};
	this.lostCoords={};
	this.openFirstCell();
};

RPGVersusGame.prototype.onResetBoard = function (e) {
	this.inBattle=false;
	this.emitEvent('party', this.id, 'system', 'Message', 'Result: '+e.eventKey);
	this.emitEvent('party', this.id, 'game', 'ShowResultRPGVersus', e);
};

RPGVersusGame.prototype.onCells = function (re) {
	this.addCells(re.cells);
	this.addOrbs(re.user,this.calcOrbs(re.cells));
	this.openCells(re.cells);
};

RPGVersusGame.prototype.onBomb = function (re) {
	var coord=re.coords[0]+"_"+re.coords[1];
	if (!this.lostCoords[coord]){
		this.lostCoords[coord]=1;
		this.profiles[re.user].livesLost++;
		this.openCells(re.cells);
		this.emitEvent('party', this.id, 'game', 'UserLostLife', {user:re.user,livesLost:this.profiles[re.user].livesLost});
	}
};

RPGVersusGame.prototype.startBattle = function () {
	var rpg=RPGMechanics;
	
	this.inBattle=true;
	
	var stat=this.getGenericStat();

	for (var u in this.players){
		var userProfile=this.actors[u].adjustProfile({
			"maxhp":0,"patk":0,"pdef":0,"speed":0,"armorEndurance":RPGMechanics.constants.ARMOR_ENDURANCE,
			"level":8, "name":u, "state":"active", "livesLost":this.profiles[u].livesLost
		});
		userProfile.hp=userProfile.level-userProfile.livesLost+userProfile.maxhp;
		if (userProfile.hp<1) userProfile.hp=1;
		this.profiles[u]=userProfile;
	}
	
	for (var p in this.profiles) if (!this.players[p]) delete this.profiles[p];
	
	this.emitEvent('party', this.id, 'system', 'Message', 'Start versus battle');
	this.emitEvent('party', this.id, 'game', 'StartBattleVersus', {
		key:'startBattle',profiles:this.profiles, time:stat.time, loot:this.digitPocket
	});
};

RPGVersusGame.prototype.checkBattleComplete = function (re,atkProfile,defProfile) {
	var lastStand=[];
	for (var p in this.profiles) if (this.profiles[p].hp>0) lastStand.push(p);
	if (lastStand.length==1) this.resetBoard({
		eventKey:'endBattle', 
		won:lastStand[0], 
		loot:this.digitPocket,
		stat:this.getGenericStat()
	});
};

RPGVersusGame.prototype.onComplete = function (re) {
	this.addCells(re.cells);
	this.addOrbs(re.user,this.calcOrbs(re.cells));
	this.openCells(re.cells);
	this.openCells(this.board.mines);
	if (!this.inBattle) this.startBattle();
};

module.exports=RPGVersusGame;
