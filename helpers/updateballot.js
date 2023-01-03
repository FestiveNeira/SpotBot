module.exports = {
    name: 'sendballot',
    secret: false,
    description: "sends a song ballot to the desired channel",
    execute(message, bot)
    {
        message.edit("🎶 Current Theme:" + bot.ratingTheme + " 🎶");
    }
}  