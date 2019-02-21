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
		var game=this.game;
		profile.state=state;
		game.emitEvent('party', game.id, 'game', 'ChangeState', { profile:profile, user:profile.name, state:profile.state, val:arg });
	},
	
	applyCoolDown:function(players){
		var self=this;
		var game=this.game;
		players.forEach(function(p){
			var profile=game.profiles[p.name];
			if (p.time>0) {
				self.setState(profile,"cooldown",p.time);
				game.actors[p.name].timer=setTimeout(function(){ self.setState(profile,"active"); }, p.time);
			} else {
				self.setState(profile,"active");
				game.actors[p.name].timer=null;
			}
		});
	},

	cancelAction:function(){
		var me=this.profile;
		this.setState(me,"active");
		if (this.timer) clearTimeout(this.timer);
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
		tgt.onStartAttack(me);
		this.timer=setTimeout(function(){ tgt.onEndAttack(me); },1000);
	},
	
	onStartAttack:function(atkProfile){
		var defProfile=this.profile;
		var state=null;
		if (defProfile.speed>atkProfile.speed) state="evade";
		else if (defProfile.patk>atkProfile.patk) state="parry";
		if (state) this.setState(defProfile,state)
	},
	
	onEndAttack:function(atkProfile){
		
		var defProfile=this.profile;
		var re={dmg:0,eventKey:'hitDamage',attack:atkProfile.name,defense:defProfile.name};
		
		var game=this.game;
		
		var adjustedAtk={ mob:0, livesLost:atkProfile.livesLost, patk:atkProfile.patk||1, speed:atkProfile.speed};
		for (var a in atkProfile.assists) {
			adjustedAtk.patk+=(atkProfile.assists[a].patk||1);
			adjustedAtk.speed+=atkProfile.assists[a].speed;
			adjustedAtk.livesLost+=atkProfile.assists[a].livesLost;
		}

		var chances=RPGMechanics.calcAtkChances.call(game,adjustedAtk,defProfile);
		
		var cooldowns;
		var defCooldownHit=1000;
		var atkCooldownMiss=1500;
		var noCooldown=0;
			
		function addCoolDown(cd,profile,time){
			cd.push({ name:profile.mob?"boss":profile.name, time:time });
			for (var a in profile.assists) cd.push({name:a,time:time});
			return cd;
		}

		if (defProfile.hp==0) {
			this.applyCoolDown(addCoolDown([],atkProfile,noCooldown));
			return;
		} else if ( chances[this.state] && chances[this.state].result) {
			re.eventKey=chances[this.state].eventKey;
			re.chance=chances[this.state].chance;
			cooldowns=addCoolDown([],atkProfile,atkCooldownMiss);
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
					defProfile.armorEndurance=this.armorEndurance;
				} else {
					re.eventKey='hitBlocked';
					if (RPGMechanics.rollDice("fightArmorEndure",armorEndureChance)) defProfile.armorEndurance--;
				}
				cooldowns=addCoolDown([],atkProfile,atkCooldownMiss*1.5);
				cooldowns=addCoolDown(cooldowns,defProfile,atkCooldownMiss/2);
			} else {
				defProfile.hp--;
				defProfile.wasHit=true;
				re.dmg=dmg;
				cooldowns=addCoolDown([],defProfile,defCooldownHit);
				cooldowns=addCoolDown(cooldowns,atkProfile,noCooldown);
			}
		}
		
		re.profiles=game.profiles;
		game.emitEvent('party', game.id, 'game', 'ResultHitTarget', re);
		
		atkProfile.assists=null;
		var resetCooldowns=false;
		
		if (defProfile.mob && defProfile.hp==0) {
			game.inBattle=false;
			game.completeFloor.call(game,{eventKey:'endBattleWin'});
			resetCooldowns=true;
		} else if (!defProfile.mob && game.totalHp==0){
			game.inBattle=false;
			game.resetBoard.call(game,{eventKey:'endBattleLose', floor:game.floor});
			game.resetFloor.call(game);
			resetCooldowns=true;
		}

		if (resetCooldowns){
			cooldowns=addCoolDown([],defProfile,noCooldown);
			cooldowns=addCoolDown(cooldowns,atkProfile,noCooldown);
		}

		this.applyCoolDown(cooldowns);
	}
};

module.exports=Player;