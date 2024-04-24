const {
    connectBot,
    getTracks,
    updatePlaylist,
    clonePlaylist
} = require('./spotify.js');
const {
    removetheme,
    listthemes,
    createtheme,
    reloadplaylist,
    saveplaylist,
    setplaylist,
    setsongscore,
    settheme,
    stop
} = require('./commands.js');
const {
    like,
    dislike,
    love,
    hate,
    sendballot,
    updateballot,
} = require('./voting.js');

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
const { connect } = require('http2');

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
    ariDM: '946077905199435836', // Unused
    ariID: '946077905199435836', // Unused
    botID: '1043633807267467415',

    // Channel ID for rating songs
    spotChannel: '1061146423950856253',
    // Channel ID for changelog
    spotLogChat: '1061146481945489518',
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
    themeslist: new Discord.Collection,
    // Map of voting emotes to functions
    votes: new Map([
        ["🤮", hate],
        ["👎", dislike],
        ["👍", like],
        ["🥰", love]
    ]),

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
    // Message corresponding to the theme changing system
    themeMessage: null,

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

        connectBot(bot);

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
            getTracks(bot.seaID)
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
            keys: Array.from(bot.themeslist.keys()),
            themes: Array.from(bot.themeslist.values()),
            thememsg: bot.themeMessage
        }

        var settingsfile = './data/spotify/settings.json';
        var themesfile = './data/spotify/themes.json';

        // Saves settings to .json files
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
        for (var i = 0; i < themes.keys.length; i++) {
            bot.themeslist.set(themes.keys[i], themes.themes[i]);
        }
        bot.ratingMessage = settings.ratmsg;
        bot.themeMessage = themes.thememsg;

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

        // Format theme name
        var temp = bot.ratingtheme.split(" ");
        for (var i = 0; i < temp.length; i++) {
            temp[i] = temp[i][0].toUpperCase() + temp[i].substring(1);
        }
        var theme = temp.join(" ");

        // Log activity
        console.log("Theme Data For '" + theme + "' Saved");
        bot.client.channels.cache.get(bot.spotLogChat).send("Theme Data For '" + theme + "' Saved");
    },
    loadTheme: function (newtheme) {
        if (this.themeExists(newtheme)) {
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

            // Change ratingMessage and themeMessage content or send new messages if one doesn't exist
            if (bot.ratingMessage != null && bot.ratingMessage != "" && bot.themeMessage != null && bot.themeMessage != "") {
                updateballot([bot.ratingMessage, bot.themeMessage], bot);
            }
            else {
                sendballot(bot.spotChannel, bot);
            }

            // Format theme name
            var temp = bot.ratingtheme.split(" ");
            for (var i = 0; i < temp.length; i++) {
                temp[i] = temp[i][0].toUpperCase() + temp[i].substring(1);
            }
            var theme = temp.join(" ");

            // Log activity
            console.log("Theme Updated To '" + theme + "'");
            bot.client.channels.cache.get(bot.spotLogChat).send("Theme Updated To '" + theme + "'");

            // Sync the data to the masterlist
            bot.syncToMaster();
            // Save changes to settings
            bot.saveSettings();
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

    // Takes a playlist id and returns a list of the uris of the songs in that playlist
    getPlaylistUris: function (playid) {
        // Get a list of uris from given playlist
        return new Promise((resolve, reject) => {
            // Create an empty list to return
            var uris = [];
            getTracks(playid)
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
    themeExists: function (theme) {
        //checks to see if theme exists
        if (Array.from(bot.themeslist.values()).indexOf(theme) != -1) {
            return true;
        }
        return false;
    },
    getKeyFromVal: function (map, val) {
        var rkey = -1
        map.forEach((value, key) => {
            if (value == val) {
                rkey = key;
            }
        });
        return rkey;
    },
    playlistContains: function (list, uri) {
        var add = true;
        list.forEach(item => {
            if (item.track.uri == uri) {
                add = false;
            }
        });
        return add;
    },
    // ------------------------------------------------------------ //

    // --------- EDITING RATING MAPS AND ADDING NEW SONGS --------- //
    // Checks that a song exists in the masterlist and adds it if it doesn't and it's liked
    checkMasterForUri: function (name, uri, add) {
        return new Promise((resolve, reject) => {
            // Can be used to auto add liked songs to master list INCOMPLETE
            if (add && bot.songsObjectMasterList.get(uri) == null) {
                bot.spotifyApi.getPlaylist(bot.seaID)
                    .then((playlistInfo) => bot.spotifyApi.getPlaylistTracks(bot.seaID, { offset: playlistInfo.body.tracks.total - 50 }))
                    .then((lastTracks) => {
                        if (bot.playlistContains(lastTracks.body.items, uri)) {
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
                            bot.addSong(name, uri);
                            resolve(uri);
                        }
                    });
            }
            else {
                resolve(uri);
            }
        })
    },
    // Adds a song to all maps
    addSong: function (name, uri, value = 0) {
        // Log activity
        console.log("Adding '" + name + "' To Lists");
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

        // Format theme name
        var temp = bot.ratingtheme.split(" ");
        for (var i = 0; i < temp.length; i++) {
            temp[i] = temp[i][0].toUpperCase() + temp[i].substring(1);
        }
        var theme = temp.join(" ");

        // Log activity
        console.log("'" + song.name + "' Value Updated To " + song.value + " in '" + theme + "'");
        bot.client.channels.cache.get(bot.spotLogChat).send("'" + song.name + "' Value Updated To " + song.value);
    }
    // ------------------------------------------------------------ //
}

client.commands = new Map([removetheme,
    ["listthemes", listthemes],
    ["createtheme", createtheme],
    ["reloadplaylist", reloadplaylist],
    ["saveplaylist", saveplaylist],
    ["setplaylist", setplaylist],
    ["setsongscore", setsongscore],
    ["settheme", settheme],
    ["stop", stop]
]);

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
            if (client.commands.get(command) != undefined) {
                // Run the command
                client.commands.get(command)(message, args, bot);
            }
        }
    }
});

// For song voting based on reactions
client.on('messageReactionAdd', (reaction, user) => {
    if (user != bot.botID) {
        // If there is a ballot and this message is the ballot
        if (bot.ratingMessage != null && reaction.message.id === bot.ratingMessage.id) {
            // Check that emoji is valid
            if (["🤮", "👎", "👍", "🥰"].includes(reaction.emoji.name)) {
                // Call the appropriate voting function
                bot.votes.get(reaction.emoji.name)(bot);
            }
        }
        else if (bot.themeMessage != null && reaction.message.id === bot.themeMessage.id) {
            // Check that emoji is valid
            if (Array.from(bot.themeslist.keys()).includes(reaction.emoji.name)) {
                bot.saveTheme();
                bot.loadTheme(bot.themeslist.get(reaction.emoji.name));
            }
        }
        reaction.users.remove(user);
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

console.log("SpotBot v1.3.0");
