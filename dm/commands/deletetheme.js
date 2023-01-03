module.exports = {
    name: 'removetheme',
    secret: false,
    description: "Removes a theme",
    execute(message, args, bot)
    {
        let themeName = args.join(' ').toLowerCase();
        var success = bot.delTheme(themeName);
        if (success) {
            message.channel.send("'" + themeName + "' successfully deleted!");
        }
        else {
            message.channel.send("'" + themeName + "' doesn't exist...");
        }
    }
}