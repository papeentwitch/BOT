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

// ==========================
// 🔧 CONFIGURATION
// ==========================

const MESSAGE_TEXTE = "Choisis tes rôles afin de ne pas recevoir des notifications que tu ne souhaite pas. Comme ça tu ne manquera JAMAIS les choses importante sur le DISCORD de Pixel & Papote 👇";

// ⏳ anti-spam ticket : 60 secondes
const ticketCooldown = new Map();
const COOLDOWN_TICKET_MS = 60 * 1000;

// 🔘 Boutons de rôles
const BOUTONS = [
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

// ==========================
// 🤖 CLIENT
// ==========================

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ==========================
// 📌 COMMANDES
// ==========================

const commands = [
  new SlashCommandBuilder()
    .setName("setup-roles")
    .setDescription("Envoie le message avec les boutons de rôles"),

  new SlashCommandBuilder()
    .setName("aide")
    .setDescription("Affiche l'aide du bot"),

  new SlashCommandBuilder()
    .setName("annonce")
    .setDescription("Envoie une annonce avec le bot")
    .addStringOption(option =>
      option
        .setName("message")
        .setDescription("Le message à envoyer")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Ouvre un ticket privé avec le staff"),
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
    console.error(error);
  }
}

// ==========================
// 🚀 BOT PRÊT
// ==========================

client.once(Events.ClientReady, async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
  await registerCommands();
});

// ==========================
// 🖱️ INTERACTIONS
// ==========================

client.on(Events.InteractionCreate, async interaction => {
  // ==========================
  // COMMANDES SLASH
  // ==========================

  if (interaction.isChatInputCommand()) {
    // --------------------------
    // /setup-roles
    // --------------------------
    if (interaction.commandName === "setup-roles") {
      const boutons = BOUTONS.map(bouton =>
        new ButtonBuilder()
          .setCustomId(bouton.id)
          .setLabel(bouton.label)
          .setStyle(bouton.style)
      );

      const row = new ActionRowBuilder().addComponents(boutons);

      const embed = new EmbedBuilder()
        .setTitle("🎭 Choix des rôles")
        .setDescription(MESSAGE_TEXTE)
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
    // /aide
    // --------------------------
    if (interaction.commandName === "aide") {
      const embed = new EmbedBuilder()
        .setTitle("📖 Aide du bot")
        .setDescription("Voici les commandes disponibles :")
        .addFields(
          {
            name: "/aide",
            value: "Affiche ce message.",
          },
          {
            name: "/ticket",
            value: "Ouvre un ticket privé avec le staff.",
          },
          {
            name: "/setup-roles",
            value: "Crée le message avec les boutons de rôles.",
          },
          {
            name: "/annonce",
            value: "Envoie une annonce avec le bot. Admin uniquement.",
          }
        )
        .setColor("Blue");

      return interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    }

    // --------------------------
    // /annonce
    // --------------------------
    if (interaction.commandName === "annonce") {
      if (interaction.user.id !== process.env.ADMIN_ID) {
        return interaction.reply({
          content: "❌ Tu n'as pas la permission d'utiliser cette commande.",
          ephemeral: true,
        });
      }

      const message = interaction.options.getString("message");

      const embed = new EmbedBuilder()
        .setTitle("📢 Annonce")
        .setDescription(message)
        .setColor("Red")
        .setFooter({ text: `Annonce envoyée par ${interaction.user.username}` })
        .setTimestamp();

      await interaction.channel.send({ embeds: [embed] });

      return interaction.reply({
        content: "✅ Annonce envoyée.",
        ephemeral: true,
      });
    }

    // --------------------------
    // /ticket
    // --------------------------
    if (interaction.commandName === "ticket") {
      const userId = interaction.user.id;

      // Anti-spam simple
      const lastTicket = ticketCooldown.get(userId);
      const now = Date.now();

      if (lastTicket && now - lastTicket < COOLDOWN_TICKET_MS) {
        const secondesRestantes = Math.ceil(
          (COOLDOWN_TICKET_MS - (now - lastTicket)) / 1000
        );

        return interaction.reply({
          content: `⏳ Attends encore ${secondesRestantes} secondes avant de refaire un ticket.`,
          ephemeral: true,
        });
      }

      ticketCooldown.set(userId, now);

      // Limite : 1 ticket ouvert par personne
      const existingTicket = interaction.guild.channels.cache.find(channel =>
        channel.name === `ticket-${userId}`
      );

      if (existingTicket) {
        return interaction.reply({
          content: `❌ Tu as déjà un ticket ouvert : ${existingTicket}`,
          ephemeral: true,
        });
      }

      const staffRole = await interaction.guild.roles.fetch(process.env.STAFF_ROLE_ID);

      if (!staffRole) {
        return interaction.reply({
          content: "❌ Le rôle staff est introuvable. Vérifie STAFF_ROLE_ID.",
          ephemeral: true,
        });
      }

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
            id: staffRole.id,
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
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ReadMessageHistory,
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
        content: `${interaction.user} <@&${staffRole.id}>`,
        embeds: [embed],
        components: [closeButton],
      });

      return interaction.reply({
        content: `✅ Ticket créé : ${ticketChannel}`,
        ephemeral: true,
      });
    }
  }

  // ==========================
  // BOUTONS
  // ==========================

  if (interaction.isButton()) {
    // --------------------------
    // Boutons de rôles
    // --------------------------
    const bouton = BOUTONS.find(b => b.id === interaction.customId);

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

    // --------------------------
    // Fermer ticket
    // --------------------------
    if (interaction.customId === "close_ticket") {
      const isTicket = interaction.channel.name.startsWith("ticket-");

      if (!isTicket) {
        return interaction.reply({
          content: "❌ Ce bouton ne peut être utilisé que dans un ticket.",
          ephemeral: true,
        });
      }

      const member = interaction.member;
      const isStaff = member.roles.cache.has(process.env.STAFF_ROLE_ID);
      const isAdmin = interaction.user.id === process.env.ADMIN_ID;

      if (!isStaff && !isAdmin) {
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
});

client.login(process.env.TOKEN);