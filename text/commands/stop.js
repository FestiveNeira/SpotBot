module.exports = {
    name: 'stop',
    secret: false,
    description: "Stops the bot",
    execute(message, args, bot) {
        // Log activity
        console.log("Bot Stopped");
        bot.client.channels.cache.get(bot.spotLogChat).send("Bot Stopped");
        process.exit(0);
    }
}