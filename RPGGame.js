var Game=require('./Game');
var Player=require('./RPGPlayer');
	
function RPGGame(pars) {
	Game.call(this, pars);
	this.actors={};
	for (var u in this.players) {
		if(!this.profiles[u]) this.profiles[u]={};
		this.actors[u]=new Player(this,this.profiles[u].equip||[]);
	}
}

RPGGame.prototype = new Game;

RPGGame.prototype.restoreLives = function () {
	this.livesLost=0;
	this.livesTotal=0;
	for (var u in this.players) {
		this.profiles[u].livesLost=0;
		this.livesTotal+=8;
	}
};

RPGGame.prototype.equipGear = function (e) {
	if (e.pars.length==0 || e.pars.length>8 ) return;
	var user=this.actors[e.user];
	
	if ( user.equip || this.inBattle ) return;
		
	user.equip=e.pars;
	this.emitEvent('client', e.user, 'system', 'Message','Equipped '+user.equip);
};

RPGGame.prototype.cancelAction = function (e) {
	var user=this.actors[e.user];
	this.assertAliveAndInBattle(user);
	this.assertNotCoolDown(user);
	user.cancelAction();
};

RPGGame.prototype.assertActiveState=function(user){
	if (user.profile.state!="active") return;
};

RPGGame.prototype.assertNotCoolDown=function(user){
	if (user.profile.state=="cooldown") return;
};

RPGGame.prototype.assertNotSelf=function(user,tgt){
	if (user.profile.name==tgt.profile.name) return;
};

RPGGame.prototype.assertAliveAndInBattle=function(user){
	if (!this.inBattle) return;
	if (user.profile.livesLost==8 || user.profile.hp==0) {
		this.emitEvent('client', e.user, 'system', 'Message','You are dead now, and cannot do that');
		return;
	}	
};

RPGGame.prototype.trySetPlayerState = function (userName,state) {
	var user=this.actors[userName];
	this.assertAliveAndInBattle(user);
	this.assertNotCoolDown(user);
	user.setState(user.profile,state);
};

RPGGame.prototype.setParryState = function (e) {
	this.trySetPlayerState(e.user,"parry");
};

RPGGame.prototype.setEvadeState = function (e) {
	this.trySetPlayerState(e.user,"evade");
};	

RPGGame.prototype.assistAttack = function (e) {
	var user=this.actors[e.user], tgt=this.actors[e.pars[0]||"boss"];
	this.assertAliveAndInBattle(user);
	this.assertNotSelf(user,tgt);
	if (user.profile.state=="active" && tgt.profile.state=="attack") user.addAssist(tgt);
};

RPGGame.prototype.hitTarget = function (e) {
	var user=this.actors[e.user],tgt=this.actors[e.pars[0]||"boss"];
	this.assertAliveAndInBattle(user);
	this.assertActiveState(user);
	this.assertNotSelf(user,tgt);
	user.startAttack(tgt);
};

RPGGame.prototype.sendUserVote = function (user, eventKey) {
	this.emitEvent('party', this.id, 'system', 'Message', user+'voted for '+eventKey);
	this.emitEvent('party', this.id, 'game', 'GameUserVote', {user:user,eventKey:eventKey});
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

RPGGame.prototype.canCheckCell=function(genericCheckResult,user){
	return genericCheckResult;
};

module.exports=RPGGame;
