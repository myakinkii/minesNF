var RPGMechanics={
	
	constants:{
		ARMOR_ENDURANCE:1,
		BASIC_CHANCE:0.5,
		AVOID_INTERRUPT_CHANCE:0.6,
		BOSS_ATTACK_DELAY_TIME:1000,
		ATTACK_TIME:1500,
		CAST_TIME:1500,
		NO_COOLDOWN_TIME:0,
		COOLDOWN_HIT:1000,
		COOLDOWN_MISS:1500
	},

	gems:[
		{eft:"maxhp",rarity:1},
		{eft:"patk",rarity:1},
		{eft:"pdef",rarity:1},
		{eft:"speed",rarity:1},
		{eft:"strenghten",rarity:2},
		{eft:"fortify",rarity:2},
		{eft:"quicken",rarity:2},
		{eft:"fatigue",rarity:3},
		{eft:"weaken",rarity:3},
		{eft:"slow",rarity:3},
		{eft:"heal",rarity:4},
		{eft:"lifesteal",rarity:4},
	],

	spells:{
		strenghten:function(srcProfile,tgtProfile){ tgtProfile.patk--; },
		fortify:function(srcProfile,tgtProfile){ tgtProfile.pdef++; },
		quicken:function(srcProfile,tgtProfile){ tgtProfile.speed++; },
		heal:function(srcProfile,tgtProfile){ tgtProfile.hp++; },
		fatigue:function(srcProfile,tgtProfile){ tgtProfile.patk--; },
		weaken:function(srcProfile,tgtProfile){ tgtProfile.pdef--; },
		slow:function(srcProfile,tgtProfile){ tgtProfile.speed--; },
		lifesteal:function(srcProfile,tgtProfile){ srcProfile.hp++; tgtProfile.hp--; }
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
	
	calcAtkChances:function (atkProfile,defProfile) {

		var rpg=RPGMechanics;
		
		function evade(){
			var evadeChance=rpg.constants.BASIC_CHANCE;
			evadeChance+=0.05*(defProfile.speed-atkProfile.speed);
			evadeChance*=rpg.adjustLivesLost(defProfile);
			evadeChance*=rpg.adjustBossRatio(defProfile);
			var re={ eventKey:'hitEvaded', chance:evadeChance, result:false};
			if (rpg.rollDice("fightEvade",evadeChance)) re.result=true;
			return re;
		}
		function parry(){
			var parryChance=rpg.constants.BASIC_CHANCE;
			parryChance+=0.05*(defProfile.patk+1-atkProfile.patk); //cuz adjusted attack has +1 patk for free
			parryChance*=rpg.adjustLivesLost(defProfile);
			parryChance*=rpg.adjustBossRatio(defProfile);
			var re={ eventKey:'hitParried', chance:parryChance, result:false};
			if (rpg.rollDice("fightParry",parryChance)) re.result=true;
			return re;
		}
		function crit(){
			var critChance=rpg.constants.BASIC_CHANCE/5;
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