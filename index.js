const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    EmbedBuilder,
    UserSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder,
    AuditLogEvent
} = require('discord.js');
const fs = require('fs');
const discordTranscripts = require('discord-html-transcripts');
const { joinVoiceChannel } = require('@discordjs/voice');
const { GameDig } = require('gamedig');
require('dotenv').config();
const config = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID
};
const dbPath = './db.json';
let cache = {};
function loadDb() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({}));
        cache = {};
    } else {
        try {
            cache = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        } catch (e) {
            cache = {};
        }
    }
}
function saveDb() {
    fs.writeFileSync(dbPath, JSON.stringify(cache, null, 2));
}
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
function addStaffScore(guildId, userId) {
    const gConfig = getGuildConfig(guildId);
    if (!gConfig.staffStats) gConfig.staffStats = { daily: { date: '', scores: {} }, weekly: { date: '', scores: {} }, allTime: {} };
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentWeekStr = `${now.getFullYear()}-W${getWeekNumber(now)}`;
    if (gConfig.staffStats.daily.date !== todayStr) {
        gConfig.staffStats.daily = { date: todayStr, scores: {} };
    }
    if (gConfig.staffStats.weekly.date !== currentWeekStr) {
        gConfig.staffStats.weekly = { date: currentWeekStr, scores: {} };
    }
    gConfig.staffStats.daily.scores[userId] = (gConfig.staffStats.daily.scores[userId] || 0) + 1;
    gConfig.staffStats.weekly.scores[userId] = (gConfig.staffStats.weekly.scores[userId] || 0) + 1;
    gConfig.staffStats.allTime[userId] = (gConfig.staffStats.allTime[userId] || 0) + 1;
    saveGuildConfig(guildId, { staffStats: gConfig.staffStats });
}
function getGuildConfig(guildId) {
    if (!cache[guildId]) cache[guildId] = { ticketCount: 0, tickets: {}, openTicketsByUser: {}, staffStats: { daily: { date: '', scores: {} }, weekly: { date: '', scores: {} }, allTime: {} } };
    if (!cache[guildId].tickets) cache[guildId].tickets = {};
    if (!cache[guildId].openTicketsByUser) cache[guildId].openTicketsByUser = {};
    if (!cache[guildId].staffStats) cache[guildId].staffStats = { daily: { date: '', scores: {} }, weekly: { date: '', scores: {} }, allTime: {} };
    return cache[guildId];
}
function saveGuildConfig(guildId, configData) {
    cache[guildId] = { ...cache[guildId], ...configData };
}
setInterval(() => {
    saveDb();
}, 3 * 60 * 1000);
loadDb();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});
const commands = [
    new SlashCommandBuilder()
        .setName('kurulum')
        .setDescription('Ticket sisteminin kurulacağı kanalı, log kanalını ve yetkili rolünü ayarlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Ticket açma butonunun gönderileceği kanal')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addRoleOption(option =>
            option.setName('rol')
                .setDescription('Ticketları görebilecek yetkili rolü')
                .setRequired(true)
        )
        .addChannelOption(option =>
            option.setName('log_kanali')
                .setDescription('Kapanan ticket dökümlerinin gideceği kanal')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption(option =>
            option.setName('kategori')
                .setDescription('Açılacak biletlerin hangi kategori altında toplanacağını seçin')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildCategory)
        ),
    new SlashCommandBuilder()
        .setName('log_kurulum')
        .setDescription('Ban ve Kick loglarının gönderileceği kanalları ayarlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('ban_kanali')
                .setDescription('Ban kayıtlarının gönderileceği kanal')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption(option =>
            option.setName('kick_kanali')
                .setDescription('Kick kayıtlarının gönderileceği kanal')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        ),
    new SlashCommandBuilder()
        .setName('genel_log_kurulum')
        .setDescription('Giriş/Çıkış, Mesaj ve Ses loglarının gönderileceği kanalları ayarlar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('giris_cikis')
                .setDescription('Sunucuya giren/çıkan üyelerin loglanacağı kanal')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption(option =>
            option.setName('mesaj_log')
                .setDescription('Silinen mesajların loglanacağı kanal')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        )
        .addChannelOption(option =>
            option.setName('ses_log')
                .setDescription('Ses kanalına giriş/çıkış hareketlerinin loglanacağı kanal')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
        ),
    new SlashCommandBuilder()
        .setName('ekle')
        .setDescription('Mevcut ticket kanalına başka bir kullanıcıyı eklersiniz.')
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Eklenecek kullanıcı')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('cikar')
        .setDescription('Mevcut ticket kanalından bir kullanıcıyı çıkarırsınız.')
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Çıkarılacak kullanıcı')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('kapat')
        .setDescription('Aktif ticket kanalını kapatır.'),
    new SlashCommandBuilder()
        .setName('aktif')
        .setDescription('Sunucunun aktif olduğunu ve giriş IP adresini duyurur.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('bakim')
        .setDescription('Sunucunun bakıma alındığını duyurur.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('ses')
        .setDescription('Botu belirlediğiniz bir ses kanalına sokar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('kanal')
                .setDescription('Botun katılacağı ses kanalı')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildVoice)
        ),
    new SlashCommandBuilder()
        .setName('devret')
        .setDescription('Ticketi başka bir yetkiliye devredersiniz.')
        .addUserOption(option =>
            option.setName('yetkili')
                .setDescription('Devredilecek yetkili')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('toplist')
        .setDescription('En çok bilet çözen yetkililerin sıralamasını gösterir.')
        .addStringOption(option =>
            option.setName('periyot')
                .setDescription('Hangi zaman dilimindeki sıralamayı görmek istiyorsunuz?')
                .setRequired(true)
                .addChoices(
                    { name: 'Günlük', value: 'daily' },
                    { name: 'Haftalık', value: 'weekly' },
                    { name: 'Tüm Zamanlar', value: 'allTime' }
                )
        ),
    new SlashCommandBuilder()
        .setName('numarator')
        .setDescription('Açılacak ticket sayısının kaçtan başlayacağını belirlersiniz.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption(option =>
            option.setName('sayi')
                .setDescription('Yeni açılacak biletlerin başlayacağı sayı')
                .setRequired(true)
        )
];
client.once('clientReady', async () => {
    console.log(`${client.user.tag} adıyla giriş yapıldı!`);
    if (config.token && config.clientId) {
        const rest = new REST({ version: '10' }).setToken(config.token);
        try {
            console.log('Slash komutları yükleniyor...');
            await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
            console.log('Slash komutları başarıyla yüklendi.');
        } catch (error) {
            console.error('Komutlar yüklenirken hata oluştu:', error);
        }
    } else {
        console.log("UYARI: token veya clientId bulunamadı! Komutlar Discord'a gönderilemedi.");
    }
    const serverIP = 'IP';
    const serverPort = 27015;
    let statusIndex = 0;
    let cachedPlayerCount = 'Bilinmiyor';
    let isServerOnline = false;
    async function fetchServerData() {
        try {
            const state = await GameDig.query({
                type: 'garrysmod',
                host: serverIP,
                port: serverPort,
                maxAttempts: 1,
                socketTimeout: 5000
            });
            cachedPlayerCount = `${state.players.length}/${state.maxplayers}`;
            isServerOnline = true;
        } catch (error) {
            isServerOnline = false;
        }
    }
    function updateDiscordPresence() {
        const statuses = isServerOnline ? [
            { name: `${cachedPlayerCount} Aktif`, type: 0 },
            { name: 'venomrp.com.tr', type: 0 },
            { name: 'TURKIYENIN EN IYI SUNUCUSU', type: 0 }
        ] : [
            { name: 'Sunucu Bağlantısı Bekleniyor...', type: 0 },
            { name: 'turkiye.com', type: 0 },
            { name: 'TURKIYENIN EN IYI SUNUCUSU', type: 0 }
        ];
        client.user.setActivity(statuses[statusIndex].name, { type: statuses[statusIndex].type });
        statusIndex = (statusIndex + 1) % statuses.length;
    }
    fetchServerData().then(() => {
        updateDiscordPresence();
        setInterval(fetchServerData, 60000);
        setInterval(updateDiscordPresence, 10000);
    });
});
client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        if (commandName === 'toplist') {
            const period = interaction.options.getString('periyot');
            const gConfig = getGuildConfig(interaction.guildId);
            const stats = gConfig.staffStats || { daily: { scores: {} }, weekly: { scores: {} }, allTime: {} };
            let scoresObj = {};
            let titleStr = '';
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
            const currentWeekStr = `${now.getFullYear()}-W${getWeekNumber(now)}`;
            if (period === 'daily') {
                if (stats.daily && stats.daily.date === todayStr) scoresObj = stats.daily.scores || {};
                titleStr = 'Günlük Top Yetkililer (Bugün)';
            } else if (period === 'weekly') {
                if (stats.weekly && stats.weekly.date === currentWeekStr) scoresObj = stats.weekly.scores || {};
                titleStr = 'Haftalık Top Yetkililer (Bu Hafta)';
            } else {
                scoresObj = stats.allTime || {};
                titleStr = 'Tüm Zamanların Top Yetkilileri';
            }
            const sortedRank = Object.entries(scoresObj).sort((a, b) => b[1] - a[1]).slice(0, 10);
            if (sortedRank.length === 0) {
                return interaction.reply({ content: `Bu periyot için henüz hiç bilet kapatılmamış.`, ephemeral: true });
            }
            let desc = '';
            for (let i = 0; i < sortedRank.length; i++) {
                const [userId, score] = sortedRank[i];
                let rankEmoji = '🏅';
                if (i === 0) rankEmoji = '🥇';
                else if (i === 1) rankEmoji = '🥈';
                else if (i === 2) rankEmoji = '🥉';
                desc += `${rankEmoji} **${i + 1}.** <@${userId}>: **${score} Bilet**\n`;
            }
            const embed = new EmbedBuilder()
                .setTitle(titleStr)
                .setDescription(desc)
                .setColor('Gold')
                .setTimestamp();
            return interaction.reply({ embeds: [embed] });
        }
        if (commandName === 'kurulum') {
            const channel = interaction.options.getChannel('kanal');
            const role = interaction.options.getRole('rol');
            const logChannel = interaction.options.getChannel('log_kanali');
            const categoryChannel = interaction.options.getChannel('kategori');
            saveGuildConfig(interaction.guildId, {
                panelChannel: channel.id,
                ticketRole: role.id,
                logChannel: logChannel.id,
                ticketCategory: categoryChannel ? categoryChannel.id : null
            });
            const embed = new EmbedBuilder()
                .setTitle('Destek Sistemi')
                .setDescription('Destek talebi oluşturmak için aşağıdaki butona tıklayın.')
                .setColor('Blue');
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('create_ticket')
                        .setLabel('📩 Ticket Oluştur')
                        .setStyle(ButtonStyle.Primary),
                );
            await channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({ content: `Kurulum başarılı! Panel ${channel} kanalına gönderildi. Yetkili rolü ${role}, log kanalı ise ${logChannel} olarak ayarlandı.`, ephemeral: true });
        }
        if (commandName === 'log_kurulum') {
            const hasManagerRole = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!hasManagerRole) {
                return interaction.reply({ content: 'Bu komutu kullanmak için Yönetici yetkisine sahip olmalısınız.', ephemeral: true });
            }
            const banChannel = interaction.options.getChannel('ban_kanali');
            const kickChannel = interaction.options.getChannel('kick_kanali');
            saveGuildConfig(interaction.guildId, {
                banLogChannel: banChannel.id,
                kickLogChannel: kickChannel.id
            });
            const embed = new EmbedBuilder()
                .setTitle('🛡️ Güvenlik Logları Ayarlandı')
                .setDescription(`Banlanan üyeler ${banChannel} kanalına, kicklenen üyeler ise ${kickChannel} kanalına detaylı olarak bildirilecek.`)
                .setColor('Green');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (commandName === 'genel_log_kurulum') {
            const hasManagerRole = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!hasManagerRole) {
                return interaction.reply({ content: 'Bu komutu kullanmak için Yönetici yetkisine sahip olmalısınız.', ephemeral: true });
            }
            const girisCikisChannel = interaction.options.getChannel('giris_cikis');
            const mesajLogChannel = interaction.options.getChannel('mesaj_log');
            const sesLogChannel = interaction.options.getChannel('ses_log');
            saveGuildConfig(interaction.guildId, {
                joinLeaveLogChannel: girisCikisChannel.id,
                messageLogChannel: mesajLogChannel.id,
                voiceLogChannel: sesLogChannel.id
            });
            const embed = new EmbedBuilder()
                .setTitle('📋 Genel Sunucu Logları Ayarlandı')
                .setDescription(`Giriş/Çıkış logları ${girisCikisChannel} kanalına.\nMesaj Silme logları ${mesajLogChannel} kanalına.\nSes Giriş/Çıkış logları ${sesLogChannel} kanalına detaylı olarak bildirilecek.`)
                .setColor('Green');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        if (commandName === 'numarator') {
            const hasManagerRole = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!hasManagerRole) {
                return interaction.reply({ content: 'Bu komutu kullanmak için Yönetici yetkisine sahip olmalısınız.', ephemeral: true });
            }
            const newCount = interaction.options.getInteger('sayi');
            const finalCount = newCount > 0 ? newCount - 1 : 0;
            saveGuildConfig(interaction.guildId, { ticketCount: finalCount });
            return interaction.reply({ content: `✅ Ticket numaratörü başarıyla ayarlandı! Bir sonraki açılacak bilet **ticket-${newCount.toString().padStart(4, '0')}** adını alacaktır.`, ephemeral: true });
        }
        if (commandName === 'aktif') {
            const hasManagerRole = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!hasManagerRole) {
                return interaction.reply({ content: 'Bu komutu kullanmak için Yönetici yetkisine sahip olmalısınız.', ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setTitle('🟢 Sunucu Aktif')
                .setDescription('Sunucumuz şu an aktiftir, giriş yapabilirsiniz!\n\n**Bağlanmak için:** `connect 136.0.200.10:27015`')
                .setColor('Green')
                .setTimestamp();
            return interaction.reply({ content: '@everyone', embeds: [embed] });
        }
        if (commandName === 'bakim') {
            const hasManagerRole = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!hasManagerRole) {
                return interaction.reply({ content: 'Bu komutu kullanmak için Yönetici yetkisine sahip olmalısınız.', ephemeral: true });
            }
            const embed = new EmbedBuilder()
                .setTitle('🔴 Sunucu Bakımda')
                .setDescription('Sunucumuz daha iyi bir oyun deneyimi sunabilmek için şu an bakıma alınmıştır. Lütfen aktif duyurusunu bekleyiniz.')
                .setColor('Red')
                .setTimestamp();
            return interaction.reply({ content: '@everyone', embeds: [embed] });
        }
        if (commandName === 'ses') {
            const hasManagerRole = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!hasManagerRole) {
                return interaction.reply({ content: 'Bu komutu kullanmak için Yönetici yetkisine sahip olmalısınız.', ephemeral: true });
            }
            const kanal = interaction.options.getChannel('kanal');
            try {
                joinVoiceChannel({
                    channelId: kanal.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });
                return interaction.reply({ content: `✅ Bot başarıyla ${kanal} kanalına giriş yaptı ve beklemede.`, ephemeral: true });
            } catch (error) {
                console.error("Ses kanalına girilemedi:", error);
                return interaction.reply({ content: `❌ Ses kanalına girilirken bir hata oluştu.`, ephemeral: true });
            }
        }
        if (commandName === 'ekle' || commandName === 'cikar' || commandName === 'kapat' || commandName === 'devret') {
            const gConfig = getGuildConfig(interaction.guildId);
            const isTicketChannel = interaction.channel.name.startsWith('ticket-');
            if (!isTicketChannel) {
                return interaction.reply({ content: 'Bu komutu sadece ticket kanallarında kullanabilirsiniz.', ephemeral: true });
            }
            const hasManagerRole = interaction.member.roles.cache.has(gConfig.ticketRole);
            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (commandName === 'devret') {
                const isHandler = gConfig.tickets && gConfig.tickets[interaction.channel.id] && gConfig.tickets[interaction.channel.id].handler === interaction.user.id;
                if (!isHandler && !isAdmin) {
                    return interaction.reply({ content: 'Bu ticketi devretmek için asıl devralan yetkili veya yönetici olmalısınız.', ephemeral: true });
                }
                const newUser = interaction.options.getUser('yetkili');
                const targetMember = await interaction.guild.members.fetch(newUser.id).catch(() => null);
                if (!targetMember) {
                    return interaction.reply({ content: 'Belirtilen kullanıcı sunucuda bulunamadı!', ephemeral: true });
                }
                const targetHasManagerRole = targetMember.roles.cache.has(gConfig.ticketRole) || targetMember.permissions.has(PermissionFlagsBits.Administrator);
                if (!targetHasManagerRole) {
                    return interaction.reply({ content: 'Ticketi sadece başka bir yetkiliye devredebilirsiniz!', ephemeral: true });
                }
                if (!gConfig.tickets[interaction.channel.id]) gConfig.tickets[interaction.channel.id] = { owner: null, handler: null };
                const oldOwnerId = gConfig.tickets[interaction.channel.id].handler;
                if (oldOwnerId) {
                    await interaction.channel.permissionOverwrites.delete(oldOwnerId).catch(() => { });
                }
                await interaction.channel.permissionOverwrites.edit(newUser.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });
                gConfig.tickets[interaction.channel.id].handler = newUser.id;
                saveGuildConfig(interaction.guildId, { tickets: gConfig.tickets });
                return interaction.reply({ content: `Bilet başarıyla ${newUser} kullanıcısına devredildi. Artık o ilgilenecek.` });
            }
            if (commandName === 'ekle') {
                if (!hasManagerRole && !isAdmin) return interaction.reply({ content: 'Bunu yapmaya yetkiniz yok.', ephemeral: true });
                const user = interaction.options.getUser('kullanici');
                await interaction.channel.permissionOverwrites.edit(user.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });
                return interaction.reply({ content: `${user} bu ticket'a eklendi.` });
            }
            if (commandName === 'cikar') {
                if (!hasManagerRole && !isAdmin) return interaction.reply({ content: 'Bunu yapmaya yetkiniz yok.', ephemeral: true });
                const user = interaction.options.getUser('kullanici');
                await interaction.channel.permissionOverwrites.delete(user.id);
                return interaction.reply({ content: `${user} adli kullanıcı ticket'tan çıkarıldı.` });
            }
            if (commandName === 'kapat') {
                const ticketData = gConfig.tickets ? gConfig.tickets[interaction.channel.id] : null;
                const isOwner = ticketData && ticketData.owner === interaction.user.id;
                const isHandler = ticketData && ticketData.handler === interaction.user.id;
                
                if (!isOwner && !isHandler && !isAdmin) {
                    return interaction.reply({ content: 'Bu bileti sadece açan kişi, devralan yetkili veya sunucu yöneticileri kapatabilir.', ephemeral: true });
                }

                await interaction.reply({ content: 'Bilet kapatılıyor...' });
                const channelId = interaction.channel.id;
                if (gConfig.tickets && gConfig.tickets[channelId]) {
                    const ownerId = gConfig.tickets[channelId].owner;
                    if (ownerId && gConfig.openTicketsByUser && gConfig.openTicketsByUser[ownerId]) {
                        delete gConfig.openTicketsByUser[ownerId];
                    }
                    delete gConfig.tickets[channelId];
                    saveGuildConfig(interaction.guildId, { openTicketsByUser: gConfig.openTicketsByUser, tickets: gConfig.tickets });
                }
                await interaction.channel.delete().catch(err => console.error("Kanal silinemedi", err));
            }
        }
    }
    if (interaction.isButton()) {
        if (interaction.customId === 'create_ticket') {
            const guild = interaction.guild;
            const gConfig = getGuildConfig(guild.id);
            if (!gConfig.ticketRole) {
                return interaction.reply({ content: 'Sunucuda henüz ticket kurulumu yapılmamış. Yöneticinize başvurun.', ephemeral: true });
            }
            if (gConfig.openTicketsByUser && gConfig.openTicketsByUser[interaction.user.id]) {
                const existingTicketId = gConfig.openTicketsByUser[interaction.user.id];
                const existingChannel = guild.channels.cache.get(existingTicketId);
                if (existingChannel) {
                    return interaction.reply({ content: `Zaten açık bir biletiniz bulunuyor: ${existingChannel}. Lütfen yenisini açmadan önce mevcut olanı kapatın.`, ephemeral: true });
                } else {
                    delete gConfig.openTicketsByUser[interaction.user.id];
                    saveGuildConfig(guild.id, { openTicketsByUser: gConfig.openTicketsByUser });
                }
            }
            const ticketRole = guild.roles.cache.get(gConfig.ticketRole);
            gConfig.ticketCount = (gConfig.ticketCount || 0) + 1;
            saveGuildConfig(guild.id, { ticketCount: gConfig.ticketCount });
            const channelName = `ticket-${gConfig.ticketCount.toString().padStart(4, '0')}`;
            const permissionOverwrites = [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                }
            ];
            if (ticketRole) {
                permissionOverwrites.push({
                    id: ticketRole.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                    deny: [PermissionFlagsBits.SendMessages],
                });
            }
            try {
                const channelOptions = {
                    name: channelName,
                    type: ChannelType.GuildText,
                    permissionOverwrites: permissionOverwrites
                };
                if (gConfig.ticketCategory) {
                    channelOptions.parent = gConfig.ticketCategory;
                }
                const ticketChannel = await guild.channels.create(channelOptions);
                const welcomeEmbed = new EmbedBuilder()
                    .setTitle('Destek Bileti')
                    .setDescription(`Merhaba ${interaction.user}, biletiniz başarıyla açıldı. Yetkililer en kısa sürede ilgilenecektir. \n\nSorununuzu detaylı bir şekilde açıklayabilirsiniz. Bileti kapatmak için aşağidaki butonu veya \`/kapat\` komutunu kullanabilirsiniz.`)
                    .setColor('Green');
                const closeBtnRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('take_ticket')
                            .setLabel('✋ Ticketi Devral')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('manage_ticket')
                            .setLabel('⚙️ Yönetim Paneli')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId('close_ticket')
                            .setLabel('🔒 Bileti Kapat')
                            .setStyle(ButtonStyle.Danger)
                    );
                await ticketChannel.send({
                    content: `${interaction.user} ${ticketRole ? `<@&${ticketRole.id}>` : ''}`,
                    embeds: [welcomeEmbed],
                    components: [closeBtnRow]
                });
                await interaction.reply({ content: `Biletiniz başarıyla oluşturuldu: ${ticketChannel}`, ephemeral: true });
                if (!gConfig.openTicketsByUser) gConfig.openTicketsByUser = {};
                gConfig.openTicketsByUser[interaction.user.id] = ticketChannel.id;
                gConfig.tickets[ticketChannel.id] = { owner: interaction.user.id, handler: null };
                saveGuildConfig(guild.id, { openTicketsByUser: gConfig.openTicketsByUser, tickets: gConfig.tickets });
            } catch (error) {
                console.error('Kanal oluşturulamadı:', error);
                await interaction.reply({ content: 'Bilet oluşturulurken bir hata meydana geldi. Botun kanal oluşturma/yönetme yetkilerini kontrol edin.', ephemeral: true });
            }
        }
        if (interaction.customId === 'take_ticket') {
            const guild = interaction.guild;
            const gConfig = getGuildConfig(guild.id);
            const hasManagerRole = interaction.member.roles.cache.has(gConfig.ticketRole) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!hasManagerRole) {
                return interaction.reply({ content: 'Bu bileti devralma yetkiniz yok.', ephemeral: true });
            }
            if (!gConfig.tickets) gConfig.tickets = {};
            if (gConfig.tickets[interaction.channel.id] && gConfig.tickets[interaction.channel.id].handler) {
                return interaction.reply({ content: `Bu bilet zaten <@${gConfig.tickets[interaction.channel.id].handler}> tarafından devralınmış.`, ephemeral: true });
            }
            if (!gConfig.tickets[interaction.channel.id]) gConfig.tickets[interaction.channel.id] = { owner: null };
            gConfig.tickets[interaction.channel.id].handler = interaction.user.id;
            saveGuildConfig(guild.id, { tickets: gConfig.tickets });
            await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
            const newRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('take_ticket')
                        .setLabel('✅ Bilet Devralındı')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('manage_ticket')
                        .setLabel('⚙️ Yönetim Paneli')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('🔒 Bileti Kapat')
                        .setStyle(ButtonStyle.Danger)
                );
            await interaction.message.edit({ components: [newRow] });
            await interaction.reply({ content: `${interaction.user} bu ticketi devraldı ve ilgileniyor.` });
        }
        if (interaction.customId === 'manage_ticket') {
            const guild = interaction.guild;
            const gConfig = getGuildConfig(guild.id);
            const hasManagerRole = interaction.member.roles.cache.has(gConfig.ticketRole) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!hasManagerRole) {
                return interaction.reply({ content: 'Yönetim panelini sadece yetkililer kullanabilir.', ephemeral: true });
            }
            const row = new ActionRowBuilder()
                .addComponents(
                    new UserSelectMenuBuilder()
                        .setCustomId('ticket_manage_select')
                        .setPlaceholder('Ticketa işlem yapmak için bir kullanıcı seçin')
                );
            const btnRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('action_add')
                        .setLabel('➕ Kullanıcı Ekle')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('action_remove')
                        .setLabel('➖ Kullanıcı Çıkar')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('action_transfer')
                        .setLabel('🔄 Başkasına Devret')
                        .setStyle(ButtonStyle.Secondary)
                );
            await interaction.reply({
                content: 'İşlem yapmak istediğiniz kullanıcıyı seçin ve ardından yapmak istediğiniz eylemi tıklayın:',
                components: [row, btnRow],
                ephemeral: true
            });
        }
        if (interaction.customId === 'close_ticket') {
            const guild = interaction.guild;
            const gConfig = getGuildConfig(guild.id);
            const ticketData = gConfig.tickets ? gConfig.tickets[interaction.channel.id] : null;

            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            const isOwner = ticketData && ticketData.owner === interaction.user.id;
            const isHandler = ticketData && ticketData.handler === interaction.user.id;

            if (!isOwner && !isHandler && !isAdmin) {
                return interaction.reply({ content: 'Bu bileti sadece açan kişi, devralan yetkili veya sunucu yöneticileri kapatabilir.', ephemeral: true });
            }

            await interaction.reply({ content: 'Bilet kapatılıyor, Transcript hazırlanıyor. Lütfen bekleyin...' });
            let solverId = null;
            if (ticketData && ticketData.handler) {
                solverId = ticketData.handler;
            } else {
                const hasManagerRole = interaction.member.roles.cache.has(gConfig.ticketRole) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
                if (hasManagerRole) solverId = interaction.user.id;
            }
            if (solverId) {
                addStaffScore(guild.id, solverId);
            }
            try {
                const attachment = await discordTranscripts.createTranscript(interaction.channel, {
                    limit: -1,
                    returnType: 'attachment',
                    filename: `transcript-${interaction.channel.name}.html`,
                    saveImages: true,
                    poweredBy: false,
                    description: `Destek Bilet Dökümü`
                });
                let attachmentUrl = null;
                let logMessage = null;
                if (gConfig.logChannel) {
                    const logChannel = guild.channels.cache.get(gConfig.logChannel);
                    if (logChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('📄 Bilet Kapatıldı ve Arşivlendi')
                            .setColor('Red')
                            .addFields(
                                { name: 'Kanal Adı', value: `\`${interaction.channel.name}\``, inline: true },
                                { name: 'Açan Kişi', value: ticketData && ticketData.owner ? `<@${ticketData.owner}>` : 'Bilinmiyor', inline: true },
                                { name: 'İlgilenen Yetkili', value: ticketData && ticketData.handler ? `<@${ticketData.handler}>` : ticketData && ticketData.owner === null ? 'Yok' : `<@${interaction.user.id}> (Kapatan)`, inline: true }
                            )
                            .setTimestamp();
                        try {
                            logMessage = await logChannel.send({ embeds: [logEmbed], files: [attachment] });
                            if (logMessage.attachments.size > 0) {
                                attachmentUrl = logMessage.attachments.first().url;
                            }
                        } catch (e) {
                            console.error("Log kanalına atılamadı:", e);
                        }
                    }
                }
                if (attachmentUrl) {
                    const downloadRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel('📥 Transcript İndir')
                                .setStyle(ButtonStyle.Link)
                                .setURL(attachmentUrl)
                        );
                    if (logMessage) await logMessage.edit({ components: [downloadRow] });
                    if (ticketData && ticketData.owner) {
                        const ownerUser = await client.users.fetch(ticketData.owner).catch(() => null);
                        if (ownerUser) {
                            const dmEmbed = new EmbedBuilder()
                                .setTitle('📄 Biletiniz Kapatıldı')
                                .setColor('Blue')
                                .setDescription(`Merhaba, sunucumuzda açmış olduğunuz **${interaction.channel.name}** isimli bilet kapatıldı.\n\nAşağıdaki butona tıklayarak biletteki konuşma geçmişinizi doğrudan tarayıcınıza indirebilirsiniz.`);
                            await ownerUser.send({ embeds: [dmEmbed], components: [downloadRow] })
                                .catch(() => console.log('Kullanıcıya DM atılamadı, DMleri kapalı.'));
                        }
                    }
                }
            } catch (err) {
                console.error("Transcript oluşturulurken hata oluştu:", err);
            }
            const channelId = interaction.channel.id;
            if (ticketData && ticketData.owner) {
                delete gConfig.openTicketsByUser[ticketData.owner];
            }
            if (gConfig.tickets && gConfig.tickets[channelId]) {
                delete gConfig.tickets[channelId];
            }
            saveGuildConfig(guild.id, { openTicketsByUser: gConfig.openTicketsByUser, tickets: gConfig.tickets });
            await interaction.channel.delete().catch(() => { });
        }
        if (interaction.customId.startsWith('action_')) {
            const message = interaction.message;
            const selectMenuRow = message.components.find(r => r.components[0].customId === 'ticket_manage_select');
            if (!selectMenuRow) {
                return interaction.reply({ content: 'Bir hata oluştu, seçim menüsü bulunamadı.', ephemeral: true });
            }
            return interaction.reply({ content: 'Lütfen yukarıdaki menüden önce kullanıcı seçimi yapın!', ephemeral: true });
        }
    }
    if (interaction.isUserSelectMenu()) {
        if (interaction.customId === 'ticket_manage_select') {
            const selectedUserId = interaction.values[0];
            const targetUser = await interaction.client.users.fetch(selectedUserId);
            const btnRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`do_add_${selectedUserId}`)
                        .setLabel(`➕ ${targetUser.username} Ekle`)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`do_remove_${selectedUserId}`)
                        .setLabel(`➖ ${targetUser.username} Çıkar`)
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId(`do_transfer_${selectedUserId}`)
                        .setLabel(`🔄 ${targetUser.username} Devret`)
                        .setStyle(ButtonStyle.Secondary)
                );
            await interaction.update({
                content: `Seçilen kullanıcı: **${targetUser.username}**. Lütfen ne yapmak istediğinizi seçin:`,
                components: [interaction.message.components[0], btnRow],
            }).catch(console.error);
        }
        return;
    }
    if (interaction.isButton() && interaction.customId.startsWith('do_')) {
        const parts = interaction.customId.split('_');
        const action = parts[1];
        const targetId = parts[2];
        try {
            const guild = interaction.guild;
            const targetUser = await client.users.fetch(targetId);
            const gConfig = getGuildConfig(guild.id);
            const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
            if (action === 'add') {
                await interaction.channel.permissionOverwrites.edit(targetUser.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });
                await interaction.channel.send({ content: `${targetUser} yetkililer tarafından ticket'a eklendi.` });
                await interaction.reply({ content: 'İşlem başarılı. Kullanıcı eklendi.', ephemeral: true });
            }
            else if (action === 'remove') {
                await interaction.channel.permissionOverwrites.delete(targetUser.id).catch(() => { });
                await interaction.channel.send({ content: `${targetUser} adlı kullanıcı bilet kanalından çıkarıldı.` });
                await interaction.reply({ content: 'İşlem başarılı. Kullanıcı çıkarıldı.', ephemeral: true });
            }
            else if (action === 'transfer') {
                const isHandler = gConfig.tickets && gConfig.tickets[interaction.channel.id] && gConfig.tickets[interaction.channel.id].handler === interaction.user.id;
                if (!isHandler && !isAdmin) {
                    return interaction.reply({ content: 'Bu ticketi devretmek için asıl devralan yetkili veya yönetici olmalısınız.', ephemeral: true });
                }
                const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
                if (!targetMember) {
                    return interaction.reply({ content: 'Belirtilen kullanıcı sunucuda bulunamadı!', ephemeral: true });
                }
                const targetHasManagerRole = targetMember.roles.cache.has(gConfig.ticketRole) || targetMember.permissions.has(PermissionFlagsBits.Administrator);
                if (!targetHasManagerRole) {
                    return interaction.reply({ content: 'Ticketi sadece başka bir yetkiliye devredebilirsiniz!', ephemeral: true });
                }
                const oldOwnerId = gConfig.tickets[interaction.channel.id].handler;
                if (oldOwnerId) {
                    await interaction.channel.permissionOverwrites.delete(oldOwnerId).catch(() => { });
                }
                await interaction.channel.permissionOverwrites.edit(targetUser.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });
                gConfig.tickets[interaction.channel.id].handler = targetUser.id;
                saveGuildConfig(interaction.guildId, { tickets: gConfig.tickets });
                await interaction.channel.send({ content: `Bilet başarıyla ${targetUser} kullanıcısına devredildi. Artık o ilgilenecek.` });
                await interaction.reply({ content: 'Bilet başarıyla devredildi.', ephemeral: true });
            }
        } catch (error) {
            console.error('Yönetim paneli işlem hatası:', error);
            if (!interaction.replied) {
                await interaction.reply({ content: 'İşlem sırasında bir hata oluştu.', ephemeral: true });
            }
        }
    }
});
if (config.token) {
    client.login(config.token);
    client.on('guildBanAdd', async ban => {
        try {
            const guild = ban.guild;
            const user = ban.user;
            const gConfig = getGuildConfig(guild.id);
            if (!gConfig.banLogChannel) return;
            const logChannel = guild.channels.cache.get(gConfig.banLogChannel);
            if (!logChannel) return;
            const fetchedLogs = await guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberBanAdd,
            });
            const banLog = fetchedLogs.entries.first();
            let executor = 'Bilinmiyor';
            let reason = ban.reason || 'Sebep belirtilmedi.';
            if (banLog) {
                const { executor: logExecutor, target, reason: logReason } = banLog;
                if (target.id === user.id) {
                    executor = logExecutor;
                    reason = logReason || reason;
                }
            }
            const embed = new EmbedBuilder()
                .setTitle('🚫 Bir Üye Yasaklandı (Ban)')
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setColor('DarkRed')
                .addFields(
                    { name: 'Yasaklanan Üye', value: `${user} (\`${user.id}\`)`, inline: false },
                    { name: 'Yasaklayan Yetkili', value: `${executor}`, inline: true },
                    { name: 'Sebep', value: `${reason}`, inline: true }
                )
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        } catch (e) {
            console.error('Ban loglanırken hata oluştu:', e);
        }
    });
    client.on('guildMemberRemove', async member => {
        try {
            const guild = member.guild;
            const user = member.user;
            const gConfig = getGuildConfig(guild.id);
            if (!gConfig.kickLogChannel) return;
            const logChannel = guild.channels.cache.get(gConfig.kickLogChannel);
            if (!logChannel) return;
            await new Promise(resolve => setTimeout(resolve, 2000));
            const fetchedLogs = await guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberKick,
            });
            const kickLog = fetchedLogs.entries.first();
            if (!kickLog) return;
            const { executor, target, reason, createdAt } = kickLog;
            if (target.id !== user.id) return;
            const timeDifference = Date.now() - createdAt.getTime();
            if (timeDifference > 30000) return;
            const kickReason = reason || 'Sebep belirtilmedi.';
            const embed = new EmbedBuilder()
                .setTitle('👢 Bir Üye Atıldı (Kick)')
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setColor('Orange')
                .addFields(
                    { name: 'Atılan Üye', value: `${user} (\`${user.id}\`)`, inline: false },
                    { name: 'Atan Yetkili', value: `${executor}`, inline: true },
                    { name: 'Sebep', value: `${kickReason}`, inline: true }
                )
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        } catch (e) {
            console.error('Kick loglanırken hata oluştu:', e);
        }
    });
    client.on('guildMemberAdd', member => {
        try {
            const guild = member.guild;
            const gConfig = getGuildConfig(guild.id);
            if (!gConfig.joinLeaveLogChannel) return;
            const logChannel = guild.channels.cache.get(gConfig.joinLeaveLogChannel);
            if (!logChannel) return;
            const embed = new EmbedBuilder()
                .setTitle('📥 Sunucuya Yeni Biri Katıldı')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setColor('DarkGreen')
                .addFields(
                    { name: 'Üye', value: `${member.user} (\`${member.user.id}\`)`, inline: true },
                    { name: 'Hesap Kuruluş', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
                )
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        } catch (e) { console.error('Giriş logu hatası:', e); }
    });
    client.on('guildMemberRemove', member => {
        try {
            const guild = member.guild;
            const gConfig = getGuildConfig(guild.id);
            if (!gConfig.joinLeaveLogChannel) return;
            const logChannel = guild.channels.cache.get(gConfig.joinLeaveLogChannel);
            if (!logChannel) return;
            const embed = new EmbedBuilder()
                .setTitle('📤 Sunucudan Biri Ayrıldı')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .setColor('DarkRed')
                .addFields(
                    { name: 'Üye', value: `${member.user} (\`${member.user.id}\`)`, inline: true }
                )
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        } catch (e) { console.error('Çıkış logu hatası:', e); }
    });
    client.on('messageDelete', message => {
        try {
            if (message.author?.bot || !message.guild) return;
            const guild = message.guild;
            const gConfig = getGuildConfig(guild.id);
            if (!gConfig.messageLogChannel) return;
            const logChannel = guild.channels.cache.get(gConfig.messageLogChannel);
            if (!logChannel) return;
            const content = message.content ? (message.content.length > 1000 ? message.content.substring(0, 1000) + '...' : message.content) : '*[Yazı içeriği yok veya sadece eklenti var]*';
            const embed = new EmbedBuilder()
                .setTitle('🗑️ Bir Mesaj Silindi')
                .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
                .setColor('Yellow')
                .addFields(
                    { name: 'Mesaj Sahibi', value: `${message.author} (\`${message.author.id}\`)`, inline: true },
                    { name: 'Kanal', value: `${message.channel}`, inline: true },
                    { name: 'İçerik', value: `\`\`\`\n${content}\n\`\`\``, inline: false }
                )
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        } catch (e) { console.error('Mesaj log hatası:', e); }
    });
    client.on('voiceStateUpdate', (oldState, newState) => {
        try {
            const guild = newState.guild || oldState.guild;
            const gConfig = getGuildConfig(guild.id);
            if (!gConfig.voiceLogChannel) return;
            const logChannel = guild.channels.cache.get(gConfig.voiceLogChannel);
            if (!logChannel) return;
            const member = newState.member;
            if (!member || member.user.bot) return;
            let embed = new EmbedBuilder().setTimestamp().setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL({ dynamic: true }) });
            if (!oldState.channelId && newState.channelId) {
                embed.setTitle('🎤 Ses Kanalına Katıldı')
                    .setColor('Green')
                    .setDescription(`${member} kullanıcısı **${newState.channel.name}** kanalına giriş yaptı.`);
                return logChannel.send({ embeds: [embed] });
            }
            if (oldState.channelId && !newState.channelId) {
                embed.setTitle('🎧 Ses Kanalından Çıktı')
                    .setColor('Red')
                    .setDescription(`${member} kullanıcısı **${oldState.channel.name}** kanalından ayrıldı.`);
                return logChannel.send({ embeds: [embed] });
            }
            if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                embed.setTitle('🔄 Ses Kanalı Değiştirdi')
                    .setColor('Blue')
                    .setDescription(`${member} kullanıcısı **${oldState.channel.name}** kanalından **${newState.channel.name}** kanalına geçiş yaptı.`);
                return logChannel.send({ embeds: [embed] });
            }
        } catch (e) { console.error('Ses log hatası:', e); }
    });
    client.on('channelDelete', channel => {
        try {
            if (!channel.guild) return;
            const guildId = channel.guild.id;
            const gConfig = getGuildConfig(guildId);
            let updated = false;
            if (gConfig.tickets && gConfig.tickets[channel.id]) {
                const ownerId = gConfig.tickets[channel.id].owner;
                if (ownerId && gConfig.openTicketsByUser && gConfig.openTicketsByUser[ownerId]) {
                    delete gConfig.openTicketsByUser[ownerId];
                }
                delete gConfig.tickets[channel.id];
                updated = true;
            }
            if (updated) {
                saveGuildConfig(guildId, { openTicketsByUser: gConfig.openTicketsByUser, tickets: gConfig.tickets });
            }
        } catch (e) {
            console.error("Kanal silinme (otokontrol) hatası:", e);
        }
    });
}
