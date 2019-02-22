var RPGMechanics=require("./RPGMechanics");
	
function Player(game,equip){
	this.game=game;
	this.equip=equip;
}

Player.prototype={
	
	adjustProfile:function(template){
		var power={"common":1,"rare":2,"epic":3};
		var effects={"maxhp":1,"patk":1,"pdef":1,"speed":1};
		this.profile=this.equip.reduce(function(prev,cur){
			var gem=cur.split("_");
			if (effects[gem[1]] && power[gem[0]] )prev[gem[1]]+=power[gem[0]];
			return prev;
		},template);
		this.profile.equip=this.equip;
		return this.profile;
	},
		
	setState:function(profile,state,arg){
		if (profile.state==state) return;
		var game=this.game;
		profile.state=state;
		if(this.game.actors.boss) this.game.actors.boss.onState(profile,state,arg);
		game.emitEvent('party', game.id, 'game', 'ChangeState', { profile:profile, user:profile.name, state:profile.state, val:arg });
	},
	
	applyCoolDown:function(players){
		var self=this;
		var game=this.game;
		var avoidCooldownChance=0.5;
		players.forEach(function(p){
			var profile=game.profiles[p.name];
			if (p.time>0 && Math.random()>avoidCooldownChance ) {
				if (game.actors[p.name].timer) {
					clearTimeout(game.actors[p.name].timer);
					game.actors[p.name].timer=null;
				}
				self.setState.call(self,profile,"cooldown",p.time);
				game.actors[p.name].timer=setTimeout(function(){ self.setState.call(self,profile,"active"); }, p.time);
			} else if ( p.attacker || profile.state!="attack") {
				self.setState.call(self,profile,"active");
			}
		});
	},

	cancelAction:function(){
		var me=this.profile;
		this.setState(me,"active");
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer=null;
		}
	},

	addAssist:function(tgt){
		var me=this.profile;
		if (!tgt.profile.assists) tgt.profile.assists={};
		tgt.profile.assists[me.name]=me;
		this.setState(this.profile,"assist",tgt.profile.name);
	},

	startAttack:function(tgt){
		var me=this.profile;
		this.setState(me,"attack",tgt.profile.name);
		if (tgt.onStartAttack) tgt.onStartAttack(me);
		this.timer=setTimeout(function(){ tgt.onEndAttack(me); },1000);
	},

	onEndAttack:function(atkProfile){
		
		function addCoolDown(cd,profile,time,attacker){
			cd.push({ name:profile.mob?"boss":profile.name, time:time, attacker:attacker });
			for (var a in profile.assists) cd.push({name:a,time:time, attacker:attacker});
			return cd;
		}
		var cooldowns;
		var defCooldownHit=1000;
		var atkCooldownMiss=1500;
		var noCooldown=0;
		
		var game=this.game;
		var defProfile=this.profile;
		var re={dmg:0,eventKey:'hitDamage'};
		
		var adjustedAtk={ 
			bossRatio:atkProfile.bossRatio, livesLost:atkProfile.livesLost, 
			patk:atkProfile.patk||1, speed:atkProfile.speed
		};
		for (var a in atkProfile.assists) {
			adjustedAtk.patk+=(atkProfile.assists[a].patk||1);
			adjustedAtk.speed+=atkProfile.assists[a].speed;
			adjustedAtk.livesLost+=atkProfile.assists[a].livesLost;
		}

		var chances=RPGMechanics.calcAtkChances.call(game,adjustedAtk,defProfile);
			
		if (atkProfile.hp==0) {
			// this.applyCoolDown(addCoolDown([],defProfile,noCooldown));
			return;
		} else if (defProfile.hp==0) {
			this.applyCoolDown(addCoolDown([],atkProfile,noCooldown,true));
			return;
		} else if ( chances[defProfile.state] && chances[defProfile.state].result) {
			re.eventKey=chances[defProfile.state].eventKey;
			re.chance=chances[defProfile.state].chance;
			cooldowns=addCoolDown([],atkProfile,atkCooldownMiss,true);
			cooldowns=addCoolDown(cooldowns,defProfile,noCooldown);
		} else {
			var dmg=adjustedAtk.patk;
			if (chances.crit.result) {
				dmg*=2;
				defCooldownHit*=2;
				re.eventKey=chances.crit.eventKey;
				re.chance=chances.crit.chance;
			}
			var armorEndureChance=0.5;
			armorEndureChance+=0.1*(adjustedAtk.patk-defProfile.pdef);
			if (defProfile.pdef+1>dmg) {
				if ( defProfile.armorEndurance==0 && defProfile.pdef>0 ){
					re.eventKey='hitPdefDecrease';
					defProfile.pdef--;
					defProfile.armorEndurance=RPGMechanics.constants.ARMOR_ENDURANCE;
					cooldowns=addCoolDown([],atkProfile,atkCooldownMiss/2,true);
					cooldowns=addCoolDown(cooldowns,defProfile,defCooldownHit/2);
				} else {
					re.eventKey='hitBlocked';
					if (RPGMechanics.rollDice("fightArmorEndure",armorEndureChance)) defProfile.armorEndurance--;
					cooldowns=addCoolDown([],atkProfile,atkCooldownMiss,true);
					cooldowns=addCoolDown(cooldowns,defProfile,noCooldown);
				}
			} else {
				defProfile.hp--;
				defProfile.wasHit=true;
				re.dmg=dmg;
				cooldowns=addCoolDown([],atkProfile,noCooldown,true);
				cooldowns=addCoolDown(cooldowns,defProfile,defCooldownHit);
			}
		}
		
		atkProfile.assists=null;

		game.onResultHitTarget(re,atkProfile,defProfile);

		if (!game.inBattle){
			cooldowns=addCoolDown([],atkProfile,noCooldown,true);
			cooldowns=addCoolDown(cooldowns,defProfile,noCooldown);
		}

		this.applyCoolDown(cooldowns);
	}
};

module.exports=Player;