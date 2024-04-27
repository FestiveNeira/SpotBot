const {
    connectBot,
    getTracks,
    checkMasterForUri,
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

const { tokenDiscord } = require('./data/config.json');


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

    // Message with song data for rating
    songMessage: null,

    // Maps channels for sending messages
    channelids: new Map([
        // Channel ID for logs
        [0,'1061146481945489518'],
        // Channel ID for rating songs
        [1,'1061146423950856253'],
        [2,'946077905199435836']
    ]),

    // Spotify Variables
    // User ID for logged in spotify account
    spotifyUserID: 'jdv0921', // Unused
    // Master playlist
    seaID: '67LeHr41yfTbQYxQWjSV5F',
    // Theme playlist
    themelistID: '5cDuriM7Kj8ybF0Av8Qum1',

    // Min and max scores allowed
    min: -25,
    max: 25,

    // Loaded from themes.json
    // List of registered themes
    themeslist: new Discord.Collection,

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

    // Variable used to tell if both discord and spotify have loaded is set to true when the first loads, when the second loads the bot starts
    // this exists because sometimes they load in different orders so I don't know when to start doing things
    canLoad: false,

    // ----------------------- INITIAL LOAD ----------------------- //
    // Runs with on ready
    startup: function () {
        // Log activity
        bot.sendMessage("Bot Logged Into Discord");

        connectBot(bot);
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
        bot.sendMessage("Settings Saved");
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
        bot.sendMessage("Settings Loaded");

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
        bot.sendMessage("Theme Data For '" + theme + "' Saved");
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
            bot.sendMessage("Theme Updated To '" + theme + "'");

            // Sync the data to the masterlist
            bot.syncToMaster();
            // Save changes to settings
            bot.saveSettings();
        }
        else {
            // Log activity
            bot.sendMessage("Theme Does Not Exist");
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
        bot.sendMessage("Playlist Theme Synced To Master");
    },
    // ------------------------------------------------------------ //

    // Takes a playlist id and returns a list of the uris of the songs in that playlist
    themeExists: function (theme) {
        //checks to see if theme exists
        if (Array.from(bot.themeslist.values()).indexOf(theme) != -1) {
            return true;
        }
        return false;
    },
    // ------------------------------------------------------------ //

    // --------- EDITING RATING MAPS AND ADDING NEW SONGS --------- //
    // Adds a song to all maps
    addSong: function (name, uri, value = 0) {
        // Log activity
        bot.sendMessage("Adding '" + name + "' To Lists");

        tempSong = new Song(name, uri, value);
        bot.songsObjectMasterList.set(tempSong.uri, new Song(name, uri, value));
        bot.songsObjectRatingMap.set(tempSong.uri, tempSong);
        bot.songsObjectRankMap.get(tempSong.value).set(tempSong.uri, tempSong);
        bot.saveTheme();
    },
    // Removes a song from all maps
    removeSong: function (uri) {
        // Log activity
        bot.sendMessage("Removing '" + bot.songsObjectRatingMap.get(uri).name + "' From Lists");

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
        bot.sendMessage("'" + song.name + "' Value Updated To " + song.value + " in '" + theme + "'");
    },
    // ------------------------------------------------------------ //
    sendMessage: function (msg, type = 0){
        console.log(msg);
        bot.client.channels.cache.get(bot.channelids.get(0)).send(msg);
    }
}

// When bot loads
client.once('ready', () => {
    bot.startup();
});

// Map of commands to functions
client.commands = new Map([
    ["removetheme", removetheme],
    ["listthemes", listthemes],
    ["createtheme", createtheme],
    ["reloadplaylist", reloadplaylist],
    ["saveplaylist", saveplaylist],
    ["setplaylist", setplaylist],
    ["setsongscore", setsongscore],
    ["settheme", settheme],
    ["stop", stop]
]);

// Map of voting emotes to functions
client.votes = new Map([
    ["🤮", hate],
    ["👎", dislike],
    ["👍", like],
    ["🥰", love]
]),

    // For bot commands
    client.on('messageCreate', message => {
        // Ignore messages from bots
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
                client.votes.get(reaction.emoji.name)(bot);
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

client.login(bot.tokenDiscord);

console.log("SpotBot v1.3.0");
