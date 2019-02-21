var RPGMechanics={
	
	rollDice:function (effect,chance,log) {
		var rnd=Math.random();
		if(log) console.log(effect,chance,rnd); //some logging or processing later maybe
		return chance>rnd;
	},
	
	adjustLivesLost:function(profile){
		if (profile.mob) return 1;
		return Math.sqrt((8-profile.livesLost)/9);
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
	
	adjustBossRatio:function(profile){
		if (profile.mob) return profile.bossRatio;
		return 1;
	},
	
	genBossEquip:function(floor,bossLevel,bSize,stat){
		var equip=[];
		var effects=["maxhp","patk","pdef","speed"];
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
			var evadeChance=0.2;
			evadeChance+=0.1*(defProfile.speed-atkProfile.speed);
			evadeChance*=rpg.adjustLivesLost(defProfile);
			evadeChance*=rpg.adjustBossRatio(defProfile);
			var re={ eventKey:'hitEvaded', chance:evadeChance, result:false};
			if (rpg.rollDice("fightEvade",evadeChance)) re.result=true;
			return re;
		}
		function parry(){
			var parryChance=0.2;
			parryChance+=0.1*(defProfile.patk-atkProfile.patk);
			parryChance*=rpg.adjustLivesLost(defProfile);
			parryChance*=rpg.adjustBossRatio(defProfile);
			var re={ eventKey:'hitParried', chance:parryChance, result:false};
			if (rpg.rollDice("fightParry",parryChance)) re.result=true;
			return re;
		}
		function crit(){
			var critChance=0.1;
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