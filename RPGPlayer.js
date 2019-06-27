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
		template.attackers=0;
		template.spells={};
		template.equip=this.equip;
		
		this.profile=this.equip.reduce(function(prev,cur){
			var gem=cur.split("_"),e=gem[1],p=gem[0];
			if ( prev[e]>=0 && power[p] ) {
				prev[e]+=power[p];
				// if(RPGMechanics.spells[e]) {
				// 	prev.spells[e]={mp:prev[e],spell:e};
				// 	prev.haveSpells=true;
				// }
			}
			return prev;
		},template);
		
		var profile=this.profile, game=this.game, self=this; 
		this.refreshApStats(profile);
		function apTickFn(){
			if (self.apTimer) self.apTimer=setTimeout(apTickFn,self.apTick);
			if (profile.curAP==profile.maxAP) return;
			profile.curAP++;
			if(game.actors.boss) game.actors.boss.onChangeAP(profile);
			game.emitEvent('party', game.id, 'game', 'ChangePlayerAP', { 
				profiles:game.profiles, user:profile.name, curAP:profile.curAP 
			});
		}
		if (this.apTimer) clearTimeout(this.apTimer);
		this.apTimer=setTimeout(apTickFn,this.apTick);
		
		return this.profile;
	},

	refreshApStats:function(profile){
		this.apTick=RPGMechanics.constants.AP_TICK-250*(profile.speed<12 ? Math.floor(profile.speed/3) : 4);
		this.profile.maxAP=3 + (profile.patk<12 ? Math.floor(profile.patk/4) : 3);
		this.profile.curAP=profile.curAP||0;
	},
		
	setState:function(profile,state,arg){
		if (profile.state==state) return;

		var oldState=profile.state;
		var oldTarget=this.game.profiles[profile.target]||this.game.profiles.boss;
		if (oldState=='attack') {
			oldTarget.attackers--;
		}
		if (oldState=='assist' ) {
			if (oldTarget.assists && oldTarget.assists[profile.name]) delete oldTarget.assists[profile.name];
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
				profile.curAP-=p.time;
				game.emitEvent('party', game.id, 'game', 'ChangePlayerAP', { profiles:game.profiles, user:profile.name, curAP:profile.curAP });
			}
			if (!p.attacker && game.actors[p.name].timer){
				if (profile.state!="cast" || Math.random()<RPGMechanics.constants.AVOID_INTERRUPT_CHANCE) return;
				clearTimeout(game.actors[p.name].timer);
				game.emitEvent( 'party', game.id, 'game', 'BattleLogEntry',
					{ eventKey:'actionInterrupted', defense:profile.name }
				);
			}
			self.setState.call(self,profile,"active");
			game.actors[p.name].timer=null;
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
		var game=this.game;
		var me=this.profile;
		tgt.profile.defender=me.name;
		me.curAP-=RPGMechanics.actionCostAP.defend;
		game.emitEvent('party', game.id, 'game', 'ChangePlayerAP', { profiles:game.profiles, user:me.name, curAP:me.curAP });
		this.setState(this.profile,"defend",tgt.profile.name);
	},

	startAttack:function(tgt){
		var me=this.profile;
		tgt.profile.attackers++;
		this.setState(me,"attack",tgt.profile.name);
		// console.log("startattack",me.name,tgt.profile.name);
		if (tgt.onAttackStarted) tgt.onAttackStarted.call(tgt,me);
		var adjustedAttackTime=RPGMechanics.constants.ATTACK_TIME-(100*me.speed);
		this.timer=setTimeout(function(){ tgt.onEndAttack.call(tgt,me); },adjustedAttackTime);
	},

	onEndAttack:function(atkProfile){

		var game=this.game;
		var defProfile=this.profile;
		var defName=defProfile.defender;
		if (defName) {
			defProfile.defender=null;
			defProfile=game.profiles[defName];
		}
		// console.log("endattack",atkProfile.name,defProfile.name);

		var addCoolDown=function(cd,profile,time,attacker){
			cd.push({ name:profile.mob?"boss":profile.name, time:time, attacker:attacker });
			for (var a in profile.assists) cd.push({name:a,time:time, attacker:attacker});
			return cd;
		};

		if ( atkProfile.hp==0 || defProfile.hp==0 || atkProfile.curAP<RPGMechanics.actionCostAP.hit ) {
			this.applyCoolDown(addCoolDown([],atkProfile,RPGMechanics.constants.NO_COOLDOWN_TIME,true));
			atkProfile.assists=null;
			if (game.actors.boss) game.actors.boss.onAttackEnded(atkProfile); //so that boss clears his underAttack
			return;
		}

		var adjustedAtk={ 
			bossRatio:atkProfile.bossRatio, livesLost:atkProfile.livesLost, 
			patk:atkProfile.patk+1, speed:atkProfile.speed
		};
		var a,asp;
		for (a in atkProfile.assists) {
			asp=atkProfile.assists[a];
			if (asp.curAP<RPGMechanics.actionCostAP.hit) continue;
			adjustedAtk.patk+=(asp.patk||1);
			adjustedAtk.speed+=asp.speed;
			adjustedAtk.livesLost+=asp.livesLost;
		}
		
		var chances=RPGMechanics.calcAtkChances(adjustedAtk,defProfile);
		var parryEvadeSuccess=chances[defProfile.state] && chances[defProfile.state].result;
		var parryEvadeCost=0;
		if (chances[defProfile.state]) parryEvadeCost+=RPGMechanics.constants.AP_PARRY_EVADE_COST;

		var castOrattack=["attack","cast"].indexOf(defProfile.state)>-1;
		
		var cooldowns;
		var defCooldown=RPGMechanics.constants.AP_HIT_COST;

		var re={dmg:0,eventKey:'hitDamage'};

		var willBlock=chances[defProfile.state]?false:true;
		if (defProfile.state=='assist') willBlock=false;

		if (parryEvadeSuccess) {
			// console.log(defProfile.name,defProfile.state,"parryEvadeSuccess -> atk cooldown");
			re.eventKey=chances[defProfile.state].eventKey;
			re.chance=chances[defProfile.state].chance;
			cooldowns=addCoolDown([],atkProfile,RPGMechanics.constants.AP_ATTACK_COST+RPGMechanics.constants.AP_MISS_COST,true);
			cooldowns=addCoolDown(cooldowns,defProfile,parryEvadeCost);
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
			if ( willBlock && adjustedAtk.patk<defProfile.pdef+1) {
				if ( defProfile.armorEndurance==0 && defProfile.pdef>0 ){
					re.eventKey='hitPdefDecrease';
					defProfile.pdef--;
					defProfile.armorEndurance=RPGMechanics.constants.ARMOR_ENDURANCE;
					cooldowns=addCoolDown([],atkProfile,RPGMechanics.constants.AP_ATTACK_COST/2,true);
					cooldowns=addCoolDown(cooldowns,defProfile,RPGMechanics.constants.AP_ATTACK_COST/2);
					// console.log(defProfile.name,defProfile.state,defProfile.pdef,re.eventKey," -> both cooldown");
				} else {
					re.eventKey='hitBlocked';
					if (RPGMechanics.rollDice("fightArmorEndure",armorEndureChance)) defProfile.armorEndurance--;
					cooldowns=addCoolDown([],atkProfile,RPGMechanics.constants.AP_ATTACK_COST,true);
					cooldowns=addCoolDown(cooldowns,defProfile,RPGMechanics.constants.NO_COOLDOWN_TIME);
					// console.log(defProfile.name,defProfile.state,re.eventKey," -> atk cooldown");
				}
			} else {
				// console.log(defProfile.name,defProfile.state,"wasHit -> def cooldown");
				defProfile.hp--;
				defProfile.wasHit=true;
				re.dmg=adjustedAtk.patk;
				cooldowns=addCoolDown([],atkProfile,RPGMechanics.constants.AP_ATTACK_COST,true);
				cooldowns=addCoolDown(cooldowns,defProfile,defCooldown+parryEvadeCost);
			}
		}
		
		this.applyCoolDown(cooldowns);
		atkProfile.assists=null;
		if (game.actors.boss) game.actors.boss.onAttackEnded(atkProfile);
		
		game.onResultHitTarget(re,atkProfile,defProfile);
	},

	startCastSpell:function(spell,tgt){
		var me=this;
		if (tgt) me.profile.target=tgt;
		this.setState(me.profile,"cast",spell);
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
			srcProfile.mana--;
			// srcProfile.spells[spell].mp--;
			RPGMechanics.spells[spell](srcProfile,tgtProfile);
			if (tgt) tgt.refreshApStats.call(tgt,tgtProfile);
			else this.refreshApStats(tgtProfile);
		}
		game.onResultSpellCast(re,srcProfile,tgtProfile);
	}
	
};

module.exports=Player;