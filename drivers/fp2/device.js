'use strict';

const { OAuth2Device } = require('../../lib/homey-oauth2app');

class MyDevice extends OAuth2Device
{

    /**
     * onInit is called when the device is initialized.
     */
    async onOAuth2Init()
    {
        this.log('MyDevice has been initialized');
        if (this.oAuth2Client)
        {
            const dd = this.getData();
            const attributes = await this.oAuth2Client.getAttributes(dd.id, ['0.4.85', '3.51.85']);
            if (attributes && attributes.result)
            {
                this.log('resources', attributes);
                for (const attribute of attributes.result)
                {
                    if (attribute.resourceId === '0.4.85')
                    {
                        this.setCapabilityValue('measure_luminance', parseInt(attribute.value, 10));
                    }
                   else if (attribute.resourceId === '3.51.85')
                    {
                        this.setCapabilityValue('alarm_motion', attribute.value === '1');
                    }
                }
            }
            else if (attributes && attributes.code && attributes.code === 108)
            {
                return;
            }

            const subscribed = await this.oAuth2Client.subscribe(dd.id, ['0.4.85', '3.51.85']);
            this.log('subscribe', subscribed);
        }
    }

    /**
     * onAdded is called when the user adds the device, called just after pairing.
     */
    async onAdded()
    {
        this.log('MyDevice has been added');
    }

    /**
     * onSettings is called when the user updates the device's settings.
     * @param {object} event the onSettings event data
     * @param {object} event.oldSettings The old settings object
     * @param {object} event.newSettings The new settings object
     * @param {string[]} event.changedKeys An array of keys changed since the previous version
     * @returns {Promise<string|void>} return a custom message that will be displayed
     */
    async onSettings({ oldSettings, newSettings, changedKeys })
    {
        this.log('MyDevice settings where changed');
    }

    /**
     * onRenamed is called when the user updates the device's name.
     * This method can be used this to synchronise the name to the device.
     * @param {string} name The new name
     */
    async onRenamed(name)
    {
        this.log('MyDevice was renamed');
    }

    /**
     * onDeleted is called when the user deleted the device.
     */
    async onOAuth2Deleted()
    {
        this.log('MyDevice has been deleted');
    }

    async processWebhookMessage(message)
    {
        if (this.oAuth2Client && message.data)
        {
            const token = this.oAuth2Client.getToken();
            if (token.openId === message.openId)
            {
                const dd = this.getData();
                for (const data of message.data)
                {
                    if (dd.id === data.subjectId)
                    {
                        if (data.resourceId === '0.4.85')
                        {
                            this.setCapabilityValue('measure_luminance', parseInt(data.value, 10));
                        }
                       else if (data.resourceId === '3.51.85')
                        {
                            this.setCapabilityValue('alarm_motion', data.value === '1');
                        }
                    }
                }
            }
        }
    }

}

module.exports = MyDevice;
