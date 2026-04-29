require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");

// =====================================================
// CONFIG FACILE À MODIFIER
// =====================================================

const MESSAGE_ROLES = "Choisis tes rôles afin d'activer les notifications et rien louper 👇";

// Boutons de rôles. Modifie les noms/labels/variables ici.
const BOUTONS_ROLES = [
  {
    id: "IRMA",
    label: "🪬 IRMA",
    roleId: process.env.ROLE_IRMA,
    style: ButtonStyle.Primary,
  },
  {
    id: "METEO",
    label: "🌦️ La météo",
    roleId: process.env.ROLE_METEO,
    style: ButtonStyle.Secondary,
  },
  {
    id: "news",
    label: "📰 News",
    roleId: process.env.ROLE_NEWS,
    style: ButtonStyle.Success,
  },
];

// Réactions automatiques : si un message contient le mot, le bot réagit.
const REACTIONS_AUTOMATIQUES = [
  { mot: "café", emoji: "☕" },
  { mot: "bonjour", emoji: "👋" },
  { mot: "merci", emoji: "❤️" },
  { mot: "bug", emoji: "🎫" },
];

// Réponses automatiques : si un message contient le mot, le bot répond.
const REPONSES_AUTOMATIQUES = [
  { mot: "bonjour", reponse: "Salut 👋" },
  { mot: "merci", reponse: "Avec plaisir !" },
  { mot: "ticket", reponse: "Tu peux ouvrir un ticket avec `/ticket` 🎫" },
  { mot: "problème", reponse: "Si tu as besoin d’aide, utilise `/ticket` 🎫" },
];

// Messages aléatoires dans un salon précis.
// Mets SALON_FUN_ID dans Render si tu veux activer cette option.
const PHRASES_ALEATOIRES = [
  "Je surveille 👀",
  "Quelqu’un a dit café ? ☕",
  "Intéressant...",
  "Je note ça dans mon carnet secret 📒",
  "Cafette approuve ce message ✅",
];

// Chance de réponse aléatoire : 0.05 = 5%.
const CHANCE_MESSAGE_ALEATOIRE = 0.05;

// Anti-spam ticket : 60 secondes.
const ticketCooldown = new Map();
const COOLDOWN_TICKET_MS = 60 * 1000;

// =====================================================
// CLIENT DISCORD
// =====================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// =====================================================
// COMMANDES SLASH
// =====================================================

const commands = [
  // Visible par tout le monde
  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Ouvre un ticket privé avec le staff"),

  new SlashCommandBuilder()
    .setName("aide")
    .setDescription("Affiche l'aide du bot"),

  // Staff/admin seulement : Discord cache la commande aux membres classiques
  new SlashCommandBuilder()
    .setName("message")
    .setDescription("Envoyer un message simple avec le bot")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(option =>
      option
        .setName("texte")
        .setDescription("Le message à envoyer")
        .setRequired(true)
    ),

  // Staff/admin seulement : pour créer le menu de rôles
  new SlashCommandBuilder()
    .setName("setup-roles")
    .setDescription("Envoie le message avec les boutons de rôles")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
].map(command => command.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function registerCommands() {
  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );
    console.log("Commandes enregistrées.");
  } catch (error) {
    console.error("Erreur lors de l'enregistrement des commandes :", error);
  }
}

// =====================================================
// READY
// =====================================================

client.once(Events.ClientReady, async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
  await registerCommands();
});

// =====================================================
// COMMANDES + BOUTONS
// =====================================================

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      // --------------------------
      // /aide : visible par tout le monde, mais n'affiche que /ticket
      // --------------------------
      if (interaction.commandName === "aide") {
        const embed = new EmbedBuilder()
          .setTitle("📖 Aide")
          .setDescription("Commande disponible :")
          .addFields({
            name: "/ticket",
            value: "Ouvre un ticket privé avec le staff.",
          })
          .setColor("Blue");

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // --------------------------
      // /message : admin ou staff uniquement
      // --------------------------
      if (interaction.commandName === "message") {
        const isAdmin = interaction.user.id === process.env.ADMIN_ID;
        const isStaff = interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID);

        if (!isAdmin && !isStaff) {
          return interaction.reply({
            content: "❌ Tu n'as pas la permission d'utiliser cette commande.",
            ephemeral: true,
          });
        }

        const texte = interaction.options.getString("texte");
        await interaction.channel.send(texte);

        return interaction.reply({
          content: "✅ Message envoyé.",
          ephemeral: true,
        });
      }

      // --------------------------
      // /setup-roles : crée le message des boutons de rôles
      // --------------------------
      if (interaction.commandName === "setup-roles") {
        const boutons = BOUTONS_ROLES.map(bouton =>
          new ButtonBuilder()
            .setCustomId(bouton.id)
            .setLabel(bouton.label)
            .setStyle(bouton.style)
        );

        const row = new ActionRowBuilder().addComponents(boutons);

        const embed = new EmbedBuilder()
          .setTitle("🎭 Choix des rôles")
          .setDescription(MESSAGE_ROLES)
          .setColor("Blue");

        await interaction.channel.send({
          embeds: [embed],
          components: [row],
        });

        return interaction.reply({
          content: "✅ Message des rôles envoyé.",
          ephemeral: true,
        });
      }

      // --------------------------
      // /ticket : 1 ticket max par personne + anti-spam
      // --------------------------
      if (interaction.commandName === "ticket") {
        const userId = interaction.user.id;
        const now = Date.now();
        const lastTicket = ticketCooldown.get(userId);

        if (lastTicket && now - lastTicket < COOLDOWN_TICKET_MS) {
          const secondesRestantes = Math.ceil(
            (COOLDOWN_TICKET_MS - (now - lastTicket)) / 1000
          );

          return interaction.reply({
            content: `⏳ Attends encore ${secondesRestantes} secondes avant de refaire un ticket.`,
            ephemeral: true,
          });
        }

        const existingTicket = interaction.guild.channels.cache.find(
          channel => channel.name === `ticket-${userId}`
        );

        if (existingTicket) {
          return interaction.reply({
            content: `❌ Tu as déjà un ticket ouvert : ${existingTicket}`,
            ephemeral: true,
          });
        }

        ticketCooldown.set(userId, now);

        const ticketChannel = await interaction.guild.channels.create({
          name: `ticket-${userId}`,
          type: ChannelType.GuildText,
          parent: process.env.TICKET_CATEGORY_ID || null,
          permissionOverwrites: [
            {
              id: interaction.guild.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: userId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
            {
              id: process.env.STAFF_ROLE_ID,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
              ],
            },
            {
              id: client.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageChannels,
              ],
            },
          ],
        });

        const closeButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("close_ticket")
            .setLabel("🔒 Fermer le ticket")
            .setStyle(ButtonStyle.Danger)
        );

        const embed = new EmbedBuilder()
          .setTitle("🎫 Ticket ouvert")
          .setDescription(
            `Bonjour ${interaction.user}, explique ton problème ici.\n\nUn membre du staff va te répondre dès que possible.`
          )
          .setColor("Green")
          .setTimestamp();

        await ticketChannel.send({
          content: `${interaction.user} <@&${process.env.STAFF_ROLE_ID}>`,
          embeds: [embed],
          components: [closeButton],
        });

        return interaction.reply({
          content: `✅ Ticket créé : ${ticketChannel}`,
          ephemeral: true,
        });
      }
    }

    // --------------------------
    // Boutons
    // --------------------------
    if (interaction.isButton()) {
      // Boutons de rôles
      const bouton = BOUTONS_ROLES.find(b => b.id === interaction.customId);

      if (bouton) {
        const role = await interaction.guild.roles.fetch(bouton.roleId);

        if (!role) {
          return interaction.reply({
            content: "❌ Rôle introuvable.",
            ephemeral: true,
          });
        }

        if (interaction.member.roles.cache.has(role.id)) {
          await interaction.member.roles.remove(role);
          return interaction.reply({
            content: `❌ Le rôle **${role.name}** t’a été retiré.`,
            ephemeral: true,
          });
        }

        await interaction.member.roles.add(role);
        return interaction.reply({
          content: `✅ Le rôle **${role.name}** t’a été ajouté.`,
          ephemeral: true,
        });
      }

      // Fermeture ticket : staff/admin seulement
      if (interaction.customId === "close_ticket") {
        const isTicket = interaction.channel.name.startsWith("ticket-");
        const isAdmin = interaction.user.id === process.env.ADMIN_ID;
        const isStaff = interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID);

        if (!isTicket) {
          return interaction.reply({
            content: "❌ Ce bouton ne peut être utilisé que dans un ticket.",
            ephemeral: true,
          });
        }

        if (!isAdmin && !isStaff) {
          return interaction.reply({
            content: "❌ Seul le staff peut fermer ce ticket.",
            ephemeral: true,
          });
        }

        await interaction.reply({
          content: "🔒 Fermeture du ticket...",
          ephemeral: true,
        });

        setTimeout(() => {
          interaction.channel.delete().catch(console.error);
        }, 2000);
      }
    }
  } catch (error) {
    console.error("Erreur interaction :", error);

    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({
        content: "❌ Une erreur est survenue.",
        ephemeral: true,
      }).catch(console.error);
    }

    return interaction.reply({
      content: "❌ Une erreur est survenue.",
      ephemeral: true,
    }).catch(console.error);
  }
});

// =====================================================
// RÉACTIONS, RÉPONSES ET MESSAGES FUN
// =====================================================

client.on(Events.MessageCreate, async message => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    const contenu = message.content.toLowerCase();

    // Réactions automatiques
    for (const item of REACTIONS_AUTOMATIQUES) {
      if (contenu.includes(item.mot.toLowerCase())) {
        await message.react(item.emoji).catch(() => {});
      }
    }

    // Réponses automatiques
    for (const item of REPONSES_AUTOMATIQUES) {
      if (contenu.includes(item.mot.toLowerCase())) {
        await message.reply(item.reponse).catch(() => {});
        break; // évite plusieurs réponses sur un seul message
      }
    }

    // Message aléatoire dans un salon précis
    if (
      process.env.SALON_FUN_ID &&
      message.channel.id === process.env.SALON_FUN_ID &&
      Math.random() < CHANCE_MESSAGE_ALEATOIRE
    ) {
      const phrase = PHRASES_ALEATOIRES[
        Math.floor(Math.random() * PHRASES_ALEATOIRES.length)
      ];

      await message.channel.send(phrase).catch(() => {});
    }
  } catch (error) {
    console.error("Erreur MessageCreate :", error);
  }
});

client.login(process.env.TOKEN);
