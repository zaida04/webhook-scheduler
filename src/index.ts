import { Client, Collection, Constants, WebhookClient } from "discord.js";
import { Event, PrismaClient } from "@prisma/client";
import fetch from "node-fetch";
import parse from "parse-duration";
import "dotenv/config";
["PREFIX", "DISCORD_TOKEN"].forEach(x => {
    if(!process.env[x]) throw new Error(`Missing env var ${x}`);
});

const client = new Client({
    intents: [
        "GUILDS",
        "GUILD_MESSAGES",
        "GUILD_WEBHOOKS"
    ]
});
const db = new PrismaClient();
const prefix = process.env.PREFIX!;
const timeouts = new Collection<number, NodeJS.Timeout>();

process.on("exit", () => db.$disconnect());

client.on(Constants.Events.CLIENT_READY, () => {
    console.log("Ready!");

    const eventSweeper = async () => {
        const events = await db.event.findMany({
            "where": {
                "time": {
                    "gte": new Date(),
                    "lte": new Date(Date.now() + 1.8e+6)
                },
                "expired": false
            }
        });

        for(const event of events) {
            if(timeouts.has(event.id) || event.expired) continue;
            const timeout = event.time.getTime() - Date.now();
            timeouts.set(event.id, setTimeout(() => {
                registerEventForRemoval(event);
            }, timeout < 1 ? 10000 : timeout));
        }
    }
    eventSweeper()
    setInterval(eventSweeper, 1.8e+6);
});

client.on(Constants.Events.MESSAGE_CREATE, async (msg) => {
    if(msg.author.bot || !msg.content.startsWith(prefix)) return void 0;
    const [command, ...args] = msg.content.slice(prefix.length).split(" ");

    switch(command) {
        case "schedule": {
            const [ time ] = args;
            const file = msg.attachments.first();

            if(!time || !file) {
                msg.channel.send("Error! You must provide a time and a webhook payload in the form of a file attachment.");
                return void 0;
            }
            const combined_time = Date.now() + parse(time);
            const payload = await fetch(file.url).then(x => x.text());
            let parsedPayload;
            let webhook_url;

            try { 
                const temp = JSON.parse(payload);
                parsedPayload = temp.backups[0].messages[0].data;
                webhook_url = temp.backups[0].targets[0].url;
            } catch(e) {
                msg.channel.send(`That is not valid JSON. Please make sure it looks like
                \`\`\`  
                {
                    content: "This is stuff",
                    embeds: [
                        {
                            ...
                        },
                        {
                            ...
                        }
                    ]
                }
                \`\`\``)
            }

            try {
                const created_event = await db.event.create({
                    "data": {
                        "payload": JSON.stringify(parsedPayload),
                        "time": new Date(combined_time),
                        "expired": false,
                        webhook_url
                    }
                })
                msg.channel.send(`Event scheduled. ID: \`${created_event.id}\``);

                const time_until_expiration = created_event.time.getTime() - Date.now();
                if(time_until_expiration <= 1.8e+6) timeouts.set(created_event.id, setTimeout(() => registerEventForRemoval(created_event), time_until_expiration));
            } catch(e) {
                msg.channel.send("There was an error creating this event.");
                console.log(e);
                return void 0;
            }
            break;
        }
        case "del": {
            const [ id ] = args;
            if(!id || isNaN(id as any)) {
                msg.channel.send("Please provide an ID.");
                return void 0;
            }
            const parsed_id = parseInt(id);
            try {
                await db.event.delete({
                    "where": {
                        id: parsed_id
                    }
                });
                const timeout = timeouts.get(parsed_id)!;
                clearTimeout(timeout);
                timeouts.delete(parsed_id);
            } catch(e) {
                msg.channel.send("There was an error deleting this event. Contact Nico.");
            }
            await msg.channel.send("Successfully deleted event.");
            break;
        }
        case "all": {
            const events = await db.event.findMany({
                "where": {}
            });

            await msg.channel.send(`
                **Events**: \n${events.map(x => `\`${x.id}\` => \`${new Date(x.time).toISOString()}\``).join("\n")}
            `)
            break;
        }
        case "all_setted": {
            await msg.channel.send(`
                **Events**: \n${timeouts.map((_, key) => `\`${key}\``).join("\n")}
            `)
            break;
        }
        default: return void 0;
    }
});

async function registerEventForRemoval(event: Event) {
    const webhook = new WebhookClient({ "url": event.webhook_url });
    try {
        await webhook.send(JSON.parse(event.payload));
        console.log(`Successfully sent webhook ${event.id} by ${event.webhook_url} of content ${event.payload}`)
    } catch(e) {
        console.log(`Failed sending webhook ${event.id} by ${event.webhook_url} of content ${event.payload}`)
    } finally {
        await db.event.update({
            "where": {
                "id": event.id
            },
            "data": {
                "expired": true
            }
        })
    }
}

(() => {
    client.login(process.env.DISCORD_TOKEN);
})();