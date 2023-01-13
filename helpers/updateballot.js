module.exports = {
    name: 'updateballot',
    secret: false,
    description: "updates an existing song ballot",
    execute(args, bot) {
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
                bot.helpers('sendballot', bot.spotChannel, bot);
            });
        bot.client.channels.cache.get(args[0].channelId).messages.fetch(args[0].id)
            .then(msg => {
                msg.edit(ratingcontent);
            })
            .catch(err => {
                console.log('no rating message found, sending new messages');
                bot.helpers('sendballot', bot.spotChannel, bot);
            });
    }
}  