  module.exports.game={
    '/check':{f:'checkCell',d:'/check - check cell <x> <y>'},
    '/quit':{f:'quitGame',d:'/quit - quit current game'}
  };
  module.exports.chat={
    '/ranks':{f:'showRanks',d:'/ranks - get info about ranks and times.'},
    '/top':{f:'topPlayers',d:'/top - get top10.'},
    '/ping':{f:'testPing',d:'/ping - test connection latency.'},
    '/info':{f:'playerInfo',d:'/info <player> - get player info.'},
    '/to':{f:'sendPrivateMessage',d:'/to <player> <text> - send private message.'},
    '/join':{f:'joinParty',d:'/join <partyId> - join party.'},
    '/spec':{f:'addSpectator',d:'/spec <user> - spectate user.'},
    '/leave':{f:'leaveParty',d:'/leave - leave party.'},
    '/create':{f:'createParty',d:'/create <mode> <bSize> <maxplayers> - create party.'},
//    '/publish':{f:'publishParty',d:'/publish - publish party you are in info to players'},
    '/dismiss':{f:'dismissParty',d:'/dismiss - dismiss a party where you are a leader.'},
    '/kick':{f:'kickPlayerFromParty',d:'/kick <player> - kick player from a party where you are a leader.'},
    '/mute':{f:'mutePlayer',d:'/mute [<player>] - display muted players or mute player.'},
    '/umute':{f:'umutePlayer',d:'/umute <player> - unmute player.'},
    '/login':{f:'logIn',d:'/login <user> <passwd> - log in or register new user.'},
    '/logoff':{f:'logOff',d:'/logoff - log off registered user.'},
    '/help':{f:'showHelp',d:'/help - show this help.'}
  };
