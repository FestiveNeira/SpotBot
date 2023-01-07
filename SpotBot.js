const Discord = require("discord.js");
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const SpotifyWebApi = require('spotify-web-api-node');
const client = new Discord.Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers
    ],
    
    partials: [
        Partials.Channel,
        Partials.Message
    ]
})

const fs = require('fs');
const express = require('express');

const { tokenDiscord, clientId, clientSecret } = require('./data/config.json');
const { resolve } = require('path');

const app = express();

class Song {
    constructor(name, uri, value) {
        this.name = name;
        this.uri = uri;
        this.value = value;
    }
}

var bot = {
    tokenDiscord: tokenDiscord,
    prefix: '-',
    client: client,
    channelTypes: ['dm', 'text'],
    messageTypes: ['commands', 'generics', 'specials'],
    ariDM: '946077905199435836',
    ariID: '946077905199435836',
    botID: '1043633807267467415',

    //channel ID for rating songs
    spotChannel: '1060998261546160128',
    //channel ID for songs changelog
    spotLogChat: '946677297728069632',
    //message with song data for rating
    songMessage: null,

    spotifyApi: new SpotifyWebApi({
        clientId: clientId,
        clientSecret: clientSecret,
        redirectUri: 'http://localhost:8888/callback'
    }),
    //user ID for logged in spotify account
    spotifyUserID:'jdv0921',
    //message corresponding to the song rating system
    ratingMessage: null,

    //master playlist
    seaID: '67LeHr41yfTbQYxQWjSV5F',
    //theme playlist
    themelistID: '5cDuriM7Kj8ybF0Av8Qum1',
    //current playlist theme
    playlisttheme: null,
    //current playlist setting (top, bottom, rank)
    playsetting: null,
    //value defining how many/what percent to add to the theme playlist
    playvalue: null,
    //current rating theme
    ratingtheme: null,
    //list of registered themes
    themeslist: [],

    //min and max scores allowed
    min: -25,
    max: 25,

    //array of song objects in master playlist
    songsObjectMasterList: [],
    //array of song objects
    songsObjectRatingList: [],

    //map of songs in theme playlist to song objects, key is song uri
    songsMap: new Discord.Collection,
    //map of scores in theme to a list of songs with that score, key is song score int
    songlistMap: new Discord.Collection,

    startup: async function () {
        //runs after startup, but before spotify logs in

        //log activity
        bot.client.channels.cache.get(this.spotLogChat).send("Bot Logged Into Discord");
    },

    //loading order fucked
    startupSpotify: async function () {
        //load settings (playlist theme, playlist setting (int or %), rating theme)
        bot.loadSettings();
        //load master playlist and updates
        bot.loadMaster()
        .then(() => {
            //load songsMap and intiallize songlistMap
            bot.initSongsMap();
            //load scores
            bot.loadTheme(bot.ratingtheme);
            //syncs the rating theme by adding/removing songs so it matches the master list
            bot.syncToMaster();
            //reload playlist
            bot.helpers('reloadplaylist', bot.playlisttheme + " " + bot.playsetting + " " + bot.playvalue);
            if (bot.ratingMessage == null) {
                bot.helpers('sendballot', bot.spotChannel, bot);
            }
            console.log('Bot Loaded');

            //log activity
            bot.client.channels.cache.get(this.spotLogChat).send("Bot Logged Into Spotify");
        });
    },

    //save/load most recent settings for the playlist and rating theme, also loads themelist
    saveSettings: function () {
        //create wrappers for saving settings
        var settings = {
            playtheme: bot.playlisttheme,
            playset: bot.playsetting,
            playval: bot.playvalue,
            ratetheme: bot.ratingtheme,
            ratmsg: bot.ratingMessage
        }
        var themes = {
            themes: bot.themeslist
        }

        var settingsfile = './data/spotify/settings.json';
        var themesfile = './data/spotify/themes.json';

        //saves settings to a .json files
        fs.writeFileSync(settingsfile, JSON.stringify(settings), e => {
            if (e) throw e;
        });
        fs.writeFileSync(themesfile, JSON.stringify(themes), e => {
            if (e) throw e;
        });

        //log activity
        bot.client.channels.cache.get(this.spotLogChat).send("Settings Saved");
    },
    loadSettings: function () {
        //get saved settings
        var settingsfile = './data/spotify/settings.json';
        var themesfile = './data/spotify/themes.json';
        var settings = JSON.parse(fs.readFileSync(settingsfile));
        var themes = JSON.parse(fs.readFileSync(themesfile));

        //read in playlist theme, settings, rating theme, and a list of all themes
        bot.playlisttheme = settings.playtheme;
        bot.playsetting = settings.playset;
        bot.playvalue = settings.playval;
        bot.ratingtheme = settings.ratetheme;
        bot.themeslist = themes.themes;
        bot.ratingMessage = settings.ratmsg;

        bot.saveSettings();
        
        //log activity
        bot.client.channels.cache.get(this.spotLogChat).send("Settings Loaded");
    },

    //handles reading in the main song list
    loadMaster: function () {
        return new Promise((resolve, reject) =>
        {
            //load masterlist from spotify
            console.log("reading master list");
            bot.getTracks(bot.seaID)
                .then(tracks => {
                    tracks.forEach(item => {
                        //only support non-local songs
                        if (item.track.uri.indexOf("spotify:local") == -1) {
                            let newsong = new Song(item.track.name, item.track.uri, 0);
                            bot.songsObjectMasterList.push(newsong);
                        }
                        else {
                            console.log(item.track.uri + " is local and unsupported.");
                        }
                    });
                    console.log("master list has been read");

                    //log activity
                    bot.client.channels.cache.get(this.spotLogChat).send("Master Playlist Loaded");
                    resolve();
                });
        })
        .catch(function (error) 
        {
            if (error.statusCode === 500 || error.statusCode === 502)
            {
                console.log("Server error while reading the master list, trying again");
                bot.loadMaster()
                    .then(() => resolve())
            }
            else
            {
                console.log('Something went wrong while reading the master list');
                console.log(error);
            }
        });
    },
    getPlaylistUris: function (playid) {
        //get a list of uris from given playlist
        return new Promise((resolve, reject) => {
            //create an empty list to return
            var uris = [];
            bot.getTracks(playid)
                .then((tracks) => {
                    tracks.forEach(item => {
                        //only support non-local songs
                        if (item.track.uri.indexOf("spotify:local") == -1) {
                            uris.push(item.track.uri);
                        }
                    });
                    console.log('uris retrieved');
                    //resolve the uri list out to be used
                    resolve(uris);
                });
        })
        .catch(() => reject());
    },
    getTracks: function (playlistID) {
        //return a promise
        return new Promise((resolve, reject) => {
            //get playlist data from API
            bot.spotifyApi.getPlaylist(playlistID)
                //send the length of the playlist into readTracks so that it knows how much to scan
                .then((playlistInfo) => bot.readTracks(playlistInfo.body.tracks.total, playlistID))
                //resolve the tracks back out to the promise
                .then((tracks) => resolve(tracks))
                //error handling 
                .catch(function (error) {
                    if (error.statusCode === 500 || error.statusCode === 502) {
                        //report server error
                        console.log("Server error, trying again");
                        //try again
                        bot.getTracks(playlistID)
                            //resolve with results of successful attempt
                            .then((tracks) => resolve(tracks))
                    }
                    else {
                        console.log('Something went wrong in getTracks');
                        console.log(error);
                    }
                });
        });
    },
    readTracks: function (goal, playlistID, totTracks = [], newTracks = []) {
        //add the next batch of tracks onto the total list of tracks
        Array.prototype.push.apply(totTracks, newTracks);

        if (totTracks.length < goal) {console.log("reading chunk " + (1 + Math.floor(totTracks.length / 100)) + "/" + (Math.ceil(goal / 100)));}

        //return a promise 
        return new Promise((resolve, reject) => {
            //if we have read all tracks, resolve with the tracks
            if (totTracks.length == goal) { //fix this line
                resolve(totTracks);
            }
            else {
                //get the next batch of tracks
                bot.spotifyApi.getPlaylistTracks(playlistID, { offset: totTracks.length })
                    //pass that next batch into the next step of readTracks (recurs until complete list is read)
                    .then((tracksInfo) => bot.readTracks(goal, playlistID, totTracks, tracksInfo.body.items))
                    //resolve the tracks annd pass them up the recursion chain
                    .then((result) => resolve(result))
                    //error handling
                    .catch(function (error) {
                        if (error.statusCode === 500 || error.statusCode === 502) {
                            //report server error
                            console.log("Server error, trying again");
                            //try again
                            bot.getTracks(playlistID)
                                //resolve with results of successful attempt
                                .then((tracks) => resolve(tracks))
                        }
                        else {
                            console.log('Something went wrong in readTracks');
                            console.log(error);
                        }
                    });
            }
        })
    },

    //initializes the maps
    initSongsMap: function () {
        //creates songsMap and initializes songlistMap
        //initializes songlistMap indexes
        for (var i = bot.min; i <= bot.max; i++) {
            bot.songlistMap.set(i, []);
        }
        bot.songsObjectMasterList.forEach(song => {
            bot.songsMap.set(song.uri, song);
        });
    },

    //save and load theme data for ratings
    saveTheme: function () {
        //write the current playlist theme to ./data/spotify/themes/---theme---.json
        bot.songsObjectRatingList.forEach(song => {
            song = bot.songsMap.get(song.uri);
        });

        var playlistthemesongs = {
            songs: bot.songsObjectRatingList
        }

        var themefile = './data/spotify/themes/' + bot.ratingtheme + '.json';
        //saves theme to a .json file
        fs.writeFileSync(themefile, JSON.stringify(playlistthemesongs), e => {
            if (e) throw e;
        });

        //log activity
        bot.client.channels.cache.get(this.spotLogChat).send("Theme Data Saved");
    },
    loadTheme: function (newtheme) {
        if (bot.themeslist.indexOf(newtheme) != -1) {
            //load ./data/spotify/themes/---theme---.json to be the current playlist theme
            var themefile = './data/spotify/themes/' + newtheme + '.json';
            var themedata = JSON.parse(fs.readFileSync(themefile));
            var songslist = themedata.songs;
            bot.songsObjectRatingList = songslist;

            bot.initSongsMap();

            //after reading apply values to rating map to help update scores, key is uri
            songslist.forEach(song => {
                bot.songlistMap.get(song.value).push(song);
                bot.songsMap.set(song.uri, song);
            });
            bot.ratingtheme = newtheme;

            bot.syncToMaster();
            bot.saveSettings();

            //change ratingMessage content
            if (bot.ratingMessage != null && bot.ratingMessage != "") {
                bot.helpers('updateballot', bot.ratingMessage, bot);
            }
            else
            {
                bot.helpers('sendballot', bot.spotChannel, bot);
            }
            console.log('Theme Loaded');

            //log activity
            bot.client.channels.cache.get(this.spotLogChat).send('Theme Data Loaded');
        }
        else {
            console.log("Theme does not exist. (loading error)");

            //log activity
            bot.client.channels.cache.get(this.spotLogChat).send("Theme Data Failed To Load");
        }
    },
    themeExists: function (theme) {
        //checks to see if theme exists
        if (bot.themeslist.indexOf(theme) != -1) {
            return true;
        }
        return false;
    },
    newTheme: function (newtheme) {
        //create a new theme file and initialize it to have all songs in the master list with values of 0
        var themefile = './data/spotify/themes/' + newtheme + '.json';
        if (!fs.existsSync(themefile)) {
            //add the theme to the themelist
            bot.themeslist.push(newtheme);

            var playlistthemesongs = {
                songs: bot.songsObjectMasterList
            }

            //saves theme to a .json file
            fs.writeFileSync(themefile, JSON.stringify(playlistthemesongs), e => {
                if (e) throw e;
            });

            //log activity
            bot.client.channels.cache.get(this.spotLogChat).send("New Theme '" + newtheme + "' Created");

            //save changes to settings
            bot.saveSettings();
            return true;
        }
        return false;
    },
    delTheme: function (theme) {
        //remove a theme file
        var themefile = './data/spotify/themes/' + theme + '.json';
        if (fs.existsSync(themefile)) {
            //remove the theme from the themelist
            bot.themeslist = bot.themeslist.filter(e => e !== theme);
            //delete's the file at themefile
            fs.unlinkSync(themefile);

            //log activity
            bot.client.channels.cache.get(this.spotLogChat).send("Theme '" + theme + "' Deleted");

            //save changes to settings
            bot.saveSettings();
            return true;
        }
        return false;
    },

    checkMasterForUri: function (uri, add) {
        return new Promise((resolve, reject) =>
        {
            //can be used to auto add liked songs to master list INCOMPLETE
            if (add) {

            }
            resolve(uri);
        })
    },
    getSongByUri: function (uri, songs) {
        var rsong = null;
        songs.forEach(song => {
            if (song.uri === uri)
            {
                rsong = song;
            }
        });
        return rsong;
    },

    reloadPlaylist: function() {
        //reload the playlist with the previously used data
        bot.setPlaylist(bot.playlisttheme, bot.playsetting, bot.playvalue);
        
        //log activity
        bot.client.channels.cache.get(this.spotLogChat).send("Reloading Playlist");
    },
    savePlaylist: function (name, public) {
        //clones current playlist into a new playlist called name
        var songs;
        bot.getPlaylistUris(bot.themelistID)
        .then(uris => {
            return bot.urisToSongs(uris);
        })
        .then(songobjects => {
            songs = songobjects;
            bot.spotifyApi.createPlaylist(name, {'description': 'My auto generated playlist of my ' + bot.playsetting + ' ' + bot.playvalue + ' ' + bot.playlisttheme + ' songs. (prompt: setplaylist ' + bot.playlisttheme + ' ' + bot.playsetting + ' ' + bot.playvalue + ")", 'public': public})
            .then((playlistInfo) => {
                bot.createSpotifyPlaylist(playlistInfo.body.id, songs);
            })
            
            //log activity
            bot.client.channels.cache.get(this.spotLogChat).send("Playlist With Settings: '" + bot.playlisttheme + ' ' + bot.playsetting + ' ' + bot.playvalue + "' Saved");
        });
    },
    //create a new playlist on the dynamic playlist
    setPlaylist: function (theme, type, value) {
        var run = true;
        try {
            //if theme exists
            if (bot.themeslist.indexOf(theme) != -1) {
                //create a ranked map for the theme of all its songs sorted by value
                var tempMap = bot.createRankedMap(theme);
                //format val to send into the constructor
                var val;
                if (type == "rank" && !isNaN(value)) {
                    val = parseInt(value);
                    if (val > bot.max || val < bot.min) {
                        run = false;
                    }
                    if (run) {
                        bot.constructPlaylistRank(tempMap, val);
                    }
                }
                else {
                    if (value.includes("%") && !isNaN(value.substring(0, str.length - 1))) {
                        val = Math.ceil(bot.songsObjectMasterList.length * (parseFloat(value.substring(0, str.length - 1)) / 100));
                    }
                    else if (!isNaN(value)) {
                        val = Math.ceil(parseFloat(value));
                    }
                    else {
                        //do not continue if invalid args
                        run = false;
                        console.log("Invalid value type.");
                    }
                    //check that val is in range
                    if (val < 0 || val > bot.songsObjectMasterList.length) {
                        run = false;
                    }
                    if (run) {
                        //send data to constructor
                        bot.constructPlaylistStandard(tempMap, type, val);
                    }
                }
                //save new settings
                bot.playlisttheme = theme;
                bot.playsetting = type;
                bot.playvalue = value;
                bot.saveSettings();
            }
            else {
                console.log("Theme does not exist.");
            }
            if (run) {
                //log activity
                bot.client.channels.cache.get(this.spotLogChat).send("Playlist Updated To Settings: '" + theme + ' ' + type + ' ' + value + "'");
                return true;
            }
            else {
                //log activity
                bot.client.channels.cache.get(this.spotLogChat).send("Playlist Failed To Update");
                return false;
            }
        }
        catch {
            //log activity
            bot.client.channels.cache.get(this.spotLogChat).send("Playlist Failed To Update");
            return false;
        }
    },
    //creates a temporary map to be passed into a construct playlist function for changing the playlist
    createRankedMap: function (theme) {
        //creates a song map and returns it for playlist altering
        tempMap = new Discord.Collection;
        //read in theme file data
        var themefile = './data/spotify/themes/' + theme + '.json';
        var themedata = JSON.parse(fs.readFileSync(themefile));
        var songslist = themedata.songs;
        //get a list of all songs in the masterlist
        var templist = bot.songsObjectMasterList;
        //for each song in the masterlist add it to a uri - song map
        templist.forEach(song => {
            tempMap.set(song.uri, song);
        });
        //overwrite songs with values from the theme rating data
        songslist.forEach(song => {
            tempMap.set(song.uri, song);
        });
        //initialize a map with an empty list for each possible rating between min and max
        rankMap = new Discord.Collection;
        for (var i = bot.min; i <= bot.max; i++) {
            rankMap.set(i, []);
        }
        //for each song in the master list use it's uri to get the rated data from tempMap and organizze it by rank instead
        templist.forEach(song => {
            rankMap.get(tempMap.get(song.uri).value).push(tempMap.get(song.uri));
        });
        return rankMap;
    },
    //playlist constructors!
    constructPlaylistStandard: function (map, type, val) {
        countdown = val;
        playlistsongs = [];
        if (type == "top") {
            for (var i = bot.max; i > bot.min; i--) {
                if (map.get(i).length < countdown) {
                    playlistsongs = playlistsongs.concat(map.get(i));
                    countdown -= map.get(i).length;
                }
                else {
                    playlistsongs = playlistsongs.concat(bot.pickXSongs(map.get(i), countdown));
                    break;
                }
            }
        }
        else if (type == "bottom") {
            for (var i = bot.min; i < bot.max; i++) {
                if (map.get(i).length < countdown) {
                    playlistsongs = playlistsongs.concat(map.get(i));
                    countdown -= map.get(i).length;
                }
                else {
                    playlistsongs = playlistsongs.concat(bot.pickXSongs(map.get(i), countdown));
                    break;
                }
            }
        }
        else {
            console.log("Invalid creation type.");
        }
        bot.createSpotifyPlaylist(this.themelistID, playlistsongs);
    },
    constructPlaylistRank: function (map, val) {
        bot.createSpotifyPlaylist(this.themelistID, map.get(val));
    },
    //picks X songs from the passed array and returns an array of selected songs
    pickXSongs: function (arr, x) {
        var countdown = x;
        var list = arr;
        var selected = [];
        while (countdown > 0) {
            var index = Math.floor(Math.random() * list.length);
            selected.push(list[index]);
            list.splice(index, 1);
            countdown--;
        }
        return selected;
    },
    //adds new songs to the dynamic playlist
    createSpotifyPlaylist: async function (playlistID, songs) {
        //actually make the playlist
        var uris = bot.songsToUris(songs);
        bot.clearDynamicList()
        .then(() => {
            uris.forEach(uri => {
                bot.spotifyApi.addTracksToPlaylist(playlistID, [uri])
                .catch(() => {
                    bot.tryUntilSuccess(playlistID, uri, true);
                });
            });
            console.log('songs added')
        });
    },
    //if a song is failed to add, retry until success
    tryUntilSuccess: function (playlistID, uri, add) {
        if (add) {
            bot.spotifyApi.addTracksToPlaylist(playlistID, [uri])
            .catch(() => {
                bot.tryUntilSuccess(playlistID, uri, true);
            });
        }
        else {
            bot.spotifyApi.removeTracksFromPlaylist(playlistID, uri)
            .catch(() => {
                bot.tryUntilSuccess(playlistID, uri, false);
            });
        }
    },
    //removes all songs from the dynamic playlist
    clearDynamicList: function () {
        return new Promise((resolve, reject) => {
            bot.getPlaylistUris(bot.themelistID)
            .then(uris => {
                uris.forEach(uri => {
                    bot.spotifyApi.removeTracksFromPlaylist(bot.themelistID, [{ uri : uri}])
                    .catch(() => {
                        bot.tryUntilSuccess(bot.themelistID, [{ uri : uri}], false);
                    });
                });
                console.log('theme playlist cleared');
                resolve();
            });
        });
    },
    songsToUris: function (songs) {
        var uris = [];
        for (var i = 0; i < songs.length; i++) {
            uris.push(songs[i].uri);
        }
        return uris;
    },
    urisToSongs: function (uris) {
        var songs = [];
        for (var i = 0; i < uris.length; i++) {
            songs.push(this.songsMap.get(uris[i]));
        }
        return songs;
    },

    addSong: function (name, uri, value = 0) {
        //adds a song object to the master playlist rating playist and the rating maps
        tempSong = new Song(name, uri, value);
        bot.songsObjectMasterList.push(tempSong);
        bot.songsObjectRatingList.push(tempSong);
        bot.songsMap.set(uri, tempSong);
        bot.songlistMap.set(tempSong.value, bot.songlistMap.get(tempSong.value).push(tempSong));

        //log activity
        bot.client.channels.cache.get(this.spotLogChat).send("Song Added To Lists");
    },
    removeSong: function (uri) {
        //removes a song from all lists
        bot.songsObjectMasterList = bot.songsObjectMasterList.filter(song => song.uri != uri);
        bot.songsObjectRatingList = bot.songsObjectRatingList.filter(song => song.uri != uri);
        bot.songsMap.set(uri, null);
        bot.songlistMap.set(bot.songsMap.get(uri).value, bot.songlistMap.get(bot.songsMap.get(uri).value).filter(song => song.uri != uri));

        //log activity
        bot.client.channels.cache.get(this.spotLogChat).send("Song Removed From Lists");
    },
    changeSongVal: function (uri, change) {
        //updates rating values in songsMap
        var tempSong = bot.songsMap.get(uri);
        tempSong.value = tempSong.value + change;
        bot.songsMap.set(uri, tempSong);
        //updates rating values in songlistMap
        bot.songlistMap.set(tempSong.value, bot.songlistMap.get(tempSong.value).push(tempSong));
        bot.songlistMap.set((tempSong.value - change), bot.songlistMap.get(tempSong.value - change).filter(song => song.uri != uri));

        //log activity
        bot.client.channels.cache.get(this.spotLogChat).send("'" + tempSong.name + "' Value Updated By " + change);
    },

    syncToMaster: function () {
        //compares the current theme file to the master list, after run theme file will have songs not on master list removed
        //consrtuct a map of the masterlist to make comparing easier
        bot.saveTheme();
        masterMap = new Discord.Collection;
        bot.songsObjectMasterList.forEach(song => {
            masterMap.set(song.uri, song);
        });
        bot.songsObjectRatingList.forEach(song => {
            if (masterMap.get(song.uri) == null) {
                bot.removeSong(uri);
            }
        });
        bot.saveTheme();

        //log activity
        bot.client.channels.cache.get(this.spotLogChat).send("Playlist Theme Synced To Master");
    },

    // ADD HERE //

    helpers: function (name, params) {
        //check if the helper exists
        if (client.things.get('helpers').get(name) != undefined) {
            //run the helper
            var out = client.things.get('helpers').get(name).execute(params, this);

            if (out != undefined) {
                return out;
            }
        }
    }
}

client.things = new Discord.Collection();
//sets up the text and dm folders
bot.channelTypes.forEach(channelType => {
    bot.messageTypes.forEach(messageType => {
        client.things.set(channelType + messageType, new Discord.Collection());

        var directory = './' + channelType + '/' + messageType + '/';

        const files = fs.readdirSync(directory).filter(file => file.endsWith('.js'));
        for (const file of files) {
            const command = require(directory + `${file}`);

            if (channelType + messageType === 'dmspecials' || channelType + messageType === 'textspecials') {
                client.things.get(channelType + messageType).set(command.id, command);
            }
            else {
                client.things.get(channelType + messageType).set(command.name, command);

                if (command.alt != undefined) {
                    client.things.get(channelType + messageType).set(command.alt, command);
                }
            }
        }
    })
});

//sets up the helper folder
client.things.set('helpers', new Discord.Collection());
var directory = './helpers/';
const files = fs.readdirSync(directory).filter(file => file.endsWith('.js'));
for (const file of files) {
    const command = require(directory + `${file}`);

    client.things.get('helpers').set(command.name, command);

    if (command.alt != undefined) {
        client.things.get('helpers').set(command.alt, command);
    }
};

client.once('ready', () => {
    bot.startup();
    console.log('SpotBot v0.1.0');
});

client.on('messageCreate', message => {
    //ignore messages from itself
    if (message.author.bot) return;
    if (!message.guild) {
        //on dm receive
    }
    //the message is in a text channel
    else if (message.channel.type === 0) {
        //if the message starts with prefix
        if (message.content.startsWith(bot.prefix)) {
            //splits the message into words after the prefix
            const args = message.content.slice(bot.prefix.length).split(/ +/);

            //the first word in the message following the prefix
            const command = args.shift().toLowerCase();

            //check if the command is in the list
            if (client.things.get('textcommands').get(command) != undefined) {
                //run the command
                client.things.get('textcommands').get(command).execute(message, args, bot);
            }
        }
    }
});

//for song voting based on reactions
client.on('messageReactionAdd', (reaction, user) => {
    // if there is a ballot and this message is the ballot and the person who reacted is jasper
    if (bot.ratingMessage != null && reaction.message.id === bot.ratingMessage.id)
    {
        //check that emoji is valid
        if (["🤮", "👎", "👍", "🥰"].includes(reaction.emoji.name))
        {
            // call helper for emoji
            bot.helpers(reaction.emoji.name, {reaction: reaction, user: user});
            reaction.users.remove(user);
        }
    }
});

//spotify login things
const scopes = [
    'ugc-image-upload',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
    'app-remote-control',
    'user-read-email',
    'user-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-read-private',
    'playlist-modify-private',
    'user-library-modify',
    'user-library-read',
    'user-top-read',
    'user-read-playback-position',
    'user-read-recently-played',
    'user-follow-read',
    'user-follow-modify'
];

app.get('/login', (req, res) => {
    res.redirect(bot.spotifyApi.createAuthorizeURL(scopes));
});

app.get('/callback', (req, res) => {
    const error = req.query.error;
    const code = req.query.code;
    const state = req.query.state;

    if (error) {
        console.error('Callback Error:', error);
        res.send(`Callback Error: ${error}`);
        return;
    }

    bot.spotifyApi
        .authorizationCodeGrant(code)
        .then(data => {
            const access_token = data.body['access_token'];
            const refresh_token = data.body['refresh_token'];
            const expires_in = data.body['expires_in'];

            bot.spotifyApi.setAccessToken(access_token);
            bot.spotifyApi.setRefreshToken(refresh_token);

            console.log(
                `Successfully retrieved access token. Expires in ${expires_in} s.`
            );
            res.send('Success! You can now close the window.');

            bot.startupSpotify();

            setInterval(async () => {
                const data = await bot.spotifyApi.refreshAccessToken();
                const access_token = data.body['access_token'];

                console.log('The access token has been refreshed!');
                bot.spotifyApi.setAccessToken(access_token);
            }, expires_in / 2 * 1000);
        })
        .catch(error => {
            console.error('Error getting Tokens:', error);
            res.send(`Error getting Tokens: ${error}`);
        });
});

app.listen(8888, () =>
    console.log(
        'HTTP Server up. Now go to http://localhost:8888/login in your browser.'
    )
);

client.login(bot.tokenDiscord);