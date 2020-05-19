// These examples are temporary
// https://www.bungie.net/en/Help/Article/45481

const Destiny2API = require('node-destiny-2');
const fs = require('fs');

const destiny = new Destiny2API({
    key: process.env.BUNGIE_API
});

const CLASSTYPES = {
    0: 'Titan',
    1: 'Hunter',
    2: 'Warlock',
    3: 'Unknown',
};

const GAMETYPES = {
    0: 'None',
    2: 'Story',
    3: 'Strike',
    4: 'Raid',
    5: 'AllPvP',
    6: 'Patrol',
    7: 'AllPvE',
    9: 'Reserved9',
    10: 'Control',
    11: 'Reserved11',
    12: 'Clash',
    13: 'Reserved13',
    15: 'CrimsonDoubles',
    16: 'Nightfall',
    17: 'HeroicNightfall',
    18: 'AllStrikes',
    19: 'IronBanner',
    20: 'Reserved20',
    21: 'Reserved21',
    22: 'Reserved22',
    24: 'Reserved24',
    25: 'AllMayhem',
    26: 'Reserved26',
    27: 'Reserved27',
    28: 'Reserved28',
    29: 'Reserved29',
    30: 'Reserved30',
    31: 'Supremacy',
    32: 'PrivateMatchesAll',
    37: 'Survival',
    38: 'Countdown',
    39: 'TrialsOfTheNine',
    40: 'Social',
    41: 'TrialsCountdown',
    42: 'TrialsSurvival',
    43: 'IronBannerControl',
    44: 'IronBannerClash',
    45: 'IronBannerSupremacy',
    46: 'ScoredNightfall',
    47: 'ScoredHeroicNightfall',
    48: 'Rumble',
    49: 'AllDoubles',
    50: 'Doubles',
    51: 'PrivateMatchesClash',
    52: 'PrivateMatchesControl',
    53: 'PrivateMatchesSupremacy',
    54: 'PrivateMatchesCountdown',
    55: 'PrivateMatchesSurvival',
    56: 'PrivateMatchesMayhem',
    57: 'PrivateMatchesRumble',
    58: 'HeroicAdventure',
    59: 'Showdown',
    60: 'Lockdown',
    61: 'Scorched',
    62: 'ScorchedTeam',
    63: 'Gambit',
    64: 'AllPvECompetitive',
    65: 'Breakthrough',
    66: 'BlackArmoryRun',
    67: 'Salvage',
    68: 'IronBannerSalvage',
    69: 'PvPCompetitive',
    70: 'PvPQuickplay',
    71: 'ClashQuickplay',
    72: 'ClashCompetitive',
    73: 'ControlQuickplay',
    74: 'ControlCompetitive',
    75: 'GambitPrime',
    76: 'Reckoning',
    77: 'Menagerie',
    78: 'VexOffensive',
    79: 'NightmareHunt',
    80: 'Elimination',
    81: 'Momentum',
    82: 'Dungeon',
    83: 'Sundial',
    84: 'TrialsOfOsiris',
};


// Looking up my character: charId: 2305843009278477570
// 205 gives inventory
const transformCharacterStats = (character) => {
    const {
        dateLastPlayed,
        light,
        minutesPlayedThisSession,
        minutesPlayedTotal,
        classType,
        characterId,
    } = character.character.data;

    const fields = {
        classType,
        dateLastPlayed,
        light,
        minutesPlayedThisSession,
        minutesPlayedTotal,
        characterId,
    };

    fields.classType = CLASSTYPES[fields.classType];
    fields.minutesPlayedThisSession = parseInt(fields.minutesPlayedThisSession);
    fields.minutesPlayedTotal = parseInt(fields.minutesPlayedTotal);

    return fields;
};

const writeInfluxCharacter = (influxClient, character) => {
    const fields = transformCharacterStats(character);
    influxClient.write('character')
    .field(fields)
    .queue();
};

const writeInfluxClan = (influxClient, clan) => {
    const gamemodes = clan.reduce(function(result, clanstat, index) { 
        const gametype = GAMETYPES[clanstat.mode];
        if (!result[gametype]) result[gametype] = {};
        result[gametype][clanstat.statId] = parseFloat(clanstat.value.basic.displayValue);
        return result;
    }, {});

    for(const [key, value] of Object.entries(gamemodes)) {
        influxClient.write('clan')
        .tag('gamemode', key)
        .field(value)
        .queue();
    }
};

const writeInfluxWeapons = (influxClient, weapons) => {
    const fields = Object.entries(weapons.allPvP.allTime).reduce(function(result, [key, value], index) {
        result[key] = value.basic.value;
        return result;
    }, {});

    influxClient.write('weapons')
    .tag('gametype', 'pvp')
    .field(fields)
    .queue();
};

const writeInfluxAccount = (influxClient, account) => {
    const fields = Object.entries(account.mergedAllCharacters.merged.allTime).reduce(function(result, [key, value], index) {
        result[key] = value.basic.value;
        return result;
    }, {});

    influxClient.write('account')
    .field(fields)
    .queue();
};

const writeInfluxGroupMembersStatus = (influxClient, status) => {
    for(member of status.results) {
        const fields = {
            isOnline: member.isOnline,
            memberType: member.memberType,
        };

        influxClient.write('clanmemberstatus')
        .tag('displayName', member.destinyUserInfo.displayName)
        .field(fields)
        .queue();
    }
};

const writeInfluxGroupMembersCharacters = (influxClient, characters) => {
    for(character of characters) {
        if(character) {
            influxClient.write('clanmemberscharacters')
            .tag('displayName', character.displayName)
            .tag('classType', character.classType)
            .field(character)
            .queue();
        }
    }
};

const writeInflux = (influxClient, character, clan, weapons, account, groupMembers, groupMembersStats) => {
    writeInfluxCharacter(influxClient, character.Response);
    writeInfluxClan(influxClient, clan.Response);
    writeInfluxWeapons(influxClient, weapons.Response);
    writeInfluxAccount(influxClient, account.Response);
    writeInfluxGroupMembersStatus(influxClient, groupMembers.Response);
    writeInfluxGroupMembersCharacters(influxClient, groupMembersStats.flat().flat());

    influxClient.syncWrite()
    .then(() => console.debug(`${Date.now()} destiny: influx write point success`))
    .catch((error) => console.debug(`${Date.now()} destiny: write failed ${error}`));
};

const getGroupMembersStats = async () => {
    return destiny.getGroupMembers('3896551').then(function(response) {
        const members = response.Response.results;
        return Promise.all(members.map(function(member) {
            const memberId = member.destinyUserInfo.membershipId;
            const membershipType = member.destinyUserInfo.membershipType;
            return destiny.getProfile(membershipType, memberId, [100]).then(response => {
                const characterIds = response.Response.profile.data.characterIds;
                const displayName = response.Response.profile.data.userInfo.displayName;
                return Promise.all(characterIds.map(function(characterId) {
                    return destiny.getCharacter(membershipType, memberId, characterId, [200, 205]).then(function(response) {
                        const characterResponse = response.Response;
                        const fields = transformCharacterStats(characterResponse);
                        return {
                            displayName: displayName,
                            ...fields
                        };
                    });
                }));
            });
        }));
    });
};

const logDestiny = async influxClient => {
    const promises = [
        destiny.getCharacter(1, '4611686018431927918', '2305843009513035254', [200, 205]),
        destiny.getClanAggregateStats('3896551'),
        destiny.getHistoricalStats(1, '4611686018431927918', '2305843009513035254', { modes: [5], groups: [2] }), // weapons
        destiny.getHistoricalStatsForAccount(1, '4611686018431927918'), //account
        destiny.getGroupMembers('3896551'),
        getGroupMembersStats()
    ];
    return Promise.all(promises)
    .then((results) => {
        return writeInflux(influxClient, ...results);
    })
    .catch(err => {
        console.error(`Error: ${err}`);
    });
};

module.exports = logDestiny;
