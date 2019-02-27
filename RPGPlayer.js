var RPGMechanics=require("./RPGMechanics");
	
function Player(game,equip){
	this.game=game;
	this.equip=equip;
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

		var oldState=profile.state;
		var oldTarget=this.game.profiles[profile.target]||this.game.profiles.boss;
		if (oldState=='attack') {
			oldTarget.attackers--;
		}
		if (oldState=='assist') {
			delete oldTarget.assists[profile.name];
		}
		if (oldState=='defend') {
			oldTarget.defender=null;
		}
		if (['assist','defend','attack'].indexOf(state)>-1) profile.target=arg;
		else profile.target=null;

		var game=this.game;
		profile.state=state;
		if(game.actors.boss) game.actors.boss.onState(profile,state,arg);
		game.emitEvent('party', game.id, 'game', 'ChangeState', { profiles:game.profiles, user:profile.name, state:state, val:arg });
	},
	
	applyCoolDown:function(players){
		var self=this;
		var game=this.game;
		players.forEach(function(p){
			var profile=game.profiles[p.name];
			if (p.time>0) {
				if (game.actors[p.name].timer) {
					clearTimeout(game.actors[p.name].timer);
					game.actors[p.name].timer=null;
					if (!p.attacker) game.emitEvent('party', game.id, 'game', 'BattleLogEntry', {
						eventKey:'actionInterrupted', defense:profile.name
					});
				}
				// console.log("setCooldown "+p.time,profile.name);
				self.setState.call(self,profile,"cooldown",p.time);
				game.actors[p.name].timer=setTimeout(function(){ self.setState.call(self,profile,"active"); }, p.time);
			} else {
				// console.log("setActive 0",profile.name);
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
		if (!tgt.profile.attackers) tgt.profile.attackers=0;
		tgt.profile.attackers++;
		// console.log("startattack",me.name,tgt.profile.name);
		if (tgt.onStartAttack) tgt.onStartAttack.call(tgt,me);
		var adjustedAttackTime=RPGMechanics.constants.ATTACK_TIME-(100*me.speed);
		this.timer=setTimeout(function(){ tgt.onEndAttack.call(tgt,me); },adjustedAttackTime);
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
		// console.log("endattack",atkProfile.name,defProfile.name);

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

		var heDiedBefore=atkProfile.hp==0;
		var meDiedBefore=defProfile.hp==0;
		var parryEvadeSuccess=chances[defProfile.state] && chances[defProfile.state].result;

		var castOrattack=["attack","cast"].indexOf(defProfile.state)>-1;
		var notInterrupted=Math.random()<RPGMechanics.constants.AVOID_INTERRUPT_CHANCE;
		var getDamageButcontinue=castOrattack && notInterrupted;
		
		var cooldowns;
		var defCooldown=RPGMechanics.constants.COOLDOWN_HIT;

		if (heDiedBefore) {
			return;
		} else if (meDiedBefore) {
			this.applyCoolDown(addCoolDown([],atkProfile,RPGMechanics.constants.NO_COOLDOWN_TIME,true));
			return;
		} else if (parryEvadeSuccess) {
			// console.log(defProfile.name,defProfile.state,"parryEvadeSuccess -> atk cooldown");
			re.eventKey=chances[defProfile.state].eventKey;
			re.chance=chances[defProfile.state].chance;
			cooldowns=addCoolDown([],atkProfile,RPGMechanics.constants.COOLDOWN_MISS,true);
			cooldowns=addCoolDown(cooldowns,defProfile,RPGMechanics.constants.NO_COOLDOWN_TIME);
		} else if(getDamageButcontinue){
			defProfile.hp--;
			defProfile.wasHit=true;
			re.dmg=adjustedAtk.patk;
			cooldowns=addCoolDown([],atkProfile,RPGMechanics.constants.NO_COOLDOWN_TIME,true);
			// console.log(defProfile.name,defProfile.state,defProfile.hp,"getDamageButcontinue -> atk active");
		} else {
			// console.log(defProfile.name,defProfile.state,"willBlock");
			if (chances.crit.result) {
				adjustedAtk.patk*=2;
				defCooldown*=2;
				re.eventKey=chances.crit.eventKey;
				re.chance=chances.crit.chance;
			}
			var armorEndureChance=0.5;
			armorEndureChance+=0.1*(adjustedAtk.patk-defProfile.pdef);
			if (adjustedAtk.patk<defProfile.pdef+1) {
				if ( defProfile.armorEndurance==0 && defProfile.pdef>0 ){
					re.eventKey='hitPdefDecrease';
					defProfile.pdef--;
					defProfile.armorEndurance=RPGMechanics.constants.ARMOR_ENDURANCE;
					cooldowns=addCoolDown([],atkProfile,RPGMechanics.constants.COOLDOWN_MISS/2,true);
					cooldowns=addCoolDown(cooldowns,defProfile,defCooldown/2);
					// console.log(defProfile.name,defProfile.state,defProfile.pdef,re.eventKey," -> both cooldown");
				} else {
					re.eventKey='hitBlocked';
					if (RPGMechanics.rollDice("fightArmorEndure",armorEndureChance)) defProfile.armorEndurance--;
					cooldowns=addCoolDown([],atkProfile,RPGMechanics.constants.COOLDOWN_MISS,true);
					if (!castOrattack) cooldowns=addCoolDown(cooldowns,defProfile,RPGMechanics.constants.NO_COOLDOWN_TIME);
					// console.log(defProfile.name,defProfile.state,re.eventKey," -> atk cooldown");
				}
			} else {
				// console.log(defProfile.name,defProfile.state,"wasHit -> def cooldown");
				defProfile.hp--;
				defProfile.wasHit=true;
				re.dmg=adjustedAtk.patk;
				cooldowns=addCoolDown([],atkProfile,RPGMechanics.constants.NO_COOLDOWN_TIME,true);
				cooldowns=addCoolDown(cooldowns,defProfile,defCooldown);
			}
		}
		
		atkProfile.assists=null;
		if (game.actors.boss) game.actors.boss.underAttack=null;

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