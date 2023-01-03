module.exports = {
    name: 'sendballot',
    secret: false,
    description: "sends a song ballot to the desired channel",
    execute(channel, bot)
    {
        let content = "🎶 Current Theme:" + bot.ratingTheme + " 🎶";

        channel.send(content).then(msg =>
        {
            bot.ratingMessage = msg;
            msg.react('🤮')
            .then(() => msg.react('👎'))
            .then(() => msg.react('👍'))
            .then(() => msg.react('🥰'))
            .catch(error => console.error('One of the emojis failed to react'));
        });
    }
}  