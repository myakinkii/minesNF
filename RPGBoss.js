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
	// console.log("boss active");
	if (tgt) setTimeout( function(){
		if( me.profile.state!="cooldown" && me.profile.state!="attack" && me.profile.hp>0 && tgt.profile.hp>0 ) {
			// console.log("boss will attack");
			me.startAttack.call(me,tgt);
		}
	},RPGMechanics.constants.BOSS_ATTACK_DELAY_TIME );
};

Boss.prototype.onState_assist=function(isitme,profile,arg){
	console.log(profile.name,arg);
};	

Boss.prototype.onStartAttack=function(atkProfile){
	var me=this, tgt=this.game.actors[atkProfile.name];
	// console.log("boss under attack",me.profile.name,me.profile.state);
	if (me.profile.state=="cooldown") return;
	var state=null;
	if (me.profile.speed>atkProfile.speed) state="evade";
	else if (me.profile.patk>atkProfile.patk) state="parry";
	var willParryEvade=state && Math.random()<RPGMechanics.constants.BASIC_CHANCE*3/4;
	var willNotCancelAttack=(me.profile.patk>=atkProfile.pdef) && Math.random()<RPGMechanics.constants.BASIC_CHANCE*3/4;
	var willBlock = (atkProfile.patk<me.profile.pdef) && Math.random()<RPGMechanics.constants.BASIC_CHANCE*3/4;
	if (willParryEvade) {
		if (!me.timer){
			// console.log("boss set state",state);
			this.setState(me.profile,state);
		} else if (!willNotCancelAttack) {
			// console.log("boss clear my attack");
			me.cancelAction();
			// console.log("boss set state",state);
			this.setState(me.profile,state);
		}
	} else { // block or attack
		 if (willBlock) {
			//  console.log("boss will block");
			 if (me.timer) me.cancelAction();
		} else setTimeout(function(){ 
			if( me.profile.state!="cooldown" && me.profile.state!="attack" && me.profile.hp>0 && tgt.profile.hp>0 ) {
				// console.log("boss will attack");
				me.startAttack.call(me,tgt); 
			}
		}, RPGMechanics.constants.BOSS_ATTACK_DELAY_TIME/2 );
	}
};

module.exports=Boss;