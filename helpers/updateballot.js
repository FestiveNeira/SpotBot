module.exports = {
    name: 'updateballot',
    secret: false,
    description: "updates an existing song ballot",
    execute(message, bot) {
        bot.client.channels.cache.get(message.channelId).messages.fetch(message.id)
            .then(msg => {
                msg.edit("🎶 Current Theme: " + bot.ratingtheme + " 🎶");
            })
            .catch(err => {
                console.log('no rating message found, sending new rating message');
                bot.helpers('sendballot', bot.spotChannel, bot);
            });
    }
}  