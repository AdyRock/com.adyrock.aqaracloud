'use strict';

const CryptoJS = require('crypto-js');
const Homey = require('homey');
const { OAuth2Client, OAuth2Error } = require('./homey-oauth2app');
const { OAuth2Token } = require('./homey-oauth2app');

module.exports = class AqaraOAuth2Client extends OAuth2Client
{

    // Required:
    // static API_URL = 'https://open-cn.aqara.com/v3.0/open/api';
    // static TOKEN_URL = 'https://open-cn.aqara.com/v3.0/open/access_token';
    // static AUTHORIZATION_URL = 'https://open-cn.aqara.com/v3.0/open/authorize';
    // static SCOPES = ['my_scope'];

    // Optional:
    static TOKEN = OAuth2Token; // Default: OAuth2Token
    static REDIRECT_URL = 'https://callback.athom.com/oauth2/callback'; // Default: 'https://callback.athom.com/oauth2/callback'

    // Overload what needs to be overloaded here

    async onHandleNotOK({ body })
    {
        throw new OAuth2Error(body.error);
    }

    getHeaders()
    {
        const Time = Math.round(new Date().getTime());
        const Nonce = Math.round(new Date().getTime());
        const Accesstoken = this.getToken();
        const AppId = Homey.env[this._configId].CLIENT_ID;
        const AppKey = Homey.env[this._configId].CLIENT_SECRET;
        const KeyId = Homey.env[this._configId].KEY_ID;

        let preSign = '';
        if (Accesstoken && Accesstoken.access_token != null && Accesstoken.access_token !== '' && Accesstoken.access_token !== undefined)
        {
            preSign = `Accesstoken=${Accesstoken.access_token}&`;
        }

        preSign = `${preSign}Appid=${AppId}&Keyid=${KeyId}&Nonce=${Nonce}&Time=${Time}${AppKey}`;
        const Sign = CryptoJS.MD5(preSign.toLowerCase()).toString();

        return {
            AppId,
            Accesstoken: Accesstoken.access_token,
            KeyId,
            Time,
            Nonce,
            Sign,
            Lang: 'en',
        };
    }

    async getThings()
    {
//        const headers = this.getHeaders();
        return this.post(
        {
            path: '',
//            headers,
            json:
            {
                intent: 'query.device.info',
                data:
                {
                    positionId: '',
                    pageNum: 1,
                    pageSize: 50,
                },
            },
        },
);
    }

    // resourcedId = [resources id']
    // subjectId = device ID
    async getAttributes(subjectId, resourcedId)
    {
//        const headers = this.getHeaders();
        return this.post(
        {
            path: '',
//            headers,
            json:
            {
                intent: 'query.resource.value',
                data:
                {
                    resources: [
                        {
                            subjectId,
                            options: resourcedId,
                        },
                    ],
                },
            },
        },
);
    }

    // resourcedId = [resources id']
    // subjectId = device ID
    async subscribe(subjectId, resourcedId)
    {
//        const headers = this.getHeaders();
        return this.post(
        {
            path: '',
//            headers,
            json:
            {
                intent: 'config.resource.subscribe',
                data:
                {
                    resources: [
                        {
                            subjectId,
                            resourceIds: resourcedId,
                        },
                    ],
                },
            },
        },
);
    }

    async updateThing({ id, thing })
    {
        return this.put(
        {
            path: `/thing/${id}`,
            json: { thing },
        },
);
    }

};
