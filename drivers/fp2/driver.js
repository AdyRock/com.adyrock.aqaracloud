'use strict';

const { OAuth2Driver } = require('../../lib/homey-oauth2app');

class MyDriver extends OAuth2Driver
{

    /**
     * onInit is called when the driver is initialized.
     */
    async onOAuth2Init()
    {
        this.log('MyDriver has been initialized');
    }

    /**
     * onPairListDevices is called when a user is adding a device
     * and the 'list_devices' view is called.
     * This should return an array with the data of devices that are available for pairing.
     */
    async onPairListDevices({ oAuth2Client })
    {
        const things = await oAuth2Client.getThings();
        if (things && things.result && things.result.data)
        {
            return things.result.data.filter((device) => device.model === 'lumi.motion.agl001').map((thing) =>
            {
                return {
                    name: thing.deviceName,
                    data:
                    {
                        id: thing.did,
                    },
                };
            });
        }
        if (things.message !== 'Success')
        {
            throw new Error(things.message);
        }
        return [];
    }

}

module.exports = MyDriver;
