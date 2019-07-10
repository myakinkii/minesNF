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
		template.orbs=this.game.orbs[template.name]||{};
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
			else return;
			if (profile.curAP==profile.maxAP) return;
			profile.curAP++;
			game.emitEvent('party', game.id, 'game', 'ChangePlayerAP', { 
				profiles:game.profiles, user:profile.name, curAP:profile.curAP 
			});
			if(game.actors.boss) game.actors.boss.onChangeAP(profile);
		}
		if (this.apTimer) clearTimeout(this.apTimer);
		this.apTimer=setTimeout(apTickFn,this.apTick);
		
		return this.profile;
	},

	refreshApStats:function(profile){
		this.apTick=RPGMechanics.constants.AP_TICK-250*(profile.speed<12 ? Math.floor(profile.speed/3) : 4);
		this.profile.maxAP= 3 + (profile.patk<12 ? Math.floor(profile.patk/4) : 3);
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

		if (state=='active') timer=null;
		profile.state=state;

		var game=this.game;
		if(game.actors.boss) game.actors.boss.onState(profile,state,arg);
		game.emitEvent('party', game.id, 'game', 'ChangeState', { profiles:game.profiles, user:profile.name, state:state, val:arg });
	},
	
	applyPenalty:function(players){
		var self=this;
		var game=this.game;
		var interruptableStates=["cast"];
		players.forEach(function(p){
			var profile=game.profiles[p.name];
			if (p.time>0) {
				profile.curAP-=p.time;
				game.emitEvent('party', game.id, 'game', 'ChangePlayerAP', { profiles:game.profiles, user:profile.name, curAP:profile.curAP });
			}
			if (!p.attacker && game.actors[p.name].timer){
				var interruptChance=RPGMechanics.adjustChanceWithOrbs("interrupt",RPGMechanics.constants.INTERRUPT_CHANCE,self.profile,profile);
				if ( interruptableStates.indexOf(profile.state)>-1 && RPGMechanics.rollDice("fightInterrupt",interruptChance)){
					clearTimeout(game.actors[p.name].timer);
					game.emitEvent( 'party', game.id, 'game', 'BattleLogEntry', { eventKey:'actionInterrupted', defense:profile.name } );
				} else return;
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
		if (tgt.onAttackStarted) tgt.onAttackStarted.call(tgt,me);
		var atkTimeAdjustment={ 0:0, 1:250, 2:250, 3:500, 4:500, 5:750, 6:1000 };
		var adjustRaio=(me.speed<12 ? Math.floor(me.speed/2) : 6);
		var adjustedAttackTime=RPGMechanics.constants.ATTACK_TIME-atkTimeAdjustment[adjustRaio];
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

		var addPenalty=function(pen,profile,time,attacker){
			pen.push({ name:profile.mob?"boss":profile.name, time:time, attacker:attacker });
			for (var a in profile.assists) pen.push({name:a,time:time, attacker:attacker});
			return pen;
		};

		if ( atkProfile.hp==0 || defProfile.hp==0 || atkProfile.curAP<RPGMechanics.actionCostAP.hit ) {
			this.applyPenalty(addPenalty([],atkProfile,RPGMechanics.constants.NO_COOLDOWN_TIME,true));
			this.applyPenalty(addPenalty([],defProfile,RPGMechanics.constants.NO_COOLDOWN_TIME));
			atkProfile.assists=null;
			if (game.actors.boss) game.actors.boss.onAttackEnded(atkProfile); //so that boss clears his underAttack
			return;
		}
		
		var adjustedAtk={
			bossRatio:atkProfile.bossRatio, 
			livesLost:atkProfile.livesLost<8?atkProfile.livesLost:8,
			patk:1+atkProfile.patk, speed:atkProfile.speed, orbs:atkProfile.orbs
		};
		var adjustedDef={
			pdef:1+defProfile.pdef,
			bossRatio:defProfile.bossRatio, 
			livesLost:defProfile.livesLost<8?defProfile.livesLost:8,
			patk:1+defProfile.patk, speed:defProfile.speed, orbs:defProfile.orbs
		};
		var a,asp;
		for (a in atkProfile.assists) {
			asp=atkProfile.assists[a];
			if (asp.curAP<RPGMechanics.actionCostAP.hit) continue;
			adjustedAtk.patk+=(asp.patk+1);
			adjustedAtk.speed+=asp.speed;
			adjustedAtk.livesLost+=asp.livesLost;
		}
		if (atkProfile.assists) adjustedDef.pdef++;
		
		var chances=RPGMechanics.calcAtkChances(adjustedAtk,adjustedDef); // calc parry, evade, crit chances
		
		if (chances.crit.result) adjustedAtk.patk+=(atkProfile.patk||1);
		
		var parryEvadeSuccess=false, parryEvadeCost=0, haveEnoughAp;
		if (chances[defProfile.state]){ // tried to parry/evade
			haveEnoughAp=defProfile.curAP>=RPGMechanics.actionCostAP[defProfile.state];
			// if (haveEnoughAp) parryEvadeCost+=RPGMechanics.constants.AP_PARRY_EVADE_COST; //cost for trying
			parryEvadeSuccess = haveEnoughAp && chances[defProfile.state].result; //result
			if (!parryEvadeSuccess) parryEvadeCost+=RPGMechanics.constants.AP_MISS_COST; // add cost for failing
		}

		var noBlock=["attack","cast","assist"].indexOf(defProfile.state)>-1;
		var willBlock= !noBlock && parryEvadeCost==0;

		var apCosts;
		var gotHitCost=RPGMechanics.constants.AP_HIT_COST;

		var re={dmg:0,eventKey:'hitDamage'};

		if (parryEvadeSuccess) {
			re.eventKey=chances[defProfile.state].eventKey;
			re.chance=chances[defProfile.state].chance;
			apCosts=addPenalty([],atkProfile,RPGMechanics.constants.AP_ATTACK_COST+RPGMechanics.constants.AP_MISS_COST,true);
			apCosts=addPenalty(apCosts,defProfile,parryEvadeCost);
		} else {
			if (chances.crit.result) {
				gotHitCost*=2;
				re.eventKey=chances.crit.eventKey;
				re.chance=chances.crit.chance;
			}
			var pierceChance=RPGMechanics.adjustChanceWithOrbs("pierce",RPGMechanics.constants.BASIC_CHANCE/5,atkProfile,defProfile);
			var armorDegradeChance=RPGMechanics.adjustChanceWithOrbs("degrade",RPGMechanics.constants.BASIC_CHANCE,atkProfile,defProfile);
			armorDegradeChance+=0.1*(adjustedAtk.patk-defProfile.pdef);
			if ( willBlock && adjustedDef.pdef-adjustedAtk.patk>0) {
				if ( defProfile.armorEndurance==0){
					re.eventKey='hitPdefDecrease';
					if (defProfile.pdef>0) defProfile.pdef--;
					defProfile.armorEndurance=RPGMechanics.constants.ARMOR_ENDURANCE;
					apCosts=addPenalty([],atkProfile,RPGMechanics.constants.AP_ATTACK_COST/2,true);
					apCosts=addPenalty(apCosts,defProfile,RPGMechanics.constants.AP_ATTACK_COST/2);
				} else if (RPGMechanics.rollDice("fightArmorPierce",pierceChance)){
					re.eventKey='hitPierced';
					re.chance=pierceChance;
					defProfile.hp--;
					defProfile.wasHit=true;
					re.dmg=adjustedAtk.patk;
					apCosts=addPenalty([],atkProfile,RPGMechanics.constants.AP_ATTACK_COST,true);
					apCosts=addPenalty(apCosts,defProfile,RPGMechanics.constants.AP_ATTACK_COST/2);
				} else {
					re.eventKey='hitBlocked';
					if (RPGMechanics.rollDice("fightArmorDegrade",armorDegradeChance)) defProfile.armorEndurance--;
					apCosts=addPenalty([],atkProfile,RPGMechanics.constants.AP_ATTACK_COST,true);
					apCosts=addPenalty(apCosts,defProfile,RPGMechanics.constants.NO_COOLDOWN_TIME);
				}
			} else {
				defProfile.hp--;
				defProfile.wasHit=true;
				re.dmg=adjustedAtk.patk;
				apCosts=addPenalty([],atkProfile,RPGMechanics.constants.AP_ATTACK_COST,true);
				apCosts=addPenalty(apCosts,defProfile,gotHitCost+parryEvadeCost);
			}
		}
		
		this.applyPenalty(apCosts);
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
		this.timer=null;

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