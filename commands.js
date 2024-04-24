const {
    updatePlaylist,
    clonePlaylist
} = require('./spotify.js');
const {
    like,
    dislike,
    love,
    hate,
    sendballot,
    updateballot,
} = require('./voting.js');

// Creates a new theme and initializes all scores to 0
function createtheme(message, args, bot) {
    if (args.length > 1) {
        var themeName = args.slice(0, args.length - 1).join(' ').toLowerCase();
        var emote = args[args.length - 1];
        if (emote.match(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g)) {
            var success = bot.newTheme(themeName, emote);

            // Create a new theme file and initialize it to have all songs in the master list with values of 0
            var themefile = './data/spotify/themes/' + newtheme + '.json';
            if (!fs.existsSync(themefile)) {
                // Add the theme to the themelist
                bot.themeslist.set(emote, newtheme);
                var playlistthemesongs = {
                    songs: Array.from(bot.songsObjectMasterList.values())
                }
                // Saves theme to a .json file
                fs.writeFileSync(themefile, JSON.stringify(playlistthemesongs), e => {
                    if (e) throw e;
                });
                // Update and add a reaction to the theme changing message
                if (bot.ratingMessage != null && bot.ratingMessage != "" && bot.themeMessage != null && bot.themeMessage != "") {
                    updateballot([bot.ratingMessage, bot.themeMessage], bot);
                }
                else {
                    sendballot(bot.spotChannel, bot);
                }
                bot.client.channels.cache.get(bot.themeMessage.channelId).messages.fetch(bot.themeMessage.id)
                    .then(msg => {
                        msg.react(emote);
                    });

                // Log activity
                console.log("New Theme '" + newtheme + "' Created");
                bot.client.channels.cache.get(bot.spotLogChat).send("New Theme '" + newtheme + "' Created");

                // Save changes to settings
                bot.saveSettings();
                success = true;
            }

            if (success) {
                message.channel.send("'" + themeName + "' successfully created!");
            }
            else {
                message.channel.send("'" + themeName + "' already exists!");
            }
        }
    }
}

// Deletes a theme
function removetheme(message, args, bot) {
    let themeName = args.join(' ').toLowerCase();
    var success = false;
    // Delete the theme (if it's not the default one)
    if (theme != "default") {
        // Remove a theme file
        var themefile = './data/spotify/themes/' + theme + '.json';
        if (fs.existsSync(themefile)) {
            // Get the key
            var key = bot.getKeyFromVal(bot.themeslist, theme);
            if (key != -1) {
                // Remove the theme from the themelist
                bot.themeslist.delete(key);
                // Delete's the file at themefile
                fs.unlinkSync(themefile);
                // Update and remove a reaction from theme changing message
                if (bot.ratingMessage != null && bot.ratingMessage != "" && bot.themeMessage != null && bot.themeMessage != "") {
                    updateballot([bot.ratingMessage, bot.themeMessage], bot);
                }
                else {
                    sendballot(bot.spotChannel, bot);
                }
                bot.client.channels.cache.get(bot.themeMessage.channelId).messages.fetch(bot.themeMessage.id)
                    .then(msg => {
                        Array.from(msg.reactions.cache.values()).forEach(reaction => {
                            if (reaction.emoji.name == key) {
                                reaction.remove();
                            }
                        });
                    });

                // Log activity
                console.log("Theme '" + theme + "' Deleted");
                bot.client.channels.cache.get(bot.spotLogChat).send("Theme '" + theme + "' Deleted");

                // Save changes to settings
                bot.saveSettings();
                success = true;
            }
        }
    }
    // Respond to user request
    if (success) {
        message.channel.send("'" + themeName + "' successfully deleted!");
    }
    else {
        message.channel.send("'" + themeName + "' doesn't exist...");
    }
}

// Lists all existing themes
function listthemes(message, args, bot) {
    var msg = "__Themes__\n";
    var themes = bot.themeslist;
    themes.forEach(theme => {
        msg += theme + "\n";
    });
    bot.client.channels.cache.get(bot.spotLogChat).send(msg);
}

function settheme(message, args, bot) {
    let themeName = args.join(' ').toLowerCase();
    bot.saveTheme();
    if (bot.themeExists(themeName)) {
        bot.loadTheme(themeName);
        message.channel.send("Theme successfully updated to '" + themeName + "'.");
    }
    else {
        message.channel.send("Theme failed to update, '" + themeName + "' not found.");
    }
}

// Loads the theme playlist with the most recent settings
function reloadplaylist(message, args, bot) {
    // Log activity
    console.log("Reloading Playlist");
    bot.client.channels.cache.get(bot.spotLogChat).send("Reloading Playlist");

    // Reload the playlist with the previously used data
    setplaylist(message, [bot.playlisttheme, bot.playsetting, bot.playvalue], bot);
    message.channel.send("Playlist reloaded for most recent ratings.");
}

function setplaylist(message, args, bot) {
    if (args.length >= 3) {
        temp = args.splice(0, args.length - 2).join(" ");
        var success = updatePlaylist(temp.toLowerCase(), args[0].toLowerCase(), args[1].toLowerCase());
        if (success) {
            message.channel.send("Playlist set to " + temp + " " + args.join(' ') + ".");
        }
        else {
            message.channel.send("Playlist failed to update, check that your input values ar valid\ncheck the spelling of your theme argument\nvalid types are top, bottom, and rank\nranks only fall between -25 and 25\nthe number of songs cannot exceed the number of songs in the master playlist");
        }
    }
}

function saveplaylist(message, args, bot) {
    if (args.length == 2) {
        var name = args[0];
        var visible;
        var go = false;
        if (args[1] == '1' || args[1] == 'true' || args[1] == 'public') {
            visible = true;
            go = true;
        }
        else if (args[1] == '0' || args[1] == 'false' || args[1] == 'private') {
            visible = false;
            go = true;
        }
        if (go) {

            clonePlaylist(name, visible, bot);

            message.channel.send("Playlist saved.");
        }
    }
}

function setsongscore(message, args, bot) {
    if (args.length == 1 && !isNaN(args[0])) {
        //get current song uri
        //check if a song is playing
        bot.spotifyApi.getMyCurrentPlaybackState()
            .then(function (data) {
                //if a song is playing
                if (data.body && data.body.is_playing) {
                    //get current song
                    return bot.spotifyApi.getMyCurrentPlayingTrack();
                }
                else {
                    return new Promise((resolve, reject) => {
                        reject("No song playing");
                    })
                }
            })
            .then(function (data) {
                //if val is positive add it if it's not already in the master list
                var plus = false;
                if (args[0] >= 0) {
                    plus = true;
                }
                //current song data
                var name = data.body.item.name;
                var uri = data.body.item.uri;

                //check for the uri in the masterlist
                return bot.checkMasterForUri(name, uri, plus);
            })
            .then((uri) => {
                songval = bot.urisToSongs([uri])[0].value;
                //increment score
                console.log('score increased by 1');
                bot.changeSongVal(uri, songval - args[0]);
                bot.saveTheme();
            })
            .catch((error) => {
                if (error === "No song playing") {
                    //no song is playing right now
                    console.log("No song is currently playing.")
                }
            })
    }
}

function stop(message, args, bot) {
    // Log activity
    console.log("Bot Stopped");
    bot.client.channels.cache.get(bot.spotLogChat).send("Bot Stopped");
    process.exit(0);
}

module.exports = {
    removetheme,
    listthemes,
    createtheme,
    reloadplaylist,
    saveplaylist,
    setplaylist,
    setsongscore,
    settheme,
    stop
};