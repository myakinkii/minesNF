var RPGMechanics={
	
	constants:{
		ARMOR_ENDURANCE:1,
		BASIC_CHANCE:0.5,
		ORB_CHANCE_ADJUST:0.05,
		INTERRUPT_CHANCE:0.4,
		BOSS_ATTACK_DELAY_TIME:1000,
		ATTACK_TIME:1500,
		CAST_TIME:2000,
		NO_COOLDOWN_TIME:0,
		COOLDOWN_HIT:1000,
		COOLDOWN_MISS:1500,
		AP_TICK:2000,
		AP_HIT_COST:1,
		AP_MISS_COST:1,
		AP_ATTACK_COST:2,
		AP_PARRY_EVADE_COST:1
	},
	
	orbEffects:{
		parry:-1,
		antiparry:0,
		evade:-1,
		antievade:0,
		crit:1,
		anticrit:0,
		pierce:1,
		antipierce:0,
		degrade:1,
		antidegrade:0,
		interrupt:1,
		antiinterrupt:0
	},
	
	actionCostAP:{
		hit:2,
		assist:2,
		defend:2,
		parry:1,
		evade:1
	},

	gems:[
		{eft:"mana",rarity:0},
		{eft:"maxhp",rarity:1},
		{eft:"patk",rarity:1},
		{eft:"pdef",rarity:1},
		{eft:"speed",rarity:1},
		// {eft:"patkinc",rarity:2},
		// {eft:"pdefinc",rarity:2},
		// {eft:"speedinc",rarity:2},
		// {eft:"patkdec",rarity:3},
		// {eft:"pdefdec",rarity:3},
		// {eft:"speeddec",rarity:3},
		// {eft:"heal",rarity:4},
		// {eft:"lifesteal",rarity:4},
	],

	spells:{
		patkinc:function(srcProfile,tgtProfile){ tgtProfile.patk++; },
		pdefinc:function(srcProfile,tgtProfile){ tgtProfile.pdef++; },
		speedinc:function(srcProfile,tgtProfile){ tgtProfile.speed++; },
		patkdec:function(srcProfile,tgtProfile){ if (tgtProfile.patk>0) tgtProfile.patk--; },
		pdefdec:function(srcProfile,tgtProfile){ if (tgtProfile.pdef>0) tgtProfile.pdef--; },
		speeddec:function(srcProfile,tgtProfile){ if (tgtProfile.speed>0) tgtProfile.speed--; },
		// heal:function(srcProfile,tgtProfile){ tgtProfile.hp++; },
		// lifesteal:function(srcProfile,tgtProfile){ srcProfile.hp++; tgtProfile.hp--; }
	},
	
	rollDice:function (effect,chance,log) {
		var rnd=Math.random();
		if(log) console.log(effect,chance,rnd); //some logging or processing later maybe
		return chance>rnd;
	},
	
	adjustLivesLost:function(profile){
		if (profile.bossRatio) return 1;
		return Math.sqrt((8-profile.livesLost)/9);
	},
	
	adjustBossRatio:function(profile){
		if (profile.bossRatio) return profile.bossRatio;
		return 1;
	},
	
	calcFloorCompleteRatio:function(bossLevel,bSize,stat){
		var ratio=1;
		var times={"small":10.0,"medium":40.0,"big":120.0};
		var bossLevelRatio={ 1:0.7, 2:0.8, 3:0.9, 4:1.1, 5:1.2, 6:1.3, 7:1.4, 8:1.5};
		ratio*=bossLevelRatio[bossLevel];
		var timeRatio=(times[bSize]-stat.time)/times[bSize];
		if (timeRatio<0) timeRatio=1;
		ratio*=Math.sqrt(timeRatio);
		return ratio;
	},

	genBossEquip:function(floor,bossLevel,bSize,stat){
		var equip=[];
		// var effects=["maxhp","patk","pdef","speed"];
		var effects=this.gems.filter(function(g){ return g.rarity==1}).map(function(g){ return g.eft; });
		var gemCount=floor;
		while (gemCount>0) {
			equip.push( "common_"+effects[Math.floor(Math.random()*4)] );
			gemCount--;
		}
		return equip;
	},
	
	adjustChanceWithOrbs:function(eft,chance,atkProfile,defProfile){
		var rpg=RPGMechanics;
		var atkdef= rpg.constants.ORB_CHANCE_ADJUST * rpg.orbEffects[eft];
		var delta=atkdef*(atkProfile.orbs[(atkdef>0?'':'anti')+eft]||0) - atkdef*(defProfile.orbs[(atkdef<0?'':'anti')+eft]||0);
		// console.log(eft,chance,delta);
		return chance+delta;
	},
	
	calcAtkChances:function (atkProfile,defProfile) {

		var rpg=RPGMechanics;
		
		function evade(){
			var evadeChance=rpg.adjustChanceWithOrbs("evade",rpg.constants.BASIC_CHANCE,atkProfile,defProfile);
			evadeChance+=0.05*(defProfile.speed-atkProfile.speed);
			evadeChance*=rpg.adjustLivesLost(defProfile);
			evadeChance*=rpg.adjustBossRatio(defProfile);
			var re={ eventKey:'hitEvaded', chance:evadeChance, result:false};
			if (rpg.rollDice("fightEvade",evadeChance)) re.result=true;
			return re;
		}
		function parry(){
			var parryChance=rpg.adjustChanceWithOrbs("parry",rpg.constants.BASIC_CHANCE,atkProfile,defProfile);
			parryChance+=0.05*(defProfile.patk-atkProfile.patk);
			parryChance*=rpg.adjustLivesLost(defProfile);
			parryChance*=rpg.adjustBossRatio(defProfile);
			var re={ eventKey:'hitParried', chance:parryChance, result:false};
			if (rpg.rollDice("fightParry",parryChance)) re.result=true;
			return re;
		}
		function crit(){
			var critChance=rpg.adjustChanceWithOrbs("crit",rpg.constants.BASIC_CHANCE/5,atkProfile,defProfile);
			critChance+=0.1*(atkProfile.speed-defProfile.speed);
			critChance*=rpg.adjustLivesLost(atkProfile);
			critChance*=rpg.adjustBossRatio(atkProfile);
			var re={ eventKey:'hitDamageCrit', chance:critChance, result:false};
			if (rpg.rollDice("fightCrit",critChance)) re.result=true;
			return re;		
		}
		return { evade:evade(), parry:parry(), crit:crit() };
	}
};

module.exports=RPGMechanics;