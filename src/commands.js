import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { config, getForm, saveConfig } from './config.js';
import { syncAutoRole } from './autorole.js';
import { getTicket } from './store.js';
import { closeTicket, EPHEMERAL, isStaff } from './tickets.js';
import { announcementMessage, formPicker, panelMessage, partnersMessage, rulesMessage } from './ui.js';

const commands = [
  {
    data: new SlashCommandBuilder()
      .setName('panel')
      .setDescription('Опублікувати панель набору до клану')
      .addChannelOption((o) =>
        o.setName('канал').setDescription('Куди надіслати панель').addChannelTypes(ChannelType.GuildText),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setDMPermission(false),
    async run(interaction) {
      const channel = interaction.options.getChannel('канал') ?? interaction.channel;
      if (!config.forms.length) {
        await interaction.reply({ content: '⚠️ У `config.json` немає жодної форми.', ...EPHEMERAL });
        return;
      }
      await channel.send(panelMessage());
      await interaction.reply({ content: `✅ Панель надіслано в <#${channel.id}>`, ...EPHEMERAL });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('rules')
      .setDescription('Опублікувати правила сервера')
      .addChannelOption((o) =>
        o.setName('канал').setDescription('Куди надіслати правила').addChannelTypes(ChannelType.GuildText),
      )
      .addBooleanOption((o) =>
        o.setName('сповістити').setDescription('Додати @everyone до повідомлення (за замовчуванням ні)'),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setDMPermission(false),
    async run(interaction) {
      const channel = interaction.options.getChannel('канал') ?? interaction.channel;
      if (!config.rules?.sections?.length) {
        await interaction.reply({ content: '⚠️ У `config.json` немає блоку `rules`.', ...EPHEMERAL });
        return;
      }

      const ping = interaction.options.getBoolean('сповістити') ?? false;
      const payload = rulesMessage();
      if (ping) {
        payload.content = '@everyone';
        payload.allowedMentions = { parse: ['everyone'] };
      }
      await channel.send(payload);

      const canPing = channel.permissionsFor(interaction.guild.members.me)?.has(PermissionFlagsBits.MentionEveryone);
      const note = ping && !canPing ? '\n⚠️ У бота немає права **Згадувати @everyone** — текст надіслано, але сповіщення не спрацювало.' : '';
      await interaction.reply({ content: `✅ Правила надіслано в <#${channel.id}>${note}`, ...EPHEMERAL });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('partners')
      .setDescription('Опублікувати партнерську програму')
      .addChannelOption((o) =>
        o.setName('канал').setDescription('Куди надіслати').addChannelTypes(ChannelType.GuildText),
      )
      .addBooleanOption((o) =>
        o.setName('сповістити').setDescription('Додати ||@everyone|| до повідомлення (за замовчуванням ні)'),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setDMPermission(false),
    async run(interaction) {
      const channel = interaction.options.getChannel('канал') ?? interaction.channel;
      if (!config.partners?.sections?.length) {
        await interaction.reply({ content: '⚠️ У `config.json` немає блоку `partners`.', ...EPHEMERAL });
        return;
      }

      const ping = interaction.options.getBoolean('сповістити') ?? false;
      const payload = partnersMessage();
      if (ping) {
        payload.content = '||@everyone||';
        payload.allowedMentions = { parse: ['everyone'] };
      }
      await channel.send(payload);

      const canPing = channel.permissionsFor(interaction.guild.members.me)?.has(PermissionFlagsBits.MentionEveryone);
      const note = ping && !canPing ? '\n⚠️ У бота немає права **Згадувати @everyone** — текст надіслано, але сповіщення не спрацювало.' : '';
      await interaction.reply({ content: `✅ Партнерську програму надіслано в <#${channel.id}>${note}`, ...EPHEMERAL });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('video')
      .setDescription('Оголосити нове відео з пінгом')
      .addStringOption((o) =>
        o.setName('посилання').setDescription('Посилання на відео').setRequired(true).setMaxLength(500),
      )
      .addStringOption((o) => o.setName('коментар').setDescription('Що написати над посиланням').setMaxLength(300))
      .addChannelOption((o) =>
        o.setName('канал').setDescription('Куди надіслати (типово — канал із налаштувань)').addChannelTypes(ChannelType.GuildText),
      )
      .addBooleanOption((o) => o.setName('без-пінгу').setDescription('Не згадувати @everyone'))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setDMPermission(false),
    async run(interaction) {
      const link = interaction.options.getString('посилання').trim();
      if (!/^https?:\/\//i.test(link)) {
        await interaction.reply({ content: '⚠️ Посилання має починатися з `https://`.', ...EPHEMERAL });
        return;
      }

      const feed = config.feeds?.[0] ?? {};
      const channel =
        interaction.options.getChannel('канал') ??
        (feed.channelId ? await interaction.guild.channels.fetch(feed.channelId).catch(() => null) : null) ??
        interaction.channel;

      const silent = interaction.options.getBoolean('без-пінгу') ?? false;
      const mention = silent ? '' : (feed.mention ?? '@everyone');
      const comment = interaction.options.getString('коментар') ?? '🎬 **НОВЕ ВІДЕО!**';

      await channel.send({
        content: [mention, comment, link].filter(Boolean).join('\n'),
        allowedMentions: mention === '@everyone' ? { parse: ['everyone'] } : { parse: ['roles', 'users'] },
      });

      await interaction.reply({ content: `✅ Опубліковано в <#${channel.id}>`, ...EPHEMERAL });
    },
  },

  {
    data: (() => {
      // варіанти підтягуються з config.announcements, тому нове оголошення
      // додається правкою конфігу + npm run deploy, без коду
      const builder = new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Опублікувати оголошення (набір фармил, електрика тощо)')
        .addStringOption((o) => {
          o.setName('тип').setDescription('Яке оголошення').setRequired(true);
          for (const [key, a] of Object.entries(config.announcements ?? {})) {
            o.addChoices({ name: (a.title ?? key).slice(0, 100), value: key });
          }
          return o;
        })
        .addChannelOption((o) =>
          o.setName('канал').setDescription('Куди надіслати').addChannelTypes(ChannelType.GuildText),
        )
        .addBooleanOption((o) =>
          o.setName('сповістити').setDescription('Додати @everyone до повідомлення (за замовчуванням ні)'),
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false);
      return builder;
    })(),
    async run(interaction) {
      const key = interaction.options.getString('тип');
      const payload = announcementMessage(key);
      if (!payload) {
        await interaction.reply({ content: `⚠️ Оголошення \`${key}\` немає в \`config.json\`.`, ...EPHEMERAL });
        return;
      }

      const channel = interaction.options.getChannel('канал') ?? interaction.channel;
      const ping = interaction.options.getBoolean('сповістити') ?? false;
      if (ping) {
        payload.content = '@everyone';
        payload.allowedMentions = { parse: ['everyone'] };
      }
      await channel.send(payload);

      const canPing = channel.permissionsFor(interaction.guild.members.me)?.has(PermissionFlagsBits.MentionEveryone);
      const note = ping && !canPing ? '\n⚠️ У бота немає права **Згадувати @everyone** — текст надіслано, але сповіщення не спрацювало.' : '';
      await interaction.reply({ content: `✅ Оголошення надіслано в <#${channel.id}>${note}`, ...EPHEMERAL });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('sync-roles')
      .setDescription('Видати автороль усім, хто вже на сервері')
      .addRoleOption((o) => o.setName('роль').setDescription('Яку роль видати (типово — автороль із налаштувань)'))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setDMPermission(false),
    async run(interaction) {
      const roleId = interaction.options.getRole('роль')?.id ?? config.autoRole?.roleId;
      if (!roleId) {
        await interaction.reply({ content: '⚠️ Автороль не налаштована — вкажи роль параметром.', ...EPHEMERAL });
        return;
      }

      const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
      const me = interaction.guild.members.me;
      if (role && me && role.position >= me.roles.highest.position) {
        await interaction.reply({
          content: `⛔ Роль ${role.name} вище за роль бота — Discord не дозволить її видавати. Підніми роль бота в налаштуваннях сервера.`,
          ...EPHEMERAL,
        });
        return;
      }

      await interaction.deferReply({ ...EPHEMERAL });
      const r = await syncAutoRole(interaction.client, interaction.guild, roleId);
      await interaction.editReply(
        [
          `✅ Готово. Роль: <@&${roleId}>`,
          `Перевірено: **${r.checked}**`,
          `Видано: **${r.given}**`,
          `Пропущено (боти або вже мали роль): **${r.skipped}**`,
          r.failed ? `Не вдалося: **${r.failed}**` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      );
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('setup')
      .setDescription('Налаштувати категорії, ролі та логи бота')
      .addChannelOption((o) =>
        o.setName('категорія').setDescription('Категорія для нових заявок').addChannelTypes(ChannelType.GuildCategory),
      )
      .addChannelOption((o) =>
        o.setName('архів').setDescription('Категорія для прийнятих заявок').addChannelTypes(ChannelType.GuildCategory),
      )
      .addRoleOption((o) => o.setName('рекрутери').setDescription('Роль, яку пінгуємо і яка бачить заявки'))
      .addRoleOption((o) => o.setName('учасник').setDescription('Роль, що видається при схваленні'))
      .addChannelOption((o) =>
        o.setName('логи').setDescription('Канал для логів та транскриптів').addChannelTypes(ChannelType.GuildText),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setDMPermission(false),
    async run(interaction) {
      const patch = {};
      const category = interaction.options.getChannel('категорія');
      const archive = interaction.options.getChannel('архів');
      const recruiters = interaction.options.getRole('рекрутери');
      const member = interaction.options.getRole('учасник');
      const logs = interaction.options.getChannel('логи');

      if (category) patch.ticketCategoryId = category.id;
      if (archive) patch.archiveCategoryId = archive.id;
      if (recruiters) patch.recruiterRoleId = recruiters.id;
      if (member) patch.memberRoleId = member.id;
      if (logs) patch.logChannelId = logs.id;

      if (Object.keys(patch).length) saveConfig(patch);

      const show = (id, kind) => (id ? (kind === 'role' ? `<@&${id}>` : `<#${id}>`) : '`не задано`');
      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle('⚙️ Налаштування бота')
        .setDescription(Object.keys(patch).length ? 'Збережено у `config.json`.' : 'Нічого не передано — показую поточні.')
        .addFields(
          { name: 'Категорія заявок', value: show(config.ticketCategoryId), inline: true },
          { name: 'Архів', value: show(config.archiveCategoryId), inline: true },
          { name: 'Логи', value: show(config.logChannelId), inline: true },
          { name: 'Рекрутери', value: show(config.recruiterRoleId, 'role'), inline: true },
          { name: 'Роль учасника', value: show(config.memberRoleId, 'role'), inline: true },
          { name: 'Форм у наборі', value: String(config.forms.length), inline: true },
        );
      await interaction.reply({ embeds: [embed], ...EPHEMERAL });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('apply')
      .setDescription('Подати заявку до клану без панелі')
      .setDMPermission(false),
    async run(interaction) {
      if (!config.forms.length) {
        await interaction.reply({ content: '⚠️ Набір зараз не налаштовано.', ...EPHEMERAL });
        return;
      }
      await interaction.reply({ content: 'Обери тип заявки:', components: formPicker(), ...EPHEMERAL });
    },
  },

  {
    data: new SlashCommandBuilder()
      .setName('ticket')
      .setDescription('Керування відкритою заявкою')
      .addSubcommand((s) =>
        s
          .setName('close')
          .setDescription('Закрити заявку та вивантажити транскрипт')
          .addStringOption((o) => o.setName('причина').setDescription('Причина закриття').setMaxLength(400)),
      )
      .addSubcommand((s) =>
        s
          .setName('add')
          .setDescription('Додати учасника до каналу заявки')
          .addUserOption((o) => o.setName('учасник').setDescription('Кого додати').setRequired(true)),
      )
      .addSubcommand((s) =>
        s
          .setName('remove')
          .setDescription('Прибрати учасника з каналу заявки')
          .addUserOption((o) => o.setName('учасник').setDescription('Кого прибрати').setRequired(true)),
      )
      .addSubcommand((s) => s.setName('info').setDescription('Показати дані по заявці'))
      .setDMPermission(false),
    async run(interaction) {
      const ticket = getTicket(interaction.channelId);
      if (!ticket) {
        await interaction.reply({ content: '⚠️ Це не канал заявки.', ...EPHEMERAL });
        return;
      }
      const form = getForm(ticket.formId);
      const staff = isStaff(interaction.member, form);
      const sub = interaction.options.getSubcommand();

      if (sub === 'close') {
        if (!staff && interaction.user.id !== ticket.userId) {
          await interaction.reply({ content: '⛔ Закрити може лише рекрутер або автор заявки.', ...EPHEMERAL });
          return;
        }
        await closeTicket(interaction, ticket, { reason: interaction.options.getString('причина') ?? '' });
        return;
      }

      if (sub === 'info') {
        const embed = new EmbedBuilder()
          .setColor(config.colors.primary)
          .setTitle(`ℹ️ Заявка #${String(ticket.number).padStart(4, '0')}`)
          .addFields(
            { name: 'Кандидат', value: `<@${ticket.userId}> (\`${ticket.userTag}\`)`, inline: true },
            { name: 'Тип', value: form?.label ?? ticket.formId, inline: true },
            { name: 'Статус', value: ticket.status, inline: true },
            { name: 'Створена', value: `<t:${Math.floor(ticket.createdAt / 1000)}:f>`, inline: true },
            { name: 'В роботі у', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : '—', inline: true },
          );
        await interaction.reply({ embeds: [embed], ...EPHEMERAL });
        return;
      }

      if (!staff) {
        await interaction.reply({ content: '⛔ Лише для рекрутерів.', ...EPHEMERAL });
        return;
      }

      const target = interaction.options.getUser('учасник');
      if (sub === 'add') {
        await interaction.channel.permissionOverwrites.edit(target.id, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
        await interaction.reply({ content: `➕ <@${target.id}> доданий до заявки.` });
      } else {
        await interaction.channel.permissionOverwrites.delete(target.id).catch(() => {});
        await interaction.reply({ content: `➖ <@${target.id}> прибраний із заявки.` });
      }
    },
  },
];

export const commandMap = new Map(commands.map((c) => [c.data.name, c]));
export const commandData = commands.map((c) => c.data.toJSON());
