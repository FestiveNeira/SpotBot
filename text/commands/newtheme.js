module.exports = {
    name: 'createtheme',
    secret: false,
    description: "Creates a new theme",
    execute(message, args, bot) {
        if (args.length > 1) {
            var themeName = args.slice(0, args.length - 1).join(' ').toLowerCase();
            var emote = args[args.length - 1];
            if (emote.match(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g)) {
                var success = bot.newTheme(themeName, emote);
                if (success) {
                    message.channel.send("'" + themeName + "' successfully created!");
                }
                else {
                    message.channel.send("'" + themeName + "' already exists!");
                }
            }
        }
    }
}