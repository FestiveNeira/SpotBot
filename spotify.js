// ---------------------- CONNECT TO BOT ---------------------- //

const fs = require('fs');
var bot;
function connectBot(b) {
    bot = b;
}

// ------------ GETTING AND CONVERTING INFORMATION ------------ //

// Takes a playlist id and returns a promise that resolves to a list of spotify songs
function getTracks(playlistID) {
    // Return a promise
    return new Promise((resolve, reject) => {
        // Get playlist data from API
        bot.spotifyApi.getPlaylist(playlistID)
            // Send the length of the playlist into readTracks so that it knows how much to scan
            .then((playlistInfo) => readTracks(playlistInfo.body.tracks.total, playlistID))
            // Resolve the tracks back out to the promise
            .then((tracks) => resolve(tracks))
            // Error handling 
            .catch(function (error) {
                if (error.statusCode === 500 || error.statusCode === 502) {
                    // If there's a server error try again
                    getTracks(playlistID)
                        // Resolve with results of successful attempt
                        .then((tracks) => resolve(tracks))
                }
                else {
                    console.log("Something Went Wrong In getTracks");
                    console.log(error);
                }
            });
    });
}
// Songs can only be loaded 100 at a time so this helper function is used to assist the above function
function readTracks(goal, playlistID, totTracks = [], newTracks = []) {
    // Add the next batch of tracks onto the total list of tracks
    Array.prototype.push.apply(totTracks, newTracks);

    if (totTracks.length < goal) {
        // Log activity
        console.log("Reading Chunk " + (1 + Math.floor(totTracks.length / 100)) + "/" + (Math.ceil(goal / 100)));
    }

    // Return a promise 
    return new Promise((resolve, reject) => {
        // If we have read all tracks, resolve with the tracks
        if (totTracks.length == goal) {
            resolve(totTracks);
        }
        else {
            // Get the next batch of tracks
            bot.spotifyApi.getPlaylistTracks(playlistID, { offset: totTracks.length })
                // Pass that next batch into the next step of readTracks (recurs until complete list is read)
                .then((tracksInfo) => readTracks(goal, playlistID, totTracks, tracksInfo.body.items))
                // Resolve the tracks and pass them up the recursion chain
                .then((result) => resolve(result))
                // Error handling
                .catch(function (error) {
                    if (error.statusCode === 500 || error.statusCode === 502 || error.statusCode === 429) {
                        console.log('server error')
                        // If there's a server error try again
                        getTracks(playlistID)
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
}

// ----------- MAKING CHANGES TO THE THEME PLAYLIST ----------- //

// Create a new playlist on the dynamic playlist
function updatePlaylist(theme, type, value) {
    var run = true;
    try {
        // If theme exists
        if (bot.themeExists(theme)) {
            // Create a ranked map for the theme of all its songs sorted by value
            var tempMap = createRankedMap(theme);
            // Format val to send into the constructor
            var val;
            if (type == "rank" && !isNaN(value)) {
                val = parseInt(value);
                if (val > bot.max || val < bot.min) {
                    run = false;
                }
                if (run) {
                    constructPlaylistRank(tempMap, val);
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
                    constructPlaylistStandard(tempMap, type, val);
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
}

// Clones the curent version of the dynamic playlist
function clonePlaylist(name, visible, bot) {
    // Clones current playlist into a new playlist called name
    var songs;
    bot.getPlaylistUris(bot.themelistID)
        .then(uris => {
            return bot.urisToSongs(uris);
        })
        .then(songobjects => {
            songs = songobjects;
            bot.spotifyApi.createPlaylist(name, { 'description': 'My auto generated playlist of my ' + bot.playsetting + ' ' + bot.playvalue + ' ' + bot.playlisttheme + ' songs. (prompt: setplaylist ' + bot.playlisttheme + ' ' + bot.playsetting + ' ' + bot.playvalue + ")", 'public': visible })
                .then((playlistInfo) => {
                    createSpotifyPlaylist(playlistInfo.body.id, songs);

                    // Log activity
                    console.log("Playlist With Settings: '" + bot.playlisttheme + ' ' + bot.playsetting + ' ' + bot.playvalue + "' Saved");
                    bot.client.channels.cache.get(bot.spotLogChat).send("Playlist With Settings: '" + bot.playlisttheme + ' ' + bot.playsetting + ' ' + bot.playvalue + "' Saved");
                });
        });
}

// -------------------- BUILDING PLAYLISTS -------------------- //

// Creates a temporary map to be passed into a construct playlist function for changing the playlist
function createRankedMap(theme) {
    // Creates a song map and returns it for playlist altering
    tempMap = new Map;
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
    rankMap = new Map;
    for (var i = bot.min; i <= bot.max; i++) {
        rankMap.set(i, []);
    }
    // For each song in the master list use it's uri to get the rated data from tempMap and organizze it by rank instead
    templist.forEach(song => {
        rankMap.get(tempMap.get(song.uri).value).push(tempMap.get(song.uri));
    });
    return rankMap;
}

// Playlist constructors!
function constructPlaylistStandard(map, type, val) {
    countdown = val;
    playlistsongs = [];
    if (type == "top") {
        for (var i = bot.max; i > bot.min; i--) {
            if (map.get(i).length < countdown) {
                playlistsongs = playlistsongs.concat(map.get(i));
                countdown -= map.get(i).length;
            }
            else {
                playlistsongs = playlistsongs.concat(pickXSongs(map.get(i), countdown));
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
                playlistsongs = playlistsongs.concat(pickXSongs(map.get(i), countdown));
                break;
            }
        }
    }
    else {
        // Log activity
        console.log("Invalid Creation Type.");
        bot.client.channels.cache.get(bot.spotLogChat).send("Invalid Creation Type");
    }
    createSpotifyPlaylist(bot.themelistID, playlistsongs);
}

function constructPlaylistRank(map, val) {
    createSpotifyPlaylist(bot.themelistID, map.get(val));
}

// Picks X songs from the passed array and returns an array of selected songs
function pickXSongs(arr, x) {
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
}

// Builds chunks of 100 songs so Spotify will handle requests
function playlistChunkBuilder(uris, remove) {
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
}

// Adds new songs to the themed playlist
function createSpotifyPlaylist(playlistID, songs) {
    var uris = bot.songsToUris(songs);
    if (playlistID == bot.themelistID) {
        clearThemeList()
            .then(async () => {
                var promises = [];
                playlistChunkBuilder(uris, false).forEach(chunk => {
                    promises.push(addPlaylistSongs(playlistID, chunk));
                });
                await Promise.all(promises);
            })
            .then(() => {
                // Log activity
                console.log("Theme Playlist Songs Loaded");
                bot.client.channels.cache.get(bot.spotLogChat).send("Theme Playlist Songs Loaded");
            })
            .catch((error) => { console.log(error) });
    }
    else {
        playlistChunkBuilder(uris, false).forEach(chunk => {
            addPlaylistSongs(playlistID, chunk);
        });
    }
}

// --------------- UPDATING THE THEMED PLAYLIST --------------- //

// Removes all songs from the themed playlist
function clearThemeList() {
    return new Promise((resolve, reject) => {
        bot.getPlaylistUris(bot.themelistID)
            .then(async uris => {
                var promises = [];
                playlistChunkBuilder(uris, true).forEach(chunk => {
                    promises.push(removePlaylistSongs(chunk));
                });
                await Promise.all(promises);
            })
            .then(() => {
                // Log activity
                console.log("Theme Playlist Cleared");
                bot.client.channels.cache.get(bot.spotLogChat).send("Theme Playlist Cleared");
                resolve(true);
            });
    });
}

// Removes a chunk of 100 or fewer songs from the themed playlist
function removePlaylistSongs(chunk) {
    return bot.spotifyApi.removeTracksFromPlaylist(bot.themelistID, chunk)
        .catch(() => {
            return removePlaylistSongs(chunk);
        });
}

// Adds a chunk of 100 or fewer songs from the themed playlist
function addPlaylistSongs(playlistID, chunk) {
    return bot.spotifyApi.addTracksToPlaylist(playlistID, chunk)
        .catch(() => {
            return addPlaylistSongs(playlistID, chunk);
        });
}

module.exports = {
    connectBot,
    getTracks,
    updatePlaylist,
    clonePlaylist
};