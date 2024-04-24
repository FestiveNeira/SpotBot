function like(bot) {
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
            //current song data
            var name = data.body.item.name;
            var uri = data.body.item.uri;

            //check for the uri in the masterlist
            return bot.checkMasterForUri(name, uri, true);
        })
        .then((uri) => {
            //increment score
            console.log('score increased by 1');
            bot.changeSongVal(uri, 1);
            bot.saveTheme();
        })
        .catch((error) => {
            if (error === "No song playing") {
                //no song is playing right now
                console.log("No song is currently playing.");
            }
        })
}

function dislike(bot) {
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
            //current song data
            var name = data.body.item.name;
            var uri = data.body.item.uri;

            //check for the uri in the masterlist
            return bot.checkMasterForUri(name, uri, false);
        })
        .then((uri) => {
            //increment score
            console.log('score decreased by 1');
            bot.changeSongVal(uri, -1);
            bot.saveTheme();
        })
        .catch((error) => {
            if (error === "No song playing") {
                //no song is playing right now
                console.log("No song is currently playing.")
            }
        })
}

function love(bot) {
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
            //current song data
            var name = data.body.item.name;
            var uri = data.body.item.uri;

            //check for the uri in the masterlist
            return bot.checkMasterForUri(name, uri, true);
        })
        .then((uri) => {
            //increment score
            console.log('score increased by 3');
            bot.changeSongVal(uri, 3);
            bot.saveTheme();
        })
        .catch((error) => {
            if (error === "No song playing") {
                //no song is playing right now
                console.log("No song is currently playing.")
            }
        })
}

function hate(bot) {
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
            //current song data
            var name = data.body.item.name;
            var uri = data.body.item.uri;

            //check for the uri in the masterlist
            return bot.checkMasterForUri(name, uri, false);
        })
        .then((uri) => {
            //increment score
            console.log('score decreased by 3');
            bot.changeSongVal(uri, -3);
            bot.saveTheme();
        })
        .catch((error) => {
            if (error === "No song playing") {
                //no song is playing right now
                console.log("No song is currently playing.")
            }
        })
}

function sendballot(channel, bot) {
    // Try to delete old messages if they exist
    try {
        if (bot.client.channels.cache.get(themeMessage.channelId).messages.fetch(themeMessage.id) != undefined) {
            bot.client.channels.cache.get(themeMessage.channelId).messages.fetch(themeMessage.id).delete();
        }
    }
    catch {
        console.log("Theme Message Does Not Exist");
    }
    try {
        if (bot.client.channels.cache.get(ratingMessage.channelId).messages.fetch(ratingMessage.id) != undefined) {
            bot.client.channels.cache.get(ratingMessage.channelId).messages.fetch(ratingMessage.id).delete();
        }
    }
    catch {
        console.log("Rating Message Does Not Exist");
    }
    var themecontent = "🎶 __**Themes**__ 🎶";
    Array.from(bot.themeslist.values()).forEach(theme => {
        themecontent += "\n" + theme;
    });
    var ratingcontent = "🎶 Current Theme: " + bot.ratingtheme + " 🎶";
    bot.saveSettings();

    bot.client.channels.cache.get(channel).send(themecontent).then(msg => {
        bot.themeMessage = msg;
        var temp = Array.from(bot.themeslist.keys());
        themeReactionLoop(msg, temp, 0)
    })
        .then(() => {
            bot.client.channels.cache.get(channel).send(ratingcontent).then(msg => {
                bot.ratingMessage = msg;
                msg.react('🤮')
                    .then(() => msg.react('👎'))
                    .then(() => msg.react('👍'))
                    .then(() => msg.react('🥰'))
                    .catch(error => console.error('One of the emojis failed to react'));
            });
        });
}

function updateballot(args, bot) {
    var themecontent = "🎶 __**Themes**__ 🎶";
    Array.from(bot.themeslist.values()).forEach(theme => {
        themecontent += "\n" + theme;
    });
    var ratingcontent = "🎶 Current Theme: " + bot.ratingtheme + " 🎶";

    bot.client.channels.cache.get(args[1].channelId).messages.fetch(args[1].id)
        .then(msg => {
            msg.edit(themecontent);
        })
        .catch(err => {
            console.log('no theme message found, sending new messages');
            sendballot(bot.spotChannel, bot);
        });
    bot.client.channels.cache.get(args[0].channelId).messages.fetch(args[0].id)
        .then(msg => {
            msg.edit(ratingcontent);
        })
        .catch(err => {
            console.log('no rating message found, sending new messages');
            sendballot(bot.spotChannel, bot);
        });
}

// Recursive helper to react with an unknown number of themes on new ballots
function themeReactionLoop(msg, reactions, i) {
    if (i < reactions.length) {
        msg.react(reactions[i])
            .then(() => {
                themeReactionLoop(msg, reactions, i + 1);
            })
            .catch(error => console.error('One of the emojis failed to react'));
    }
}

module.exports = {
    like,
    dislike,
    love,
    hate,
    sendballot,
    updateballot
};