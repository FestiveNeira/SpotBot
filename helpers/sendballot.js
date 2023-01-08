module.exports = {
    name: 'sendballot',
    secret: false,
    description: "sends a song ballot to the desired channel",
    execute(channel, bot) {
        let content = "🎶 Current Theme: " + bot.ratingtheme + " 🎶";

        bot.client.channels.cache.get(channel).send(content).then(msg => {
            bot.ratingMessage = msg;
            bot.saveSettings();
            msg.react('🤮')
                .then(() => msg.react('👎'))
                .then(() => msg.react('👍'))
                .then(() => msg.react('🥰'))
                .catch(error => console.error('One of the emojis failed to react'));
        });
    }
}  