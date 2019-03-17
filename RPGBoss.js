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

Boss.prototype.decideParryEvade=function(atkProfile){
	if (!atkProfile) return null;
	var me=this;
	var state=null;
	var deltaEvade=me.profile.speed>atkProfile.speed;
	var deltaParry=me.profile.patk-atkProfile.patk;
	if (deltaEvade>0) state="evade";
	if (deltaParry>deltaEvade) state="parry";
	// if (state) console.log("can ",state);
	return state;
};

Boss.prototype.decideWillBlock=function(atkProfile){
	if (!atkProfile) return false;
	var me=this;
	var willBlock = me.profile.pdef>atkProfile.patk;
	return willBlock;
};

Boss.prototype.decideCancelAttack=function(atkProfile){
	if (!atkProfile) return false;
	return this.decideWillBlock(atkProfile) || this.decideParryEvade(atkProfile);
};

Boss.prototype.isUnderAttack=function(){
	return this.underAttack;
};

Boss.prototype.isMeAliveAndActive=function(){
	return this.profile.hp>0 && this.profile.state!="cooldown" && this.profile.state!="attack";
};
Boss.prototype.isTargetAlive=function(tgt){
	return tgt.profile.hp>0;
};

Boss.prototype.onState_active=function(isitme,profile){
	if (!isitme) return;
	var me=this;
	var atkProfile=me.isUnderAttack();
	var state=this.decideParryEvade(atkProfile);
	var willParryEvade=state && me.randomDecision(3/2);
	var willBlock = me.decideWillBlock(atkProfile) && me.randomDecision(1);
	// console.log("boss active");
	if (atkProfile){
		// console.log("boss under attack",atkProfile.name);
		if (willBlock) {
			// console.log("boss will block");
			return;
		} else if (willParryEvade) {
			// console.log("boss will set state",state);
			this.setState(me.profile,state);
			return;
		}
	}
	var tgt=this.getRandomTarget();
	if (tgt) me.waitAndAttack(tgt);
};

Boss.prototype.randomDecision=function(ratio){
	return Math.random()<RPGMechanics.constants.BASIC_CHANCE*ratio;
}

Boss.prototype.waitAndAttack=function(tgt){
	var me=this;
	// console.log("boss will wait and attack");
	setTimeout( function(){
		if( me.isMeAliveAndActive() && !me.decideCancelAttack(me.isUnderAttack()) && me.isTargetAlive(tgt) ) {
			// console.log("boss attacks");
			me.startAttack.call(me,tgt);
		}
	},RPGMechanics.constants.BOSS_ATTACK_DELAY_TIME);
};

Boss.prototype.onState_cooldown=function(isitme,profile,arg){
	if (isitme ) return;
	// console.log("found profile in cooldown",profile.name);
	var me=this, tgt=this.game.actors[profile.name];
	if ( me.isMeAliveAndActive() && !me.decideWillBlock(me.isUnderAttack()) ) me.waitAndAttack(tgt);
};

Boss.prototype.onState_assist=function(isitme,profile,arg){
	console.log(profile.name,arg);
};

Boss.prototype.onStartAttack=function(atkProfile){

	var me=this, tgt=this.game.actors[atkProfile.name];	
	// console.log(atkProfile.name,"started attack",me.profile.name,me.profile.state);
	var wasUnderAttack=me.isUnderAttack();
	if (wasUnderAttack) console.log("boss was already under attack",wasUnderAttack.name);
	me.underAttack=atkProfile;
	
	if (me.profile.state=="cooldown") return;

	var state=this.decideParryEvade(atkProfile);
	var willParryEvade=state && me.randomDecision(1);
	var willCancelAttack=me.decideCancelAttack(atkProfile) && me.randomDecision(1/3);
	var willBlock = me.decideWillBlock(atkProfile) && me.randomDecision(3/2);

	if (me.profile.state=="attack"){
		if (willCancelAttack) {
			// console.log("boss decided to cancel attack");
			me.cancelAction(); // onState_active handler will do proper stuff when called later
		}
	} else if (willBlock){
		return;
	} else if(willParryEvade) {
		this.setState(me.profile,state);
	} else me.waitAndAttack(tgt);

};

module.exports=Boss;