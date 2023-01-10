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
const e = require("express");

const app = express();

// Variable used to tell if both discord and spotify have loaded is set to true when the first loads, when the second loads the bot starts
// this exists because sometimes they load in different orders so I don't know when to start doing things
var canLoad = false;

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
    ariDM: '946077905199435836', // Unused
    ariID: '946077905199435836', // Unused
    botID: '1043633807267467415', // Unused

    // Discord Variables
    // Channel ID for rating songs
    spotChannel: '1060998261546160128',
    // Channel ID for changelog
    spotLogChat: '946677297728069632',
    // Message with song data for rating
    songMessage: null,

    // Spotify Variables
    // User ID for logged in spotify account
    spotifyUserID: 'jdv0921', // Unused
    // Master playlist
    seaID: '67LeHr41yfTbQYxQWjSV5F',
    // Theme playlist
    themelistID: '5cDuriM7Kj8ybF0Av8Qum1',

    // Spotify api
    spotifyApi: new SpotifyWebApi({
        clientId: clientId,
        clientSecret: clientSecret,
        redirectUri: 'http://localhost:8888/callback'
    }),
    // Min and max scores allowed
    min: -25,
    max: 25,

    // Loaded from themes.json
    // List of registered themes
    themeslist: [],

    // Loaded from settings.json
    // Current playlist theme
    playlisttheme: null,
    // Current playlist setting (top, bottom, rank)
    playsetting: null,
    // Value defining how many/what percent to add to the theme playlist
    playvalue: null,
    // Current rating theme
    ratingtheme: null,
    // Message corresponding to the song rating system
    ratingMessage: null,

    // Lists for songs and data
    // Array of song objects in master playlist, value always set to 0
    songsObjectMasterList: new Discord.Collection,
    // Map of songs in theme playlist to song objects, key is song uri
    songsObjectRatingMap: new Discord.Collection,
    // Map of scores in theme to a list of songs with that score, key is song score int
    songsObjectRankMap: new Discord.Collection,

    // ----------------------- INITIAL LOAD ----------------------- //
    // Runs with on ready
    startup: function () {
        // Log activity
        console.log("Bot Logged Into Discord");

        // Start loading stuff if spotify and discord are both loaded
        if (canLoad) {
            bot.startupSpotify();
        }
        else {
            canLoad = true;
        }
    },
    // Load spotify and song data
    startupSpotify: function () {
        // Load master playlist and updates
        bot.loadMaster()
            .then(() => {
                // Load settings (playlist theme, playlist setting (int or %), rating theme)
                bot.loadSettings();
                // Load song maps and scores
                bot.loadTheme(bot.ratingtheme);
                // Reload playlist
                bot.helpers('reloadplaylist', bot.playlisttheme + " " + bot.playsetting + " " + bot.playvalue);
                if (bot.ratingMessage == null) {
                    bot.helpers('sendballot', bot.spotChannel, bot);
                }

                // Log activity
                console.log("Bot Loaded");
                bot.client.channels.cache.get(bot.spotLogChat).send("Bot Loaded");
            });
    },
    // Handles reading in the master song list
    loadMaster: function () {
        return new Promise((resolve, reject) => {
            // Log activity
            console.log("Reading Master Playlist");
            bot.client.channels.cache.get(bot.spotLogChat).send("Reading Master Playlist");
            // Load masterlist from spotify
            bot.getTracks(bot.seaID)
                .then(tracks => {
                    tracks.forEach(item => {
                        // Only support non-local songs
                        if (item.track.uri.indexOf("spotify:local") == -1) {
                            let newsong = new Song(item.track.name, item.track.uri, 0);
                            bot.songsObjectMasterList.set(newsong.uri, newsong);
                        }
                        else {
                            // Log activity
                            console.log("'" + item.track.name + "' Is Local And Unsupported");
                            bot.client.channels.cache.get(bot.spotLogChat).send("'" + item.track.name + "' Is Local And Unsupported");
                        }
                    });

                    // Log activity
                    console.log("Master Playlist Loaded");
                    bot.client.channels.cache.get(bot.spotLogChat).send("Master Playlist Loaded");
                    resolve();
                });
        })
            .catch(function (error) {
                if (error.statusCode === 500 || error.statusCode === 502) {
                    // If there's a server error try again
                    bot.loadMaster()
                        .then(() => resolve())
                }
                else {
                    // Log activity
                    console.log("Something Went Wrong While Reading Master List");
                    bot.client.channels.cache.get(bot.spotLogChat).send("Something Went Wrong While Reading Master List");
                    console.log(error);
                }
            });
    },
    // ------------------------------------------------------------ //

    // -------------------- SAVING AND LOADING -------------------- //
    // Save/load most recent settings for the playlist and rating theme, also loads themelist
    saveSettings: function () {
        // Create wrappers for saving settings
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

        // Saves settings to a .json files
        fs.writeFileSync(settingsfile, JSON.stringify(settings), e => {
            if (e) throw e;
        });
        fs.writeFileSync(themesfile, JSON.stringify(themes), e => {
            if (e) throw e;
        });

        // Log activity
        console.log("Settings Saved");
        bot.client.channels.cache.get(bot.spotLogChat).send("Settings Saved");
    },
    loadSettings: function () {
        // Get saved settings
        var settingsfile = './data/spotify/settings.json';
        var themesfile = './data/spotify/themes.json';
        var settings = JSON.parse(fs.readFileSync(settingsfile));
        var themes = JSON.parse(fs.readFileSync(themesfile));

        // Read in playlist theme, settings, rating theme, and a list of all themes
        bot.playlisttheme = settings.playtheme;
        bot.playsetting = settings.playset;
        bot.playvalue = settings.playval;
        bot.ratingtheme = settings.ratetheme;
        bot.themeslist = themes.themes;
        bot.ratingMessage = settings.ratmsg;

        // Log activity
        console.log("Settings Loaded");
        bot.client.channels.cache.get(bot.spotLogChat).send("Settings Loaded");

        bot.saveSettings();
    },
    // Initializes the maps that store song objects
    initSongMaps: function () {
        // Creates and initializes songsObjectRatingMap and songsObjectRankMap
        for (var i = bot.min; i <= bot.max; i++) {
            bot.songsObjectRankMap.set(i, new Discord.Collection);
        }
        bot.songsObjectMasterList.forEach((song, key) => {
            bot.songsObjectRatingMap = new Discord.Collection;
        });
    },
    // Save/load theme data (song ratings)
    saveTheme: function () {
        var playlistthemesongs = {
            songs: Array.from(bot.songsObjectRatingMap.values())
        }

        // Write the current playlist theme to ./data/spotify/themes/---theme---.json
        var themefile = './data/spotify/themes/' + bot.ratingtheme + '.json';
        fs.writeFileSync(themefile, JSON.stringify(playlistthemesongs), e => {
            if (e) throw e;
        });

        // Log activity
        console.log("Theme Data Saved");
        bot.client.channels.cache.get(bot.spotLogChat).send("Theme Data Saved");
    },
    loadTheme: function (newtheme) {
        if (bot.themeslist.indexOf(newtheme) != -1) {
            // Reset the song collections
            bot.initSongMaps();

            // Load ./data/spotify/themes/---theme---.json data into songslist
            var themefile = './data/spotify/themes/' + newtheme + '.json';
            var themedata = JSON.parse(fs.readFileSync(themefile));
            var songslist = themedata.songs;

            // Fill a map with all the default values from the master list
            tempMap = new Discord.Collection;
            bot.songsObjectMasterList.forEach((song, key) => {
                bot.songsObjectRatingMap.set(key, JSON.parse(JSON.stringify(song)));
            });
            // After reading in the master list, overwrite rated songs with the proper values (uri => song)
            songslist.forEach(song => {
                bot.songsObjectRatingMap.set(song.uri, song);
            });
            // Fill the rank map with the proper values (value => [songs])
            bot.songsObjectRatingMap.forEach((song, key) => {
                bot.songsObjectRankMap.get(song.value).set(key, song);
            });

            // Update theme variable
            bot.ratingtheme = newtheme;

            // Change ratingMessage content or send a rating message if one doesn't exist
            if (bot.ratingMessage != null && bot.ratingMessage != "") {
                bot.helpers('updateballot', bot.ratingMessage, bot);
            }
            else {
                bot.helpers('sendballot', bot.spotChannel, bot);
            }

            // Log activity
            console.log("Theme Loaded");
            bot.client.channels.cache.get(bot.spotLogChat).send("Theme Loaded");

            // Sync the data to the masterlist
            bot.syncToMaster();
            // Save changes to settings
            bot.saveSettings();
            bot.saveTheme();
        }
        else {
            // Log activity
            console.log("Theme Does Not Exist");
            bot.client.channels.cache.get(bot.spotLogChat).send("Theme Does Not Exist");
        }
    },
    // Compares the current theme file to the master list, after run theme file will have songs not on master list removed
    syncToMaster: function () {
        bot.songsObjectRatingMap.forEach((song, key) => {
            if (bot.songsObjectMasterList.get(key) == null) {
                bot.removeSong(key);
            }
        });

        // Log activity
        console.log("Playlist Theme Synced To Master");
        bot.client.channels.cache.get(bot.spotLogChat).send("Playlist Theme Synced To Master");
    },
    // ------------------------------------------------------------ //

    // --------------- CREATING AND DELETING THEMES --------------- //
    // Creates a new theme and initializes all scores to 0
    newTheme: function (newtheme) {
        // Create a new theme file and initialize it to have all songs in the master list with values of 0
        var themefile = './data/spotify/themes/' + newtheme + '.json';
        if (!fs.existsSync(themefile)) {
            // Add the theme to the themelist
            bot.themeslist.push(newtheme);

            var playlistthemesongs = {
                songs: Array.from(bot.songsObjectMasterList.values())
            }

            // Saves theme to a .json file
            fs.writeFileSync(themefile, JSON.stringify(playlistthemesongs), e => {
                if (e) throw e;
            });

            // Log activity
            console.log("New Theme '" + newtheme + "' Created");
            bot.client.channels.cache.get(bot.spotLogChat).send("New Theme '" + newtheme + "' Created");

            // Save changes to settings
            bot.saveSettings();
            return true;
        }
        return false;
    },
    // Deletes a theme
    delTheme: function (theme) {
        // Remove a theme file
        var themefile = './data/spotify/themes/' + theme + '.json';
        if (fs.existsSync(themefile)) {
            // Remove the theme from the themelist
            bot.themeslist = bot.themeslist.filter(e => e !== theme);
            // Delete's the file at themefile
            fs.unlinkSync(themefile);

            // Log activity
            console.log("Theme '" + theme + "' Deleted");
            bot.client.channels.cache.get(bot.spotLogChat).send("Theme '" + theme + "' Deleted");

            // Save changes to settings
            bot.saveSettings();
            return true;
        }
        return false;
    },
    // ------------------------------------------------------------ //

    // ------------ GETTING AND CONVERTING INFORMATION ------------ //
    // Takes a playlist id and returns a promise that resolves to a list of spotify songs
    getTracks: function (playlistID) {
        // Return a promise
        return new Promise((resolve, reject) => {
            // Get playlist data from API
            bot.spotifyApi.getPlaylist(playlistID)
                // Send the length of the playlist into readTracks so that it knows how much to scan
                .then((playlistInfo) => bot.readTracks(playlistInfo.body.tracks.total, playlistID))
                // Resolve the tracks back out to the promise
                .then((tracks) => resolve(tracks))
                // Error handling 
                .catch(function (error) {
                    if (error.statusCode === 500 || error.statusCode === 502) {
                        // If there's a server error try again
                        bot.getTracks(playlistID)
                            // Resolve with results of successful attempt
                            .then((tracks) => resolve(tracks))
                    }
                    else {
                        console.log("Something Went Wrong In getTracks");
                        console.log(error);
                    }
                });
        });
    },
    // Songs can only be loaded 100 at a time so this helper function is used to assist the above function
    readTracks: function (goal, playlistID, totTracks = [], newTracks = []) {
        // Add the next batch of tracks onto the total list of tracks
        Array.prototype.push.apply(totTracks, newTracks);

        if (totTracks.length < goal) {
            // Log activity
            console.log("Reading Chunk " + (1 + Math.floor(totTracks.length / 100)) + "/" + (Math.ceil(goal / 100)));
            bot.client.channels.cache.get(bot.spotLogChat).send("Reading Chunk " + (1 + Math.floor(totTracks.length / 100)) + "/" + (Math.ceil(goal / 100)));
        }

        // Return a promise 
        return new Promise((resolve, reject) => {
            // If we have read all tracks, resolve with the tracks
            if (totTracks.length == goal) { // Fix this line
                resolve(totTracks);
            }
            else {
                // Get the next batch of tracks
                bot.spotifyApi.getPlaylistTracks(playlistID, { offset: totTracks.length })
                    // Pass that next batch into the next step of readTracks (recurs until complete list is read)
                    .then((tracksInfo) => bot.readTracks(goal, playlistID, totTracks, tracksInfo.body.items))
                    // Resolve the tracks annd pass them up the recursion chain
                    .then((result) => resolve(result))
                    // Error handling
                    .catch(function (error) {
                        if (error.statusCode === 500 || error.statusCode === 502 || error.statusCode === 429) {
                            console.log('server error') // delete
                            // If there's a server error try again
                            bot.getTracks(playlistID)
                                // Resolve with results of successful attempt
                                .then((tracks) => resolve(tracks))
                        }
                        else {
                            console.log("Something Went Wrong In readTracks");
                            console.log(error);
                        }
                    });
            }
        })
    },
    // Takes a playlist id and returns a list of the uris of the songs in that playlist
    getPlaylistUris: function (playid) {
        // Get a list of uris from given playlist
        return new Promise((resolve, reject) => {
            // Create an empty list to return
            var uris = [];
            bot.getTracks(playid)
                .then((tracks) => {
                    tracks.forEach(item => {
                        // Only support non-local songs
                        if (item.track.uri.indexOf("spotify:local") == -1) {
                            uris.push(item.track.uri);
                        }
                    });
                    // Resolve the uri list out to be used
                    resolve(uris);
                });
        })
            .catch(() => reject());
    },
    // Converts a list of songs to a list of uris
    songsToUris: function (songs) {
        var uris = [];
        for (var i = 0; i < songs.length; i++) {
            uris.push(songs[i].uri);
        }
        return uris;
    },
    // Converts a list of uris to a list of rated songs
    urisToSongs: function (uris) {
        var songs = [];
        for (var i = 0; i < uris.length; i++) {
            songs.push(bot.songsObjectRatingMap.get(uris[i]));
        }
        return songs;
    },
    playlistChunkBuilder: function (uris, remove) {
        var arr = [];
        for (i = 0; i < uris.length; i += 100) {
            var temp = uris.slice(i, i + 100);
            if (remove) {
                for (var o = 0; o < temp.length; o++) {
                    temp[o] = { uri: temp[o] };
                }
            }
            arr.push(temp);
        }
        return arr;
    },
    themeExists: function (theme) {
        //checks to see if theme exists
        if (bot.themeslist.indexOf(theme) != -1) {
            return true;
        }
        return false;
    },
    // ------------------------------------------------------------ //

    // --------- EDITING RATING MAPS AND ADDING NEW SONGS --------- //
    // Checks that a song exists in the masterlist and adds it if it doesn't and it's liked
    checkMasterForUri: function (name, uri, add) {
        return new Promise((resolve, reject) => {
            // Can be used to auto add liked songs to master list INCOMPLETE
            if (add) {
                if (bot.songsObjectMasterList.get(uri) == null) {
                    // Log activity
                    console.log("Adding " + name + " To The Master Playlist");
                    bot.client.channels.cache.get(bot.spotLogChat).send("Adding " + name + " To The Master Playlist");
                    // Add the song to all active lists
                    bot.spotifyApi.addTracksToPlaylist(bot.seaID, [uri])
                        .then(() => {
                            bot.addSong(name, uri);
                            resolve(uri);
                        });
                }
                else {
                    resolve(uri);
                }
            }
            else {
                resolve(uri);
            }
        })
    },
    // Adds a song to all maps
    addSong: function (name, uri, value = 0) {
        // Log activity
        console.log("Adding '" + bot.songsObjectRatingMap.get(uri).name + "' To Lists");
        bot.client.channels.cache.get(bot.spotLogChat).send("Adding '" + name + "' To Lists");

        tempSong = new Song(name, uri, value);
        bot.songsObjectMasterList.set(tempSong.uri, new Song(name, uri, value));
        bot.songsObjectRatingMap.set(tempSong.uri, tempSong);
        bot.songsObjectRankMap.get(tempSong.value).set(tempSong.uri, tempSong);
        bot.saveTheme();
    },
    // Removes a song from all maps
    removeSong: function (uri) {
        // Log activity
        console.log("Removing '" + bot.songsObjectRatingMap.get(uri).name + "' From Lists");
        bot.client.channels.cache.get(bot.spotLogChat).send("Removing '" + bot.songsObjectRatingMap.get(uri).name + "' From Lists");

        bot.songsObjectRankMap.get(bot.songsObjectRatingMap.get(uri).value).delete(uri);
        bot.songsObjectRatingMap.delete(uri);
        bot.songsObjectMasterList.delete(uri); // Unused
    },
    // Updates a song's rating in the current theme
    changeSongVal: function (uri, change) {
        // Updates rating values in songsObjectRatingMap
        var song = bot.songsObjectRatingMap.get(uri);
        song.value = song.value + change;
        bot.songsObjectRatingMap.set(song.uri, song); // Unused
        // Updates rating values in songsObjectRankMap
        bot.songsObjectRankMap.get(song.value).set(song.uri, song);
        bot.songsObjectRankMap.get(song.value - change).delete(song.uri);

        // Log activity
        console.log("'" + song.name + "' Value Updated To " + song.value);
        bot.client.channels.cache.get(bot.spotLogChat).send("'" + song.name + "' Value Updated To " + song.value);
    },
    // ------------------------------------------------------------ //

    // ----------- MAKING CHANGES TO THE THEME PLAYLIST ----------- //
    // Saves the current playlist as a clone playlist
    savePlaylist: function (name, public) {
        // Clones current playlist into a new playlist called name
        var songs;
        bot.getPlaylistUris(bot.themelistID)
            .then(uris => {
                return bot.urisToSongs(uris);
            })
            .then(songobjects => {
                songs = songobjects;
                bot.spotifyApi.createPlaylist(name, { 'description': 'My auto generated playlist of my ' + bot.playsetting + ' ' + bot.playvalue + ' ' + bot.playlisttheme + ' songs. (prompt: setplaylist ' + bot.playlisttheme + ' ' + bot.playsetting + ' ' + bot.playvalue + ")", 'public': public })
                    .then((playlistInfo) => {
                        bot.createSpotifyPlaylist(playlistInfo.body.id, songs);
                    })

                // Log activity
                console.log("Playlist With Settings: '" + bot.playlisttheme + ' ' + bot.playsetting + ' ' + bot.playvalue + "' Saved");
                bot.client.channels.cache.get(bot.spotLogChat).send("Playlist With Settings: '" + bot.playlisttheme + ' ' + bot.playsetting + ' ' + bot.playvalue + "' Saved");
            });
    },
    // Loads the theme playlist with the most recent settings
    reloadPlaylist: function () {
        // Log activity
        console.log("Reloading Playlist");
        bot.client.channels.cache.get(bot.spotLogChat).send("Reloading Playlist");

        // Reload the playlist with the previously used data
        bot.setPlaylist(bot.playlisttheme, bot.playsetting, bot.playvalue);
    },
    // Create a new playlist on the dynamic playlist
    setPlaylist: function (theme, type, value) {
        var run = true;
        try {
            // If theme exists
            if (bot.themeExists(theme)) {
                // Create a ranked map for the theme of all its songs sorted by value
                var tempMap = bot.createRankedMap(theme);
                // Format val to send into the constructor
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
                        val = Math.ceil(bot.songsObjectMasterList.size * (parseFloat(value.substring(0, str.length - 1)) / 100));
                    }
                    else if (!isNaN(value)) {
                        val = Math.ceil(parseFloat(value));
                    }
                    else {
                        // Do not continue if invalid args
                        run = false;
                        // Log activity
                        console.log("Invalid Value Type");
                        bot.client.channels.cache.get(bot.spotLogChat).send("Invalid Value Type");
                    }
                    // Check that val is in range
                    if (val < 0 || val > bot.songsObjectMasterList.size) {
                        run = false;
                    }
                    if (run) {
                        // Send data to constructor
                        bot.constructPlaylistStandard(tempMap, type, val);
                    }
                }
                // Save new settings
                bot.playlisttheme = theme;
                bot.playsetting = type;
                bot.playvalue = value;
                bot.saveSettings();
            }
            else {
                console.log("Theme Does Not Exist");
                bot.client.channels.cache.get(bot.spotLogChat).send("Theme Does Not Exist");
            }
            if (run) {
                // Log activity
                console.log("Playlist Updated To Settings: '" + theme + ' ' + type + ' ' + value + "'");
                bot.client.channels.cache.get(bot.spotLogChat).send("Playlist Updated To Settings: '" + theme + ' ' + type + ' ' + value + "'");
                return true;
            }
            else {
                // Log activity
                console.log("Playlist Failed To Update");
                bot.client.channels.cache.get(bot.spotLogChat).send("Playlist Failed To Update");
                return false;
            }
        }
        catch {
            // Log activity
            console.log("Playlist Failed To Update");
            bot.client.channels.cache.get(bot.spotLogChat).send("Playlist Failed To Update");
            return false;
        }
    },
    // Creates a temporary map to be passed into a construct playlist function for changing the playlist
    createRankedMap: function (theme) {
        // Creates a song map and returns it for playlist altering
        tempMap = new Discord.Collection;
        // Read in theme file data
        var themefile = './data/spotify/themes/' + theme + '.json';
        var themedata = JSON.parse(fs.readFileSync(themefile));
        var songslist = themedata.songs;
        // Get a list of all songs in the masterlist
        var templist = Array.from(bot.songsObjectMasterList.values());
        // For each song in the masterlist add it to a uri - song map
        templist.forEach(song => {
            tempMap.set(song.uri, song);
        });
        // Overwrite songs with values from the theme rating data
        songslist.forEach(song => {
            tempMap.set(song.uri, song);
        });
        // Initialize a map with an empty list for each possible rating between min and max
        rankMap = new Discord.Collection;
        for (var i = bot.min; i <= bot.max; i++) {
            rankMap.set(i, []);
        }
        // For each song in the master list use it's uri to get the rated data from tempMap and organizze it by rank instead
        templist.forEach(song => {
            rankMap.get(tempMap.get(song.uri).value).push(tempMap.get(song.uri));
        });
        return rankMap;
    },
    // Playlist constructors!
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
            // Log activity
            console.log("Invalid Creation Type.");
            bot.client.channels.cache.get(bot.spotLogChat).send("Invalid Creation Type");
        }
        bot.createSpotifyPlaylist(bot.themelistID, playlistsongs);
    },
    constructPlaylistRank: function (map, val) {
        bot.createSpotifyPlaylist(bot.themelistID, map.get(val));
    },
    // Picks X songs from the passed array and returns an array of selected songs
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
    // Removes all songs from the dynamic playlist
    clearDynamicList: function () {
        return new Promise((resolve, reject) => {
            bot.getPlaylistUris(bot.themelistID)
                .then(uris => {
                    bot.playlistChunkBuilder(uris, true).forEach(chunk => {
                        console.log("Removing Songs");
                        bot.spotifyApi.removeTracksFromPlaylist(bot.themelistID, chunk)
                            .catch(() => {
                                bot.tryUntilSuccess(bot.themelistID, chunk, false);
                            });
                    })
                })
                .then(() => {
                    // Log activity
                    console.log("Theme Playlist Cleared");
                    bot.client.channels.cache.get(bot.spotLogChat).send("Theme Playlist Cleared");
                    resolve(true);
                });
        });
    },
    // Adds new songs to the dynamic playlist
    createSpotifyPlaylist: function (playlistID, songs) {
        // Actually make the playlist
        var uris = bot.songsToUris(songs);
        bot.clearDynamicList()
            .then(() => {
                bot.playlistChunkBuilder(uris, false).forEach(chunk => {
                    console.log("Adding Songs");
                    bot.spotifyApi.addTracksToPlaylist(playlistID, chunk)
                        .catch(() => {
                            bot.tryUntilSuccess(playlistID, chunk, true);
                        });
                });
                // Log activity
                console.log("Theme Playlist Songs Loaded");
                bot.client.channels.cache.get(bot.spotLogChat).send("Theme Playlist Songs Loaded");
            });
    },
    // If a song is failed to add, retry until success
    tryUntilSuccess: function (playlistID, chunk, add) {
        if (add) {
            console.log("Adding Songs");
            bot.spotifyApi.addTracksToPlaylist(playlistID, chunk)
                .catch(() => {
                    bot.tryUntilSuccess(playlistID, chunk, true);
                });
        }
        else {
            console.log("Removing Songs");
            bot.spotifyApi.removeTracksFromPlaylist(playlistID, chunk)
                .catch(() => {
                    bot.tryUntilSuccess(playlistID, chunk, false);
                });
        }
    },
    // ------------------------------------------------------------ //

    // ------------------------- ADD HERE ------------------------- //

    // ------------------------------------------------------------ //

    // --------------------- HELPER FUNCTIONS --------------------- //
    // Calls helper functions
    helpers: function (name, params) {
        // Check if the helper exists
        if (client.things.get('helpers').get(name) != undefined) {
            // Run the helper
            var out = client.things.get('helpers').get(name).execute(params, this);

            if (out != undefined) {
                return out;
            }
        }
    }
    // ------------------------------------------------------------ //
}

client.things = new Discord.Collection();
// Sets up the text and dm folders
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

// Sets up the helper folder
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

// When bot loads
client.once('ready', () => {
    bot.startup();
});

// For bot commands
client.on('messageCreate', message => {
    // Ignore messages from itself
    if (message.author.bot) return;
    if (!message.guild) {
        // On dm receive
    }
    // The message is in a text channel
    else if (message.channel.type === 0) {
        // If the message starts with prefix
        if (message.content.startsWith(bot.prefix)) {
            // Splits the message into words after the prefix
            const args = message.content.slice(bot.prefix.length).split(/ +/);

            // The first word in the message following the prefix
            const command = args.shift().toLowerCase();

            // Check if the command is in the list
            if (client.things.get('textcommands').get(command) != undefined) {
                // Run the command
                client.things.get('textcommands').get(command).execute(message, args, bot);
            }
        }
    }
});

// For song voting based on reactions
client.on('messageReactionAdd', (reaction, user) => {
    // If there is a ballot and this message is the ballot and the person who reacted is jasper
    if (bot.ratingMessage != null && reaction.message.id === bot.ratingMessage.id) {
        // Check that emoji is valid
        if (["🤮", "👎", "👍", "🥰"].includes(reaction.emoji.name)) {
            // Call helper for emoji
            bot.helpers(reaction.emoji.name, { reaction: reaction, user: user });
            reaction.users.remove(user);
        }
    }
});

// Spotify login things
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
            res.send("Success! You can now close the window.");

            // Log activity
            console.log("Bot Logged Into Spotify");

            // Start loading stuff if spotify and discord are both loaded
            if (canLoad) {
                bot.startupSpotify();
            }
            else {
                canLoad = true;
            }

            setInterval(async () => {
                const data = await bot.spotifyApi.refreshAccessToken();
                const access_token = data.body['access_token'];

                console.log("The access token has been refreshed!");
                bot.spotifyApi.setAccessToken(access_token);
            }, expires_in / 2 * 1000);
        })
        .catch(error => {
            console.error("Error getting Tokens:", error);
            res.send(`Error getting Tokens: ${error}`);
        });
});

app.listen(8888, () =>
    console.log(
        "HTTP Server up. Now go to http://localhost:8888/login in your browser."
    )
);

client.login(bot.tokenDiscord);

console.log("SpotBot v1.0.0");
