module.exports = {
    name: 'sendballot',
    secret: false,
    description: "sends a song ballot to the desired channel",
    execute(channel, bot) {
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
            this.themeReactionLoop(msg, temp, 0)
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
    },
    themeReactionLoop: function (msg, reactions, i) {
        if (i < reactions.length) {
            msg.react(reactions[i])
                .then(() => {
                    this.themeReactionLoop(msg, reactions, i + 1);
                })
                .catch(error => console.error('One of the emojis failed to react'));
        }
    }
}  