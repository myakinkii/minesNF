var Player=require("./RPGPlayer");
var RPGMechanics=require("./RPGMechanics");
	
function Boss(game,equip){
	Player.call(this, game, equip);
	this.mob=1;
}

Boss.prototype = new Player;

Boss.prototype.getTargets=function(){
	var targets=[];
	for (var p in this.game.profiles) if (!this.game.profiles[p].mob && this.game.profiles[p].hp>0) targets.push(p);
	return targets;
};

Boss.prototype.getRandomTarget=function(){
	var targets=this.getTargets();
	var random=targets[Math.floor(Math.random()*targets.length)];
	return this.game.actors[random];
};

Boss.prototype.onState=function(profile,state,arg){
	var isitme=(profile.name==this.profile.name);
	if (this['onState_'+state]) this['onState_'+state](isitme,profile,state,arg);
};

Boss.prototype.onState_active=function(isitme,profile){
	if (!isitme) return;
	var tgt=this.getRandomTarget();
	var me=this;
	if (tgt) setTimeout( function(){
		if( me.profile.hp>0 && tgt.profile.hp>0 ) me.startAttack.call(me,tgt);
	},RPGMechanics.constants.BOSS_ATTACK_DELAY_TIME);
};

Boss.prototype.onState_assist=function(isitme,profile,arg){
	console.log(profile.name,arg);
};	

Boss.prototype.onStartAttack=function(atkProfile){
	var me=this.profile;
	if (me.state=="attack") return;
	var state=null;
	if (me.speed>atkProfile.speed) state="evade";
	else if (me.patk>atkProfile.patk) state="parry";
	if (state) this.setState(me,state);
	else this.startAttack(this.game.actors[atkProfile.name]);
};

module.exports=Boss;