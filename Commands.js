  module.exports.game={
    '/check':{f:'checkCell',d:' - check cell <x> <y>'},
    '/quit':{f:'quitGame',d:' - quit current game'}
  };
  module.exports.chat={
    '/ranks':{f:'showRanks',d:' - get info about ranks and times.'},
    '/top':{f:'topPlayers',d:' - get top10.'},
    '/ping':{f:'testPing',d:' - test connection latency.'},
    '/info':{f:'playerInfo',d:' <player> - get player info.'},
    '/to':{f:'sendPrivateMessage',d:' <player> <text> - send private message.'},
    '/join':{f:'joinParty',d:' <partyId> - join party.'},
    '/spec':{f:'addSpectator',d:' <user> - spectate user.'},
    '/leave':{f:'leaveParty',d:' - leave party.'},
    '/create':{f:'createParty',d:' <mode> <bSize> <maxplayers> - create party.'},
//    '/publish':{f:'publishParty',d:' - publish party you are in info to players'},
    '/dismiss':{f:'dismissParty',d:' - dismiss a party where you are a leader.'},
    '/kick':{f:'kickPlayerFromParty',d:' <player> - kick player from a party where you are a leader.'},
    '/mute':{f:'mutePlayer',d:' [<player>] - display muted players or mute player.'},
    '/umute':{f:'umutePlayer',d:' <player> - unmute player.'},
    '/login':{f:'logIn',d:' <user> <passwd> - log in or register new user.'},
    '/logoff':{f:'logOff',d:' - log off registered user.'},
    '/help':{f:'showHelp',d:' - show this help.'}
  };
