var RPGMechanics=require("./RPGMechanics");
	
function Player(game,equip){
	this.game=game;
	this.equip=equip;
	this.interruptableStates=["attack","cast"];
}

Player.prototype={
	
	adjustProfile:function(template){
		var power={"common":1,"rare":2,"epic":3};
		template=RPGMechanics.gems.reduce(function(prev,cur){ prev[cur.eft]=0; return prev; },template);
		template.armorEndurance=RPGMechanics.constants.ARMOR_ENDURANCE;
		template.state="active";
		template.spells={};
		template.equip=this.equip;
		this.profile=this.equip.reduce(function(prev,cur){
			var gem=cur.split("_"),e=gem[1],p=gem[0];
			if ( prev[e]>=0 && power[p] ) {
				prev[e]+=power[p];
				if(RPGMechanics.spells[e]) prev.spells[e]=prev[e];
			}
			return prev;
		},template);
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
		players.forEach(function(p){
			var profile=game.profiles[p.name];
			var avoidCooldown=self.interruptableStates.indexOf(profile.state)>-1 && Math.random()<RPGMechanics.constants.AVOID_COOLDOWN_CHANCE;
			if (p.time>0 && !avoidCooldown) {
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

	defendTarget:function(tgt){
		var me=this.profile;
		tgt.profile.defender=me.name;
		this.setState(this.profile,"defend",tgt.profile.name);
	},

	startAttack:function(tgt){
		var me=this.profile;
		this.setState(me,"attack",tgt.profile.name);
		if (tgt.onStartAttack) tgt.onStartAttack(me);
		this.timer=setTimeout(function(){ tgt.onEndAttack(me); },RPGMechanics.constants.ATTACK_TIME);
	},

	onEndAttack:function(atkProfile){
		
		function addCoolDown(cd,profile,time,attacker){
			cd.push({ name:profile.mob?"boss":profile.name, time:time, attacker:attacker });
			for (var a in profile.assists) cd.push({name:a,time:time, attacker:attacker});
			return cd;
		}
				
		var game=this.game;
		var defProfile=this.profile;
		var defName=defProfile.defender;
		if (defName) {
			defProfile.defender=null;
			defProfile=game.profiles[defName];
		}
		
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

		var chances=RPGMechanics.calcAtkChances(adjustedAtk,defProfile);
		var cooldowns;
		var defCooldown=RPGMechanics.constants.COOLDOWN_HIT;
			
		if (atkProfile.hp==0) {
			return;
		} else if (defProfile.hp==0) {
			this.applyCoolDown(addCoolDown([],atkProfile,RPGMechanics.constants.NO_COOLDOWN_TIME,true));
			return;
		} else if ( chances[defProfile.state] && chances[defProfile.state].result) {
			re.eventKey=chances[defProfile.state].eventKey;
			re.chance=chances[defProfile.state].chance;
			cooldowns=addCoolDown([],atkProfile,RPGMechanics.constants.COOLDOWN_MISS,true);
			cooldowns=addCoolDown(cooldowns,defProfile,RPGMechanics.constants.NO_COOLDOWN_TIME);
		} else {
			var dmg=adjustedAtk.patk;
			if (chances.crit.result) {
				dmg*=2;
				defCooldown*=2;
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
					cooldowns=addCoolDown([],atkProfile,RPGMechanics.constants.COOLDOWN_MISS/2,true);
					cooldowns=addCoolDown(cooldowns,defProfile,defCooldown/2);
				} else {
					re.eventKey='hitBlocked';
					if (RPGMechanics.rollDice("fightArmorEndure",armorEndureChance)) defProfile.armorEndurance--;
					cooldowns=addCoolDown([],atkProfile,RPGMechanics.constants.COOLDOWN_MISS,true);
					cooldowns=addCoolDown(cooldowns,defProfile,RPGMechanics.constants.NO_COOLDOWN_TIME);
				}
			} else {
				defProfile.hp--;
				defProfile.wasHit=true;
				re.dmg=dmg;
				cooldowns=addCoolDown([],atkProfile,RPGMechanics.constants.NO_COOLDOWN_TIME,true);
				cooldowns=addCoolDown(cooldowns,defProfile,defCooldown);
			}
		}
		
		atkProfile.assists=null;

		game.onResultHitTarget(re,atkProfile,defProfile);

		if (!game.inBattle){
			cooldowns=addCoolDown([],atkProfile,RPGMechanics.constants.NO_COOLDOWN_TIME,true);
			cooldowns=addCoolDown(cooldowns,defProfile,RPGMechanics.constants.NO_COOLDOWN_TIME);
		}

		this.applyCoolDown(cooldowns);
	},

	startCastSpell:function(spell,tgt){
		var me=this;
		this.setState(me.profile,"cast",tgt.profile.name);
		this.timer=setTimeout(function(){ me.onEndCastSpell(spell,tgt); },RPGMechanics.constants.CAST_TIME);
	},

	onEndCastSpell:function(spell,tgt){
		var game=this.game;
		var re={spell:spell,eventKey:'spellCast'};
		var srcProfile=this.profile;
		var tgtProfile=tgt?tgt.profile:srcProfile;
		this.setState(srcProfile,"active");
		if (this.profile.hp==0 || tgtProfile.hp==0) {
			return;
		} else {
			srcProfile.spells[spell]--;
			RPGMechanics.spells[spell](srcProfile,tgtProfile);
		}
		game.onResultSpellCast(re,srcProfile,tgtProfile);
	}

};

module.exports=Player;