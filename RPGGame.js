var Game=require('./Game');
var Player=require('./RPGPlayer');
var RPGMechanics=require("./RPGMechanics");
	
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
	
	if ( user.equip.length>0 || this.inBattle ) return;
		
	user.equip=e.pars;
	this.emitEvent('client', e.user, 'system', 'Message','Equipped '+user.equip);
};

RPGGame.prototype.assertNotBusyState=function(user){
	if (["attack","cast","cooldown"].indexOf(user.profile.state)>-1) throw "busy";
};

RPGGame.prototype.assertActiveState=function(user){
	if (user.profile.state!="active") throw "not active";
};

RPGGame.prototype.assertNotCoolDown=function(user){
	if (user.profile.state=="cooldown") throw "cooldown";
};

RPGGame.prototype.assertNotSelf=function(user,tgt){
	if (user.profile.name==tgt.profile.name) throw "self";
};

RPGGame.prototype.assertSpellExist=function(spell){
	if (!RPGMechanics.spells[spell]) throw "spell not exist";
};

RPGGame.prototype.assertAliveTarget=function(tgt){
	if (!tgt || !tgt.profile) throw "incorrect tgt";
	if (tgt.profile.hp==0) throw "target dead";
};

RPGGame.prototype.assertAliveAndInBattle=function(user){
	if (!this.inBattle) throw "not in battle";
	if (user.profile.livesLost==8 || user.profile.hp==0) {
		this.emitEvent('client', user, 'system', 'Message','You are dead now, and cannot do that');
		throw "dead";
	}	
};

RPGGame.prototype.assertEnoughAP=function(user,action){
	if (user.profile.curAP < RPGMechanics.actionCostAP[action]) throw "not enough AP";
};

RPGGame.prototype.cancelAction = function (e) {
	var user=this.actors[e.user];
	try {
		this.assertAliveAndInBattle(user);
		this.assertNotCoolDown(user);
		user.cancelAction();
	} catch (e) {}
};

RPGGame.prototype.trySetPlayerState = function (userName,state) {
	var user=this.actors[userName];
	try {
		this.assertAliveAndInBattle(user);
		this.assertNotCoolDown(user);
		user.setState(user.profile,state);
	} catch (e) {}
};

RPGGame.prototype.setParryState = function (e) {
	this.trySetPlayerState(e.user,"parry");
};

RPGGame.prototype.setEvadeState = function (e) {
	this.trySetPlayerState(e.user,"evade");
};	

RPGGame.prototype.assistAttack = function (e) {
	var user=this.actors[e.user], tgt=this.actors[e.pars[0]||"boss"];
	try {
		this.assertAliveAndInBattle(user);
		this.assertNotCoolDown(user);
		this.assertNotSelf(user,tgt);
		this.assertEnoughAP(user,"assist");
		if (user.profile.state!="attack" && tgt.profile.state=="attack") user.addAssist(tgt);
	} catch (e) {}
};

RPGGame.prototype.defendTarget = function (e) {
	var user=this.actors[e.user], tgt=this.actors[e.pars[0]||"boss"];
	try {
		this.assertAliveAndInBattle(user);
		this.assertNotSelf(user,tgt);
		this.assertEnoughAP(user,"defend");
		if (user.profile.state=="active" && !tgt.profile.mob) user.defendTarget(tgt);
	} catch (e) {}
};

RPGGame.prototype.hitTarget = function (e) {
	var user=this.actors[e.user],tgt=this.actors[e.pars[0]||"boss"];
	try {
		this.assertAliveTarget(tgt);
		this.assertAliveAndInBattle(user);
		this.assertNotBusyState(user);
		this.assertNotSelf(user,tgt);
		this.assertEnoughAP(user,"hit");
		user.startAttack(tgt);
	} catch (e) {}
};

RPGGame.prototype.castSpell = function (e) {
	var user=this.actors[e.user],tgt=this.actors[e.pars[1]||e.user];
	var spell=e.pars[0];
	try {
		this.assertAliveTarget(tgt);
		this.assertSpellExist(spell);
		this.assertAliveAndInBattle(user);
		this.assertNotBusyState(user);
		if( user.profile.mana>0 ) user.startCastSpell(spell,tgt);
		// if( user.profile.spells[spell].mp>0 ) user.startCastSpell(spell,tgt);
	} catch (e) {}
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

RPGGame.prototype.onResultHitTarget = function (re,atkProfile,defProfile) {
	re.profiles=this.profiles;
	re.attack=atkProfile.name;
	re.defense=defProfile.name;
	this.emitEvent('party', this.id, 'game', 'ResultHitTarget', re);
	if (this.checkBattleComplete) this.checkBattleComplete(re,atkProfile,defProfile);
};

RPGGame.prototype.onResultSpellCast = function (re,srcProfile,tgtProfile){
	re.profiles=this.profiles;
	re.source=srcProfile.name;
	re.target=tgtProfile.name;
	this.emitEvent('party', this.id, 'game', 'ResultCastSpell', re);
	if (this.checkBattleComplete) this.checkBattleComplete(re,srcProfile,tgtProfile);
};

module.exports=RPGGame;
