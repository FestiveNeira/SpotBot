const Discord = require("discord.js");
const { Client, GatewayIntentBits } = require('discord.js');
const SpotifyWebApi = require('spotify-web-api-node');
const client = new Discord.Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
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
    prefix: '~',
    altPrefix: '\\',
    client: client,
    channelTypes: ['dm', 'text'],
    messageTypes: ['commands', 'generics', 'specials'],
    guildID: '946558579081613322',
    guild: undefined,
    ariDM: '1043685911147323464',
    ariID: '946077905199435836',
    botID: '1043633807267467415',

    //channel ID for rating songs
    spotChannel: '1043685911147323464',
    //message with song data for rating
    songMessage: null,

    spotifyApi: new SpotifyWebApi({
        clientId: clientId,
        clientSecret: clientSecret,
        redirectUri: 'http://localhost:8888/callback'
    }),

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

    //array of song objects iin master playlist
    songsObjectMasterList: [],
    //array of song objects
    songsObjectRatingList: [],

    //map of songs in theme playlist to song objects, key is song uri
    songsMap: new Discord.Collection,
    //map of scores in theme to a list of songs with that score, key is song score int
    songlistMap: new Discord.Collection,

    startup: function () {
        //load settings (playlist theme, playlist setting (int or %), rating theme)
        this.loadSettings();
        //load master playlist and updates
        this.loadMaster();
        //load songsMap and intiallize songlistMap
        this.initSongsMap();
        //load scores
        this.loadTheme(this.ratingtheme);
        //syncs the rating theme by adding/removing songs so it matches the master list
        this.syncToMaster();
        //reload playlist
        this.helpers('reloadplaylist', this.playlisttheme + " " + this.playsetting + " " + this.playvalue);
    },

    //save/load most recent settings for the playlist and rating theme, also loads themelist
    saveSettings: function () {
        //create wrappers for saving settings
        var settings = {
            playtheme: this.playlisttheme,
            playset: this.playsetting,
            playval: this.playvalue,
            ratetheme: this.ratingtheme
        }
        var themes = {
            themes: this.themeslist
        }

        var settingsfile = './data/spotify/settings.json';
        var themesfile = './data/spotify/themes.json';

        //saves settings to a .json files
        fs.writeFile(settingsfile, JSON.stringify(settings), e => {
            if (e) throw e;
        });
        fs.writeFile(themesfile, JSON.stringify(themes), e => {
            if (e) throw e;
        });
    },
    loadSettings: function () {
        //get saved settings
        var settingsfile = './data/spotify/settings.json';
        var themesfile = './data/spotify/themes.json';
        var settings = JSON.parse(fs.readFileSync(settingsfile));
        var themes = JSON.parse(fs.readFileSync(themesfile));

        //read in playlist theme, settings, rating theme, and a list of all themes
        this.playlisttheme = settings.playtheme;
        this.playsetting = settings.playset;
        this.playvalue = setting.playval;
        this.ratingtheme = settings.ratetheme;
        this.themes = themes.themes;
    },

    //handles reading in the main song list
    loadMaster: function () {
        //load masterlist from spotify
        console.log("reading master list");
        this.getTracks(this.seaID)
            .then((tracks) => {
                tracks.forEach(item => {
                    //only support non-local songs
                    if (item.track.uri.indexOf("spotify:local") == -1) {
                        let newsong = new Song(item.track.name, item.track.uri, 0);
                        this.songsObjectMasterList.push(newsong);
                    }
                    else {
                        console.log(item.track.uri + " is local and unsupported.");
                    }
                });
            });
        console.log("master list has been read");
    },
    getTracks: function (playlistID) {
        //return a promise
        return new Promise((resolve, reject) => {
            //get playlist data from API 
            bot.spotifyApi.getPlaylist(playlistID)
                //send the length of the playlist into readTracks so that it knows how much to scan
                .then((playlistInfo) => this.readTracks(playlistInfo.body.tracks.total, playlistID))
                //resolve the tracks back out to the promise
                .then((tracks) => resolve(tracks))
                //error handling 
                .catch(function (error) {
                    if (error.statusCode === 500 || error.statusCode === 502) {
                        //report server error
                        console.log("Server error, trying again");
                        //try again
                        this.getTracks(playlistID)
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

        console.log("reading chunk " + (1 + Math.ceil(totTracks.length / 100)) + "/" + (1 + Math.ceil(goal / 100)));

        //return a promise 
        return new Promise((resolve, reject) => {
            //if we have read all tracks, resolve with the tracks
            if (totTracks.length == goal) {
                resolve(totTracks);
            }
            else {
                //get the next batch of tracks
                bot.spotifyApi.getPlaylistTracks(playlistID, { offset: totTracks.length })
                    //pass that next batch into the next step of readTracks (recurs until ccomplete list is read)
                    .then((tracksInfo) => this.gettingTracks(goal, playlistID, totTracks, tracksInfo.body.items))
                    //resolve the tracks annd pass them up the recursion chain
                    .then((result) => resolve(result))
                    //error handling
                    .catch(function (error) {
                        if (error.statusCode === 500 || error.statusCode === 502) {
                            //report server error
                            console.log("Server error, trying again");
                            //try again
                            this.getTracks(playlistID)
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
        for (var i = this.min; i <= this.max; i++) {
            this.songlistMap.set(i, []);
        }
        this.songsObjectMasterList.forEach(song => {
            this.songsMap.set(song.uri, song);
        });
    },

    //save and load theme data for ratings
    saveTheme: function () {
        //write the current playlist theme to ./data/spotify/themes/---theme---.json
        this.songsObjectRatingList.forEach(song => {
            song = this.songsMap.get(song.uri);
        });

        var playlistthemesongs = {
            songs: this.songsObjectRatingList
        }

        var themefile = './data/spotify/themes/' + this.theme + '.json';

        //saves theme to a .json file
        fs.writeFile(themefile, JSON.stringify(playlistthemesongs), e => {
            if (e) throw e;
        });
    },
    loadTheme: function (newtheme) {
        if (this.themes.indexOf(newtheme) != -1) {
            //load ./data/spotify/themes/---theme---.json to be the current playlist theme
            var themefile = './data/spotify/themes/' + newtheme + '.json';
            var themedata = JSON.parse(fs.readFileSync(themefile));
            var songslist = themedata.songs;
            this.songsObjectRatingList = this.songsObjectMasterList;

            //after reading apply values to rating map to help update scores, key is uri
            songslist.forEach(song => {
                songsMap.set(song.uri, song);
                songlistMap.set(song.value, songlistMap.get(song.value).push(song));
            });
            this.theme = newtheme;
        }
        else {
            console.log("Theme does not exist. (loading error)");
        }
    },
    newTheme: function (newtheme) {
        //create a new theme file and initialize it to have all songs in the master list with values of 0
        var themefile = './data/spotify/themes/' + newtheme + '.json';
        //saves theme to a .json file
        fs.writeFile(themefile, JSON.stringify(this.songsObjectMasterList), e => {
            if (e) throw e;
        });
    },

    //create a new playlist on the dynamic playlist
    setPlaylist: function (theme, type, value) {
        var run = true;
        //if theme exists
        if (this.themes.indexOf(theme) != -1) {
            //crerate a ranked map for the theme of all its songs sorted by value
            var tempMap = this.createRankedMap(theme);
            //format val to send into the constructor
            var val;
            if (type == "rank" && !isNaN(value)) {
                val = parseInt(value);
                if (val > max || val < min) {
                    val = 0;
                }
                this.constructPlaylistRank(tempMap, val);
            }
            else {
                if (value.includes("%") && !isNaN(value.substring(0, str.length - 1))) {
                    val = Math.ceil(this.songsObjectMasterList.length * (parseFloat(value.substring(0, str.length - 1)) / 100));
                }
                else if (!isNaN(value)) {
                    val = Math.ceil(parseFloat(value));
                }
                else {
                    //do not continue if invalid args
                    run = false;
                    console.log("Invalid value type.");
                }
                if (run) {
                    //check that val is in range
                    if (val < 0 || val > 1) {
                        val = 1;
                    }
                    //send data to constructor
                    this.constructPlaylistStandard(tempMap, type, val);
                }
            }
        }
        else {
            console.log("Theme does not exist.");
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
        var templist = this.songsObjectMasterList;
        //for each song in the masterlist add it to a uri - song map
        templist.forEach(song => {
            tempMap.set(song.uri, song);
        });
        //overwrite songs with valllues from the theme rating data
        songslist.forEach(song => {
            tempMap.set(song.uri, song);
        });
        //initialize a map with an empty list for each possible rating between min and max
        rankMap = new Discord.Collection;
        for (var i = this.min; i <= this.max; i++) {
            rankMap.set(i, []);
        }
        //for each song in the master list use it's uri to get the rated data from tempMap and organizze it by rank instead
        templist.forEach(song => {
            rankMap.set(tempMap.get(song.uri).value, tempMap.get(song.uri));
        });
        return rankMap;
    },
    //playlist constructors!
    constructPlaylistStandard: function (map, type, val) {
        countdown = val;
        playlistsongs = [];
        if (type == "top") {
            for (var i = max; i > min; i--) {
                if (map.get(i).length < countdown) {
                    playlistsongs.concat(map.get(i));
                    countdown -= map.get(i).length;
                }
                else {
                    playlistsongs.concat(this.pickXSongs(map.get(i), countdown));
                    break;
                }
            }
        }
        else if (type == "bottom") {
            for (var i = min; i < max; i++) {
                if (map.get(i).length < countdown) {
                    playlistsongs.concat(map.get(i));
                    countdown -= map.get(i).length;
                }
                else {
                    playlistsongs.concat(this.pickXSongs(map.get(i), countdown));
                    break;
                }
            }
        }
        else {
            console.log("Invalid creation type.");
        }
        this.createSpotifyPlaylist(playlistsongs);
    },
    constructPlaylistRank: function (map, val) {
        this.createSpotifyPlaylist(map.get(val));
    },
    //picks X songs from the passed array and returns an array of selected songs
    pickXSongs: function (arr, x) {
        var countdown = x;
        var list = arr;
        var selected = [];
        while (countdown > 0) {
            var index = Math.floor(Math.random() * list.length);
            selected.push(list[index]);
            list = list.splice(0, index).concat(list.splice(index + 1));
            countdown--;
        }
        return selected;
    },
    createSpotifyPlaylist: function (songs) {
        //actually make the playlist, songs is a list of song objects use song[i].uri to get the songs in spotify ************(INCOMPLETE)************
        
    },

    addSong: function (name, uri, value = 0) {
        //adds a song object to the master playlist rating playist and the rating maps
        tempSong = new Song(name, uri, value);
        this.songsObjectMasterList.push(tempSong);
        this.songsObjectRatingList.push(tempSong);
        this.songsMap.set(uri, tempSong);
        this.songlistMap.set(tempSong.value, this.songlistMap.get(tempSong.value).push(tempSong));
    },
    removeSong: function (uri) {
        //removes a song from all lists
        this.songsObjectMasterList = this.songsObjectMasterList.filter(song => song.uri != uri);
        this.songsObjectRatingList = this.songsObjectRatingList.filter(song => song.uri != uri);
        this.songsMap.set(uri, null);
        this.songlistMap.set(this.songsMap.get(uri).value, this.songlistMap.get(this.songsMap.get(uri).value).filter(song => song.uri != uri));
    },
    changeSongVal: function (uri, change) {
        //updates rating values in songsMap
        var tempSong = this.songsMap.get(uri);
        tempSong.value = tempSong.value + change;
        this.songsMap.set(uri, tempSong);
        //updates rating values in songlistMap
        this.songlistMap.set(tempSong.value, this.songlistMap.get(tempSong.value).push(tempSong));
        this.songlistMap.set((tempSong.value - change), this.songlistMap.get(tempSong.value - change).filter(song => song.uri != uri));
    },

    syncToMaster: function () {
        //compares the current theme file to the master list, after run theme file will have songs not on master list removed
        //consrtuct a map of the masterlist to make comparing easier
        this.saveTheme();
        this.loadTheme(this.theme);
        masterMap = new Discord.Collection;
        this.songsObjectMasterList.forEach(song => {
            masterMap.set(song.uri, song);
        });
        this.songsObjectRatingList.forEach(song => {
            if (masterMap.get(song.uri) == null) {
                this.removeSong(uri);
            }
        });
        this.saveTheme();
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

client.on('message', message => {
    //ignore messages from itself
    if (message.author.bot) return;

    if (message.channel.type === 'dm') {
        var userID = message.author.id;
        bot.helpers('relayMsgToJaspa', { message: message });
    }
    else if (message.channel.type === 'text') {
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
    //INCOMPLETE
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

            bot.loadSpot();

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