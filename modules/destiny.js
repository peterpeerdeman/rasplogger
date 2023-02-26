const Destiny2API = require('node-destiny-2');
const fs = require('fs');

const destiny = new Destiny2API({
    key: process.env.BUNGIE_API,
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

let hashes = {};

// Looking up my character: charId: 2305843009278477570
// 205 gives inventory
const transformCharacterStats = (character) => {
    const progressionsEnabled =
        typeof character.progressions.data !== 'undefined' &&
        typeof character.progressions.data.progressions !== 'undefined';

    const crucibleRank = progressionsEnabled
        ? character.progressions.data.progressions['2083746873'].currentProgress
        : 0;
    const valorRank = progressionsEnabled
        ? character.progressions.data.progressions['2083746873'].currentProgress
        : 0;
    const infamyRank = progressionsEnabled
        ? character.progressions.data.progressions['3008065600'].currentProgress
        : 0;
    const rewardProgressionRank = progressionsEnabled
        ? character.progressions.data.progressions[hashes.rewardProgressionHash]
              .level
        : 0;
    const prestigeProgressionRank = progressionsEnabled
        ? character.progressions.data.progressions[
              hashes.prestigeProgressionHash
          ].level
        : 0;

    const seasonRank = rewardProgressionRank + prestigeProgressionRank;

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
        crucibleRank,
        valorRank,
        infamyRank,
        rewardProgressionRank,
        prestigeProgressionRank,
        seasonRank,
    };

    fields.classType = CLASSTYPES[fields.classType];
    fields.minutesPlayedThisSession = parseInt(fields.minutesPlayedThisSession);
    fields.minutesPlayedTotal = parseInt(fields.minutesPlayedTotal);

    return fields;
};

const writeInfluxClanGameModeStats = (influxClient, clan) => {
    const gamemodes = clan.reduce(function (result, clanstat, index) {
        const gametype = GAMETYPES[clanstat.mode];
        if (!result[gametype]) result[gametype] = {};
        result[gametype][clanstat.statId] = parseFloat(
            clanstat.value.basic.displayValue
        );
        return result;
    }, {});

    for (const [key, value] of Object.entries(gamemodes)) {
        influxClient.write('clan').tag('gamemode', key).field(value).queue();
    }
};

const writeInfluxJoinDates = (influxClient, clanmembers) => {
    for (member of clanmembers) {
        const fields = {
            count: 1,
            displayName: member.destinyUserInfo.displayName,
        };
        influxClient
            .write('clanmemberenrollment')
            .tag('displayName', member.destinyUserInfo.displayName)
            .field(fields)
            .time(new Date(member.joinDate).getTime() * 1000 * 1000)
            .queue();
    }
};

const writeInfluxClanCountStats = (influxClient, memberCount) => {
    const fields = {
        numberOfClanMembers: memberCount,
    };

    influxClient.write('clanmembers').field(fields).queue();
};

const writeInfluxGroupMembersData = (influxClient, mergedMemberData) => {
    for (const [key, value] of Object.entries(mergedMemberData)) {
        influxClient
            .write('clanmemberstatus')
            .tag('displayName', key)
            .field(value)
            .queue();
    }
};

const writeInfluxGroupMembersCharacters = (influxClient, characters) => {
    for (character of characters) {
        if (character) {
            influxClient
                .write('clanmemberscharacters')
                .tag('displayName', character.displayName)
                .tag('classType', character.classType)
                .field(character)
                .queue();
        }
    }
};

const mergeGroupMembersData = (memberStatus, memberCharacters) => {
    let data = {};
    for (member of memberStatus) {
        data[member.destinyUserInfo.displayName] = {
            isOnline: member.isOnline,
            memberType: member.memberType,
            displayName: member.destinyUserInfo.displayName,
        };
    }
    for (character of memberCharacters) {
        data[character.displayName].crucibleRank = character.crucibleRank;
        data[character.displayName].infamyRank = character.infamyRank;
        data[character.displayName].prestigeProgressionRank =
            character.prestigeProgressionRank;
        data[character.displayName].rewardProgressionRank =
            character.rewardProgressionRank;
        data[character.displayName].seasonRank = character.seasonRank;
        data[character.displayName].valorRank = character.valorRank;
        data[character.displayName].triumphsTotalScore =
            character.triumphsTotalScore;
        data[character.displayName].itemsCollected = character.itemsCollected;
    }
    return data;
};

const writeInflux = (influxClient, aggregateStats, memberStats) => {
    const memberCount = memberStats[0].totalResults;
    const members = memberStats[0].results;
    const memberCharacters = memberStats[1].flat().flat();

    writeInfluxClanGameModeStats(influxClient, aggregateStats);
    writeInfluxClanCountStats(influxClient, memberCount);
    writeInfluxJoinDates(influxClient, members);

    const mergedGroupMembersData = mergeGroupMembersData(
        members,
        memberCharacters
    );

    writeInfluxGroupMembersData(influxClient, mergedGroupMembersData);
    writeInfluxGroupMembersCharacters(influxClient, memberCharacters);

    influxClient
        .syncWrite()
        .then(() =>
            console.debug(`${Date.now()} destiny: influx write point success`)
        )
        .catch((error) =>
            console.debug(`${Date.now()} destiny: write failed ${error}`)
        );
};

const fetchCharacters = (members) => {
    return Promise.all(
        members.map(function (member) {
            const memberId = member.destinyUserInfo.membershipId;
            const membershipType = member.destinyUserInfo.membershipType;
            // 100
            // 900 Records
            // 1100 Metrics
            return destiny
                .getProfile(membershipType, memberId, [100, 900, 1100])
                .then((response) => {
                    const characterIds =
                        response.Response.profile.data.characterIds;
                    const displayName =
                        response.Response.profile.data.userInfo.displayName;
                    const triumphsTotalScore =
                        response.Response.profileRecords.data.activeScore;
                    const itemsCollected =
                        response.Response.metrics.data.metrics['3981543480']
                            .objectiveProgress.progress;

                    return Promise.all(
                        characterIds.map(function (characterId) {
                            // Destiny Component Types: https://bungie-net.github.io/multi/schema_Destiny-DestinyComponentType.html#schema_Destiny-DestinyComponentType
                            // 200 Characters
                            // 202 CharacterProgressions
                            return destiny
                                .getCharacter(
                                    membershipType,
                                    memberId,
                                    characterId,
                                    [200, 202]
                                )
                                .then(function (response) {
                                    const characterResponse = response.Response;
                                    const fields =
                                        transformCharacterStats(
                                            characterResponse
                                        );
                                    return {
                                        displayName: displayName,
                                        triumphsTotalScore: triumphsTotalScore,
                                        itemsCollected: triumphsTotalScore,
                                        ...fields,
                                    };
                                });
                        })
                    );
                });
        })
    );
};

const cacheSeasonHashes = () => {
    const memberId = process.env.BUNGIE_MEMBER_ID;
    return destiny
        .getProfile(1, memberId, [100])
        .then((response) => {
            hashes.currentSeasonHash =
                response.Response.profile.data.currentSeasonHash;
            return destiny.getDestinyEntityDefinition(
                'DestinySeasonDefinition',
                hashes.currentSeasonHash
            );
        })
        .then((response) => {
            hashes.currentSeasonPassHash = response.Response.seasonPassHash;
            return destiny.getDestinyEntityDefinition(
                'DestinySeasonPassDefinition',
                hashes.currentSeasonPassHash
            );
        })
        .then((response) => {
            hashes.rewardProgressionHash =
                response.Response.rewardProgressionHash;
            hashes.prestigeProgressionHash =
                response.Response.prestigeProgressionHash;
            return hashes;
        });
};

const fetchAggregateStats = (clanId) => {
    return destiny.getClanAggregateStats(clanId).then((response) => {
        return response.Response;
    });
};

const fetchPerMemberStats = async (clanId) => {
    return destiny.getGroupMembers(clanId).then(function (response) {
        const members = response.Response;

        const membersAndCharacters = [
            members,
            fetchCharacters(members.results),
        ];
        return Promise.all(membersAndCharacters);
    });
};

const logDestiny = async (influxClient) => {
    const clanId = process.env.BUNGIE_CLAN_ID;

    cacheSeasonHashes().then((hashes) => {
        const promises = [
            fetchAggregateStats(clanId),
            fetchPerMemberStats(clanId),
        ];
        return Promise.all(promises)
            .then((results) => {
                return writeInflux(influxClient, ...results);
            })
            .catch((err) => {
                console.error(`Error: ${err}`);
            });
    });
};

module.exports = logDestiny;
