// src/api/author/services/remote-mail-sender.js
'use strict';

class RemoteMailSender {
    constructor() {
        this.remoteUrl = 'https://hr.visiongroup.co.ug/apis/mail-panel-api/strapi-mail-receiver.php';
    }
    
    async sendTokenEmail(toEmail, token, userName) {
        try {
            const emailData = {
                type: 'verification_token',
                to_email: toEmail,
                token: token,
                user_name: userName,
                subject: 'Your New Vision Editor Verification Code',
                timestamp: new Date().toISOString()
            };

            const result = await this.sendToRemoteMailer(emailData);
            
            return {
                success: true,
                remote_response: result
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async sendToRemoteMailer(data) {
        // Use axios instead of fetch
        const axios = require('axios');
        
        const response = await axios.post(this.remoteUrl, data, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Strapi-Mail-Client/1.0'
            },
            timeout: 30000
        });

        return response.data;
    }
}

module.exports = () => {
    return new RemoteMailSender();
};
