const Discord = require('discord.js');
const config = require('./config.json');
const client = new Discord.Client({ intents: ["DIRECT_MESSAGES","GUILDS","GUILD_MEMBERS","GUILD_MESSAGES","GUILD_WEBHOOKS","GUILD_MESSAGE_REACTIONS"], partials: ["CHANNEL","GUILD_MEMBER","MESSAGE","REACTION","USER"] });
const moment = require('moment');
moment.locale('pt-br')
const fs = require('fs')
const colors = require('colors');
const { channel } = require('diagnostics_channel');

let creatingForms = {}

client.on('ready', async() => {

    if(config.color == "" || config.guildId == "" || config.modParent == ""){
        console.log(colors.red("Você precisa concluir a configuração primeiro!"))
        return setInterval(() => {
            console.log(colors.red("Você precisa concluir a configuração primeiro!"))
        }, 1000)
    }

    console.log(colors.green(`O bot ${colors.blue(client.user.username)} foi logado com sucesso!`))

    const activities = [
        'https://github.com/guilhermesantos0',
        'Mande-me uma mensagem!'
    ];

    let i = 0;
    setInterval(() => client.user.setActivity(`${activities[i++ % activities.length]}`, { type: 'PLAYING' }), 5000)
})

client.on('messageCreate', async (message) => {
    if(message.channel.type == "DM"){
        let guild = client.guilds.cache.get(config.guildId)
        if(guild){
            let guildChannels = await guild.channels.fetch()
            let openTicket;
            guildChannels.forEach(c => {
                if(c.topic == `${message.author.id}`) openTicket = c
            })

            if(openTicket){

                const embed = new Discord.MessageEmbed()
                .setColor('2F3136')
                .setTimestamp(moment(message.createdAt).format('LLL'))

                if(message.content){
                    embed.setDescription(`${message.content}`)
                }else if(message.attachments.size > 0){
                    embed.setDescription(`${message.attachments.map((a) => a.url)}`)
                }

                openTicket.send({ embeds: [embed]})
                message.author.send("Mensagem enviada!").then(msg => setTimeout(() => { if(msg) msg.delete() },5000)).catch((err) => {return})
            } else {

                if(creatingForms[message.author.id]) return
                creatingForms[message.author.id] = true
                const embed = new Discord.MessageEmbed()
                .setColor(config.color)
                .setDescription(`Bom dia, ${message.author.username}!\n\nEu trabalho para o servidor **${guild.name}**!\n> Você deseja conversar com a staff?`)

                const openTicket = new Discord.MessageButton()
                .setCustomId('openTicket')
                .setLabel('✔️ DESEJO!')
                .setStyle("SUCCESS")

                const cancelTicket = new Discord.MessageButton()
                .setCustomId('cancelTicket')
                .setLabel('❌ NÃO DESEJO!')
                .setStyle("DANGER")

                const row = new Discord.MessageActionRow()
                .setComponents(openTicket, cancelTicket)

                message.author.send({ embeds: [embed], components: [row] }).then(msg => {
                    const collector = msg.createMessageComponentCollector({ componentType: "BUTTON", max: 1, time: 60000 })
                    collector.on('collect',async c => {
                        c.deferUpdate()
                        creatingForms[message.author.id] = false
                        if(c.customId == "openTicket"){
                            
                            await guild.channels.create(`${message.author.username}-${message.author.discriminator}`,{
                                type: "GUILD_TEXT",
                                parent: `${config.modParent}`,
                                topic: `${message.author.id}`
                            }).then(channel => {
                                channel.permissionOverwrites.set([
                                    {
                                        id: config.guildId,
                                        deny: [Discord.Permissions.FLAGS.VIEW_CHANNEL],
                                    }
                                ]);
                                
                                const embed = new Discord.MessageEmbed()
                                .setDescription("Clique no botão abaixo quando quiser fechar o ticket!")
                                .setColor(config.color)
                                
                                const button = new Discord.MessageButton()
                                .setCustomId("closeTicket")
                                .setLabel("❌ FECHAR")
                                .setStyle("DANGER")
                                
                                const row = new Discord.MessageActionRow()
                                .setComponents(button)
                                
                                channel.send({ embeds: [embed], components: [row] }).catch((err) => console.log(err))
                                msg.edit({ content: "Já abri seu ticket! Mande aqui sua mensagem, te avisarei quando um moderador responder!", embeds: [], components: [] })

                                fs.readFile('tickets.json','utf8',async(err, data) => {
                                    let tickets = JSON.parse(data)
                                    let ticketData = { "channelId": channel.id, "memberId": message.author.id }
                                    let ticket = new Ticket(ticketData)

                                    await tickets.push(JSON.stringify(ticket))
                                    console.log(tickets)
                                    fs.writeFile(
                                        'tickets.json',
                                        JSON.stringify(tickets), 
                                        function(err) {if(err) console.log(err)}
                                    )
                                })
                            })
                        }else if(c.customId == "cancelTicket"){
                            await msg.delete()
                            await message.author.send("OK! Cancelei a criação do ticket! Se quiser abrir um, só me mandar uma mensagem!").then(msg => setTimeout(() => { if(msg) msg.delete() })).catch((err) => {return})
                        }
                    })
                    collector.on('end',c => {
                        if(c.size == 0){
                            msg.delete()
                        }
                    })
                }).catch((err) => {return})
            }
        }
    }else {
        if(message.guild.id == config.guildId){
            fs.readFile('tickets.json','utf8',async (err, data) => {
                let tickets = JSON.parse(data)
                tickets.forEach(async (ticket) => {
                    if(message.channel.id == JSON.parse(ticket).channelId){
                        let guildMembers = await message.guild.members.fetch()
                        let member = await guildMembers.get(JSON.parse(ticket).memberId)
                        
                        const embed = new Discord.MessageEmbed()
                        .setColor("2F3136")
                        .setTimestamp(moment(message.createdAt).format('LLL'))

                        if(message.content){
                            embed.setDescription(`${message.content}`)
                        }else if(message.attachments.size > 0){
                            embed.setDescription(`${message.attachments.map((a) => a.url)}`)
                        }

                        member.user.send({ embeds: [embed] }).catch((err) => {return})
                    }
                })
            })
        }
    }
})

client.on('interactionCreate',async(interaction) => {
    if(interaction.isButton){
        interaction.deferUpdate()
        if(interaction.customId == "closeTicket"){
            fs.readFile('tickets.json','utf8', async(err, data) => {
                let tickets = JSON.parse(data)
                tickets.forEach(async (ticket) => {
                    if(interaction.message.channel.id == JSON.parse(ticket).channelId){
                        let index = getItemIndex(ticket, tickets)
                        if(index){
                            await tickets.splice(index, 1)

                            fs.writeFile(
                                'tickets.json',
                                JSON.stringify(tickets), 
                                function(err) {if(err) console.log(err)}
                            )
                        }
                    }
                })
            })
            interaction.channel.delete()
        }
    }
})

client.on('channelDelete', async(channel) => {
    fs.readFile('tickets.json','utf8', async(err, data) => {
        let tickets = JSON.parse(data)
        tickets.forEach(async (ticket) => {
            if(channel.id == JSON.parse(ticket).channelId){
                let index = getItemIndex(ticket, tickets)
                if(index){
                    await tickets.splice(index, 1)

                    fs.writeFile(
                        'tickets.json',
                        JSON.stringify(tickets), 
                        function(err) {if(err) console.log(err)}
                    )
                }
            }
        })
    })
})

class Ticket {

    constructor(options){

        this.channelId = options.channelId

        this.memberId = options.memberId

    }
}

function getItemIndex(item, array){
    for(let [k,v] of Object.entries(array)){
        if(v == item){
            return k
        }
    }
    return null
}

client.login(config.token)