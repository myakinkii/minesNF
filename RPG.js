var Game=require('./Game.js');

function RPGGame(pars) {
	Game.call(this, pars);
	for (var u in this.players) if(this.profiles[u]) this.profiles[u]={};
};

RPGGame.prototype = new Game;

RPGGame.prototype.onStartBoard = function () {
	this.resetScore();
	this.livesLost=0;
	this.livesTotal=0;
	for (var u in this.players) {
		this.profiles[u].livesLost=0;
		this.livesTotal+=8;
	}
	this.lostCoords={};
	this.digitPocket={};
	this.bossLevel=1;
};

RPGGame.prototype.calcAtk = function (atkProfile,defProfile) {
	var re={dmg:0,eventKey:'hitDamage',attack:atkProfile.name,defense:defProfile.name};
	var evadeChance=0.2;
	evadeChance+=0.1*(defProfile.speed-atkProfile.speed);
	if (Math.random()<=evadeChance) {
		re.eventKey='hitEvaded';
		return re;
	}
	var parryChance=0.2;
	parryChance+=0.1*(defProfile.patk-defProfile.patk);
	if (Math.random()<=parryChance){
		re.eventKey='hitParried';
		return re;
	}
	var atk=atkProfile.patk+1;
	var critChance=0.1;
	critChance+=0.1*(atkProfile.speed-defProfile.speed);
	if (Math.random()<=critChance){
		atk*=2;
		re.eventKey='hitDamageCrit';
	}
	if (defProfile.pdef+1>atk) re.eventKey='hitBlocked';
	else re.dmg=atk;
	return re;
};

RPGGame.prototype.hitMob = function (user) {
	
	if (!this.inBattle) return;
	var userProfile=this.profiles[user],bossProfile=this.profiles.boss;

	if (userProfile.livesLost==8 || userProfile.hp==0) {
		this.emitEvent('client', user, 'system', 'Message','You are dead now, and cannot do that');
		return;
	}

	var re={};
	
	if ( !bossProfile.wasHit && Math.random()<this.stealChance) {
		this.inBattle=false;
		re.win=1;
		re.eventKey='Stole';
		this.resetBoard(re);
		return;
	}
	
	var hitResult=this.calcAtk(userProfile,bossProfile);
	if (hitResult.dmg) { 
		bossProfile.hp--;
		bossProfile.wasHit=true;
	}
	hitResult.profiles=this.profiles;
	this.emitEvent('party', this.id, 'game', 'ResultHitMob', hitResult);
	this.emitEvent('party', this.id, 'system', 'Message',[hitResult.eventKey,userProfile.name,'>',bossProfile.name,'(',bossProfile.hp,')'].join(' '));
	
	hitResult=this.calcAtk(bossProfile,userProfile);
	if (hitResult.dmg)  {
		userProfile.hp--;
		this.totalHp--;
	}
	hitResult.profiles=this.profiles;
	this.emitEvent('party', this.id, 'game', 'ResultHitMob', hitResult);
	this.emitEvent('party', this.id, 'system', 'Message',[hitResult.eventKey,bossProfile.name,'>',userProfile.name,'(',userProfile.hp,')'].join(' '));
	
	if (bossProfile.hp==0) {
		this.inBattle=false;
		re.win=1;
		this.resetBoard(re);
	} else if (this.totalHp==0){
		this.inBattle=false;
		this.resetBoard(re);
	}
};

RPGGame.prototype.onResetBoard = function (e) {
	var re = {};
	re.result = e.win ? 'win' : 'fail';
	if (e.lostBeforeBossBattle){
		var stat=this.getGenericStat();
		re.time=stat.time;
		re.lostBeforeBossBattle=true;
	} else re.eventKey='endBattle'+(e.eventKey||(e.win?'Win':'Lose'));
	if (e.win) re.digitPocket=this.digitPocket;
	this.emitEvent('party', this.id, 'system', 'Message', 'Battle result: '+re.eventKey||'endBattleLostAllLives');
	this.emitEvent('party', this.id, 'game', 'ShowResultLocal', re);
};

RPGGame.prototype.onCells = function (re) {
	this.addCells(re.cells);
	this.openCells(re.cells);
};

RPGGame.prototype.addCells = function (cells) {
	var i,n;
	for (i in cells) {
		n=cells[i];
		if(n>0) {
			if (!this.digitPocket[n]) this.digitPocket[n]=0;
			this.digitPocket[n]++;
			if (n>this.bossLevel) this.bossLevel=n;
		}
	}
};

RPGGame.prototype.checkCell=function(e){
	var x=parseInt(e.pars[0])||0;
	var y=parseInt(e.pars[1])||0;
	var re;
	if ( !(x<1 || x>this.board.sizeX) && !(y<1 || y>this.board.sizeY) ){
	  if (this.logStart==0) this.board.init(x,y,2);
	  if (!this.pause && this.profiles[e.user].livesLost<8) re=this.board.checkCell(x,y,e.user);
	}
	if (re){
	  this.logEvent(re);
	  this['on'+re.flag].call(this,re);
	}
  };

RPGGame.prototype.onBomb = function (re) {
	var coord=re.coords[0]+"_"+re.coords[1];
	if (!this.lostCoords[coord]){
		this.lostCoords[coord]=0;
		this.livesLost++;
		this.profiles[re.user].livesLost++;
		this.livesTotal--;
	}
	if (this.profiles[re.user].livesLost==8) {
		this.emitEvent('client', re.user, 'system', 'Message', 'You have lost all your lives');
	}
	if (this.livesTotal==0){
		this.openCells(this.board.mines);
		re.lostBeforeBossBattle=true;
		this.resetBoard(re);
	} else {
		this.lostCoords[coord]++;
		this.openCells(re.cells);
	}
};

RPGGame.prototype.adjustProfile=function(equip,template){
	template.equip=equip;
	var power={"common":1,"rare":2,"epic":3};
	return equip.reduce(function(prev,cur){
		prev[cur.effect]+=power[cur.rarity];
		return prev;
	},template);
};

RPGGame.prototype.genBossEquip=function(bossLevel,bSize,stat){
	var equip=[];
	var rnd=["maxhp","patk","pdef","speed"];
	var rarities={small:['common','common'],medium:['rare','common'],big:['epic','rare']};
	var times={"s":10,"m":40,"b":120};
	while (bossLevel>0) {
		bossLevel--; 
		equip.push({
			effect:rnd[Math.floor(Math.random()*4)],
			rarity: (Math.random()<0.5*times[bSize]/stat.time)?rarities[bSize][0]:rarities[bSize][1]
		});
	}
	return equip;
};

RPGGame.prototype.startBattle = function () {
	
	this.inBattle=true;
	
	var stat=this.getGenericStat();

	this.totalHp=0;

	for (var u in this.players){
		var userProfile=this.adjustProfile(
			this.profiles[u].equip||[],
			{"maxhp":0,"patk":0,"pdef":0,"speed":0,"level":8,"name":u,"livesLost":this.profiles[u].livesLost}
		);
		userProfile.hp=userProfile.level-userProfile.livesLost+userProfile.maxhp;
		if (userProfile.livesLost<8) this.totalHp+=userProfile.hp;
		this.profiles[u]=userProfile;
	}
	
	var bossProfile=this.adjustProfile(
		this.genBossEquip(this.bossLevel,this.bSize,stat),
		{"maxhp":0,"patk":0,"pdef":0,"speed":0,"level":this.bossLevel,"mob":1}
	);

	var names=['angry','hungry','greedy','grumpy'];
	bossProfile.name=names[Math.floor(names.length*Math.random())]+' Phoenix';
	bossProfile.hp=bossProfile.level+bossProfile.maxhp;
	this.profiles.boss=bossProfile;
	
	this.stealChance=1/8/bossProfile.level;
	
	var names=[]; 
	for (var p in this.players) names.push(p);
	this.emitEvent('party', this.id, 'system', 'Message', 'Start Battle: '+names.join(',')+' vs '+ bossProfile.name);
	this.emitEvent('party', this.id, 'game', 'StartBattleLocal', {
		key:'startBattle',time:stat.time, profiles:this.profiles,
		userName:names.join(','), livesLost:this.livesLost,
		bossName:bossProfile.name, bossLevel:bossProfile.level
	});
};

RPGGame.prototype.onComplete = function (re) {
	this.addCells(re.cells);
	this.openCells(re.cells);
	this.openCells(this.board.mines);
	if (!this.inBattle) this.startBattle();
};

module.exports=RPGGame;
