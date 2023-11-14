'use strict';

if (process.env.DEBUG === '1')
{
    // eslint-disable-next-line node/no-unsupported-features/node-builtins, global-require
    require('inspector').open(9224, '0.0.0.0', true);
}
const http = require('http');
const https = require('https');

const Homey = require('homey');
const { OAuth2App } = require('./lib/homey-oauth2app');
const AqaraOAuth2Client = require('./lib/AqaraOAuth2Client');

module.exports = class MyApp extends OAuth2App
{

    static OAUTH2_CLIENT = AqaraOAuth2Client; // Default: OAuth2Client
    static OAUTH2_DEBUG = true; // Default: false
    static OAUTH2_MULTI_SESSION = false; // Default: false
    static OAUTH2_DRIVERS = ['fp2']; // Default: all drivers

    /**
     * onInit is called when the app is initialized.
     */
    async onOAuth2Init()
    {
        this.doWebhookReg();
        this.runsListener();
        this.log('MyApp has been initialized');
    }

    async doWebhookReg()
    {
        try
        {
            const sessions = this.getSavedOAuth2Sessions();
            if (Object.keys(sessions).length < 1)
            {
                // Try again later
                if (!this.webRegTimerID)
                {
                    this.webRegTimerID = this.homey.setTimeout(() => this.doWebhookReg(), 2000);
                }
                return;
            }

            const keys = [];
            for (const configId of Object.values(sessions))
            {
                keys.push(configId.token.openId);
            }

            const data = {
                $keys: keys,
            };

            // Setup the webhook call back to receive push notifications
            const id = Homey.env.WEBHOOK_ID;
            const secret = Homey.env.WEBHOOK_SECRET;

            if (this.homeyWebhook)
            {
                // Unregister the existing webhook
                await this.homeyWebhook.unregister();
                this.homeyWebhook = null;
            }

            this.homeyWebhook = await this.homey.cloud.createWebhook(id, secret, data);

            this.homeyWebhook.on('message', async (args) =>
            {
                try
                {
                    await this.processWebhookMessage(args.body);
                }
                catch (err)
                {
                    this.updateLog(`Homey Webhook message error: ${err.message}`, 0);
                }
            });

            this.updateLog(`Homey Webhook registered for devices ${this.homey.app.varToString(data)}`);
        }
        catch (err)
        {
            // Try again later
            if (!this.webRegTimerID)
            {
                this.webRegTimerID = this.homey.setTimeout(() => this.doWebhookReg(), 2000);
            }
        }
    }

    async processWebhookMessage(message)
    {
        const drivers = this.homey.drivers.getDrivers();
        for (const driver of Object.values(drivers))
        {
            const devices = driver.getDevices();
            for (const device of Object.values(devices))
            {
                try
                {
                    await device.processWebhookMessage(message);
                }
                catch (err)
                {
                    this.updateLog(`Error processing webhook message! ${this.varToString(err)}`, 0);
                }
            }
        }
    }

    // Convert a variable of any type (almost) to a string
    varToString(source)
    {
        try
        {
            if (source === null)
            {
                return 'null';
            }
            if (source === undefined)
            {
                return 'undefined';
            }
            if (source instanceof Error)
            {
                const stack = source.stack.replace('/\\n/g', '\n');
                return `${source.message}\n${stack}`;
            }
            if (typeof (source) === 'object')
            {
                const getCircularReplacer = () =>
                {
                    const seen = new WeakSet();
                    return (key, value) =>
                    {
                        if (typeof value === 'object' && value !== null)
                        {
                            if (seen.has(value))
                            {
                                return '';
                            }
                            seen.add(value);
                        }
                        return value;
                    };
                };

                return JSON.stringify(source, getCircularReplacer(), 2);
            }
            if (typeof (source) === 'string')
            {
                return source;
            }
        }
        catch (err)
        {
            this.updateLog(`VarToString Error: ${err.message}`);
        }

        return source.toString();
    }

    // Add a message to the debug log if not running in the cloud
    updateLog(newMessage, errorLevel = 1)
    {
        this.log(newMessage);
        if (errorLevel === 0)
        {
            this.error(newMessage);
        }

        if ((errorLevel === 0) || this.homey.settings.get('logEnabled'))
        {
            try
            {
                const nowTime = new Date(Date.now());

                this.diagLog += '\r\n* ';
                this.diagLog += nowTime.toJSON();
                this.diagLog += '\r\n';

                this.diagLog += newMessage;
                this.diagLog += '\r\n';
                if (this.diagLog.length > 60000)
                {
                    this.diagLog = this.diagLog.substr(this.diagLog.length - 60000);
                }

                if (!this.cloudOnly)
                {
                    this.homey.api.realtime('com.linktap.logupdated', { log: this.diagLog });
                }
            }
            catch (err)
            {
                this.log(err);
            }
        }
    }

    async postMessage(body)
    {
        return new Promise((resolve, reject) =>
        {
            const httpsOptions = {
                host: 'webhooks.athom.com',
                path: '/webhook/6473e29e3b64ce0be36639a9',
                method: 'POST',
                headers:
                {
                    'Content-type': 'application/json',
                    'Content-Length': body.length,
                },
            };
            const req = https.request(httpsOptions, (resp) =>
            {
                let returnData = '';
                resp.on('data', (chunk) =>
                {
                    returnData += chunk;
                });
                resp.on('end', () =>
                {
                    this.log(returnData);
                    resolve(returnData);
                });
            });
            req.write(body);
            req.end();
        });
    }

    async runsListener()
    {
        const requestListener = (request, response) =>
        {
            let body = '';
            request.on('data', (chunk) =>
            {
                body += chunk.toString(); // convert Buffer to string
            });
            request.on('end', () =>
            {
                this.log('Webhook message ', body);
                response.writeHead(200);
                response.end("{'code':0}");
                try
                {
                    this.postMessage(body);
                    // this.processWebhookMessage(JSON.parse(body));
                }
                catch (err)
                {
                    this.updateLog(`Webhook message error ${err}`, 0);
                }
            });
        };

        this.server = http.createServer(requestListener);
        this.server.on('error', (e) =>
        {
            if (e.code === 'EADDRINUSE')
            {
                this.updateLog(`Server port ${5555} in use, retrying in 10 seconds`, 0);
                setTimeout(() =>
                {
                    this.server.close();
                    this.server.listen(5555);
                }, 10000);
            }
        });

        try
        {
            this.server.listen(5555);
        }
        catch (err)
        {
            this.log(err);
        }
    }

};
